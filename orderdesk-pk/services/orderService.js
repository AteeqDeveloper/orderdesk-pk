import { apiRequest } from "@/lib/api";

export function mapOrder(order) {
  if (!order) return null;
  const id = String(order._id || order.id);
  return {
    ...order,
    id,
    order_number: order.order_number || `#${id.slice(-6).toUpperCase()}`,
    total_amount: order.totalAmount ?? order.total_amount ?? 0,
    order_status: order.orderStatus ?? order.order_status,
    payment_status: order.paymentStatus ?? order.payment_status,
    payment_method: order.paymentMethod ?? order.payment_method,
    created_at: order.createdAt ?? order.created_at,
    customers: order.customerSnapshot || order.customers || {},
    order_items: (order.items || order.order_items || []).map((item, index) => ({
      ...item,
      id: item._id || `${id}-${index}`,
      unit_price: item.unitPrice ?? item.unit_price ?? item.price,
      products: { name: item.name || item.products?.name },
    })),
  };
}

export async function getOrders(request, filters = {}) {
  try {
    const data = await request("orders");
    let orders = (data.orders || []).map(mapOrder);
    if (filters.status) orders = orders.filter((order) => order.order_status === filters.status);
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      orders = orders.filter((order) => order.order_number.toLowerCase().includes(term));
    }
    return { orders, error: null };
  } catch (error) {
    return { orders: [], error };
  }
}

export async function getOrderById(request, id) {
  try {
    const data = await request(`orders/${id}`);
    return { order: mapOrder(data.order), error: null };
  } catch (error) {
    return { order: null, error };
  }
}

export async function createOrder(values) {
  try {
    const data = await apiRequest("orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: values.customerId,
        items: values.items.map(({ productId, quantity }) => ({ productId, quantity })),
        discount: Number(values.discount || 0),
        deliveryCharges: Number(values.deliveryCharges || 0),
        paymentMethod: values.paymentMethod,
        notes: values.notes || "",
      }),
    });
    return { order: mapOrder(data.order), error: null };
  } catch (error) {
    return { order: null, error };
  }
}

export async function updateOrderStatus(id, orderStatus) {
  try {
    const data = await apiRequest(`orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ orderStatus }),
    });
    return { order: mapOrder(data.order), error: null };
  } catch (error) {
    return { order: null, error };
  }
}

export async function updatePaymentStatus(id, paymentStatus) {
  try {
    const data = await apiRequest(`orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus }),
    });
    return { order: mapOrder(data.order), error: null };
  } catch (error) {
    return { order: null, error };
  }
}

export async function deleteOrder(id) {
  return { error: new Error("Order deletion is not supported by the backend API.") };
}
