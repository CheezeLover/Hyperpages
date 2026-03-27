# Hyperpages

A self-hosted portal for serving custom internal pages, built with Next.js, Caddy, and PostgreSQL. Pages are organised into projects with per-project and per-page access control based on email addresses.

---

## How it works

```
Browser → Caddy (auth + TLS) → Portal (Next.js) → PostgreSQL
                             → Pages service (static / Python backend)
```

- **Caddy** terminates TLS, validates JWT tokens, and injects identity headers into all upstream requests
- **Portal** (`portal-app/`) is the Next.js frontend — sidebar navigation, admin panel, page embedding
- **Pages service** serves self-contained HTML pages (optionally with Python backends)
- **PostgreSQL** stores page settings and project definitions

---

## Quick Start

### Prerequisites

- Debian 12+ machine (physical, VM, or LXC)
- Ports 80 and 443 open
- A domain name or local hostname (e.g. `hyperset.internal`)

### 1. Clone and configure

```bash
git clone https://github.com/CheezeLover/Hyperset.git
cd Hyperset/Hyperpages
cp .env.example .env
```

### 2. Edit `.env`

```bash
# Your domain — all subdomains are derived from this
HYPERSET_DOMAIN=your-domain.internal

# Secrets — generate each with: openssl rand -hex 32
AUTH_CRYPTO_KEY=...
DATABASE_PASSWORD=...
PORTAL_DATABASE_PASSWORD=...
```

Subdomains auto-derived from `HYPERSET_DOMAIN`:

| Subdomain | Purpose |
|-----------|---------|
| `your-domain.internal` | Portal (main UI) |
| `auth.your-domain.internal` | Authentication (Caddy security) |
| `pages.your-domain.internal` | Pages service |

### 3. Set up DNS / hosts file

```
<server-ip>  your-domain.internal
<server-ip>  auth.your-domain.internal
<server-ip>  pages.your-domain.internal
```

### 4. Deploy

```bash
chmod +x setup_podman.sh
./setup_podman.sh
```

### 5. Create your first user

- Visit `https://auth.your-domain.internal`
- Register — the first user is automatically granted the `authp/admin` role

### 6. Open the portal

- Go to `https://your-domain.internal`
- Click the settings icon to open the admin panel and upload your first page

---

## Pages & Projects

### Pages

A **page** is a self-contained directory containing at minimum an `index.html`. It may also include a Python backend (`app.py`) that runs as a sidecar process; all requests to `/{page_name}/api/*` are proxied to it.

Pages are uploaded via the admin panel (drag-and-drop zip or folder). Each page has:

- A display name, icon, and colour
- An active/inactive toggle
- A display order
- Its own `allowedEmails` list
- Membership in one or more projects

### Projects

A **project** is a named group of pages with its own access list. Users see only the pages that belong to the active project. Projects are created and managed in the admin panel by any authenticated user.

### Access control

A user can view a page if **any** of the following is true:

| Condition | Access granted |
|-----------|---------------|
| User has `hyperset/admin` or `authp/admin` role | All pages and projects |
| User created the page | That page |
| User's email is in the page's `allowedEmails` | That page |
| User created a project the page belongs to | That page |
| User's email is in a project's `allowedEmails` and the page belongs to that project | That page |

**Creator protection:** The email of whoever created a project or page is permanently locked into its access list and cannot be removed — not even by an admin through the UI.

**Admin panel:** All authenticated users can open the admin panel. Non-admins see only their own projects and can only edit or delete resources they created.

---

## Authentication

Caddy validates JWT tokens and injects these headers into every upstream request:

| Header | Content |
|--------|---------|
| `X-Token-User-Email` | User's email address |
| `X-Token-User-Roles` | Space-separated role list |

The portal trusts these headers unconditionally — they are safe because Caddy is the only entry point (no direct port access to the portal or pages service).

A user is considered an admin if their roles contain `hyperset/admin` or `authp/admin`.

> **Important:** Never expose the portal (port 3000) or pages service directly. All traffic must go through Caddy.

---

## Environment Variables

All variables live in the root `.env` file.

### Required

| Variable | Description |
|----------|-------------|
| `HYPERSET_DOMAIN` | Base domain (e.g. `hyperset.internal`) |
| `AUTH_CRYPTO_KEY` | 32-byte hex key for JWT signing. Generate: `openssl rand -hex 32` |
| `DATABASE_PASSWORD` | PostgreSQL superuser password. Generate: `openssl rand -hex 32` |
| `PORTAL_DATABASE_PASSWORD` | PostgreSQL portal role password. Generate: `openssl rand -hex 32` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PAGES_PUBLIC_URL` | `https://pages.{HYPERSET_DOMAIN}` | Browser-accessible pages URL |
| `HYPERSET_PORTAL_URL` | `https://{HYPERSET_DOMAIN}` | Portal URL |
| `PORTAL_DATABASE_URL` | _(derived)_ | Full PostgreSQL connection string for the portal role |
| `PORTAL_SETUP_DATABASE_URL` | _(derived)_ | Admin connection string used once on first boot to provision the portal schema. Omit on managed databases (RDS, Supabase, etc.) |

---

## File Layout

```
hyperset_data volume
├── pages/          ← uploaded page content
├── caddy-data/     ← TLS certificates
└── caddy-config/   ← Caddy config cache

Caddy/
└── users.json      ← local user accounts (bind-mounted; not git-tracked)
```

> **Note:** `Caddy/users.json` is excluded from git. On a fresh clone you must create this file manually before starting — if it is missing, Podman will create a directory in its place and Caddy will fail to start.

---

## Maintenance

### Update the portal

```bash
podman rm -f hyperset-portal
podman-compose up --build -d portal
```

### Update the pages service

```bash
podman rm -f hyperset-pages
podman-compose up --build -d pages
```

### Back up page settings

```bash
# Database (portal schema)
podman exec hyperset-db pg_dump -U superset -n portal superset > portal_backup.sql

# Page files
podman run --rm -v hyperset_data:/hyperset -v $(pwd):/backup \
  busybox tar czf /backup/pages_backup.tar.gz -C /hyperset/pages .
```

### View logs

```bash
podman logs hyperset-portal -f
podman logs hyperset-pages -f
podman logs hyperset-caddy -f
```

---

## Troubleshooting

**Portal not loading / connection refused**
- Check Caddy first: `podman logs hyperset-caddy -f`
- Caddy crashes if `Caddy/users.json` is a directory instead of a file — fix: `rm -rf Caddy/users.json` then recreate the file with valid JSON

**Pages not appearing in the sidebar**
- Verify the page is marked active in the admin panel
- Verify the current user has access (check project membership and `allowedEmails`)

**Authentication loop**
- Verify `AUTH_CRYPTO_KEY` is a valid 32-byte hex string
- Verify `auth.{HYPERSET_DOMAIN}` resolves to the server

**Service health checks**
```bash
curl -I http://localhost:3000/api/config   # portal
curl https://pages.your-domain.internal   # pages
```

---

## API Reference

### Portal (`/api/…`)

**Projects & pages — any authenticated user; mutations scoped by ownership**

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/config` | Current user info and service URLs |
| `GET` | `/api/admin/projects` | List projects visible to the caller |
| `POST` | `/api/admin/projects` | Create a project |
| `PATCH` | `/api/admin/projects` | Update a project (creator or admin) |
| `DELETE` | `/api/admin/projects` | Delete a project (creator or admin) |
| `GET` | `/api/admin/pages` | List all pages with settings |
| `POST` | `/api/admin/pages` | Upload a new page (multipart/form-data) |
| `PUT` | `/api/admin/pages` | Replace page files (multipart/form-data) |
| `PATCH` | `/api/admin/pages` | Update page settings (active, emails, projects, order, icon) |
| `DELETE` | `/api/admin/pages` | Delete a page |
| `GET` | `/api/auth/logout` | Sign out |

### Pages service

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/{page_name}` | Serve a custom page |
| `*` | `/{page_name}/api/*` | Proxy to the page's Python backend |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Portal | Next.js 16, TypeScript, App Router |
| Auth gateway | Caddy + caddy-security (JWT) |
| Pages runtime | Python (FastAPI / Flask / stdlib) |
| Database | PostgreSQL 15 (JSONB for page settings) |
| Container runtime | Podman (rootless) |

---

## License

MIT — see [LICENSE](LICENSE) for details.
