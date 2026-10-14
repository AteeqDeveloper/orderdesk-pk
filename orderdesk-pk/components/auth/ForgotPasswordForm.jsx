"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label, { FieldError } from "@/components/ui/Label";
import { sendPasswordReset } from "@/services/authService";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setError("");

    setLoading(true);
    const { error: resetError } = await sendPasswordReset(email);
    setLoading(false);

    if (resetError) {
      setFormError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3.5 text-sm text-brand-800"
      >
        If an account exists for <strong>{email}</strong>, we&apos;ve sent a
        password reset link to it.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@business.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!error}
        />
        <FieldError message={error} />
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
