"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import ProductImage from "@/components/ui/ProductImage";
import { updateProductStock } from "@/services/inventoryService";

export default function StockAdjustmentModal({ product, open, onClose, onUpdated }) {
  const [stock, setStock] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (product) {
      setStock(Number(product.stock) || 0);
      setError("");
      setSuccess("");
    }
  }, [product]);

  if (!product) return null;

  const currentStock = Number(product.stock) || 0;
  const variant = product.variant;
  const difference = stock - currentStock;

  function handleAdjustDelta(delta) {
    setError("");
    setSuccess("");
    setStock((prev) => Math.max(0, prev + delta));
  }

  function handleDirectChange(val) {
    setError("");
    setSuccess("");
    const parsed = Number(val);
    if (val === "") {
      setStock(0);
    } else if (Number.isSafeInteger(parsed)) {
      setStock(Math.max(0, parsed));
    }
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    setSubmitting(true);
    const { product: updatedProduct, error: updateError } =
      await updateProductStock(
        product.id,
        Number(stock),
        currentStock,
        variant?.id
      );
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message || "Failed to update stock. Please try again.");
      return;
    }

    setSuccess(`Stock updated successfully to ${stock} units.`);
    if (onUpdated) {
      onUpdated(updatedProduct);
    }

    setTimeout(() => {
      onClose();
    }, 900);
  }

  return (
    <Modal
      open={open}
      title={variant ? "Adjust Variant Stock" : "Adjust Product Stock"}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Product Details Header */}
        <div className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
          <ProductImage
            src={product.image_url}
            className="h-12 w-12 rounded-md border border-ink-100 bg-white"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-ink-900">{product.name}</h3>
            {variant && (
              <p className="text-xs font-medium text-ink-700">
                Variant: {[variant.size, variant.color].filter(Boolean).join(" / ") || "Standard"}
              </p>
            )}
            <p className="text-xs text-ink-500">
              SKU:{" "}
              <span className="font-mono">
                {variant?.sku || product.sku || "N/A"}
              </span>{" "}
              &middot; Category: {product.category || "Uncategorized"}
            </p>
          </div>
        </div>

        {/* Current vs New Stock Display */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-xs">
            <span className="text-xs text-ink-500">Current Stock</span>
            <p className="font-display text-2xl font-bold text-ink-900">{currentStock}</p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 shadow-xs">
            <span className="text-xs text-brand-800">New Stock</span>
            <p className="font-display text-2xl font-bold text-brand-900">
              {stock}
              {difference !== 0 && (
                <span className={`ml-2 text-xs font-semibold ${difference > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  ({difference > 0 ? `+${difference}` : difference})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Manual Stock Input */}
        <div>
          <Label htmlFor="stock-input">Set Stock Manually</Label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAdjustDelta(-1)}
              disabled={stock <= 0 || submitting}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 active:bg-ink-100 disabled:opacity-40"
              aria-label="Decrease by 1"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Input
              id="stock-input"
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => handleDirectChange(e.target.value)}
              className="text-center font-display text-lg font-semibold"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => handleAdjustDelta(1)}
              disabled={submitting}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 active:bg-ink-100 disabled:opacity-40"
              aria-label="Increase by 1"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Increment/Decrement Buttons */}
        <div>
          <span className="text-xs font-medium text-ink-500">Quick Adjustments</span>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => handleAdjustDelta(-10)}
              disabled={stock < 10 || submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDelta(-5)}
              disabled={stock < 5 || submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDelta(-1)}
              disabled={stock < 1 || submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDelta(1)}
              disabled={submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDelta(5)}
              disabled={submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => handleAdjustDelta(10)}
              disabled={submitting}
              className="rounded border border-ink-200 bg-white py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
            >
              +10
            </button>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
          >
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            loading={submitting}
            disabled={submitting || stock === currentStock}
          >
            Save Stock
          </Button>
        </div>
      </div>
    </Modal>
  );
}
