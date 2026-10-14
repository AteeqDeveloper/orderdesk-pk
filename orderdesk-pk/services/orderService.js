import { createClient } from "@/lib/supabase/client";

/**
 * Read functions take an already-created Supabase client (server or
 * browser) plus the current user's id — used from Server Components.
 */
export async function getOrders(supabase, userId, filters = {}) {
  const { search = "", status = "" } = filters;

  let query = supabase
    .from("orders")
    .select("*, customers(name, phone, city)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("order_status", status);
  }

  if (search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(`order_number.ilike.%${term}%`);
  }

  const { data, error } = await query;
  return { orders: data || [], error };
}

export async function getOrderById(supabase, userId, id) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(*), order_items(*, products(name, price))")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  return { order: data || null, error };
}

/**
 * Write functions create their own browser client — called directly from
 * Client Components.
 */
export async function updateOrderStatus(id, orderStatus) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ order_status: orderStatus })
    .eq("id", id)
    .select()
    .single();

  return { order: data || null, error };
}

export async function updatePaymentStatus(id, paymentStatus) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", id)
    .select()
    .single();

  return { order: data || null, error };
}

export async function deleteOrder(id) {
  const supabase = createClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  return { error };
}
