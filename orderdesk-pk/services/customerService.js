import { apiRequest } from "@/lib/api";

function mapCustomer(customer) {
  if (!customer) return null;
  return {
    ...customer,
    id: String(customer._id || customer.id),
    created_at: customer.createdAt ?? customer.created_at,
  };
}

function mapOrder(order) {
  const id = String(order._id || order.id);
  const customer = order.customerSnapshot || order.customers || {};
  return {
    ...order,
    id,
    order_number: order.order_number || `#${id.slice(-6).toUpperCase()}`,
    total_amount: order.totalAmount ?? order.total_amount ?? 0,
    order_status: order.orderStatus ?? order.order_status,
    payment_status: order.paymentStatus ?? order.payment_status,
    payment_method: order.paymentMethod ?? order.payment_method,
    created_at: order.createdAt ?? order.created_at,
    customers: customer,
    order_items: (order.items || order.order_items || []).map((item, index) => ({
      ...item,
      id: item._id || `${id}-${index}`,
      unit_price: item.unitPrice ?? item.unit_price ?? item.price,
      products: { name: item.name || item.products?.name },
    })),
  };
}

export async function getCustomers(request, filters = {}) {
  try {
    const data = await request("customers");
    let customers = (data.customers || []).map(mapCustomer);
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      customers = customers.filter((customer) =>
        `${customer.name} ${customer.phone || ""} ${customer.email || ""}`
          .toLowerCase()
          .includes(term)
      );
    }
    return { customers, error: null };
  } catch (error) {
    return { customers: [], error };
  }
}

export async function getCustomerById(request, id) {
  try {
    const data = await request(`customers/${id}`);
    return { customer: mapCustomer(data.customer), error: null };
  } catch (error) {
    return { customer: null, error };
  }
}

export async function getCustomerOrders(request, customerId, limit = 10) {
  try {
    const data = await request("orders");
    const customerOrders = (data.orders || [])
      .filter((order) => String(order.customerId) === String(customerId))
      .map(mapOrder);
    return {
      orders: customerOrders.slice(0, limit),
      totalOrders: customerOrders.length,
      totalSpent: customerOrders.reduce((total, order) => total + Number(order.total_amount || 0), 0),
      error: null,
    };
  } catch (error) {
    return { orders: [], totalOrders: 0, totalSpent: 0, error };
  }
}

export async function createCustomer(userId, values) {
  try {
    const data = await apiRequest("customers", {
      method: "POST",
      body: JSON.stringify(values),
    });
    return { customer: mapCustomer(data.customer), error: null };
  } catch (error) {
    return { customer: null, error };
  }
}

export async function updateCustomer(id, values) {
  try {
    const data = await apiRequest(`customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    });
    return { customer: mapCustomer(data.customer), error: null };
  } catch (error) {
    return { customer: null, error };
  }
}

export async function deleteCustomer(id) {
  try {
    await apiRequest(`customers/${id}`, { method: "DELETE" });
    return { error: null };
  } catch (error) {
    return { error };
  }
}
