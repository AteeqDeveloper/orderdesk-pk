"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import CustomerForm from "@/components/customers/CustomerForm";

export default function EditCustomerButton({ userId, customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit
      </button>

      <Modal open={open} title="Edit customer" onClose={() => setOpen(false)}>
        <CustomerForm
          userId={userId}
          customer={customer}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
