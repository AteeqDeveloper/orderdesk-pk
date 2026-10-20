"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Label, { FieldError } from "@/components/ui/Label";
import { PAKISTANI_CITIES } from "@/lib/constants";
import { createCustomer, updateCustomer } from "@/services/customerService";

function toFormState(customer) {
  return {
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
    city: customer?.city || "",
    notes: customer?.notes || "",
  };
}

export default function CustomerForm({ userId, customer, onSuccess, onCancel }) {
  const isEditing = Boolean(customer);

  const [form, setForm] = useState(toFormState(customer));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Customer name is required.";
    if (!form.phone.trim()) nextErrors.phone = "Customer phone is required.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    const values = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    const { customer: saved, error } = isEditing
      ? await updateCustomer(customer.id, values)
      : await createCustomer(userId, values);
    setSaving(false);

    if (error) {
      setFormError(error.message || "Couldn't save this customer. Please try again.");
      return;
    }

    onSuccess(saved);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <div>
        <Label htmlFor="name" required>
          Name
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="Ayesha Khan"
          value={form.name}
          onChange={handleChange}
          error={!!errors.name}
        />
        <FieldError message={errors.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone" required>
            Phone
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="03xx-xxxxxxx"
            value={form.phone}
            onChange={handleChange}
            error={!!errors.phone}
          />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="customer@email.com"
            value={form.email}
            onChange={handleChange}
            error={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            placeholder="House / street / area"
            value={form.address}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Select id="city" name="city" value={form.city} onChange={handleChange}>
            <option value="">Select a city</option>
            {PAKISTANI_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Preferences, delivery instructions, etc."
          value={form.notes}
          onChange={handleChange}
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEditing ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
