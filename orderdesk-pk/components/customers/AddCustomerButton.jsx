"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import CustomerForm from "@/components/customers/CustomerForm";

export default function AddCustomerButton({ userId }) {
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
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Add customer
      </button>

      <Modal open={open} title="Add customer" onClose={() => setOpen(false)}>
        <CustomerForm
          userId={userId}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
