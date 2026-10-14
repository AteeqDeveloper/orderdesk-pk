import { createClient } from "@/lib/supabase/client";

/**
 * Read functions take an already-created Supabase client (server or
 * browser) plus the current user's id — used from Server Components.
 */
export async function getCustomers(supabase, userId, filters = {}) {
  const { search = "" } = filters;

  let query = supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(
      `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  return { customers: data || [], error };
}

export async function getCustomerById(supabase, userId, id) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  return { customer: data || null, error };
}

/**
 * Pulls this customer's order history straight from the orders table.
 * Order creation isn't built yet (Phase 5), so this simply renders empty
 * until then — no dependency on that phase to ship this one.
 */
export async function getCustomerOrders(supabase, userId, customerId, limit = 10) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, order_status, payment_status, created_at")
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { orders: data || [], error };
}

/**
 * Write functions create their own browser client — called directly from
 * Client Components (the add/edit modal, delete button).
 */
export async function createCustomer(userId, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ user_id: userId, ...values })
    .select()
    .single();

  return { customer: data || null, error };
}

export async function updateCustomer(id, values) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { customer: data || null, error };
}

export async function deleteCustomer(id) {
  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  return { error };
}
