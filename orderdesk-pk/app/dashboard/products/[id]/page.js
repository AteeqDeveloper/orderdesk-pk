import { notFound } from "next/navigation";
import { getServerUser, serverApiRequest } from "@/lib/serverApi";
import { getProductById, getProductCategories } from "@/services/productService";
import ProductForm from "@/components/products/ProductForm";
import DeleteProductButton from "@/components/products/DeleteProductButton";

export const metadata = {
  title: "Edit product — OrderDesk PK",
};

export default async function EditProductPage(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const id = params?.id;

  if (!id || id === "undefined" || id === "null") {
    notFound();
  }

  const user = await getServerUser();
  const [{ product, error }, { categories }] = await Promise.all([
    getProductById(serverApiRequest, id),
    getProductCategories(serverApiRequest),
  ]);

  if (error || !product) {
    notFound();
  }

  const productFields = product;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl text-ink-900">{product.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Update product details, stock, and product image.
          </p>
        </div>
        <DeleteProductButton
          productId={product.id}
          productName={product.name}
          redirectTo="/dashboard/products"
        />
      </div>

      <ProductForm
        userId={user?.id}
        product={productFields}
        categories={categories}
        initialSuccessMessage={
          searchParams?.created === "1" ? "Product created successfully." : ""
        }
      />
    </div>
  );
}
