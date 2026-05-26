# EMZI Nexus Care — Frontend

React + Vite SPA for complaint management. Connects to the Laravel API in `/backend`.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment

```env
VITE_API_URL=/api/v1
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Authentication

The frontend uses Laravel Sanctum Bearer tokens stored in `localStorage` (`care_auth_token`).

Auth pages:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

## API Client

All data access goes through `src/api/db.js`, which wraps the Laravel REST API.
