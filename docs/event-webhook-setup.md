# Event Webhook Integration Specification

A portable contract for **event-driven HTTP webhooks** between EMZI **satellite applications** (emitters) and a central notification hub such as **EMZI Nexus Brain** (receiver).

> **Scope:** Every EMZI app that emits outbound webhooks MUST conform to §2 (emitter) and document its domain events in the same format. Receivers (typically Brain) MUST conform to §3. Booking and Linkly are reference domains — not the only valid event prefixes.

Use this document as:

- **Requirements** when building a new emitter (any app that sends events)
- **Requirements** when building or extending a receiver (hub that ingests events and routes notifications)
- **Acceptance criteria** for integration testing between two systems

---

## 1. Overview

### 1.1 Purpose

When a business event occurs in a satellite app (e.g. booking submitted, ticket closed, form approved), the emitter POSTs a structured JSON payload to one or more configured webhook URLs. The receiver validates the request, resolves the intended user, and delivers an in-app (or downstream) notification.

### 1.2 Actors

| Actor | Role |
|-------|------|
| **Emitter** | Source application where the event originates. Owns event logic, payload construction, and delivery. |
| **Receiver** | External HTTP endpoint (typically Nexus Brain) that accepts webhooks and routes notifications to users. |
| **Recipient** | End user who should be notified. Identified by `nexus_sso_id` when SSO is linked. |

### 1.3 Flow

```
Emitter                              Receiver
───────                              ────────
Domain event occurs        ──►   POST {webhook.url}
Build payload + recipients ──►   Header: X-Webhook-Secret: whsec_…
Fire-and-forget delivery   ──►   Body: { event, nexus_sso_id, title, body, … }
                                   │
                                   ▼
                             Validate secret → route to user → optional deep link
```

Delivery is **asynchronous and non-blocking**: emitter failures must not roll back the underlying business transaction.

---

## 2. Emitter Requirements

Any system implementing outbound webhooks MUST support the following.

### 2.1 Webhook configuration model

Each webhook endpoint is a record with at minimum:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | yes | Stable identifier; included in every payload as `webhook_id`. |
| `name` | string | no | Human label for admins (e.g. “Nexus Brain”, “Slack”). |
| `url` | string (HTTPS URL) | yes | Receiver endpoint. Must be HTTPS in production. |
| `secret` | string | yes | Shared verification secret. Recommended prefix: `whsec_`. Min. 32 bytes of entropy. |
| `enabled` | boolean | yes | When `false`, skip delivery without deleting config. |
| `events` | object | yes | Map of event keys → boolean subscription flags. |

Example stored shape:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nexus Brain",
  "url": "https://hub.example.com/api/webhooks/inbound",
  "secret": "whsec_a1b2c3…",
  "enabled": true,
  "events": {
    "submitted": true,
    "confirmed": true,
    "rejected": true,
    "cancelled": true
  }
}
```

**Emitter MUST:**

- Support **multiple webhooks** per installation.
- Allow **per-event subscriptions** per webhook.
- Auto-generate `secret` when not provided.
- Never expose secrets in public or unauthenticated APIs (admin-only read is acceptable).
- Provide a **test delivery** mechanism that sends a `webhook.test` event without requiring a real domain object.

### 2.2 Event naming convention

Events use dot-separated namespacing:

```
{domain}.{action}
```

Examples:

| Event | Meaning |
|-------|---------|
| `booking.submitted` | New booking created (Booking app) |
| `booking.confirmed` | Booking approved / confirmed |
| `link.created` | New short link created (Linkly app) |
| `user.approved` | User approved by admin (any app with approval workflow) |
| `webhook.test` | Synthetic test delivery |

**Emitter MUST** use stable, documented event strings. **Receiver SHOULD** treat unknown events as generic notifications (log + optional fallback UI) rather than hard-fail, unless security policy requires rejection.

### 2.3 Event metadata (per event type)

Each event type SHOULD define:

| Property | Type | Description |
|----------|------|-------------|
| `type` | enum | Notification severity: `info`, `success`, `error`, `warning`. |
| `category` | enum | UI grouping: `approval`, `task`, `system`, `other`. |
| `recipientKeys` | string[] | Ordered list of recipient roles for this event (see §2.5). |

Reference mapping (booking domain):

| Event | `type` | `category` | `recipientKeys` |
|-------|--------|------------|-----------------|
| `booking.submitted` | `info` | `approval` | `["pic"]` |
| `booking.confirmed` | `success` | `approval` | `["booker"]` |
| `booking.rejected` | `error` | `approval` | `["booker"]` |
| `booking.cancelled` | `warning` | `task` | `["booker", "pic"]` |
| `webhook.test` | `info` | `system` | `["booker"]` |

Other domains (e.g. `complaint.escalated`, `leave.approved`) SHOULD follow the same pattern.

### 2.4 When to emit

**Emitter MUST** fire webhooks at well-defined lifecycle points. For the booking domain:

| Business action | Event(s) emitted |
|-----------------|------------------|
| Resource request / record created | `booking.submitted`; also `booking.confirmed` if created in a confirmed state |
| Status → confirmed | `booking.confirmed` |
| Status → rejected | `booking.rejected` |
| Status → cancelled | `booking.cancelled` |

Other domains MUST document their own trigger table in the same format.

### 2.5 Recipient resolution

Each event targets one or more **recipient roles** (e.g. `booker`, `pic`, `assignee`, `requester`). The emitter resolves each role to an external identity:

| Field | Description |
|-------|-------------|
| `nexus_sso_id` | Nexus Brain user ID (`sub` from SSO JWT). Primary routing key for the receiver. |

**Resolution rules:**

1. Look up the role’s user record in the emitter’s database.
2. Read linked `nexus_sso_id` (populated via [Nexus SSO](./nexus-sso-setup.md) or equivalent identity linking).
3. Deduplicate: if two roles resolve to the same `nexus_sso_id`, send **one** POST.
4. If no linked ID exists for any required role, emit **one** POST with `nexus_sso_id: null` so the receiver can apply fallback routing (email, skip, etc.).

When an event lists multiple recipients (e.g. `["booker", "pic"]`), the emitter MUST send **separate POST requests per distinct recipient**, each with its own `nexus_sso_id` and tailored `title`/`body` if needed.

### 2.6 HTTP delivery

**Emitter MUST:**

| Requirement | Value |
|-------------|-------|
| Method | `POST` |
| Body | JSON (`Content-Type: application/json`) |
| Header `X-Webhook-Secret` | The webhook’s shared `secret` |
| Header `User-Agent` | `{AppName}-Webhooks/{version}` (e.g. `BookHub-Webhooks/1.0`) |
| Timeout | 10 seconds per request |
| Success | HTTP 2xx response |
| Retries | Optional; if implemented, use exponential backoff. Reference implementation: no retry (log failure only). |
| Concurrency | MAY deliver to multiple webhooks / recipients in parallel |

**Emitter MUST NOT** block or fail the primary business operation when webhook delivery fails.

### 2.7 Payload contract

Every delivery MUST include this top-level JSON structure:

```json
{
  "event": "booking.submitted",
  "timestamp": "2026-06-14T10:30:00.000Z",
  "webhook_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "info",
  "category": "approval",
  "title": "New booking awaiting approval",
  "body": "Jane Doe submitted \"Team standup\" for Conference Room A.",
  "action_url": "https://app.example.com/bookings?booking=abc-123",
  "nexus_sso_id": "nexus-user-id-of-recipient",
  "booking": { }
}
```

#### Required top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Dot-namespaced event identifier. |
| `timestamp` | string | ISO-8601 UTC time of delivery. |
| `webhook_id` | string | Emitter’s webhook config ID. |
| `type` | string | `info` \| `success` \| `error` \| `warning`. |
| `category` | string | `approval` \| `task` \| `system` \| `other`. |
| `title` | string | Short notification heading. |
| `body` | string | Notification message body. |
| `action_url` | string | Absolute URL for “open in source app” deep link. |
| `nexus_sso_id` | string \| null | Recipient’s external identity ID. |

#### Domain object (nested)

The nested object key MUST match the event domain prefix (e.g. `booking` for `booking.*`, `complaint` for `complaint.*`).

**Booking domain — required nested fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Booking ID |
| `title` | string | Booking title |
| `resource_id` | string | Linked resource ID |
| `resource_name` | string | Display name |
| `resource_type` | string | Resource category |
| `start_time` | string | ISO-8601 start |
| `end_time` | string | ISO-8601 end |
| `status` | string | Current status (`pending`, `confirmed`, etc.) |
| `cost_cents` | number | Cost in smallest currency unit |
| `booked_by_email` | string | Actor email |
| `booked_by_name` | string | Actor display name |

**Emitter SHOULD** include only fields available at event time (snapshot semantics, not live join).

#### Example payloads

**`booking.submitted`**

```json
{
  "event": "booking.submitted",
  "timestamp": "2026-06-14T10:30:00.000Z",
  "webhook_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "info",
  "category": "approval",
  "title": "New booking awaiting approval",
  "body": "Jane Doe submitted \"Team standup\" for Conference Room A.",
  "action_url": "https://booking.example.com/bookings?booking=abc-123",
  "nexus_sso_id": "nexus-user-id-of-pic",
  "booking": {
    "id": "abc-123",
    "title": "Team standup",
    "resource_id": "res-456",
    "resource_name": "Conference Room A",
    "resource_type": "Meeting Room",
    "start_time": "2026-06-15T09:00:00.000Z",
    "end_time": "2026-06-15T10:00:00.000Z",
    "status": "pending",
    "cost_cents": 5000,
    "booked_by_email": "jane@example.com",
    "booked_by_name": "Jane Doe"
  }
}
```

**`webhook.test`**

```json
{
  "event": "webhook.test",
  "timestamp": "2026-06-14T10:30:00.000Z",
  "webhook_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "info",
  "category": "system",
  "title": "Test notification",
  "body": "This is a test webhook delivery.",
  "action_url": "https://booking.example.com/bookings",
  "nexus_sso_id": "test-nexus-sso-id",
  "booking": {
    "id": "test-booking-id",
    "title": "Test Booking",
    "resource_id": "test-resource",
    "resource_name": "Test Room",
    "resource_type": "Meeting Room",
    "start_time": "2026-06-14T10:30:00.000Z",
    "end_time": "2026-06-14T11:30:00.000Z",
    "status": "pending",
    "cost_cents": 0,
    "booked_by_email": "test@example.com",
    "booked_by_name": "Test User"
  }
}
```

For non-booking domains, replace the nested `booking` object with the appropriate domain key and field set, documented alongside new event types.

### 2.8 Environment configuration

| Variable | Used by | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | Emitter | Base URL for constructing absolute `action_url` values. |

---

## 3. Receiver Requirements

Any system accepting inbound webhooks MUST implement the following.

### 3.1 Endpoint

- Accept `POST` with `Content-Type: application/json`.
- Respond **2xx within 10 seconds** (emitter timeout).
- **SHOULD** acknowledge immediately (e.g. `200` or `202`) and process asynchronously for heavy work.

### 3.2 Authentication

- Read shared secret from header **`X-Webhook-Secret`**.
- Compare to stored secret using **constant-time** comparison.
- Reject with **401** if missing or invalid.
- **SHOULD** reject non-HTTPS callers in production.

### 3.3 Routing

1. Parse `event`, `title`, `body`, `type`, `category`.
2. Resolve recipient via `nexus_sso_id`:
   - If present → deliver in-app notification to that Nexus user.
   - If `null` → apply fallback (email lookup from nested object, dead-letter log, or skip).
3. Attach `action_url` as the notification’s primary action / deep link.
4. Store `webhook_id` and `timestamp` for idempotency and audit if needed.

### 3.4 Idempotency (recommended)

Receivers SHOULD treat `(webhook_id, event, nexus_sso_id, domain_object.id, timestamp)` as a deduplication key to avoid duplicate notifications when emitters retry.

### 3.5 Error responses

| Status | When |
|--------|------|
| `200` / `202` | Accepted |
| `401` | Invalid or missing `X-Webhook-Secret` |
| `400` | Malformed JSON or missing required fields |
| `422` | Valid request but unsupported event (optional; prefer accept + log) |

---

## 4. Integration Checklist

### 4.1 Emitter checklist

- [ ] Webhook CRUD with `id`, `url`, `secret`, `enabled`, `events`
- [ ] Secret generation (`whsec_` prefix, sufficient entropy)
- [ ] Test delivery endpoint (`webhook.test`)
- [ ] Event catalog documented with triggers and recipient roles
- [ ] `nexus_sso_id` linked on users via SSO or manual mapping
- [ ] Payload matches §2.7 schema
- [ ] `action_url` uses configured public frontend base URL
- [ ] Delivery is non-blocking; failures logged
- [ ] 10s HTTP timeout enforced

### 4.2 Receiver checklist

- [ ] HTTPS POST endpoint registered
- [ ] Secret stored and verified via `X-Webhook-Secret`
- [ ] Parses all required top-level fields
- [ ] Routes on `nexus_sso_id`
- [ ] Renders `title`, `body`, `type`, `category`
- [ ] Deep link from `action_url`
- [ ] Responds 2xx within 10s
- [ ] Handles `webhook.test` for connectivity validation
- [ ] Fallback when `nexus_sso_id` is null

### 4.3 End-to-end test plan

1. Register receiver URL + secret in emitter admin.
2. Send `webhook.test` → expect 2xx and notification (or logged acceptance).
3. Trigger each subscribed domain event → verify payload shape and recipient routing.
4. Confirm multi-recipient events produce separate POSTs with distinct `nexus_sso_id`.
5. Confirm invalid secret returns 401.
6. Confirm disabled webhook receives no deliveries.

---

## 5. Extending to New Domains

To add events from another satellite app (e.g. complaints, leave, assets):

1. **Define event names** under a new prefix: `{domain}.{action}`.
2. **Document trigger points** (which status changes or actions emit which events).
3. **Define recipient roles** and how each maps to `nexus_sso_id`.
4. **Define nested object schema** (key = domain prefix).
5. **Assign** `type`, `category`, and default `title`/`body` templates per event.
6. **Add** subscription toggles to the webhook `events` map (keys are short action names: `submitted`, `approved`, etc., or fully qualified if preferred — emitter and receiver must agree).
7. **Update** receiver to handle new `event` values and nested objects.

---

## 6. Security Considerations

- Rotate webhook secrets on compromise; support regeneration without changing URL.
- Use HTTPS only in production.
- Do not log full secrets or PII in application logs.
- Rate-limit inbound webhook endpoints on the receiver to prevent abuse.
- Validate payload size (recommend max 256 KB).
- `action_url` SHOULD be same-origin or an allowlisted domain on the receiver if opened in embedded contexts.

---

## 7. Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| No deliveries | Webhook disabled, empty URL, or event not subscribed | Verify emitter config |
| HTTP 401 | Secret mismatch | Align `X-Webhook-Secret` on both sides |
| HTTP 4xx/5xx | Receiver validation or server error | Check receiver logs |
| Timeout | Receiver > 10s | Return 202 immediately; process async |
| `nexus_sso_id` null | User never linked via SSO | Link identity or use fallback routing |
| Duplicate notifications | Retries without idempotency | Add dedup key on receiver |
| Wrong deep link | Incorrect `FRONTEND_URL` | Fix emitter base URL config |

---

## Appendix A — Reference implementations

### EMZI Nexus Booking (`booking.*`)

| Spec area | Implementation |
|-----------|----------------|
| Webhook delivery | Planned — not yet ported to Laravel |
| Admin configuration | Settings → Webhooks tab |
| SSO identity linking | [nexus-sso-setup.md](./nexus-sso-setup.md) |

Booking is the reference emitter for the `booking.*` event family.

### EMZI Nexus Sentinel (`domain.*`, `alert.*`, `user.*`)

| Spec area | Implementation |
|-----------|----------------|
| Webhook delivery | `backend/app/Services/EventWebhookService.php` (fire-and-forget POST) |
| Domain events | `backend/app/Services/SentinelWebhookService.php` |
| Admin configuration | Settings → Notifications (`NotificationSettings.jsx`) |
| Default events | `domain.created`, `domain.updated`, `domain.deleted`, `alert.triggered`, `user.registered`, `user.approved`, `webhook.test` |
| Config storage | `settings.event_webhook.webhooks[]` — multiple UUID endpoints per §2.1 |
| Test delivery | `POST /api/settings/event-webhook/test` (admin) |

Sentinel is the reference emitter for the `domain.*` and `alert.*` event families.

### Linkly (`link.*`, `user.*`)

| Spec area | Implementation |
|-----------|----------------|
| Webhook delivery | `backend/app/Services/EventWebhookService.php` (fire-and-forget POST) |
| Domain events | `backend/app/Services/LinkWebhookService.php` |
| Event metadata | `backend/app/Support/EventWebhookMetadata.php` |
| Admin configuration | Settings → Notifications (`NotificationSettings.jsx`) |
| Default events | `link.created`, `link.updated`, `link.deleted`, `user.registered`, `user.approved`, `link.metric_threshold`, `webhook.test` |
| Config storage | `settings.event_webhook.webhooks[]` — multiple UUID endpoints per §2.1 |
| Test delivery | `POST /api/settings/event-webhook/test` (admin) |

Other EMZI apps SHOULD conform to this document and may cite Booking or Linkly as worked examples.
