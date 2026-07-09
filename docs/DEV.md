# Local development

Run the **React SPA** and **Laravel API** together from the repo root with a single command.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Root + `frontend/` npm installs |
| PHP | 8.3+ | Extensions: `mbstring`, `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath` |
| Composer | 2.x | Laravel dependencies in `backend/` |
| MySQL | 8+ | Database for Laravel |

Optional: [Laravel Herd](https://herd.laravel.com) — if the repo lives under `~/Herd/sentinel`, Herd can serve the API at `http://sentinel.test` instead of `php artisan serve`.

---

## One-time setup

From the repository root:

```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd backend && php artisan key:generate && cd ..
```

Create the MySQL database (name must match `DB_DATABASE` in `backend/.env`):

```sql
CREATE DATABASE IF NOT EXISTS sentinel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Migrate, seed, and link public storage:

```bash
npm run migrate
npm run seed
cd backend && php artisan storage:link && cd ..
```

Default admin (`AdminUserSeeder`, from `backend/.env`): `admin@admin.com` / `password`.

---

## Start dev servers

```bash
npm run dev
```

This runs **both** processes in parallel via [concurrently](https://www.npmjs.com/package/concurrently):

| Script | Command | URL |
|--------|---------|-----|
| `dev:api` | `php artisan serve --host=127.0.0.1 --port=8010` | http://127.0.0.1:8010 |
| `dev:frontend` | `vite` (in `frontend/`) | http://localhost:5180 |

Sentinel uses **port 5180** on purpose. Vite’s default `:5173` is often taken by other EMZI apps (e.g. Nexus Brain in `~/Herd/nexus`). If `:5180` is in use, change `server.port` in `frontend/vite.config.js`.

Health check: http://127.0.0.1:8010/api/health

### Run individually

```bash
npm run dev:frontend   # Vite only
npm run dev:api        # Laravel only (port 8010)
```

---

## Environment (local)

### `frontend/.env`

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_TARGET=http://127.0.0.1:8010
VITE_APP_TIMEZONE=UTC
```

Vite proxies browser requests from `/api` to `VITE_DEV_API_TARGET` during development (`frontend/vite.config.js`). The SPA always talks to `/api` on the Vite origin; no CORS setup is needed locally.

### `backend/.env`

Key values for local dev:

```bash
APP_URL=http://127.0.0.1:8010
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=sentinel
DB_USERNAME=root
DB_PASSWORD=
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=password
```

Mail defaults to `log` driver — password-reset emails appear in Laravel logs, not a real inbox.

---

## Laravel Herd (optional)

If Herd serves the API at `http://sentinel.test`, skip `dev:api` and point Vite at Herd:

```bash
# frontend/.env
VITE_DEV_API_TARGET=http://sentinel.test
```

Then run only the frontend:

```bash
npm run dev:frontend
```

---

## Root npm scripts

Defined in the repo root `package.json`:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Frontend + API together |
| `npm run dev:frontend` | Vite dev server only |
| `npm run dev:api` | Laravel `artisan serve` on port 8010 |
| `npm run install:all` | `npm install` (root + frontend) + `composer install` (backend) |
| `npm run migrate` | `php artisan migrate --force` |
| `npm run seed` | `php artisan db:seed --force` |
| `npm run build` | Production Vite build → `frontend/dist/` |
| `npm run lint` | ESLint on `frontend/` |

---

## Troubleshooting

### Port 8010 already in use

Another process (often Herd or a previous `npm run dev`) is bound to `127.0.0.1:8010`.

- Stop the other server, **or**
- Use Herd and set `VITE_DEV_API_TARGET=http://sentinel.test`, then `npm run dev:frontend` only, **or**
- Change the port in root `package.json` (`dev:api`) and match `VITE_DEV_API_TARGET` in `frontend/.env`.

### API requests fail from the SPA

1. Confirm Laravel is running (`curl http://127.0.0.1:8010/api/health`).
2. Confirm `VITE_DEV_API_TARGET` matches where Laravel listens.
3. Confirm `backend/.env` database credentials and that migrations ran.

### Frontend shows login but API returns 401

New users need admin approval (`is_approved = false`). Use the seeded admin or approve the user in **User Management**.

---

## Automatic alert checks

Domain and SSL expiry alerts run on a **daily schedule** via Laravel’s scheduler (`sentinel:check-alerts`). When a rule matches, Sentinel:

1. Creates an `AlertLog` record (with deduplication)
2. Writes **in-app notifications** for all approved users
3. Sends **`alert.triggered` webhooks** to Nexus Brain (if enabled in Settings)

### Local testing

Run the check manually:

```bash
cd backend && php artisan sentinel:check-alerts
```

Or keep the scheduler running in another terminal:

```bash
cd backend && php artisan schedule:work
```

Configure timing in `backend/.env`:

```bash
SENTINEL_ALERT_CHECK_ENABLED=true
SENTINEL_ALERT_CHECK_TIME=08:00
SENTINEL_ALERT_CHECK_DEDUPE_HOURS=23
```

### Production cron (required)

The scheduler does **not** run by itself on a server. Add a cron entry on the API host:

```bash
* * * * * cd /path/to/sentinel/backend && php artisan schedule:run >> /dev/null 2>&1
```

Without this cron job, alerts only fire when an admin clicks **Run Alert Check** on the dashboard.

---

## Related docs

- [README.md](../README.md) — quick start summary
- [INITIAL_SETUP.md](./INITIAL_SETUP.md) — full monorepo setup, deploy, and compliance checklists
- [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md) — production split domains (`VITE_API_BASE_URL` on build)
