"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import { formatPKR } from "@/lib/utils";
import {
  addProductVariant,
  deleteProductVariant,
  updateProductVariant,
} from "@/services/productService";

function createDraft(defaults = {}) {
  return {
    size: "",
    color: "",
    sku: "",
    price: defaults.price ?? "",
    costPrice: defaults.costPrice ?? "",
    stock: defaults.stock ?? "0",
    lowStockThreshold: defaults.lowStockThreshold ?? "5",
    imageUrl: "",
    status: "active",
  };
}

function toDraft(variant) {
  return {
    ...variant,
    size: variant.size || "",
    color: variant.color || "",
    sku: variant.sku || "",
    price: String(variant.price ?? ""),
    costPrice: String(variant.costPrice ?? ""),
    stock: String(variant.stock ?? 0),
    lowStockThreshold: String(variant.lowStockThreshold ?? 5),
    imageUrl: variant.imageUrl || "",
    status: variant.status || "active",
  };
}

function variantLabel(variant) {
  return [variant.size, variant.color].filter(Boolean).join(" / ") || "Standard";
}

export default function VariantManager({
  productId,
  variants = [],
  onChange,
  onProductUpdated,
  onBusyChange,
  defaultPrice = "",
  defaultCostPrice = "",
  defaultThreshold = "5",
  defaultStock = "0",
  disabled = false,
}) {
  const [draft, setDraft] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sizeOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.size).filter(Boolean))),
    [variants]
  );
  const colorOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.color).filter(Boolean))),
    [variants]
  );
  const activeSizes = Array.from(
    new Set(
      variants
        .filter((variant) => variant.status === "active")
        .map((variant) => variant.size)
        .filter(Boolean)
    )
  );
  const activeColors = Array.from(
    new Set(
      variants
        .filter((variant) => variant.status === "active")
        .map((variant) => variant.color)
        .filter(Boolean)
    )
  );

  function startAdd() {
    setError("");
    setEditingKey(null);
    setDraft(
      createDraft({
        price: defaultPrice,
        costPrice: defaultCostPrice,
        lowStockThreshold: defaultThreshold,
        stock: defaultStock,
      })
    );
  }

  function startEdit(variant, index) {
    setError("");
    setEditingKey(variant.id || variant.clientId || `variant-${index}`);
    setDraft(toDraft(variant));
  }

  function cancelEdit() {
    setDraft(null);
    setEditingKey(null);
    setError("");
  }

  function updateDraft(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function validateDraft() {
    const price = Number(draft.price);
    const costPrice = draft.costPrice === "" ? 0 : Number(draft.costPrice);
    const stock = Number(draft.stock);
    const threshold =
      draft.lowStockThreshold === "" ? 0 : Number(draft.lowStockThreshold);

    if (draft.price === "" || !Number.isFinite(price) || price < 0) {
      return "Enter a valid non-negative variant price.";
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      return "Enter a valid non-negative cost price.";
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return "Variant stock must be a non-negative whole number.";
    }
    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      return "Low-stock threshold must be a non-negative whole number.";
    }
    if (!["active", "inactive"].includes(draft.status)) {
      return "Select a valid variant status.";
    }
    return "";
  }

  async function saveVariant() {
    if (saving || !draft) return;

    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    const values = {
      size: draft.size.trim(),
      color: draft.color.trim(),
      sku: draft.sku.trim(),
      price: Number(draft.price),
      costPrice: draft.costPrice === "" ? 0 : Number(draft.costPrice),
      stock: Number(draft.stock),
      lowStockThreshold:
        draft.lowStockThreshold === "" ? 0 : Number(draft.lowStockThreshold),
      imageUrl: draft.imageUrl.trim(),
      status: draft.status,
    };

    setSaving(true);
    onBusyChange?.(true);
    setError("");

    try {
      if (productId && draft.id) {
        const result = await updateProductVariant(productId, draft.id, values);
        if (result.error) {
          setError(result.error.message || "Couldn't update this variant.");
          return;
        }
        onChange(
          variants.map((variant) =>
            variant.id === draft.id ? result.variant : variant
          )
        );
        onProductUpdated?.(result.product);
      } else if (productId) {
        const result = await addProductVariant(productId, values);
        if (result.error) {
          setError(result.error.message || "Couldn't add this variant.");
          return;
        }
        onChange([...variants, result.variant]);
        onProductUpdated?.(result.product);
      } else if (editingKey) {
        onChange(
          variants.map((variant, index) => {
            const key =
              variant.id || variant.clientId || `variant-${index}`;
            return key === editingKey
              ? { ...values, clientId: variant.clientId }
              : variant;
          })
        );
      } else {
        onChange([
          ...variants,
          { ...values, clientId: `draft-${Date.now()}` },
        ]);
      }

      cancelEdit();
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  async function removeVariant(variant, index) {
    if (saving) return;
    setError("");
    const key = variant.id || variant.clientId || `variant-${index}`;

    if (productId && variant.id) {
      setSaving(true);
      onBusyChange?.(true);
      try {
        const result = await deleteProductVariant(productId, variant.id);
        if (result.error) {
          setError(result.error.message || "Couldn't delete this variant.");
          return;
        }
        onProductUpdated?.(result.product);
      } finally {
        setSaving(false);
        onBusyChange?.(false);
      }
    }

    onChange(
      variants.filter((item, itemIndex) => {
        const itemKey =
          item.id || item.clientId || `variant-${itemIndex}`;
        return itemKey !== key;
      })
    );
    if (editingKey === key) cancelEdit();
  }

  const lowStockVariants = variants.filter(
    (variant) =>
      variant.status === "active" &&
      Number(variant.stock) <= Number(variant.lowStockThreshold ?? 5)
  ).length;

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base text-ink-900">Product variants</h2>
          <p className="mt-1 text-sm text-ink-500">
            {variants.length} {variants.length === 1 ? "variant" : "variants"} ·{" "}
            {variants.reduce(
              (total, variant) => total + (Number(variant.stock) || 0),
              0
            )}{" "}
            total units
            {lowStockVariants > 0 && (
              <span className="ml-2 font-medium text-amber-700">
                · {lowStockVariants} low stock
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Available sizes: {activeSizes.join(", ") || "—"} · Colors:{" "}
            {activeColors.join(", ") || "—"}
          </p>
        </div>
        {!draft && (
          <Button
            type="button"
            variant="secondary"
            onClick={startAdd}
            disabled={disabled || saving}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add variant
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {draft && (
        <div
          className="mt-5 rounded-lg border border-ink-100 bg-ink-50/50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-ink-900">
              {editingKey ? "Edit variant" : "Add variant"}
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100"
              aria-label="Close variant form"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <datalist id={`variant-sizes-${productId || "new"}`}>
            {sizeOptions.map((size) => (
              <option key={size} value={size} />
            ))}
          </datalist>
          <datalist id={`variant-colors-${productId || "new"}`}>
            {colorOptions.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="variant-size">Size</Label>
              <Input
                id="variant-size"
                name="size"
                list={`variant-sizes-${productId || "new"}`}
                value={draft.size}
                onChange={updateDraft}
                placeholder="e.g. Medium"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-color">Color</Label>
              <Input
                id="variant-color"
                name="color"
                list={`variant-colors-${productId || "new"}`}
                value={draft.color}
                onChange={updateDraft}
                placeholder="e.g. Emerald green"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-sku">SKU</Label>
              <Input
                id="variant-sku"
                name="sku"
                value={draft.sku}
                onChange={updateDraft}
                placeholder="Optional"
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-price" required>
                Price (PKR)
              </Label>
              <Input
                id="variant-price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.price}
                onChange={updateDraft}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-cost-price">Cost price (PKR)</Label>
              <Input
                id="variant-cost-price"
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.costPrice}
                onChange={updateDraft}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-stock">Stock</Label>
              <Input
                id="variant-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.stock}
                onChange={updateDraft}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-threshold">Low-stock threshold</Label>
              <Input
                id="variant-threshold"
                name="lowStockThreshold"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.lowStockThreshold}
                onChange={updateDraft}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-image-url">Image URL</Label>
              <Input
                id="variant-image-url"
                name="imageUrl"
                type="url"
                value={draft.imageUrl}
                onChange={updateDraft}
                placeholder="https://..."
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="variant-status">Status</Label>
              <select
                id="variant-status"
                name="status"
                value={draft.status}
                onChange={updateDraft}
                disabled={saving}
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveVariant}
              loading={saving}
              disabled={disabled}
            >
              {editingKey ? "Save variant" : "Add variant"}
            </Button>
          </div>
        </div>
      )}

      {variants.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
          No variants added yet.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-ink-100">
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-ink-50/70 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Variant</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Price / Cost</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {variants.map((variant, index) => {
                  const key =
                    variant.id || variant.clientId || `variant-${index}`;
                  const isLowStock =
                    variant.status === "active" &&
                    Number(variant.stock) <=
                      Number(variant.lowStockThreshold ?? 5);

                  return (
                    <tr key={key}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">
                          {variantLabel(variant)}
                        </p>
                        {variant.imageUrl && (
                          <p className="max-w-40 truncate text-xs text-ink-400">
                            Custom image
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500">
                        {variant.sku || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">
                          {formatPKR(variant.price)}
                        </p>
                        <p className="text-xs text-ink-400">
                          Cost {formatPKR(variant.costPrice)}
                        </p>
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          isLowStock ? "text-amber-700" : "text-ink-700"
                        }`}
                      >
                        {variant.stock ?? 0}
                        {isLowStock && (
                          <span className="ml-1.5 text-xs">Low</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-ink-600">
                        {variant.status || "active"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(variant, index)}
                            disabled={disabled || saving || Boolean(draft)}
                            className="rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-brand-700 disabled:opacity-40"
                            aria-label={`Edit ${variantLabel(variant)} variant`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVariant(variant, index)}
                            disabled={disabled || saving}
                            className="rounded-md p-2 text-ink-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            aria-label={`Delete ${variantLabel(variant)} variant`}
                          >
                            {saving ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-ink-100 sm:hidden">
            {variants.map((variant, index) => {
              const key =
                variant.id || variant.clientId || `variant-${index}`;
              const isLowStock =
                variant.status === "active" &&
                Number(variant.stock) <= Number(variant.lowStockThreshold ?? 5);
              return (
                <li key={key} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {variantLabel(variant)}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-ink-500">
                        SKU: {variant.sku || "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-600">
                        <span>Price {formatPKR(variant.price)}</span>
                        <span>Cost {formatPKR(variant.costPrice)}</span>
                        <span
                          className={
                            isLowStock ? "font-semibold text-amber-700" : ""
                          }
                        >
                          Stock {variant.stock ?? 0}
                        </span>
                        <span className="capitalize">{variant.status || "active"}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => startEdit(variant, index)}
                        disabled={disabled || saving || Boolean(draft)}
                        className="rounded-md p-2 text-ink-500 hover:bg-ink-100 disabled:opacity-40"
                        aria-label={`Edit ${variantLabel(variant)} variant`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariant(variant, index)}
                        disabled={disabled || saving}
                        className="rounded-md p-2 text-ink-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={`Delete ${variantLabel(variant)} variant`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
