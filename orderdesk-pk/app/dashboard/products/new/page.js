import { createClient } from "@/lib/supabase/server";
import { getProductCategories } from "@/services/productService";
import ProductForm from "@/components/products/ProductForm";

export const metadata = {
  title: "Add product — OrderDesk PK",
};

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { categories } = await getProductCategories(supabase, user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Add product</h1>
        <p className="mt-1 text-sm text-ink-500">
          You can add size/color variants after saving.
        </p>
      </div>

      <ProductForm userId={user.id} categories={categories} />
    </div>
  );
}
