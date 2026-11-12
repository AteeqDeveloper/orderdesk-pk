"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Label, { FieldError } from "@/components/ui/Label";
import ProductImage from "@/components/ui/ProductImage";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { createProduct, updateProduct } from "@/services/productService";
import { uploadProductImage } from "@/services/uploadService";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

export default function ProductForm({
  userId,
  product,
  categories = [],
  initialSuccessMessage = "",
}) {
  const router = useRouter();
  const isEditing = Boolean(product);
  const imageInputRef = useRef(null);

  const [form, setForm] = useState(toFormState(product));
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState(initialSuccessMessage);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  function handleChange(e) {
    setSuccessMessage("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Choose a JPG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    setImageError("");
    setFormError("");
    setSuccessMessage("");
    setSelectedImage(file);
  }

  function handleRemoveImage() {
    setSelectedImage(null);
    setImagePreview("");
    setImageError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
    setForm((prev) => ({ ...prev, image_url: "" }));
    setSuccessMessage("");
  }

  function validate() {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Product name is required.";
    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    )
      nextErrors.price = "Enter a valid price.";
    if (
      form.cost_price !== "" &&
      (!Number.isFinite(Number(form.cost_price)) || Number(form.cost_price) < 0)
    )
      nextErrors.cost_price = "Enter a valid cost price.";
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
    if (saving) return;
    setFormError("");
    setSuccessMessage("");
    if (!validate() || imageError) return;

    setSaving(true);
    try {
      let imageUrl = form.image_url.trim();
      if (selectedImage) {
        setUploading(true);
        try {
          imageUrl = await uploadProductImage(selectedImage);
        } finally {
          setUploading(false);
        }
      }

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
        image_url: imageUrl || null,
        status: form.status,
      };

      const { product: saved, error } = isEditing
        ? await updateProduct(product.id, values)
        : await createProduct(userId, values);

      if (error) {
        setFormError(error.message || "Couldn't save this product. Please try again.");
        return;
      }

      setForm((prev) => ({ ...prev, image_url: imageUrl }));
      setSelectedImage(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (isEditing) {
        setSuccessMessage("Product details saved successfully.");
        router.refresh();
      } else if (saved?.id) {
        router.push(`/dashboard/products/${saved.id}?created=1`);
        router.refresh();
      } else {
        router.push("/dashboard/products");
        router.refresh();
      }
    } catch (error) {
      setFormError(error.message || "Couldn't save this product. Please try again.");
    } finally {
      setSaving(false);
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

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProductImage
            src={imagePreview || form.image_url}
            alt="Product image preview"
            className="aspect-square h-28 w-28 rounded-lg border border-ink-100 sm:h-32 sm:w-32"
            iconClassName="h-6 w-6 text-ink-300"
          />

          <div className="min-w-0 flex-1 space-y-2.5">
            <Label htmlFor="product-image">Upload an image</Label>
            <Input
              id="product-image"
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={handleImageChange}
              disabled={saving}
              error={Boolean(imageError)}
              aria-describedby="product-image-help"
            />
            <p id="product-image-help" className="text-xs text-ink-400">
              JPG, PNG, or WebP. Maximum file size: 5 MB.
            </p>
            <FieldError message={imageError} />
            {selectedImage && (
              <p className="truncate text-sm text-ink-600" title={selectedImage.name}>
                Selected: {selectedImage.name}
              </p>
            )}
            {(selectedImage || form.image_url) && (
              <Button
                type="button"
                variant="ghost"
                className="px-0 py-1 text-red-600 hover:bg-transparent hover:text-red-700"
                onClick={handleRemoveImage}
                disabled={saving}
              >
                Remove image
              </Button>
            )}
            {uploading && (
              <p role="status" className="flex items-center gap-2 text-sm text-brand-700">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Uploading image…
              </p>
            )}
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
        <Button type="submit" loading={saving} disabled={uploading}>
          {uploading
            ? "Uploading image"
            : saving
            ? "Saving"
            : isEditing
            ? "Save changes"
            : "Add product"}
        </Button>
      </div>
    </form>
  );
}
