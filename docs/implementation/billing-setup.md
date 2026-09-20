# Stripe billing setup (not activated)

Billing is credential gated and disabled unless `BILLING_ENABLED=true`. No live Stripe resources, charges, merchant identity, or public plan benefits were created by this implementation. Free quotas remain unchanged. The merchant owner must confirm the legal business identity, jurisdiction, settlement account, tax handling, refund/cancellation policy, support details, commercial offers, and quota entitlements before enabling charges. These decisions are pending.

## Configuration and provider steps

1. Apply `workers/qr-service/migrations/0005_billing.sql` to the intended D1 database. Route `/billing`, `/billing/customer`, `/billing/checkout`, and `/billing/events` through the Worker's existing `SERVICE_SECRET` bearer gate before `billingRequest`.
2. Configure existing Google account login and `QR_SERVICE_URL` / `QR_SERVICE_SECRET`. The web service secret must match the Worker service secret. Never put Stripe or service secrets in public environment variables.
3. In a Stripe sandbox, after the merchant confirms the intended offers, create two distinct fixed, positive, per-unit recurring prices. Only licensed monthly or yearly prices are accepted; metered, zero, tiered, inactive, and custom amounts are rejected. Prices must belong to the configured key's mode. Set server-only `STRIPE_PRICE_PRO` and `STRIPE_PRICE_BRAND` to those exact price IDs. The UI gets actual amounts in Stripe minor currency units and does not invent currency or price.
4. Set server-only `STRIPE_SECRET_KEY` to the sandbox secret key. Configure Stripe Customer Portal for the intended cancellation/payment management features. Review portal product-switch settings separately; this code does not configure or enable switching in the Dashboard.
5. Register `https://qrupgrade.com/api/billing/webhook` with snapshot event types `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `checkout.session.completed`. Set `STRIPE_WEBHOOK_SECRET` to that endpoint's signing secret. For isolated local sandbox testing, forward the Stripe CLI to `http://localhost:3040/api/billing/webhook` and use the CLI's separate signing secret. Production and sandbox databases must remain separate because an owner has exactly one mode-specific customer binding.
6. Only when merchant decisions are approved, test the intended sandbox flows and explicitly set `BILLING_ENABLED=true` in that sandbox. Live activation is a separate owner-authorized operation requiring live prices, key, webhook secret, and reviewed legal/offer configuration. No activation occurred here.

Reference: [Stripe Checkout creation](https://docs.stripe.com/api/checkout/sessions/create), [webhook verification](https://docs.stripe.com/webhooks), [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal).

## Public API

- `GET /api/billing`: no-store `BillingStatus` from `src/lib/billing-types.ts`. Missing configuration returns 200 with configured=false and no offers/subscription. Provider failure returns 503, never a fabricated free state. `amount` is minor currency units; `currentPeriodEnd` is Unix seconds.
- `POST /api/billing/checkout`: exact JSON `{ "tier": "pro" }` or `{ "tier": "brand" }`, authenticated verified Google session and canonical same-origin request. Returns `{url}` on official `checkout.stripe.com`, or `billing.stripe.com` when a blocking subscription already exists.
- `POST /api/billing/portal`: exact JSON `{}`, same session/origin requirements; no browser-provided customer ID. Returns `{url}` on `billing.stripe.com`.
- `POST /api/billing/webhook`: raw body, up to 256 KiB within five seconds, SDK signature verification with 300-second tolerance. Checkout/portal JSON is capped at 1 KiB within five seconds.

Production return URLs are fixed to `https://qrupgrade.com/billing?checkout=returned`, `?checkout=cancelled`, and `/billing`. Development uses only `http://localhost:3040`. A return query never grants a subscription or proves payment.

## Private Worker contract

Every route requires the dispatcher's shared bearer authentication. Owner routes also require `x-qr-user` as a 64-character lowercase hexadecimal account hash.

- `GET /billing` returns `{binding:null|row}`. Row fields: owner, customer_id, mode, reservation, tier, reserved_at, session_id, lease_until.
- `PUT /billing/customer`, `{customerId,mode}` binds an owner exactly once; identical retries succeed; owner/customer reassignment or mode changes return 409. Customer IDs are unique across owners.
- `POST /billing/checkout`, `{action:"reserve",token,tier}` atomically acquires a 60-second lease. A fresh reservation persists token/tier/time; an expired lease recovers those same original values. Tokens are 32 hexadecimal characters generated on the server.
- `POST /billing/checkout`, `{action:"finalize",token,sessionId}` stores the verified Stripe session and relinquishes the lease. `{action:"release",token}` clears the reservation only after the web service has retrieved a definitively expired Stripe session. Both operations match owner and reservation token.
- `POST /billing/events`, `{id,type,created,customerId,subscriptionId,mode}` records only minimal event identifiers and timestamps, after resolving the customer in persisted bindings. Unknown or cross-mode customers are acknowledged without creating bindings; duplicate event IDs are idempotent. Database failures return 503.

No email, card, client secret, full event payload, or hosted session URL is stored in D1. A checkout session ID is retained privately for recovery, never returned to the browser.

## Reconciliation and failure handling

Each status or checkout request retrieves the Stripe customer and at most 100 fresh subscriptions. Customer metadata owner and mode must match the persisted binding. Overflow and network failures return 503. Active, trialing, past_due, unpaid, incomplete, and paused subscriptions block another checkout and send the user to the portal. Only configured price IDs with quantity one map to a tier; no paid quota increases are implemented.

Webhook delivery order does not influence subscription state. D1 records durable minimal event metadata, including duplicates/out-of-order events safely; current Stripe reads remain authoritative. Failures to persist a recognized event return 503 so Stripe retries.

A reservation holds the original tier, timestamp, and idempotency key across ambiguous provider failures. Retrying never chooses a new tier or creates a new reservation blindly. Checkout expiry is fixed at reservation time plus 31 minutes: Stripe requires at least 30 minutes at request receipt, and the extra minute is a transport allowance. After 23 hours an unresolved creation is blocked to avoid replay after Stripe's idempotency retention window. An operator must inspect the customer's current Stripe subscriptions and Checkout Sessions, retrieve any known session, confirm whether a subscription exists or the session expired, and reconcile the reservation through the authenticated service. Do not clear an uncertain reservation, change price configuration during unresolved checkout creation, or rotate into a different Stripe account without reconciling customer bindings. Recovery can temporarily return 503 while the 60-second lease is held; the UI may retry after that interval.

Validation used only fixture Stripe methods, genuine SDK-generated webhook signatures, and an in-memory real SQLite database. No live financial transactions were executed.
