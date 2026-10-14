"use client";

import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";

/**
 * Generic "are you sure?" modal for destructive actions (delete product,
 * delete customer, etc). The caller owns the open/close state and passes
 * in what happens on confirm — this component only renders the dialog.
 */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-ink-950/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-card"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="confirm-dialog-title" className="font-display text-base text-ink-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-ink-500">{description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
