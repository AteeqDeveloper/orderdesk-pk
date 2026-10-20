import { serverApiRequest } from "@/lib/serverApi";
import { getProductCategories } from "@/services/productService";
import ProductForm from "@/components/products/ProductForm";

export const metadata = {
  title: "Add product — OrderDesk PK",
};

export default async function NewProductPage() {
  const { categories } = await getProductCategories(serverApiRequest);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-xl text-ink-900">Add product</h1>
        <p className="mt-1 text-sm text-ink-500">
          File uploads and product variants are not supported by the backend yet.
        </p>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
