# Nexus SSO Setup Guide

Portable contract for **JWT-based SSO** between **EMZI Nexus Brain** (identity hub) and **any satellite application**. Nexus signs tokens with a shared secret; your app verifies them and issues a local JWT session.

> **Scope:** Every EMZI satellite app that supports “open from Brain” or “Continue with EMZI Nexus Brain” MUST implement the same endpoints, settings shape, and JWT rules documented here. Replace `{app}`, `{frontend-domain}`, and `{api-domain}` with your deployment values.

**Linkly** in this repository is one reference implementation (`frontend/src/pages/SsoNexus.jsx`, `backend/app/Http/Controllers/SsoController.php`).

---

## How It Works

```
Nexus Brain                          Your satellite app
───────────                          ──────────────────
User clicks app tile    ──►   GET /sso/nexus?token=<JWT>&redirect_to=/dashboard
                                      │
                                      ▼
                              POST /api/sso/nexus/verify  { token }
                                      │
                              Verify HMAC signature, iss, exp
                              Find or create user (nexus_sso_id)
                              Issue JWT Bearer token
                                      │
                                      ▼
                              Redirect to /dashboard (or redirect_to)
```

**Inbound SSO** (Nexus → your app): Nexus redirects users to `/sso/nexus` with a signed JWT.

**Outbound link** (your app → Nexus): The login page includes a “Continue with EMZI Nexus Brain” link that sends users to the Nexus Brain URL (`VITE_NEXUS_BRAIN_URL`).

**Sign-out** (your app → Nexus): When the user signed in via SSO, sign-out sends them back to Nexus Brain using the stored `return_to` value (see [SSO sign-out](#sso-sign-out-return_to) below).

---

## Prerequisites

### 1. Run migrations

SSO requires the `nexus_sso_id` column on `users` and a default `nexus_sso` row in `settings`:

```bash
npm run migrate
cd backend && php artisan db:seed --class=SettingsSeeder --force
```

Schema is defined in `backend/database/migrations/` and default SSO settings are seeded by `SettingsSeeder`.

### 2. Default config

Fresh installs get a disabled SSO config:

| Field | Default |
|-------|---------|
| `enabled` | `false` |
| `secret` | `""` |
| `issuer` | `""` |
| `default_role` | `"user"` |
| `default_role_id` | `null` |

### 3. Production frontend routing

The SSO landing page is a React route (`/sso/nexus`). Your web server must serve `index.html` for client-side routes, for example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## Setup Methods

### Method 1 — Admin UI (recommended)

Best for day-to-day configuration. Requires an **admin** user (`role = admin`).

1. Log in as an admin.
2. Open **Settings** → **SSO** tab.
3. Configure:

   | Setting | Description |
   |---------|-------------|
   | **Enable Nexus SSO** | Must be on or verification returns `422 SSO is not configured.` |
   | **SSO Endpoint** | Copy this URL into Nexus Brain (shown as `{origin}/sso/nexus`). |
   | **API Key (Shared Secret)** | Min. 32 characters. Must match the secret configured in Nexus Brain for this connected system. Use **Generate** or paste a key from Nexus. |
   | **Expected Issuer URL** | Nexus Brain base URL (e.g. `https://emzinexus.com`). JWT `iss` claim must match exactly. Also used to validate `return_to` on sign-out (see below). Leave empty to skip issuer validation — but then relative `return_to` paths cannot be validated server-side. |
   | **Default role for new SSO users** | Built-in `user` / `admin`, or a custom role from the **Roles** page. |

4. Click **Save SSO Settings**.

Config is stored in the `settings` table with key `nexus_sso` and JSON shape:

```json
{
  "enabled": true,
  "secret": "<shared-secret>",
  "issuer": "https://emzinexus.com",
  "default_role": "user",
  "default_role_id": null
}
```

The API never returns the secret on read; it exposes `secret_set: true` when a valid secret is saved.

---

### Method 2 — REST API (`/api/settings`)

Authenticated admins can update SSO config via the settings endpoint.

**Read settings (secret redacted):**

```http
GET /api/settings
Authorization: Bearer <admin-token>
```

**Update:**

```http
PATCH /api/settings
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "nexus_sso": {
    "enabled": true,
    "secret": "<min-32-char-secret>",
    "issuer": "https://emzinexus.com",
    "default_role": "user",
    "default_role_id": null
  }
}
```

Omit `secret` or send an empty string to keep the existing secret. Use `default_role_id` (UUID from `roles` table) for custom roles, or `default_role` (`user` / `admin`) for built-in roles.

---

### Method 3 — Direct database update

Useful for automation or when the UI is unavailable:

```sql
INSERT INTO settings (`key`, `value`) VALUES (
  'nexus_sso',
  '{"enabled":true,"secret":"your-shared-secret-at-least-32-chars","issuer":"https://emzinexus.com","default_role":"user","default_role_id":null}'
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`);
```

---

## Nexus Brain Side Configuration

In **EMZI Nexus Brain** (Connected Systems):

1. Add or edit this app as a connected system.
2. Set **Base URL / SSO Endpoint** to:
   ```
   https://{frontend-domain}/sso/nexus
   ```
3. Set **API Key** to the same value as your app’s shared secret.
4. Ensure Nexus signs JWTs with:
   - Algorithm: **HS256** (HMAC-SHA256 over `header.payload`)
   - Secret: the shared API key

Example redirect URL Nexus should send users to:

```
https://{frontend-domain}/sso/nexus?token=<JWT>&redirect_to=/dashboard&return_to=/applications
```

Optional query parameters:

| Param | Description |
|-------|-------------|
| `redirect_to` | Preferred post-login path within this app (e.g. `/dashboard`, `/bookings`) |
| `return_to` | Where to send the user after they sign out — a Nexus Brain path (e.g. `/applications`) or full URL on the same origin. Relative paths are preferred. Stored in the browser for the session. |

The JWT payload may also include `redirect_to` and `return_to` claims; the server sanitizes both before responding.

---

## SSO Sign-Out (`return_to`)

When a user launches this app from Nexus Brain, Nexus should pass `return_to` on the SSO URL or in the JWT. That value is preserved for the browser session so sign-out can return the user to Nexus.

```
Nexus Brain                          Your satellite app
───────────                          ──────────────────
Launch with return_to   ──►   GET /sso/nexus?token=…&return_to=/applications
                                      │
                                      ▼
                              Store return_to (sessionStorage)
                              Sign user in, redirect to redirect_to
                                      │
User clicks Sign out    ──►   Navigate to Nexus (before React re-render)
                                      │
                                      ▼
                              Clear local session, redirect to Nexus Brain:
                              {VITE_NEXUS_BRAIN_URL}/applications
                              (or full stored return_to URL on same origin)
```

### How `return_to` is validated

| Source | Sanitized by | Allowed targets |
|--------|--------------|-----------------|
| `redirect_to` | `FRONTEND_URL` origins | Paths within this app (e.g. `/dashboard`) or absolute URLs on the app frontend origin |
| `return_to` | **Expected Issuer URL** (+ `FRONTEND_URL` as fallback) | Paths relative to Nexus (e.g. `/applications`) or absolute URLs on the Nexus Brain origin |

Implementation: `backend/app/Services/SsoRedirectService.php` (`sanitizeReturnTo`).

**Important:** Set **Expected Issuer URL** in Settings → SSO to your Nexus Brain base URL (same host as `VITE_NEXUS_BRAIN_URL`). Without it, absolute Nexus `return_to` URLs are rejected and relative paths are not validated server-side (the frontend still stores `return_to` from the query string as a fallback).

### Frontend storage and logout

1. **`/sso/nexus`** reads `return_to` from the query string and from the verify API response, then stores it in `sessionStorage` (`frontend/src/lib/ssoRedirect.js`).
2. **Sign out** (top bar or mobile menu) consumes that value and redirects via `getNexusBrainLogoutUrl()` (`frontend/src/lib/nexusBrain.js`). Navigation runs **before** React auth state is cleared so the login page does not flash briefly (`frontend/src/lib/AuthContext.jsx`).
3. **Logout URL resolution** (`getNexusBrainLogoutUrl`):

   | Stored `return_to` | Sign-out destination |
   |--------------------|----------------------|
   | `/applications` (relative Nexus path) | `https://<VITE_NEXUS_BRAIN_URL>/applications` |
   | `https://emzinexus.com/applications` (full URL on Nexus origin) | `https://emzinexus.com/applications` |
   | Other / unrecognized | `https://<VITE_NEXUS_BRAIN_URL>?return_to=<encoded value>` (legacy fallback) |

   Prefer passing a **relative Nexus path** (e.g. `/applications`) from Nexus Brain on SSO launch — that is the most reliable format.

4. If no `return_to` was stored (e.g. password login), sign-out falls back to `/login`.

---

## Frontend Environment (outbound login)

Set in `frontend/.env` before building:

```env
VITE_NEXUS_BRAIN_URL=https://{nexus-brain-domain}
VITE_API_BASE_URL=https://{api-domain}/api
```

| Variable | Purpose |
|----------|---------|
| `VITE_NEXUS_BRAIN_URL` | Target for “Continue with EMZI Nexus Brain” on the login page, and the base URL used to resolve SSO sign-out destinations. |
| `VITE_API_BASE_URL` | Backend API base used by the SSO landing page. Leave blank in dev to use Vite’s `/api` proxy. |

This does **not** configure inbound SSO verification; that is entirely the backend `nexus_sso` setting.

---

## JWT Token Requirements

Nexus must issue a standard three-part JWT (`header.payload.signature`).

### Signature

```
signature = base64url( HMAC-SHA256( "<header>.<payload>", secret ) )
```

Verified in `backend/app/Services/NexusJwtService.php`.

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
| `name` | Display name; falls back to email (`users.full_name`) |
| `profile_picture` | Absolute URL to the user's Nexus avatar. Synced to `users.avatar_url` on every SSO login (see [Profile Picture Syncing](#profile-picture-syncing)). |
| `redirect_to` | Post-login redirect within this app (sanitized against `FRONTEND_URL`) |
| `return_to` | Post-logout redirect back to Nexus (sanitized against Expected Issuer URL) |

---

## User Provisioning

On successful verification (`POST /api/sso/nexus/verify`):

1. Lookup by `nexus_sso_id` (`sub` claim).
2. If not found, lookup by `email`.
3. If found: update `nexus_sso_id`, `full_name`, and `email`.
4. If not found: create user with:
   - Random password hash (not used for SSO login)
   - `approved`: `1` (skips manual admin approval)
   - Role from `default_role_id` / `default_role` in config, else built-in `user`

Existing users who are not approved (`approved = 0`) fail with `403 User account is not active.`

SSO sign-in and auto-registration are written to the audit log as `sso_login` and `sso_register`.

---

## Profile Picture Syncing

When a Nexus user has a profile picture, the SSO JWT includes a `profile_picture` claim containing a URL to their avatar image hosted on Nexus. The claim may be an absolute URL (`https://nexus.example.com/storage/profile-pictures/abc.jpg`) or a relative path (`/storage/profile-pictures/abc.jpg`).

### How it works

On every SSO login (`POST /api/auth/sso/nexus`):

1. The backend reads the `profile_picture` claim from the decoded JWT.
2. **Relative paths are resolved** — if the claim starts with `/` (e.g. `/storage/profile-pictures/abc.jpg`), the backend prepends the JWT issuer URL (or the configured Expected Issuer) to form a full URL before storing it.
3. If the claim is present and non-empty, the resolved URL is stored in `users.avatar_url`.
4. If the claim is absent, the existing `avatar_url` is **not** cleared — the user may not have set a picture in Nexus.
4. The `avatar_url` is returned in the user payload from the API, and displayed in the **TopBar** avatar and **Profile** page.

This means the avatar updates automatically on each SSO login — whenever the user changes their profile picture in Nexus, the next SSO launch propagates the new URL.

### Schema

The `avatar_url` column (`VARCHAR(2048)`, nullable) is added to the `users` table by migration `2026_07_04_000004_add_avatar_url_to_users_table`.

### Frontend display

The `avatar_url` field (when present) is rendered using `<AvatarImage>` from the Radix UI avatar component. If the URL is missing or fails to load, the component falls back to the user's initials.

Components that display the SSO-synced avatar:

| Component | Location |
|-----------|----------|
| TopBar (desktop account menu) | `frontend/src/components/layout/TopBar.jsx` |
| Profile page (hero avatar) | `frontend/src/pages/ProfilePage.js` |

### Important notes

- The URL points to Nexus storage — no need to download or re-upload the image.
- The avatar is **only** synced during SSO login. Manually created accounts (password login) are not affected.
- If the `profile_picture` claim is omitted (e.g. the user launches with an additional SSO email), the existing avatar is preserved.

---

## Backend Environment

Ensure these are set for correct redirects and CORS in production:

```env
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://{frontend-domain}
```

`FRONTEND_URL` supports comma-separated origins for CORS and is used when sanitizing absolute `redirect_to` URLs. It is **not** used for `return_to`; that uses the **Expected Issuer URL** from SSO settings instead.

(Laravel apps may also set `APP_URL` to the API origin; Node apps may use `PORT` — framework-specific vars do not change the SSO contract.)

---

## API Reference

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /sso/nexus?token=…` | Public | Frontend SSO handler; calls verify API |
| `POST /api/sso/nexus/verify` | Public | Validates JWT, returns JWT token + user |
| `GET /api/settings` | Admin | Read settings (includes `nexus_sso`, secret redacted) |
| `PATCH /api/settings` | Admin | Update `nexus_sso` config |

Verify endpoint is rate-limited to **10 requests/minute** per IP.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `SSO is not configured` | SSO disabled or empty secret | Enable SSO and set API key (≥ 32 chars) in Settings |
| `Invalid token signature` | Secret mismatch between Nexus and your app | Align API keys on both sides |
| `Invalid token issuer` | `iss` claim ≠ Expected Issuer URL | Match issuer URL or clear issuer field to disable check |
| `Token has expired` | JWT `exp` in the past | Nexus must issue fresh tokens |
| `Token missing sub claim` | No Nexus user ID in JWT | Nexus must include `sub` |
| `User account is not active` | User not approved | Approve user in **User Management** (if your app uses approval workflow) |
| Blank page at `/sso/nexus` | SPA not configured for client routing | Add Apache `.htaccess` — see [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md) |
| Sign out goes to `/login` instead of Nexus | `return_to` missing, rejected, or issuer not configured | Pass `return_to` from Nexus on SSO launch; set **Expected Issuer URL** to the Nexus Brain base URL; ensure `VITE_NEXUS_BRAIN_URL` matches |
| Sign out lands on Nexus root with `?return_to=` in the URL | Nexus passed a full absolute URL and an older build used query-param-only logout | Rebuild frontend; prefer relative paths like `/applications` on SSO launch; current builds navigate directly to Nexus paths/URLs on the same origin |
| Brief flash of login page on SSO sign-out | React auth state cleared before navigation (fixed in current builds) | Rebuild frontend; logout now calls `window.location.replace()` before clearing auth state |
| API errors from SSO page | Wrong API base URL or CORS | Set `VITE_API_BASE_URL` and backend `FRONTEND_URL` for production |

---

## Related Code (Linkly reference)

| Area | Location |
|------|----------|
| SSO verification route | `backend/app/Http/Controllers/SsoController.php` |
| JWT verification | `backend/app/Services/NexusJwtService.php` |
| Redirect sanitization | `backend/app/Services/SsoRedirectService.php` |
| SSO landing page | `frontend/src/pages/SsoNexus.jsx` |
| Admin settings UI | `frontend/src/pages/Settings.jsx` (`NexusSsoSettings`) |
| Frontend redirect / logout helpers | `frontend/src/lib/ssoRedirect.js`, `frontend/src/lib/AuthContext.jsx` |
| Nexus Brain URL / logout redirect | `frontend/src/lib/nexusBrain.js` |
| Database schema | `backend/database/migrations/` |
| Avatar URL column | `backend/database/migrations/2026_07_04_000004_add_avatar_url_to_users_table.php` |
| Default SSO settings | `backend/database/seeders/SettingsSeeder.php` |
| Outgoing event webhooks (`nexus_sso_id`) | [event-webhook-setup.md](./event-webhook-setup.md) |
