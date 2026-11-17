import { apiRequest } from "@/lib/api";

function mapVariant(variant) {
  if (!variant) return null;
  return {
    ...variant,
    id: String(variant._id || variant.id),
  };
}

function mapProduct(product) {
  if (!product) return null;
  return {
    ...product,
    id: String(product._id || product.id),
    cost_price: product.costPrice ?? product.cost_price ?? 0,
    image_url: product.imageUrl ?? product.image_url ?? "",
    low_stock_threshold: product.lowStockThreshold ?? product.low_stock_threshold ?? 5,
    created_at: product.createdAt ?? product.created_at,
    updated_at: product.updatedAt ?? product.updated_at,
    has_variants: Boolean(product.hasVariants ?? product.has_variants),
    variants: Array.isArray(product.variants)
      ? product.variants.map(mapVariant)
      : [],
  };
}

function mapProductInput(values) {
  const data = {
    name: values.name,
    sku: values.sku || "",
    description: values.description || "",
    price: Number(values.price),
    costPrice: values.cost_price === null ? 0 : Number(values.cost_price || 0),
    category: values.category || "General",
    imageUrl: values.image_url || "",
    lowStockThreshold: Number(values.low_stock_threshold ?? 5),
    status: values.status,
  };

  if (values.has_variants && Array.isArray(values.variants)) {
    data.hasVariants = true;
    data.variants = values.variants.map((variant) => ({
      size: variant.size || "",
      color: variant.color || "",
      sku: variant.sku || "",
      price: Number(variant.price),
      costPrice: Number(variant.costPrice || 0),
      stock: Number(variant.stock),
      lowStockThreshold: Number(variant.lowStockThreshold ?? 5),
      imageUrl: variant.imageUrl || "",
      status: variant.status || "active",
    }));
  } else {
    data.stock = Number(values.stock);
  }

  return data;
}

async function fetchProducts(request) {
  const data = await request("products");
  return (data.products || []).map(mapProduct);
}

export async function getProducts(request, filters = {}) {
  try {
    const { search = "", category = "", status = "" } = filters;
    let products = await fetchProducts(request);
    const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort();
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      products = products.filter((product) =>
        `${product.name} ${product.sku || ""}`.toLowerCase().includes(term)
      );
    }
    if (category) products = products.filter((product) => product.category === category);
    if (status) products = products.filter((product) => product.status === status);
    return { products, categories, error: null };
  } catch (error) {
    return { products: [], categories: [], error };
  }
}

export async function getProductCategories(request) {
  try {
    const products = await fetchProducts(request);
    const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort();
    return { categories, error: null };
  } catch (error) {
    return { categories: [], error };
  }
}

export async function getProductById(request, id) {
  try {
    const data = await request(`products/${id}`);
    return { product: mapProduct(data.product), error: null };
  } catch (error) {
    return { product: null, error };
  }
}

export async function createProduct(userId, values) {
  try {
    const data = await apiRequest("products", {
      method: "POST",
      body: JSON.stringify(mapProductInput(values)),
    });
    return { product: mapProduct(data.product), error: null };
  } catch (error) {
    return { product: null, error };
  }
}

export async function updateProduct(id, values) {
  try {
    const data = await apiRequest(`products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(mapProductInput(values)),
    });
    return { product: mapProduct(data.product), error: null };
  } catch (error) {
    return { product: null, error };
  }
}

export async function getProductVariants(request, productId) {
  try {
    const data = await request(`products/${productId}/variants`);
    return { variants: (data.variants || []).map(mapVariant), error: null };
  } catch (error) {
    return { variants: [], error };
  }
}

export async function getProductVariantsById(productId) {
  try {
    const data = await apiRequest(`products/${productId}/variants`);
    return { variants: (data.variants || []).map(mapVariant), error: null };
  } catch (error) {
    return { variants: [], error };
  }
}

export async function addProductVariant(productId, values) {
  try {
    const data = await apiRequest(`products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    return {
      variant: mapVariant(data.variant),
      product: mapProduct(data.product),
      error: null,
    };
  } catch (error) {
    return { variant: null, product: null, error };
  }
}

export async function updateProductVariant(productId, variantId, values) {
  try {
    const data = await apiRequest(
      `products/${productId}/variants/${variantId}`,
      {
        method: "PATCH",
        body: JSON.stringify(values),
      }
    );
    return {
      variant: mapVariant(data.variant),
      product: mapProduct(data.product),
      error: null,
    };
  } catch (error) {
    return { variant: null, product: null, error };
  }
}

export async function deleteProductVariant(productId, variantId) {
  try {
    const data = await apiRequest(
      `products/${productId}/variants/${variantId}`,
      { method: "DELETE" }
    );
    return { product: mapProduct(data.product), error: null };
  } catch (error) {
    return { product: null, error };
  }
}

export async function deleteProduct(id) {
  try {
    await apiRequest(`products/${id}`, { method: "DELETE" });
    return { error: null };
  } catch (error) {
    return { error };
  }
}
