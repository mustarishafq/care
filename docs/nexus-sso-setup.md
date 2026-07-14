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
| `profile_picture` | URL (absolute or relative) to the user's Nexus avatar. Downloaded and cached locally on every SSO login (see [Profile Picture Syncing](#profile-picture-syncing)). |
| `redirect_to` | Post-login redirect within this app (sanitized against `FRONTEND_URL`) |
| `return_to` | Post-logout redirect back to Nexus (sanitized against Expected Issuer URL) |

---

## User Provisioning

On successful verification (`POST /api/sso/nexus/verify` or this app’s `POST /api/auth/sso/nexus`):

1. Lookup by `nexus_sso_id` / `sso_subject` (`sub` claim).
2. If not found, lookup by `email`.
3. If found: update SSO subject / name / email as your app’s rules allow, and sync avatar when a profile-picture claim is present (see [Profile Picture Syncing](#profile-picture-syncing)).
4. If not found: create user with:
   - Random password hash (not used for SSO login)
   - `approved`: `1` (skips manual admin approval) — or `status: active` if your app uses status instead
   - Role from `default_role_id` / `default_role` in config, else built-in default
   - `avatar_url` from the synced profile picture when present

Existing users who are not approved (`approved = 0`) fail with `403 User account is not active.`

SSO sign-in and auto-registration are written to the audit log as `sso_login` and `sso_register`.

---

## Profile Picture Syncing

When a Nexus user has a profile picture, the SSO JWT includes a `profile_picture` claim with a URL to their avatar on Nexus. Satellite apps should **download and cache** that image locally (not hotlink Nexus storage forever). This app does that on every SSO login and exposes a stable `avatar_url` on the user payload for UI display.

Use this section as the portable contract when wiring the same behavior into another EMZI satellite.

### Claim shapes Nexus may send

Accept any of these JWT claims (first non-empty wins):

| Claim | Notes |
|-------|--------|
| `profile_picture` | Preferred Nexus claim |
| `profilePicture` | Camel-case alias |
| `avatar_url` / `picture` / `avatar` | Defensive aliases |

Value may be:

| Form | Example |
|------|---------|
| Absolute URL | `https://emzinexus.com/storage/profile-pictures/abc.jpg` |
| Relative path | `/storage/profile-pictures/abc.jpg` |

**Important:** Nexus profile files usually live on the **Nexus API / storage host**, not the Brain SPA issuer host. An absolute URL whose path starts with `/storage/` should be rehosted against `NEXUS_BASE_URL` (e.g. `https://brainapi.emzinexus.com/storage/...`) before fetch.

### Recommended flow (portable)

```
Nexus JWT claim                  Your satellite backend
───────────────                  ──────────────────────
profile_picture = URL/path  ──►  Resolve to absolute fetch URL
                                      │
                                      ▼
                                 HTTP GET image (timeout ~10s)
                                      │
                         success? ────┴──── fail?
                            │                 │
                            ▼                 ▼
                 Validate bytes are image    Store resolved remote URL
                 Save to local public disk   as fallback in avatar_url
                 Store local path in DB
                            │
                            ▼
                 API returns absolute avatar_url
                 Frontend renders <img> / Avatar with initials fallback
```

On every successful SSO verify / login:

1. **Extract** the profile-picture claim (table above).
2. **Resolve** a fetchable absolute source URL:
   - Already `http(s)://…` → use as-is, unless path is `/storage/…` then rewrite origin to `NEXUS_BASE_URL`.
   - Relative `/storage/…` → `{NEXUS_BASE_URL}/storage/…`.
   - Other relative paths → `{issuer or Expected Issuer}/{path}` , else `NEXUS_BASE_URL`.
3. **Download** the image from that URL.
4. **Validate** response body is a real image (`jpeg` / `png` / `gif` / `webp`), reasonably sized (skip tiny/empty payloads).
5. **Save** under your public storage disk, e.g. `profile-pictures/{random40}.{ext}`, and store **`/storage/profile-pictures/...`** in `users.avatar_url`.
6. **Fallback:** if download or validation fails, store the resolved **remote** URL so the avatar still displays.
7. **Do not clear** `avatar_url` when the claim is missing — preserve the last known picture.
8. On **create** and **refresh** of SSO users, set `avatar_url` only when step 5/6 produced a non-empty value.

Avatars refresh on each SSO login: after a user changes their picture in Nexus, the next launch re-fetches and replaces the local cache path.

### Schema

Add a nullable column on users:

```sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(2048) NULL;
```

Reference migration in this app: `backend/database/migrations/2026_07_04_000004_add_avatar_url_to_users_table.php`.

Ensure the public disk is web-accessible (Laravel: `php artisan storage:link` so `/storage/...` maps to `storage/app/public/...`).

### API response — always return a displayable URL

Store relative paths in the DB when possible (`/storage/profile-pictures/...`). When serializing the user for the frontend, resolve to an absolute URL:

| Stored `avatar_url` | Returned to client |
|---------------------|--------------------|
| `https://…` | unchanged |
| `/storage/profile-pictures/….jpg` | `{APP_URL}/storage/profile-pictures/….jpg` |
| empty / null | `null` |

This app does that in `ApiSerializer::resolveAvatarUrl()` using `config('app.url')`.

### Frontend display

Contract for any satellite UI:

1. Prefer `user.avatar_url` from the auth/user API payload.
2. Render it as an image (`<img>` or Radix/shadcn `Avatar` + `AvatarImage`).
3. On missing URL or load error, fall back to **initials** from `full_name` / `email`.

This app’s shared component is `frontend/src/components/UserAvatar.jsx` (`src = avatarUrl ?? user?.avatar_url`).

| Surface | Location |
|---------|----------|
| TopBar account menu | `frontend/src/components/layout/TopBar.jsx` |
| Profile hero | `frontend/src/pages/ProfilePage.js` |
| Pickers / recognition feeds | any consumer of `UserAvatar` |

### Backend implementation (this app)

| Step | Where |
|------|--------|
| Extract + resolve + download + store | `AuthController` — `extractProfilePictureClaim`, `resolveProfilePictureSourceUrl`, `syncProfilePicture` |
| Persist on provision / refresh | `provisionSsoUser`, `refreshSsoUser` (`avatar_url` only if non-empty) |
| Absolute URL in API JSON | `backend/app/Services/ApiSerializer.php` → `resolveAvatarUrl` |
| Nexus storage base | `NEXUS_BASE_URL` → `config('management.nexus_base_url')` |

Pseudo-flow matching this codebase:

```php
$claim = extractProfilePictureClaim($payload); // profile_picture, …
$localOrRemote = syncProfilePicture($claim, $issuer); // returns /storage/... or https://...
if ($localOrRemote !== '') {
    $user->avatar_url = $localOrRemote;
}
// API:
'avatar_url' => resolveAvatarUrl($user->avatar_url); // make /storage absolute via APP_URL
```

### Rules for other systems

- Sync **only** on SSO login (or an explicit refresh you add later)—not on every page load.
- Prefer **local cache** so your UI does not depend on Nexus being reachable for every avatar request.
- Accept relative and absolute claims; rewrite `/storage/` URLs onto the Nexus **API** base, not the SPA issuer.
- Never wipe an existing avatar when Nexus omits the claim.
- Keep stored values ≤ ~2048 characters; random filenames avoid collisions and stale CDN paths.
- Password-only / manually created users are unchanged unless they later sign in via SSO with a picture claim.

---

## Backend Environment

Ensure these are set for correct redirects, CORS, and avatar fetch in production:

```env
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://{frontend-domain}
APP_URL=https://{api-domain}
NEXUS_BASE_URL=https://{nexus-api-domain}
```

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | CORS + sanitizing absolute `redirect_to` URLs (not used for `return_to`; that uses Expected Issuer). |
| `APP_URL` | API origin used to turn `/storage/...` avatar paths into absolute URLs in JSON. |
| `NEXUS_BASE_URL` | Nexus API/storage host used when resolving `/storage/...` profile-picture URLs before download. |

(Laravel apps may also set other framework vars; Node apps may use `PORT` — those do not change the SSO contract.)

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
| Avatar missing after SSO | Claim omitted, or download failed and no fallback URL | Confirm JWT includes `profile_picture`; set `NEXUS_BASE_URL`; ensure `storage:link` and public disk writable |
| Avatar URL 404 in UI | Relative `/storage/...` not resolved or symlink missing | Set `APP_URL`; run `php artisan storage:link`; check `ApiSerializer::resolveAvatarUrl` |
| Avatar still shows old Nexus host | Cached remotely only / hotlinked | Prefer local cache path from `syncProfilePicture`; re-login via SSO to refresh |

---

## Related Code (Linkly / management reference)

| Area | Location |
|------|----------|
| SSO verification route | `backend/app/Http/Controllers/SsoController.php` (Linkly) / `AuthController::ssoNexus` (this app: `POST /api/auth/sso/nexus`) |
| JWT verification | `backend/app/Services/NexusJwtService.php` |
| Redirect sanitization | `backend/app/Services/SsoRedirectService.php` |
| SSO landing page | `frontend/src/pages/SsoNexus.jsx` / `frontend/src/pages/SSONexusCallback.js` |
| Admin settings UI | `frontend/src/pages/Settings.jsx` (`NexusSsoSettings`) |
| Frontend redirect / logout helpers | `frontend/src/lib/ssoRedirect.js`, `frontend/src/lib/AuthContext.jsx` |
| Nexus Brain URL / logout redirect | `frontend/src/lib/nexusBrain.js` |
| Profile picture download + cache | `AuthController` — `syncProfilePicture` / `resolveProfilePictureSourceUrl` |
| Avatar URL in API payload | `backend/app/Services/ApiSerializer.php` (`resolveAvatarUrl`) |
| Avatar UI component | `frontend/src/components/UserAvatar.jsx` |
| Database schema | `backend/database/migrations/` |
| Avatar URL column | `backend/database/migrations/2026_07_04_000004_add_avatar_url_to_users_table.php` |
| Default SSO settings | `backend/database/seeders/SettingsSeeder.php` |
| Outgoing event webhooks (`nexus_sso_id`) | [event-webhook-setup.md](./event-webhook-setup.md) |
