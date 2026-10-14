"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { logoutUser } from "@/services/authService";

export default function DashboardHeader({ user, profile, onMenuClick }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  const displayName = profile?.business_name || profile?.full_name || user?.email;

  return (
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Spacer keeps user info right-aligned on desktop where the menu button is hidden */}
        <div className="hidden lg:block" />

        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-600">{displayName}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
