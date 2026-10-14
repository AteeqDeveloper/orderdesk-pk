"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteCustomer } from "@/services/customerService";

export default function DeleteCustomerButton({
  customerId,
  customerName,
  redirectTo,
  iconOnly = true,
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    const { error: deleteError } = await deleteCustomer(customerId);
    setLoading(false);

    if (deleteError) {
      setError("Couldn't delete this customer. Please try again.");
      return;
    }

    setOpen(false);
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600"
          aria-label={`Delete ${customerName}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      )}

      <ConfirmDialog
        open={open}
        title="Delete this customer?"
        description={
          error ||
          `"${customerName}" will be permanently removed. This can't be undone.`
        }
        confirmLabel="Delete customer"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => {
          setOpen(false);
          setError("");
        }}
      />
    </>
  );
}
