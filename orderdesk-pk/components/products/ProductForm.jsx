"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Label, { FieldError } from "@/components/ui/Label";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { createProduct, updateProduct } from "@/services/productService";

function toFormState(product) {
  return {
    name: product?.name || "",
    sku: product?.sku || "",
    description: product?.description || "",
    price: product?.price ?? "",
    cost_price: product?.cost_price ?? "",
    category: product?.category || "",
    stock: product?.stock ?? "0",
    low_stock_threshold: product?.low_stock_threshold ?? "5",
    image_url: product?.image_url || "",
    status: product?.status || "active",
  };
}

export default function ProductForm({ userId, product, categories = [] }) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [form, setForm] = useState(toFormState(product));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setSuccessMessage("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Product name is required.";
    if (form.price === "" || Number(form.price) < 0)
      nextErrors.price = "Enter a valid price.";
    if (form.cost_price !== "" && Number(form.cost_price) < 0)
      nextErrors.cost_price = "Cost price can't be negative.";
    if (form.stock === "" || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))
      nextErrors.stock = "Enter a whole number for stock.";
    if (
      form.low_stock_threshold !== "" &&
      (Number(form.low_stock_threshold) < 0 ||
        !Number.isInteger(Number(form.low_stock_threshold)))
    )
      nextErrors.low_stock_threshold = "Enter a whole number.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    const values = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price),
      cost_price: form.cost_price === "" ? null : Number(form.cost_price),
      category: form.category.trim() || null,
      stock: Number(form.stock),
      low_stock_threshold:
        form.low_stock_threshold === "" ? 0 : Number(form.low_stock_threshold),
      image_url: form.image_url.trim() || null,
      status: form.status,
    };

    setSaving(true);
    const { product: saved, error } = isEditing
      ? await updateProduct(product.id, values)
      : await createProduct(userId, values);
    setSaving(false);

    if (error) {
      setFormError(error.message || "Couldn't save this product. Please try again.");
      return;
    }

    if (isEditing) {
      setSuccessMessage("Product details saved successfully.");
      router.refresh();
    } else {
      // Open the saved product so its details can be reviewed or edited.
      if (saved?.id) {
        router.push(`/dashboard/products/${saved.id}`);
      } else {
        router.push("/dashboard/products");
      }
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800"
        >
          {successMessage}
        </div>
      )}

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Basic details</h2>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name" required>
              Product name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Embroidered Lawn Suit"
              value={form.name}
              onChange={handleChange}
              error={!!errors.name}
            />
            <FieldError message={errors.name} />
          </div>

          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              name="sku"
              placeholder="LWN-0012"
              value={form.sku}
              onChange={handleChange}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              list="category-suggestions"
              placeholder="Clothing"
              value={form.category}
              onChange={handleChange}
            />
            <datalist id="category-suggestions">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Short description customers or your team will see"
              value={form.description}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Pricing & stock</h2>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="price" required>
              Price (PKR)
            </Label>
            <Input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={handleChange}
              error={!!errors.price}
            />
            <FieldError message={errors.price} />
          </div>

          <div>
            <Label htmlFor="cost_price">Cost price (PKR)</Label>
            <Input
              id="cost_price"
              name="cost_price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.cost_price}
              onChange={handleChange}
              error={!!errors.cost_price}
            />
            <FieldError message={errors.cost_price} />
            <p className="mt-1.5 text-xs text-ink-400">
              Used for profit reporting — not shown to customers.
            </p>
          </div>

          <div>
            <Label htmlFor="stock" required>
              Stock
            </Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.stock}
              onChange={handleChange}
              error={!!errors.stock}
            />
            <FieldError message={errors.stock} />
          </div>

          <div>
            <Label htmlFor="low_stock_threshold">Low stock threshold</Label>
            <Input
              id="low_stock_threshold"
              name="low_stock_threshold"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.low_stock_threshold}
              onChange={handleChange}
              error={!!errors.low_stock_threshold}
            />
            <FieldError message={errors.low_stock_threshold} />
            <p className="mt-1.5 text-xs text-ink-400">
              You&apos;ll see a low-stock warning at or below this number.
            </p>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Product image</h2>

        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-5 w-5 text-ink-300" aria-hidden="true" />
            )}
          </div>

          <div className="flex-1 space-y-2.5">
            <p className="text-sm text-ink-500">
              File uploads are not supported by the backend yet.
            </p>

            <Input
              name="image_url"
              placeholder="Or paste an image URL"
              value={form.image_url}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/dashboard/products")}
        >
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEditing ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
