"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Plus, Search, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { apiRequest } from "@/lib/api";
import { getCustomers } from "@/services/customerService";
import { createOrder } from "@/services/orderService";
import { getProductVariantsById } from "@/services/productService";
import { formatPKR } from "@/lib/utils";

const emptyItem = () => ({ productId: "", variantId: "", quantity: "1" });

export default function CreateOrderButton() {
  const router = useRouter();
  const submissionLock = useRef(false);
  const idempotencyKey = useRef("");
  const [open, setOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loadingVariants, setLoadingVariants] = useState({});
  const [variantErrors, setVariantErrors] = useState({});
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState("0");
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedCustomer = customers.find(
    (customer) => String(customer._id || customer.id) === customerId
  );
  const matchingCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.phone || ""} ${customer.city || ""}`
      .toLowerCase()
      .includes(customerSearch.trim().toLowerCase())
  );
  const estimatedItems = items.map((item) => {
    const product = products.find(
      (entry) => String(entry._id) === item.productId
    );
    const variant = (variantsByProduct[item.productId] || []).find(
      (entry) => String(entry._id || entry.id) === item.variantId
    );
    const unitPrice = variant ? Number(variant.price) : Number(product?.price);
    const quantity = Number(item.quantity);
    return {
      product,
      variant,
      quantity,
      unitPrice,
      lineTotal:
        Number.isFinite(unitPrice) && Number.isFinite(quantity)
          ? unitPrice * quantity
          : 0,
    };
  });
  const estimatedSubtotal = estimatedItems.reduce(
    (total, item) => total + item.lineTotal,
    0
  );
  const estimatedDiscount = Number(discount) || 0;
  const estimatedDelivery = Number(deliveryCharges) || 0;
  const estimatedTotal =
    estimatedSubtotal - estimatedDiscount + estimatedDelivery;

  async function openForm() {
    setOpen(true);
    setLoadingData(true);
    setLoadError("");
    setFormError("");
    setSuccessMessage("");
    idempotencyKey.current = globalThis.crypto.randomUUID();
    setVariantsByProduct({});
    setLoadingVariants({});
    setVariantErrors({});
    try {
      const [customerResponse, productResponse] = await Promise.all([
        getCustomers(apiRequest),
        apiRequest("products"),
      ]);
      if (customerResponse.error) throw customerResponse.error;
      setCustomers(customerResponse.customers || []);
      setProducts((productResponse.products || []).filter((product) => product.status === "active"));
      setCustomerId("");
      setCustomerSearch("");
      setItems([emptyItem()]);
    } catch (error) {
      setLoadError(error.message || "Could not load customers and products.");
      setCustomers([]);
      setProducts([]);
    } finally {
      setLoadingData(false);
    }
  }

  function updateItem(index, changes) {
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...changes } : item
    ));
  }

  async function handleProductSelection(index, productId) {
    updateItem(index, { productId, variantId: "" });
    setFormError("");
    if (!productId) return;

    const product = products.find((entry) => String(entry._id) === productId);
    if (
      !product?.hasVariants ||
      variantsByProduct[productId] ||
      loadingVariants[productId]
    ) {
      return;
    }

    setLoadingVariants((current) => ({ ...current, [productId]: true }));
    setVariantErrors((current) => ({ ...current, [productId]: "" }));
    const { variants, error } = await getProductVariantsById(productId);
    setLoadingVariants((current) => ({ ...current, [productId]: false }));

    if (error) {
      setVariantErrors((current) => ({
        ...current,
        [productId]: error.message || "Could not load product variants.",
      }));
      return;
    }

    setVariantsByProduct((current) => ({ ...current, [productId]: variants }));
  }

  function combineDuplicateItem(index, changes) {
    setItems((current) => {
      const selectedItem = { ...current[index], ...changes };
      const product = products.find(
        (entry) => String(entry._id) === selectedItem.productId
      );
      const requiresVariant =
        product?.hasVariants &&
        (variantsByProduct[selectedItem.productId] || []).length > 0;
      if (
        !selectedItem.productId ||
        (requiresVariant && !selectedItem.variantId)
      ) {
        return current.map((item, itemIndex) =>
          itemIndex === index ? selectedItem : item
        );
      }

      const duplicateIndex = current.findIndex(
        (item, itemIndex) =>
          itemIndex !== index &&
          item.productId === selectedItem.productId &&
          (item.variantId || "") === (selectedItem.variantId || "")
      );
      if (duplicateIndex < 0) {
        return current.map((item, itemIndex) =>
          itemIndex === index ? selectedItem : item
        );
      }

      const combined = current.map((item, itemIndex) => {
        if (itemIndex === duplicateIndex) {
          return {
            ...item,
            quantity: String(
              Number(item.quantity || 0) + Number(selectedItem.quantity || 0)
            ),
          };
        }
        return item;
      });
      return combined.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function handleVariantSelection(index, variantId) {
    combineDuplicateItem(index, { variantId });
    setFormError("");
  }

  function getSelectedProduct(item) {
    return products.find((entry) => String(entry._id) === item.productId);
  }

  function getSelectedVariant(item) {
    return (variantsByProduct[item.productId] || []).find(
      (entry) => String(entry._id || entry.id) === item.variantId
    );
  }

  function getItemStock(item) {
    const variant = getSelectedVariant(item);
    const product = getSelectedProduct(item);
    if (variant) return Number(variant.stock);
    if (product && !product.hasVariants) return Number(product.stock);
    return undefined;
  }

  function validate() {
    if (!customerId) return "Select a customer before creating the order.";
    if (
      !customers.some(
        (customer) => String(customer._id || customer.id) === customerId
      )
    ) {
      return "That customer is no longer available. Reopen the form and select a customer again.";
    }
    if (items.length === 0) return "Add at least one product.";

    const requestedQuantities = new Map();
    for (const item of items) {
      const product = products.find((entry) => String(entry._id) === item.productId);
      const quantity = Number(item.quantity);
      if (!product) return "A selected product is no longer available. Reopen the form and select it again.";
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return "Each product quantity must be a positive whole number.";
      }

      const variants = variantsByProduct[item.productId] || [];
      if (product.hasVariants && loadingVariants[item.productId]) {
        return `Wait for the variants for ${product.name} to load.`;
      }
      if (product.hasVariants && variantErrors[item.productId]) {
        return `Could not load variants for ${product.name}. Retry by selecting the product again.`;
      }
      const activeVariants = variants.filter(
        (variant) => variant.status === "active"
      );
      if (product.hasVariants && variants.length > 0 && activeVariants.length === 0) {
        return `${product.name} has no active variants available.`;
      }
      if (product.hasVariants && variants.length > 0 && !item.variantId) {
        return `Select a variant for ${product.name}.`;
      }

      const variant = item.variantId
        ? variants.find((entry) => String(entry._id || entry.id) === item.variantId)
        : null;
      if (item.variantId && (!variant || variant.status !== "active")) {
        return `The selected variant for ${product.name} is no longer available.`;
      }

      const stock = variant ? Number(variant.stock) : Number(product.stock);
      const quantityKey = `${item.productId}:${item.variantId || ""}`;
      requestedQuantities.set(
        quantityKey,
        {
          product,
          variant,
          quantity: (requestedQuantities.get(quantityKey)?.quantity || 0) + quantity,
          stock,
        }
      );
    }

    for (const { product, variant, quantity, stock } of requestedQuantities.values()) {
      if (quantity > stock) {
        const variantLabel = variant
          ? [variant.size, variant.color].filter(Boolean).join(" / ")
          : "";
        return `Only ${stock} units of ${product.name}${
          variantLabel ? ` (${variantLabel})` : ""
        } are currently in stock.`;
      }
    }

    for (const [label, value] of [["Discount", discount], ["Delivery charges", deliveryCharges]]) {
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        return `${label} must be a non-negative amount.`;
      }
    }
    if (Number(discount || 0) > estimatedSubtotal) {
      return "Discount cannot exceed the estimated subtotal.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submissionLock.current) return;
    setFormError("");
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    try {
      const { order, error } = await createOrder({
        customerId,
        items: items.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: Number(item.quantity),
        })),
        discount: Number(discount || 0),
        deliveryCharges: Number(deliveryCharges || 0),
        paymentMethod,
        notes: notes.trim(),
      }, idempotencyKey.current);

      if (error) {
        setFormError(error.message || "Could not create the order.");
        return;
      }

      setOpen(false);
      idempotencyKey.current = "";
      setSuccessMessage(`Order ${order.order_number} created successfully.`);
      router.refresh();
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={openForm}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        New order
      </Button>

      {successMessage && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}

      <Modal open={open} title="Create order" onClose={() => !submitting && setOpen(false)}>
        {loadingData ? (
          <p role="status" className="py-6 text-center text-sm text-ink-500">
            Loading customers and products…
          </p>
        ) : loadError ? (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-red-700">{loadError}</p>
            <Button type="button" variant="secondary" onClick={openForm}>Retry</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}

            {customers.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                Add a customer before creating an order. <Link className="font-medium underline" href="/dashboard/customers">Go to customers</Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="order-customer-search" required>
                  Customer
                </Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="order-customer-search"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search by name, phone or city"
                    className="pl-9"
                    disabled={submitting}
                  />
                </div>
                <Select
                  id="order-customer"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  disabled={submitting}
                  aria-label="Select customer"
                >
                  <option value="">Select a customer</option>
                  {matchingCustomers.map((customer) => {
                    const id = String(customer._id || customer.id);
                    return (
                      <option key={id} value={id}>
                        {customer.name} · {customer.phone || "No phone"} ·{" "}
                        {customer.city || "No city"}
                      </option>
                    );
                  })}
                </Select>
                {matchingCustomers.length === 0 && (
                  <p className="text-sm text-ink-500">
                    No customers match that search.
                  </p>
                )}
                {!customerId && (
                  <p className="text-xs text-ink-500">
                    Select a customer to continue with this order.
                  </p>
                )}
                {selectedCustomer && (
                  <div className="flex items-start gap-2 rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-400"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium text-ink-900">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {selectedCustomer.phone || "No phone"}
                        {selectedCustomer.city
                          ? ` · ${selectedCustomer.city}`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {products.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                Add an active product before creating an order. <Link className="font-medium underline" href="/dashboard/products/new">Add product</Link>
              </div>
            ) : (
              <fieldset disabled={submitting} className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-ink-700">Products</legend>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-end gap-2">
                    <div>
                      {index === 0 && <Label htmlFor={`order-product-${index}`} required>Product</Label>}
                      <Select
                        id={`order-product-${index}`}
                        value={item.productId}
                        onChange={(event) => {
                          const productId = event.target.value;
                          handleProductSelection(index, productId);
                          if (productId) {
                            const selected = products.find(
                              (product) => String(product._id) === productId
                            );
                            if (!selected?.hasVariants) {
                              combineDuplicateItem(index, {
                                productId,
                                variantId: "",
                              });
                            }
                          }
                        }}
                        aria-label={`Product ${index + 1}`}
                      >
                        <option value="">Select product</option>
                        {products.map((product) => {
                          const activeVariants = (product.variants || []).filter(
                            (variant) =>
                              variant.status === "active" &&
                              Number(variant.stock) > 0
                          );
                          const hasAvailableStock = product.hasVariants
                            ? activeVariants.length > 0
                            : Number(product.stock) > 0;
                          return (
                          <option key={product._id} value={String(product._id)} disabled={!hasAvailableStock}>
                            {product.name} · stock {product.stock}
                          </option>
                          );
                        })}
                      </Select>
                      {(() => {
                        const selectedProduct = products.find(
                          (product) => String(product._id) === item.productId
                        );
                        const variants = (
                          variantsByProduct[item.productId] || []
                        ).filter((variant) => variant.status === "active");

                        if (!selectedProduct?.hasVariants) {
                          return null;
                        }

                        if (loadingVariants[item.productId]) {
                          return (
                            <p role="status" className="mt-2 text-xs text-ink-500">
                              Loading available variants…
                            </p>
                          );
                        }

                        if (variantErrors[item.productId]) {
                          return (
                            <p role="alert" className="mt-2 text-xs text-red-600">
                              {variantErrors[item.productId]}
                            </p>
                          );
                        }

                        if (variants.length === 0) {
                          return (
                            <p className="mt-2 text-xs text-amber-700">
                              This product has no active variants available.
                            </p>
                          );
                        }

                        return (
                          <div className="mt-2">
                            {index === 0 && (
                              <Label htmlFor={`order-variant-${index}`} required>
                                Variant
                              </Label>
                            )}
                            <Select
                              id={`order-variant-${index}`}
                              value={item.variantId}
                              onChange={(event) =>
                                handleVariantSelection(index, event.target.value)
                              }
                              aria-label={`Variant ${index + 1}`}
                            >
                              <option value="">Select size or color</option>
                              {variants.map((variant) => {
                                const variantId = String(variant._id || variant.id);
                                const label =
                                  [variant.size, variant.color]
                                    .filter(Boolean)
                                    .join(" / ") || "Standard";
                                return (
                                  <option
                                    key={variantId}
                                    value={variantId}
                                    disabled={Number(variant.stock) < 1}
                                  >
                                    {label} · {variant.stock} in stock
                                  </option>
                                );
                              })}
                            </Select>
                            {item.variantId && (() => {
                              const variant = variants.find(
                                (entry) =>
                                  String(entry._id || entry.id) === item.variantId
                              );
                              if (!variant) return null;
                              return (
                                <div className="mt-2 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
                                  <p>
                                    SKU:{" "}
                                    <span className="font-mono">
                                      {variant.sku || "—"}
                                    </span>{" "}
                                    · {variant.stock} available
                                  </p>
                                  <p className="mt-1 font-medium text-ink-900">
                                    {formatPKR(variant.price)} each · line total{" "}
                                    {formatPKR(
                                      Number(variant.price) *
                                        (Number(item.quantity) || 0)
                                    )}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      {item.productId &&
                        !products.find(
                          (product) => String(product._id) === item.productId
                        )?.hasVariants &&
                        (() => {
                          const product = products.find(
                            (entry) => String(entry._id) === item.productId
                          );
                          return (
                            <p className="mt-2 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
                              {formatPKR(product?.price)} each ·{" "}
                              {product?.stock ?? 0} available · line total{" "}
                              {formatPKR(
                                Number(product?.price) *
                                  (Number(item.quantity) || 0)
                              )}
                            </p>
                          );
                        })()}
                    </div>
                    <div>
                      {index === 0 && <Label htmlFor={`order-quantity-${index}`} required>Qty</Label>}
                      <Input
                        id={`order-quantity-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        max={getItemStock(item)}
                        value={item.quantity}
                        onChange={(event) => updateItem(index, { quantity: event.target.value })}
                        aria-label={`Quantity for product ${index + 1}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={submitting || items.length === 1}
                      className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove product ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="secondary"                 onClick={() => setItems((current) => [...current, emptyItem()])}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add product
                </Button>
              </fieldset>
            )}

            <section
              aria-label="Order summary"
              className="rounded-xl border border-ink-100 bg-ink-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Order summary
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {selectedCustomer
                      ? `${selectedCustomer.name} · ${
                          selectedCustomer.phone || "No phone"
                        }${selectedCustomer.city ? ` · ${selectedCustomer.city}` : ""}`
                      : "Select a customer to get started."}
                  </p>
                </div>
                <span className="text-xs font-medium text-ink-500">
                  Estimated
                </span>
              </div>

              {estimatedItems.some((item) => item.product) ? (
                <ul className="mt-3 divide-y divide-ink-200">
                  {estimatedItems.map((item, index) => {
                    if (!item.product) return null;
                    const variantLabel = item.variant
                      ? [item.variant.size, item.variant.color]
                          .filter(Boolean)
                          .join(" / ")
                      : "";
                    return (
                      <li
                        key={`${items[index].productId}-${items[index].variantId}-${index}`}
                        className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">
                            {item.product.name}
                            {variantLabel ? ` · ${variantLabel}` : ""}
                          </p>
                          {item.variant?.sku && (
                            <p className="font-mono text-xs text-ink-500">
                              SKU: {item.variant.sku}
                            </p>
                          )}
                          <p className="text-xs text-ink-500">
                            {item.quantity || 0} × {formatPKR(item.unitPrice)}
                          </p>
                        </div>
                        <span className="font-medium text-ink-900">
                          {formatPKR(item.lineTotal)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-500">
                  Add a product to preview the order total.
                </p>
              )}

              <dl className="mt-3 space-y-1.5 border-t border-ink-200 pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-600">Subtotal</dt>
                  <dd className="font-medium text-ink-900">
                    {formatPKR(estimatedSubtotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-600">Discount</dt>
                  <dd className="text-ink-900">
                    − {formatPKR(estimatedDiscount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-600">Delivery</dt>
                  <dd className="text-ink-900">
                    {formatPKR(estimatedDelivery)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-ink-200 pt-2 font-semibold">
                  <dt className="text-ink-900">Estimated total</dt>
                  <dd className="text-brand-800">
                    {formatPKR(estimatedTotal)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-500">
                Final prices and totals are calculated by the server.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="order-discount">Discount (PKR)</Label>
                <Input id="order-discount" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="order-delivery">Delivery charges (PKR)</Label>
                <Input id="order-delivery" type="number" min="0" step="0.01" value={deliveryCharges} onChange={(event) => setDeliveryCharges(event.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="order-payment">Payment method</Label>
              <Select id="order-payment" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="COD">Cash on Delivery</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Easypaisa">Easypaisa</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </Select>
              <p className="mt-1.5 text-xs text-ink-500">
                New orders remain unpaid until payment is verified.
              </p>
            </div>

            <div>
              <Label htmlFor="order-notes">Notes</Label>
              <Textarea id="order-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" loading={submitting} disabled={customers.length === 0 || products.length === 0}>Create order</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
