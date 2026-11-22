"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function SuperAdminLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest("auth/super-admin/logout", { method: "POST" });
      router.replace("/super-admin/login");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        Sign out securely
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
