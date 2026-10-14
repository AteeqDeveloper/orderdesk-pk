"use client";

import { useState } from "react";
import { Layers, Plus, Minus, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { updateVariantStock } from "@/services/inventoryService";

function VariantItem({ variant, onVariantUpdated }) {
  const [stock, setStock] = useState(variant.stock || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleUpdate(newStock) {
    if (newStock < 0 || Number.isNaN(newStock)) {
      setError("Stock cannot be negative");
      return;
    }
    setError("");
    setSaving(true);
    const { variant: updated, error: updateError } = await updateVariantStock(
      variant.id,
      newStock
    );
    setSaving(false);

    if (updateError) {
      setError(updateError.message || "Failed to update");
      return;
    }

    setStock(newStock);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    if (onVariantUpdated) {
      onVariantUpdated(updated);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ink-100 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
            {variant.variant_name}
          </span>
          <span className="font-medium text-ink-900">{variant.variant_value}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-500">
          Current: <strong className="text-ink-800">{stock} units</strong>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleUpdate(Math.max(0, stock - 1))}
          disabled={saving || stock <= 0}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          aria-label="Decrease variant stock by 1"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <div className="w-16">
          <Input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val >= 0) {
                setStock(val);
              } else if (e.target.value === "") {
                setStock(0);
              }
            }}
            onBlur={() => {
              if (stock !== variant.stock) {
                handleUpdate(stock);
              }
            }}
            disabled={saving}
            className="h-8 px-2 text-center text-xs font-semibold"
          />
        </div>

        <button
          type="button"
          onClick={() => handleUpdate(stock + 1)}
          disabled={saving}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          aria-label="Increase variant stock by 1"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        {saving && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
        {success && <CheckCircle className="h-4 w-4 text-emerald-600" />}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export default function ProductVariantsModal({ product, open, onClose, onRefresh }) {
  if (!product) return null;

  const variants = product.product_variants || [];
  const totalVariantStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <Modal open={open} title={`Variants — ${product.name}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Header information */}
        <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50/60 p-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-700" />
            <span className="text-sm font-medium text-ink-900">
              {variants.length} {variants.length === 1 ? "Variant" : "Variants"}
            </span>
          </div>
          <span className="text-xs font-medium text-ink-600">
            Combined Variant Stock: <strong className="text-ink-900">{totalVariantStock} units</strong>
          </span>
        </div>

        {/* Variants List */}
        {variants.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-500">
            This product has no variants registered yet.
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {variants.map((variant) => (
              <VariantItem
                key={variant.id}
                variant={variant}
                onVariantUpdated={() => {
                  if (onRefresh) onRefresh();
                }}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end border-t border-ink-100 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
