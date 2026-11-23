# Subscription and billing API

All routes are mounted at `/api/subscriptions` and require the existing authenticated-user JWT. User-owned reads and mutations are scoped to the authenticated user; frontend-supplied user IDs are not accepted. Routes under `/admin` additionally require `User.role === "admin"`.

## User endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/plans` | List active plans, limits, and configured pricing |
| `GET` | `/current` | Current plan, usage, and latest pending request |
| `POST` | `/requests` | Create a paid-plan request with `{ "planId": "..." }` |
| `POST` | `/cancel` | Schedule end-of-period cancellation, or cancel a pending request with `{ "subscriptionId": "..." }` |
| `GET` | `/payments?page=1&limit=20` | Paginated payment history |
| `GET` | `/payments/:paymentId` | Payment details owned by the authenticated user |

## Admin endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/plans` | List active and inactive plans |
| `POST` | `/admin/plans` | Create a plan |
| `PATCH` | `/admin/plans/:planId` | Update plan price, limits, features, billing cycle, or activation |
| `GET` | `/admin/subscriptions?page=1&limit=50&status=...` | Paginated subscription list |
| `PATCH` | `/admin/subscriptions/:subscriptionId/status` | Mark a subscription `cancelled`, `expired`, `past_due`, or `failed` |
| `POST` | `/admin/payments/:paymentId/verify` | Verify a manual payment with `{ "transactionReference": "...", "paymentMethod": "manual_bank_transfer" }` |

Manual payment methods accepted by the verification route are `manual_bank_transfer`, `manual_jazzcash`, and `manual_easypaisa`. Transaction references are unique and payment verification is idempotent for the same payment and verification details.

## Plan defaults and usage enforcement

The seed defaults are maintained in `config/subscriptionPlans.js`: Free is limited to 50 products, 100 customers, and 100 orders/month; Starter to 500, 1,000, and 1,000; Pro to 5,000, 10,000, and 10,000. Limits are stored on `SubscriptionPlan` documents and can be changed through the admin plan endpoint. `null` means unlimited. Seed operations only create missing plans and do not overwrite admin changes.

Starter and Pro prices start unconfigured; their prices must be set by an administrator before an upgrade can be requested. Product, customer, order creation and backup restore check usage on the backend. Create routes serialize quota checks per user and resource to avoid concurrent requests consuming the same remaining slot. Restored orders count toward the current usage period while retaining their historical business dates. Existing data is not deleted when limits are lowered; new records and restores are blocked until the account is within its configured limits.

New accounts receive the Free plan during registration. Existing accounts without a subscription are assigned Free on login or when subscription details or a quota-protected create operation is requested. Expired subscriptions are processed at startup and every five minutes; subscription reads also handle expiration.

## Payment status and production requirements

There is no integrated Safepay, JazzCash, or Easypaisa provider. The provider names in enums, UI labels, and manual payment methods do not indicate an online integration. There are no provider webhook endpoints, provider credentials, or verified callback signatures, so no provider-specific signature documentation or algorithms have been adopted.

Upgrade requests only create pending subscription and payment records; they do not charge a customer or activate a plan. The Super Admin manual verification route is an operator attestation that the transfer was independently checked against the provider's merchant record. It is not a provider callback and does not verify a transaction with a provider. The route checks payment/subscription ownership and the stored PKR amount, currency, and plan terms; it atomically claims a pending payment, enforces unique transaction references, and tolerates repeated/concurrent verification attempts without activating the same subscription twice. Payment verification audit entries use a unique idempotency key and omit the transaction reference from audit metadata.

Pending, paid, failed, cancelled, and refunded are representable payment statuses. There is no customer refund operation or automatic provider-driven refund/status transition. Do not treat frontend redirects, customer-submitted transaction references, or manual payment method labels as proof of payment. Production online payments require merchant approval, provider-owned backend credentials, current official callback documentation, provider-specific signature and transaction verification, endpoint/body-size controls, sandbox validation, and provider-specific retry/reconciliation tests before adding any webhook route. No merchant credentials were inspected or added for this work.
