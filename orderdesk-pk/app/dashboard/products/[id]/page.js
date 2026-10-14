import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProductById, getProductCategories } from "@/services/productService";
import ProductForm from "@/components/products/ProductForm";
import ProductVariants from "@/components/products/ProductVariants";
import DeleteProductButton from "@/components/products/DeleteProductButton";

export const metadata = {
  title: "Edit product — OrderDesk PK",
};

export default async function EditProductPage({ params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ product, error }, { categories }] = await Promise.all([
    getProductById(supabase, user.id, params.id),
    getProductCategories(supabase, user.id),
  ]);

  if (error || !product) {
    notFound();
  }

  const { product_variants: variants = [], ...productFields } = product;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl text-ink-900">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Update details, stock and variants for this product.
          </p>
        </div>
        <DeleteProductButton
          productId={product.id}
          productName={product.name}
          redirectTo="/dashboard/products"
        />
      </div>

      <ProductForm userId={user.id} product={productFields} categories={categories} />

      <ProductVariants productId={product.id} variants={variants} />
    </div>
  );
}
