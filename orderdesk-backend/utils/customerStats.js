const PAID_PAYMENT_STATUS = "paid";
const REFUNDED_PAYMENT_STATUS = "refunded";
const CANCELLED_ORDER_STATUS = "cancelled";

export function isCustomerSpendOrder(order) {
  return (
    order.paymentStatus === PAID_PAYMENT_STATUS &&
    order.paymentStatus !== REFUNDED_PAYMENT_STATUS &&
    order.orderStatus !== CANCELLED_ORDER_STATUS
  );
}

export function getCustomerStatsPipeline(userId, customerId) {
  const match = { userId };
  if (customerId) match.customerId = customerId;

  return [
    { $match: match },
    {
      $group: {
        _id: "$customerId",
        totalOrders: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", PAID_PAYMENT_STATUS] },
                  { $ne: ["$paymentStatus", REFUNDED_PAYMENT_STATUS] },
                  { $ne: ["$orderStatus", CANCELLED_ORDER_STATUS] },
                ],
              },
              { $ifNull: ["$totalAmount", 0] },
              0,
            ],
          },
        },
      },
    },
  ];
}
