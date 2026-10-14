"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Layers } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import { VARIANT_NAME_SUGGESTIONS, VARIANT_VALUE_SUGGESTIONS } from "@/lib/constants";
import {
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from "@/services/productService";

function VariantRow({ variant }) {
  const router = useRouter();
  const [stock, setStock] = useState(variant.stock);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleStockBlur() {
    const nextStock = Number(stock);
    if (Number.isNaN(nextStock) || nextStock < 0 || nextStock === variant.stock) {
      setStock(variant.stock);
      return;
    }
    setSaving(true);
    await updateProductVariant(variant.id, { stock: nextStock });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteProductVariant(variant.id);
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">
          {variant.variant_name}: {variant.variant_value}
        </p>
      </div>
      <div className="w-24">
        <Input
          type="number"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={handleStockBlur}
          disabled={saving}
          aria-label={`Stock for ${variant.variant_name} ${variant.variant_value}`}
        />
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        aria-label={`Remove ${variant.variant_name} ${variant.variant_value}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function ProductVariants({ productId, variants }) {
  const router = useRouter();
  const [form, setForm] = useState({ variant_name: "", variant_value: "", stock: "0" });
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");

    if (!form.variant_name.trim() || !form.variant_value.trim()) {
      setError("Enter both a variant name (e.g. Size) and a value (e.g. Large).");
      return;
    }

    setAdding(true);
    const { error: addError } = await addProductVariant(productId, {
      variant_name: form.variant_name.trim(),
      variant_value: form.variant_value.trim(),
      stock: Number(form.stock) || 0,
    });
    setAdding(false);

    if (addError) {
      setError("Couldn't add this variant. It may already exist.");
      return;
    }

    setForm({ variant_name: "", variant_value: "", stock: "0" });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-display text-base text-ink-900">Variants</h2>
      <p className="mt-1 text-sm text-ink-500">
        Track stock separately for options like size or color.
      </p>

      {variants.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Layers}
            title="No variants yet"
            description="Add one below, e.g. Size: Large."
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {variants.map((variant) => (
            <VariantRow key={variant.id} variant={variant} />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2.5">
        <div className="w-32">
          <Input
            list="variant-name-suggestions"
            placeholder="Name (Size)"
            aria-label="Variant name"
            value={form.variant_name}
            onChange={(e) => setForm((prev) => ({ ...prev, variant_name: e.target.value }))}
          />
          <datalist id="variant-name-suggestions">
            {VARIANT_NAME_SUGGESTIONS.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        <div className="w-32">
          <Input
            list="variant-value-suggestions"
            placeholder="Value (Large)"
            aria-label="Variant value"
            value={form.variant_value}
            onChange={(e) => setForm((prev) => ({ ...prev, variant_value: e.target.value }))}
          />
          <datalist id="variant-value-suggestions">
            {VARIANT_VALUE_SUGGESTIONS.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>

        <div className="w-24">
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Stock"
            aria-label="Variant stock"
            value={form.stock}
            onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
          />
        </div>

        <Button type="submit" variant="secondary" loading={adding}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </form>

      {error && <p className="mt-2.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
