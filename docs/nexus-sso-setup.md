# Nexus SSO Setup Guide

EMZI Nexus Care integrates with **EMZI Nexus Brain** (the parent identity hub) via JWT-based SSO. Nexus signs tokens with a shared secret; this app verifies them and issues a local Sanctum session.

---

## How It Works

```
Nexus Brain                          EMZI Nexus Care
───────────                          ───────────────
User clicks app tile    ──►   GET /sso/nexus?token=<JWT>&redirect_to=/dashboard
                                      │
                                      ▼
                              POST /api/v1/sso/nexus/verify  { token }
                                      │
                              Verify HMAC signature, iss, exp
                              Find or create user (nexus_sso_id)
                              Issue Sanctum Bearer token
                                      │
                                      ▼
                              Redirect to /dashboard (or redirect_to)
```

**Inbound SSO** (Nexus → Care): Nexus redirects users to `/sso/nexus` with a signed JWT.

**Outbound link** (Care → Nexus): Login/Register pages include a “Continue with EMZI Nexus Brain” button that sends users to the Nexus Brain URL (`VITE_NEXUS_BRAIN_URL`).

---

## Prerequisites

### 1. Run migrations

SSO requires the `nexus_sso_id` column on `users` and the `nexus_sso` row in `system_configs`:

```bash
cd backend
php artisan migrate
```

Migration: `backend/database/migrations/2026_06_13_000001_add_nexus_sso_id_to_users.php`

### 2. Seed default config (optional)

Fresh installs get a disabled SSO config from the seeder:

```bash
php artisan db:seed
```

Default `system_configs` entry (`key = nexus_sso`):

| Field | Default |
|-------|---------|
| `enabled` | `false` |
| `secret` | `""` |
| `issuer` | `""` |
| `default_role_id` | Viewer role ID |

### 3. Production frontend routing

The SSO landing page is a React route (`/sso/nexus`). Nginx must serve `index.html` for unknown paths (see `deploy/nginx/care.conf`):

```nginx
try_files $uri $uri/ /index.html;
```

---

## Setup Methods

### Method 1 — Admin UI (recommended)

Best for day-to-day configuration. Requires a user with the `settings.manage` permission (Super Admin / Admin roles).

1. Log in as an admin.
2. Open **Settings**.
3. Find **Nexus SSO Integration** and click the edit (pencil) icon.
4. Configure:

   | Setting | Description |
   |---------|-------------|
   | **API Key (Shared Secret)** | Min. 32 characters. Must match the secret configured in Nexus Brain for this connected system. Use **Generate** or paste a key from Nexus. |
   | **Expected Issuer URL** | Nexus Brain base URL (e.g. `https://emzinexus.com`). JWT `iss` claim must match exactly. Leave empty to skip issuer validation. |
   | **Enable Nexus SSO** | Must be checked or verification returns `422 SSO is not configured.` |

5. Copy the **SSO Endpoint** shown in the dialog: `{your-frontend-origin}/sso/nexus`
6. Save.

Config is stored in `system_configs` with key `nexus_sso`. The UI maps `api_key` ↔ `secret` and `issuer_url` ↔ `issuer` when reading/writing.

When saved via the Admin UI, the JSON shape is:

```json
{
  "enabled": true,
  "secret": "<shared-secret>",
  "issuer": "https://emzinexus.com",
  "default_role": "viewer"
}
```

The Admin UI does **not** expose a default-role picker; it always persists `default_role: "viewer"`. To assign a different role to new SSO users, use the REST API or direct database update (Method 3 or 4) with `default_role_id` or `default_role`.

The database seeder and role-normalization migration use `default_role_id` (numeric). The verify endpoint accepts either `default_role_id` or `default_role` (slug), preferring `default_role_id` when both are present.

---

### Method 2 — Database seeder (initial / dev)

On first `php artisan db:seed`, a disabled `nexus_sso` config is created automatically. Edit values afterward via the UI or SQL.

To reset to seeded defaults on a fresh database, re-run migrations and seeders (destructive only on empty DB due to `firstOrCreate`).

---

### Method 3 — REST API (`system-configs`)

Authenticated admins can create or update the config via the API.

**Find existing config:**

```http
GET /api/v1/system-configs
Authorization: Bearer <admin-token>
```

**Create:**

```http
POST /api/v1/system-configs
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "key": "nexus_sso",
  "label": "Nexus SSO Settings",
  "json_value": {
    "enabled": true,
    "secret": "<min-32-char-secret>",
    "issuer": "https://emzinexus.com",
    "default_role_id": 7
  }
}
```

**Update:**

```http
PATCH /api/v1/system-configs/{id}
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "json_value": {
    "enabled": true,
    "secret": "<shared-secret>",
    "issuer": "https://emzinexus.com",
    "default_role_id": 7
  }
}
```

Use `default_role_id` (numeric role ID) or `default_role` (slug, e.g. `viewer`, `customer_service`). New SSO users receive this role on first login.

---

### Method 4 — Direct database update

Useful for automation or when the UI is unavailable:

```sql
UPDATE system_configs
SET json_value = JSON_OBJECT(
  'enabled', true,
  'secret', 'your-shared-secret-at-least-32-chars',
  'issuer', 'https://emzinexus.com',
  'default_role_id', (SELECT id FROM roles WHERE slug = 'viewer' LIMIT 1)
),
updated_at = NOW()
WHERE `key` = 'nexus_sso';
```

If no row exists, insert one matching the seeder structure in `backend/database/seeders/DatabaseSeeder.php`.

---

## Nexus Brain Side Configuration

In **EMZI Nexus Brain** (Connected Systems):

1. Add or edit this app as a connected system.
2. Set **Base URL / SSO Endpoint** to:
   ```
   https://<your-care-frontend-domain>/sso/nexus
   ```
3. Set **API Key** to the same value as Care’s shared secret.
4. Ensure Nexus signs JWTs with:
   - Algorithm: **HS256** (HMAC-SHA256 over `header.payload`)
   - Secret: the shared API key

Example redirect URL Nexus should send users to:

```
https://care.example.com/sso/nexus?token=<JWT>&redirect_to=/dashboard
```

Optional query parameters:

| Param | Description |
|-------|-------------|
| `redirect_to` | Preferred post-login path (e.g. `/complaints/123`) |
| `return_to` | Fallback if `redirect_to` is absent |

The JWT payload may also include a `redirect_to` claim. On the frontend, redirect resolution order is:

1. `redirect_to` query param
2. `return_to` query param
3. `redirect_to` from the verify API response (sanitized JWT claim)

Relative paths only (`/dashboard`, `/complaints/123`). Absolute URLs must match the frontend origin.

---

## Frontend Environment (outbound login)

To point “Continue with EMZI Nexus Brain” at the correct Nexus instance, set in `frontend/.env` before build:

```env
VITE_API_URL=/api/v1
VITE_NEXUS_BRAIN_URL=https://emzinexus.com
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `/api/v1` | Backend API base; in dev, Vite proxies `/api` to Laravel (`frontend/vite.config.js`) |
| `VITE_NEXUS_BRAIN_URL` | `https://emzinexus.com` | Outbound redirect target for Nexus Brain login |

In production with a separate API subdomain, set `VITE_API_URL=https://careapi.example.com/api/v1` before `npm run build`.

Used on:

- Login page (`/login`) via `NexusBrainLoginButton`
- Register page (`/register`) via `NexusBrainLoginButton`
- Auth layout footer link (`AuthLayout`)

This does **not** configure inbound SSO verification; that is entirely backend `nexus_sso` config.

---

## JWT Token Requirements

Nexus must issue a standard three-part JWT (`header.payload.signature`).

### Signature

```
signature = base64url( HMAC-SHA256( "<header>.<payload>", secret ) )
```

Verified in `backend/app/Http/Controllers/Api/V1/SsoController.php`.

### Required claims

| Claim | Purpose |
|-------|---------|
| `sub` | Nexus user ID (stored as `users.nexus_sso_id`) |
| `email` | Valid email address |
| `exp` | Unix timestamp; must be in the future |

### Optional claims

| Claim | Purpose |
|-------|---------|
| `iss` | Must match configured issuer if issuer is set |
| `name` | Display name; falls back to email |
| `redirect_to` | Post-login redirect (sanitized server-side) |

---

## User Provisioning

On successful verification (`POST /api/v1/sso/nexus/verify`):

1. Lookup by `nexus_sso_id` (`sub` claim).
2. If not found, lookup by `email`.
3. If found: update `nexus_sso_id`, `name`, `full_name`, and `email`.
4. If not found: create user with:
   - Random password (not used for SSO login)
   - `status`: active
   - `approval_status`: approved (skips manual admin approval)
   - Role: `default_role_id` / `default_role` from config, else system default

Existing users who were disabled or rejected will fail with `403 User account is not active.`

---

## Backend Environment

Ensure these are set for correct redirects and CORS in production:

```env
APP_URL=https://careapi.example.com
FRONTEND_URL=https://care.example.com
```

`FRONTEND_URL` is used when sanitizing absolute `redirect_to` URLs in JWT claims.

---

## API Reference

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /sso/nexus?token=…` | Public | Frontend SSO handler; calls verify API |
| `POST /api/v1/sso/nexus/verify` | Public | Validates JWT, returns Sanctum token + user |
| `GET/POST/PATCH /api/v1/system-configs` | Admin (Sanctum) | Manage `nexus_sso` config |

Verify endpoint is rate-limited to **10 requests/minute**.

### Verify request / response

**Request:**

```http
POST /api/v1/sso/nexus/verify
Content-Type: application/json

{ "token": "<JWT>" }
```

**Success (200):**

```json
{
  "token": "<sanctum-plain-text-token>",
  "user": {
    "id": "1",
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "nexus_sso_id": "nexus-user-uuid",
    "role_id": "7",
    "permissions": ["…"]
  },
  "redirect_to": "/complaints/123"
}
```

`redirect_to` is omitted or `null` when the resolved destination is `/dashboard`. The frontend stores the Sanctum token in `localStorage` under the key `care_auth_token`, then performs a full-page redirect to the resolved path.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `SSO is not configured` | SSO disabled or empty secret | Enable SSO and set API key in Settings |
| `Invalid token format` | JWT is not three dot-separated segments | Nexus must issue a standard JWT |
| `Invalid token signature` | Secret mismatch between Nexus and Care | Align API keys on both sides |
| `Invalid token issuer` | `iss` claim ≠ Expected Issuer URL | Match issuer URL or clear issuer field to disable check |
| `Token has expired` | JWT `exp` in the past | Nexus must issue fresh tokens |
| `Token missing sub claim` | No Nexus user ID in JWT | Nexus must include `sub` |
| `Token missing email claim` | No valid email in JWT | Nexus must include a valid `email` claim |
| `User account is not active` | User disabled/rejected in Care | Re-enable user in **Users** |
| Blank page at `/sso/nexus` | SPA not configured for client routing | Ensure Nginx `try_files … /index.html` |
| API errors from SSO page | Wrong `VITE_API_URL` or CORS | Set `VITE_API_URL` and backend `FRONTEND_URL` / CORS for production |

The **≥ 32 character** API key requirement is enforced in the Admin UI save button only; the backend accepts any non-empty secret. Use at least 32 characters in production.

---

## Related Code

| Area | Location |
|------|----------|
| SSO verification | `backend/app/Http/Controllers/Api/V1/SsoController.php` |
| API routes | `backend/routes/api.php` |
| SSO landing page | `frontend/src/pages/SsoNexus.jsx` |
| Admin settings UI | `frontend/src/pages/Settings.jsx` |
| “Continue with EMZI Nexus Brain” button | `frontend/src/components/auth/NexusBrainLoginButton.jsx` |
| Auth layout footer link | `frontend/src/components/layout/AuthLayout.jsx` |
| HTTP client & token storage | `frontend/src/api/http.js` |
| Redirect sanitization | `backend/app/Support/SsoRedirect.php`, `frontend/src/lib/ssoRedirect.js` |
| Nexus Brain URL | `frontend/src/lib/nexusBrain.js` |
| User SSO ID column | `backend/database/migrations/2026_06_13_000001_add_nexus_sso_id_to_users.php` |
| SSO default role migration | `backend/database/migrations/2026_05_27_000005_normalize_roles.php` |
| Default config seeder | `backend/database/seeders/DatabaseSeeder.php` |
| Outgoing webhooks (includes `sso_id`) | `backend/app/Http/Controllers/Api/V1/WebhookController.php` |
