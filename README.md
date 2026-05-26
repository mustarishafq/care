# EMZI Nexus Care

Complaint management platform with a **Laravel 13 API backend** and **React (Vite) frontend**.

## Project Structure

```
care/
├── backend/          # Laravel 13 API (existing installation)
├── frontend/         # React SPA
├── deploy/           # Nginx, PHP-FPM, Supervisor configs
├── scripts/          # Dev automation scripts
├── docker-compose.yml
└── package.json      # Root scripts (npm run dev:full)
```

## Quick Start

### Prerequisites

- PHP 8.3+
- Composer 2
- Node.js 20+
- MySQL 8.0

### One-Command Development

From the project root:

```bash
npm install
npm run dev:full
```

This will:

1. Install frontend and backend dependencies
2. Copy `.env` files if missing
3. Generate Laravel app key if missing
4. Run migrations and seeders
5. Create the default admin account
6. Start Laravel (`http://localhost:8000`) and Vite (`http://localhost:5173`)

### Default Admin Account

| Field    | Value            |
|----------|------------------|
| Email    | `admin@admin.com` |
| Password | `password`        |

The seeder uses `firstOrCreate` — it will not duplicate the admin on repeated runs.

---

## Backend Setup (Laravel)

The existing Laravel installation lives in `/backend`. **Do not reinstall Laravel.**

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan storage:link
php artisan serve
```

### Environment Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

```env
APP_NAME="EMZI Nexus Care"
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=care
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5173,127.0.0.1,127.0.0.1:5173
```

### Database Configuration (MySQL)

Create the database:

```sql
CREATE DATABASE care CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run migrations (non-destructive — adds tables/columns only):

```bash
php artisan migrate
php artisan db:seed
```

### SMTP Configuration

Configure mail in `backend/.env`:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="${APP_NAME}"
```

Used for:

- Forgot password reset emails
- User invitation emails
- SLA alert emails

### Authentication

Built with **Laravel Sanctum** (Bearer tokens).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Register (status: pending approval) |
| `/api/v1/auth/login` | POST | Login (requires approved + active) |
| `/api/v1/auth/logout` | POST | Logout (authenticated) |
| `/api/v1/auth/me` | GET | Current user |
| `/api/v1/auth/forgot-password` | POST | Send reset email |
| `/api/v1/auth/reset-password` | POST | Reset password with token |
| `/api/v1/users/{id}/approve` | POST | Admin: approve user |
| `/api/v1/users/{id}/reject` | POST | Admin: reject user |
| `/api/v1/users/{id}/disable` | POST | Admin: disable user |

---

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Environment

```env
VITE_API_URL=/api/v1
```

In development, Vite proxies `/api` to `http://localhost:8000`.

### Production Build

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`.

---

## Local Development

**Option A — Full stack (recommended):**

```bash
npm run dev:full
```

**Option B — Separate terminals:**

```bash
# Terminal 1
cd backend && php artisan serve

# Terminal 2
cd frontend && npm run dev
```

---

## Production Deployment (Ubuntu VPS)

### 1. Server Requirements

- Ubuntu 22.04/24.04 LTS
- Nginx
- PHP 8.3 + PHP-FPM
- MySQL 8.0
- Node.js 20 (for frontend build)
- Composer 2
- Supervisor (queues)
- Certbot (SSL, optional)
- Redis (optional, recommended for cache/queues)

### 2. Deploy Code

```bash
git clone <your-repo> /var/www/care
cd /var/www/care/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
# Edit .env with production values
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd /var/www/care/frontend
npm ci
npm run build
```

### 3. Nginx Configuration

Sample config: `deploy/nginx/care.conf`

```bash
sudo cp deploy/nginx/care.conf /etc/nginx/sites-available/care
sudo ln -s /etc/nginx/sites-available/care /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Update `server_name`, SSL paths, and document root paths.

### 4. PHP-FPM Configuration

Sample pool: `deploy/php-fpm/care.conf`

```bash
sudo cp deploy/php-fpm/care.conf /etc/php/8.3/fpm/pool.d/care.conf
sudo systemctl restart php8.3-fpm
```

Point Nginx `fastcgi_pass` to the PHP-FPM socket.

### 5. Supervisor (Queue Workers)

```bash
sudo cp deploy/supervisor/care.conf /etc/supervisor/conf.d/care.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start care-queue:*
```

### 6. SSL with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

### 7. File Permissions

```bash
sudo chown -R www-data:www-data /var/www/care/backend/storage
sudo chown -R www-data:www-data /var/www/care/backend/bootstrap/cache
```

---

## Docker Setup

```bash
docker compose up -d --build
```

Services:

| Service  | Port  |
|----------|-------|
| Frontend | 5173  |
| Backend  | 8000  |
| MySQL    | 3306  |
| Redis    | 6379  |

Configure SMTP and secrets via environment variables in `docker-compose.yml`.

---

## API Architecture

```
backend/
├── app/Http/Controllers/Api/V1/   # Versioned controllers
├── app/Http/Requests/Api/V1/      # Form validation
├── app/Http/Resources/            # JSON transformers
├── app/Http/Middleware/           # Auth approval middleware
├── app/Services/                  # Business logic
└── routes/api.php                 # /api/v1/* routes
```

Features:

- API versioning (`/api/v1`)
- Input validation via Form Requests
- Rate limiting on auth and public endpoints
- Sanctum Bearer token authentication
- Admin approval workflow middleware
- CSRF protection for stateful domains

---

## Security

- Passwords hashed with bcrypt
- Sanctum API tokens
- Rate limiting on login/register/reset
- Admin approval required before login
- Active status check on login
- Secure password reset tokens (Laravel built-in, expiring)
- Input validation on all endpoints
- Webhook API key authentication

---

## Troubleshooting

### `npm run dev:full` fails on migrate

- Ensure MySQL is running and credentials in `backend/.env` are correct
- Create the database: `CREATE DATABASE care;`

### Frontend shows empty data

- Confirm backend is running on port 8000
- Check browser Network tab for `/api/v1/*` errors
- Verify you are logged in (token in localStorage `care_auth_token`)

### Login returns "pending admin approval"

- New registrations require admin approval
- Log in as `admin@admin.com` and approve the user in **Users**

### CORS errors in production

- Set `FRONTEND_URL` in backend `.env`
- Add your domain to `SANCTUM_STATEFUL_DOMAINS`
- Use Nginx to proxy `/api` to the backend (see `deploy/nginx/care.conf`)

### File uploads fail

```bash
php artisan storage:link
chmod -R 775 storage bootstrap/cache
```

### Password reset emails not sending

- Verify SMTP settings in `.env`
- Test with `MAIL_MAILER=log` locally to inspect logs
- Check `storage/logs/laravel.log`

### 419 / CSRF errors

- Ensure `SANCTUM_STATEFUL_DOMAINS` includes your frontend origin
- For SPA + API on same domain via Nginx proxy, CSRF cookies work automatically

---

## License

MIT
