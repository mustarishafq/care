# EMZI Nexus — Documentation Index

Portable specs and setup guides for **EMZI Nexus Brain** and **every satellite application** (Linkly, Booking, Pulse, and future apps). Use this page to onboard a new system without missing shared requirements.

**Linkly** in this repository is one reference implementation. Replace placeholders `{app}`, `{spa-domain}`, `{api-domain}`, and `{db_name}` with your project values.

For day-to-day dev commands, see [DEV.md](./DEV.md) and the root [README.md](../README.md).

---

## Quick start (new satellite app)

Follow this order. Check off each item before production.

```
[ ] 1. INITIAL_SETUP.md — Phases 1, 3, 4, 7 (backend, UI, auth, deploy)
[ ] 2. DESIGN_TEMPLATE.md — full UI spec; pass §28 pre-ship checklist
[ ] 3. DISPLAY_FORMAT_REQUIREMENTS.md — number / money / date formats in Settings → General
[ ] 4. GRAPH_DESIGN.md — charts / Recharts tokens + theme-safe tooltips (if the app has graphs)
[ ] 5. MOBILE_BOTTOM_NAV_DESIGN.md — glass dock (define your own navItems.js routes)
[ ] 6. REACT_SPA_APACHE_HTACCESS.md — production SPA routing + split domains
[ ] 7. (Optional) nexus-sso-setup.md — Brain tile / “Continue with Nexus” login
[ ] 8. (Optional) event-webhook-setup.md — push events to Brain
[ ] 9. (Optional) emzi-nexus-mcp-catalog-spec.md — Brain Connected Systems / AI tools
```

Skip sections in **INITIAL_SETUP** marked **Linkly example** when starting greenfield (not migrating from Base44).

---

## Document map

### Required — every satellite app

| Document | What it defines |
|----------|-----------------|
| [DEV.md](./DEV.md) | Local dev: `npm run dev`, env vars, ports, Herd, troubleshooting |
| [INITIAL_SETUP.md](./INITIAL_SETUP.md) | Monorepo layout, Laravel + React setup, migration phases, database rules (integer PKs), post-install admin |
| [DESIGN_TEMPLATE.md](./DESIGN_TEMPLATE.md) | **Single source of truth** for UI: tokens, shadcn/ui, layout, auth pages, overlays, forms, confirms, back navigation, dark mode |
| [DISPLAY_FORMAT_REQUIREMENTS.md](./DISPLAY_FORMAT_REQUIREMENTS.md) | Workspace number (`1,000`), money (`1,000.00`), and date formats via Settings → General |
| [GRAPH_DESIGN.md](./GRAPH_DESIGN.md) | Chart tokens, Recharts tooltips, grid/axis chrome (light + dark) |
| [MOBILE_BOTTOM_NAV_DESIGN.md](./MOBILE_BOTTOM_NAV_DESIGN.md) | Glass dock: sizing, glass tokens, mobile orb, safe area, active indicator (routes are per-app) |
| [REACT_SPA_APACHE_HTACCESS.md](./REACT_SPA_APACHE_HTACCESS.md) | Apache `.htaccess` for React Router; split SPA/API domains; CORS on `/storage/*` |

### Optional — Nexus Brain integrations

Same contract on every app that enables the feature.

| Document | Direction | When to use |
|----------|-----------|-------------|
| [nexus-sso-setup.md](./nexus-sso-setup.md) | Brain → your app | Users open your app from a Brain tile or “Continue with EMZI Nexus Brain” on login |
| [event-webhook-setup.md](./event-webhook-setup.md) | Your app → Brain | Brain should notify users when domain events occur in your app |
| [emzi-nexus-mcp-catalog-spec.md](./emzi-nexus-mcp-catalog-spec.md) | Brain → your app | Register as **Connected System**; expose `GET /api/mcp/v1/catalog` |

### Hub-only (Nexus Brain)

**DESIGN_TEMPLATE.md** §29.2 lists Brain-only components (People, Applications browser, global broadcast strip, etc.). Satellite apps reuse shared shell patterns but omit hub-only features unless in scope.

---

## Consistency rules (all systems)

These requirements are identical across every EMZI app:

| Area | Rule | Spec |
|------|------|------|
| UI look & feel | Semantic tokens, shadcn/ui New York, Lucide icons, Sonner toasts | DESIGN_TEMPLATE |
| Display formats | Numbers `1,000`, money `1,000.00`, configurable date/datetime via Settings → General | DISPLAY_FORMAT_REQUIREMENTS |
| Charts / graphs | `--chart-*` tokens; Recharts tooltips via `chartTooltipProps` | GRAPH_DESIGN |
| Mobile nav chrome | Glass dock visual spec; own route map | MOBILE_BOTTOM_NAV_DESIGN |
| Back buttons | History `-1` first, then parent route fallback | DESIGN_TEMPLATE §7.5 |
| User decisions | Confirm dialog before persist / mode switch / delete | DESIGN_TEMPLATE §11.3 |
| Database PKs | `BIGINT` auto-increment on app tables; no UUID row IDs | INITIAL_SETUP § Database design |
| Production SPA | `index.html` fallback; correct `VITE_API_BASE_URL` on split domains | REACT_SPA_APACHE_HTACCESS |
| SSO (if enabled) | `/sso/nexus`, `POST /api/sso/nexus/verify`, `nexus_sso_id` on users | nexus-sso-setup |
| Webhooks (if enabled) | `POST` + `X-Webhook-Secret`, `{domain}.{action}` events | event-webhook-setup |
| MCP (if enabled) | All routes under `/api/mcp/v1/`, standard envelope, catalog | emzi-nexus-mcp-catalog-spec |

Domain-specific pieces (entity names, event keys like `link.*` vs `booking.*`, nav routes) differ per app but must follow the same spec formats.

---

## Reference implementations

| App | Role | Notes |
|-----|------|-------|
| **Nexus Brain** | Identity hub, app tiles, notifications receiver | Full DESIGN_TEMPLATE shell |
| **Linkly** (this repo) | Satellite — URL shortener | `frontend/`, `backend/`, docs examples |
| **Nexus Pulse** | Satellite — MCP reference (Node) | `server/routes/mcp.js`, catalog |
| **Nexus Booking** | Satellite — webhooks reference | `booking.*` event family |

When implementing a feature, match the **portable spec** first, then compare against the closest reference app.

---

## Placeholder convention

| Placeholder | Meaning |
|-------------|---------|
| `{app}` | Repository / product name |
| `{spa-domain}` | Public frontend URL (e.g. `links.example.com`) |
| `{api-domain}` | Public API URL (e.g. `api.links.example.com`) |
| `{nexus-brain-domain}` | Nexus Brain origin (e.g. `emzinexus.com`) |
| `{db_name}` | MySQL database name |

---

## Updating docs

When shared patterns change in the canonical frontend or integration APIs:

1. Update the **portable spec** (DESIGN_TEMPLATE or integration doc).
2. Update **INITIAL_SETUP** checklists if setup steps change.
3. Keep **Linkly example** sections in sync with this repo’s code.

All portable spec files plus this index should stay aligned so new systems inherit the same requirements.
