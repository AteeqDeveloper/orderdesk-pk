import { createClient } from "@/lib/supabase/client";

/**
 * Read functions take an already-created Supabase client (server or
 * browser) plus the current user's id — used from Server Components so
 * pages render with data already loaded. RLS scopes rows to the signed-in
 * user; the explicit `user_id` filters are kept for clarity and so search
 * can use plain equality/ilike instead of relying on policy alone.
 */
export async function getProducts(supabase, userId, filters = {}) {
  const { search = "", category = "", status = "" } = filters;

  let query = supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  return { products: data || [], error };
}

export async function getProductCategories(supabase, userId) {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("user_id", userId)
    .not("category", "is", null);

  const categories = Array.from(
    new Set((data || []).map((p) => p.category).filter(Boolean))
  ).sort();

  return { categories, error };
}

export async function getProductById(supabase, userId, id) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  return { product: data || null, error };
}

/**
 * Write functions create their own browser client — they're called
 * directly from Client Components (forms, delete buttons) rather than
 * being handed one, matching the pattern in authService.js.
 */
export async function createProduct(userId, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ user_id: userId, ...values })
    .select()
    .single();

  return { product: data || null, error };
}

export async function updateProduct(id, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { product: data || null, error };
}

export async function deleteProduct(id) {
  const supabase = createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  return { error };
}

/**
 * Uploads to a "product-images" storage bucket, namespaced by user id so
 * RLS-style storage policies can scope access the same way the tables do.
 * If the bucket doesn't exist yet in the user's Supabase project, this
 * fails gracefully and the caller falls back to a pasted image URL.
 */
export async function uploadProductImage(userId, file) {
  const supabase = createClient();
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    return { url: null, error: uploadError };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(filePath);

  return { url: publicUrl, error: null };
}

export async function addProductVariant(productId, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .insert({ product_id: productId, ...values })
    .select()
    .single();

  return { variant: data || null, error };
}

export async function updateProductVariant(id, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { variant: data || null, error };
}

export async function deleteProductVariant(id) {
  const supabase = createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  return { error };
}
