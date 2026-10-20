"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteProduct } from "@/services/productService";

export default function DeleteProductButton({ productId, productName, redirectTo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    const { error: deleteError } = await deleteProduct(productId);
    setLoading(false);

    if (deleteError) {
      setError("Couldn't delete this product. Please try again.");
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600"
        aria-label={`Delete ${productName}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={open}
        title="Delete this product?"
        description={
          error ||
          `"${productName}" will be permanently removed. This can't be undone.`
        }
        confirmLabel="Delete product"
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
