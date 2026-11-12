import { apiRequest } from "@/lib/api";

export async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const result = await apiRequest("uploads/product-image", {
    method: "POST",
    body: formData,
  });

  if (!result.success || !result.data?.imageUrl) {
    throw new Error(result.message || "Image upload failed.");
  }

  return result.data.imageUrl;
}