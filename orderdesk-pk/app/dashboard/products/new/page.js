import { getServerUser, serverApiRequest } from "@/lib/serverApi";
import { getProductCategories } from "@/services/productService";
import ProductForm from "@/components/products/ProductForm";

export const metadata = {
  title: "Add product — OrderDesk PK",
};

export default async function NewProductPage() {
  const [user, { categories }] = await Promise.all([
    getServerUser(),
    getProductCategories(serverApiRequest),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Add product</h1>
        <p className="mt-1 text-sm text-ink-500">
          Add product details, pricing, stock, and an optional image.
        </p>
      </div>

      <ProductForm userId={user?.id} categories={categories} />
    </div>
  );
}
