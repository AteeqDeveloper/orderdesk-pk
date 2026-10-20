"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { apiRequest } from "@/lib/api";
import { createOrder } from "@/services/orderService";

const emptyItem = () => ({ productId: "", quantity: "1" });

export default function CreateOrderButton() {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [open, setOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState("0");
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function openForm() {
    setOpen(true);
    setLoadingData(true);
    setLoadError("");
    setFormError("");
    setSuccessMessage("");
    try {
      const [customerResponse, productResponse] = await Promise.all([
        apiRequest("customers"),
        apiRequest("products"),
      ]);
      setCustomers(customerResponse.customers || []);
      setProducts((productResponse.products || []).filter((product) => product.status === "active"));
      setCustomerId("");
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

  function validate() {
    if (!customerId) return "Select a customer before creating the order.";
    if (!customers.some((customer) => String(customer._id) === customerId)) {
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
      requestedQuantities.set(
        item.productId,
        (requestedQuantities.get(item.productId) || 0) + quantity
      );
    }

    for (const [productId, quantity] of requestedQuantities) {
      const product = products.find((entry) => String(entry._id) === productId);
      if (quantity > Number(product.stock)) {
        return `Only ${product.stock} units of ${product.name} are currently in stock.`;
      }
    }

    for (const [label, value] of [["Discount", discount], ["Delivery charges", deliveryCharges]]) {
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        return `${label} must be a non-negative amount.`;
      }
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
          quantity: Number(item.quantity),
        })),
        discount: Number(discount || 0),
        deliveryCharges: Number(deliveryCharges || 0),
        paymentMethod,
        notes: notes.trim(),
      });

      if (error) {
        setFormError(error.message || "Could not create the order.");
        return;
      }

      setOpen(false);
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
              <div>
                <Label htmlFor="order-customer" required>Customer</Label>
                <Select id="order-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={String(customer._id)}>
                      {customer.name} · {customer.phone}
                    </option>
                  ))}
                </Select>
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
                        onChange={(event) => updateItem(index, { productId: event.target.value })}
                        aria-label={`Product ${index + 1}`}
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product._id} value={String(product._id)} disabled={Number(product.stock) < 1}>
                            {product.name} · stock {product.stock}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      {index === 0 && <Label htmlFor={`order-quantity-${index}`} required>Qty</Label>}
                      <Input
                        id={`order-quantity-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
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
                <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyItem()])}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add product
                </Button>
              </fieldset>
            )}

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
