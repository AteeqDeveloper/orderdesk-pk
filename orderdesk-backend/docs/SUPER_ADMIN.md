# Super Admin Console

The Super Admin console is separate from the business dashboard at `/super-admin`.
Super Admin accounts use a dedicated sign-in page at `/super-admin/login`.
Business accounts cannot use that login, and every `/api/super-admin` endpoint
checks the authenticated database role on the backend.

## Initial account setup

Run the one-time promotion command from `orderdesk-backend` in a trusted
deployment environment. Set `SUPER_ADMIN_EMAIL` to the email address of the
existing registered account. The script promotes only that account, refuses a
suspended or missing account, and refuses promotion if another Super Admin
already exists. It does not create an account or change its password. The
promotion increments `authVersion`, invalidating the account's existing
sessions so the user must sign in again.

PowerShell command (replace the placeholder with the existing account's email):

```powershell
$env:SUPER_ADMIN_EMAIL = "your-existing-account@example.com"
npm run promote-super-admin
Remove-Item Env:SUPER_ADMIN_EMAIL
```

`MONGO_URI` must already be configured for the backend. Do not place
credentials in command history or source control. The script prints only a
generic success/failure status and never displays passwords, tokens, or
connection details. Re-running for the same already-promoted account is
idempotent and reports that no change was made.

## API endpoints

All endpoints below are mounted under `/api`. Except for the separate sign-in
route, they require a valid session and the `super_admin` role.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/super-admin/login` | Super Admin sign-in |
| POST | `/auth/super-admin/logout` | Audited logout; invalidates existing sessions |
| GET | `/super-admin/overview` | Real platform counts and verified revenue |
| GET | `/super-admin/users` | Paginated user search and plan/status filters |
| GET | `/super-admin/users/:userId` | User, subscription, and payment details |
| PATCH | `/super-admin/users/:userId/status` | Suspend/reactivate with a reason |
| PATCH | `/super-admin/users/:userId/plan` | Assign an active plan with a reason |
| GET | `/super-admin/plans` | List plans |
| POST | `/super-admin/plans` | Create a plan with a reason |
| PATCH | `/super-admin/plans/:planId` | Edit/activate/deactivate a plan with a reason |
| GET | `/super-admin/subscriptions` | Paginated subscription search |
| PATCH | `/super-admin/subscriptions/:subscriptionId/status` | Change supported status with a reason |
| GET | `/super-admin/payments` | Read-only paginated payment inspection |
| GET | `/super-admin/analytics` | Registration, distribution, upgrade, cancellation, and verified revenue series |
| GET | `/super-admin/activity` | Paginated append-only audit history |
| GET | `/super-admin/settings` | Current Super Admin and payment configuration status |

List endpoints accept bounded `page` and `limit` parameters. Analytics accepts
`from` and `to` in `YYYY-MM-DD` form with a maximum range of 366 days. Plan
mutations, account status changes, subscription status changes, payment
inspection, and Super Admin login/logout are recorded in the audit log.
Administrative plan assignment is a complimentary grant: it creates no
payment and does not represent a verified payment.

The existing payment-verification endpoint
`POST /subscriptions/admin/payments/:paymentId/verify` is also restricted to
Super Admins and requires an audit reason. It remains a manual administrative
operation; it is not a payment provider callback. Before using it, the
authorized operator must independently verify the transfer in the official
bank/wallet merchant record: match the pending payment's exact PKR amount,
beneficiary, method, and unique transaction reference, and confirm the transfer
is settled rather than merely submitted or pending. Record the verification
source/date in the required reason without entering credentials. If the
merchant record cannot be independently checked, leave the payment pending.

## Subscription snapshots and limitations

Before a plan is edited, the service snapshots its current and pending
subscriptions so that existing users retain the terms/features/limits they
accepted. New subscriptions use the latest plan configuration. Plan edits do
not delete customer data or rewrite payment history.

No JazzCash, Easypaisa, or Safepay credentials, merchant approval, callback
verification, recurring billing, or automatic charging are configured. Paid
plan prices must be deliberately configured before use. Do not treat a
frontend result or administrative plan grant as proof of payment.

Audit entries are append-only through application models and APIs, but this
does not prevent a database operator with direct write access from changing
the underlying collection. State changes and their audit records are not a
single database transaction, so operators should review the activity log if
an administrative request reports an audit failure. Login rate limiting and
multi-factor authentication are also not currently implemented.
