"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Label, { FieldError } from "@/components/ui/Label";
import { registerUser } from "@/services/authService";

export default function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.businessName.trim())
      nextErrors.businessName = "Business name is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      nextErrors.email = "Enter a valid email address.";
    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setLoading(true);
    const { error } = await registerUser(form);
    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
        <Label htmlFor="fullName" required>
          Full name
        </Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Ayesha Khan"
          value={form.fullName}
          onChange={handleChange}
          error={!!errors.fullName}
        />
        <FieldError message={errors.fullName} />
      </div>

      <div>
        <Label htmlFor="businessName" required>
          Business name
        </Label>
        <Input
          id="businessName"
          name="businessName"
          placeholder="Ayesha's Boutique"
          value={form.businessName}
          onChange={handleChange}
          error={!!errors.businessName}
        />
        <FieldError message={errors.businessName} />
      </div>

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
          value={form.email}
          onChange={handleChange}
          error={!!errors.email}
        />
        <FieldError message={errors.email} />
      </div>

      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={handleChange}
          error={!!errors.password}
        />
        <FieldError message={errors.password} />
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Create account
      </Button>
    </form>
  );
}
