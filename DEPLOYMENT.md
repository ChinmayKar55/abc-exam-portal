# ABC Exam Portal — Deployment Plan

> Target: **Hostinger KVM 8** (8 vCPU / 32 GB RAM / 400 GB NVMe / 32 TB BW)  
> Strategy: **Managed Docker** on Ubuntu 24 (pre-installed Docker Engine)  
> Deployment method: **Hostinger Docker Manager API** — triggered from IDE

---

## 1. OS Choice Decision: Managed Docker vs Plain Ubuntu

**Decision: Managed Docker**

| Factor | Plain Ubuntu 24 | Managed Docker ✅ |
|---|---|---|
| Docker setup | Manual install + config | Pre-installed, managed by Hostinger |
| IDE deploy integration | SSH only (no API) | Full REST API (`/api/vps/v1/virtual-machines/{id}/docker`) |
| Rollback | Manual | `POST .../update` or `DELETE .../down` + redeploy |
| Hostinger panel visibility | None | Projects, containers, logs visible in hPanel |
| Resource overhead on KVM 8 | Baseline | Negligible — irrelevant at 32 GB RAM |

The Docker Manager API is the sole enabler of IDE-side deployments without SSH. With KVM 8 resources, overhead is not a concern.

---

## 2. Architecture

```
KVM 8 VPS (Managed Docker, Ubuntu 24)
│
│  Hostinger Docker Manager Project: "abc-exam"
│
├─ nginx          (image: nginx:alpine)        → 0.0.0.0:80, :443
│   ├─ student.yourdomain.com  →  student:3000
│   ├─ admin.yourdomain.com    →  admin:3001
│   └─ api.yourdomain.com      →  api:8081
│
├─ student        (image: abc-exam/student)    :3000  (internal)
├─ admin          (image: abc-exam/admin)       :3001  (internal)
├─ api            (image: abc-exam/api)         :8081  (internal)
├─ postgres       (image: postgres:16-alpine)   :5432  (internal)
│   └─ volume: postgres_data
└─ redis          (image: redis:7-alpine)       :6379  (internal)
    └─ volume: redis_data
```

All inter-service traffic stays on a private Docker bridge network (`abc-exam-net`).  
Only nginx is exposed to the internet.

---

## 3. Files to Create

```
abc-exam-portal/
├── docker-compose.yml              ← single compose for all services
├── docker-compose.override.yml     ← local dev overrides (gitignored optional)
├── nginx/
│   └── nginx.conf                  ← reverse proxy config
├── apps/
│   ├── student/
│   │   └── Dockerfile
│   └── admin/
│       └── Dockerfile
├── services/
│   └── api/
│       └── Dockerfile
├── .env.production.example         ← env template (committed)
└── scripts/
    └── deploy.js                   ← Hostinger API deploy script (Node.js)
```

---

## 4. Container Specs

### 4.1 `apps/student/Dockerfile` — Next.js 16 (standalone output)
```dockerfile
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```
> Requires `output: 'standalone'` in `next.config.ts` (one-line change).

### 4.2 `apps/admin/Dockerfile` — identical to student except port 3001

### 4.3 `services/api/Dockerfile` — Go/Fiber multi-stage
```dockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8081
CMD ["/app/server"]
```

---

## 5. docker-compose.yml (Production)

```yaml
version: "3.9"

networks:
  abc-exam-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  storage_data:

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [abc-exam-net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks: [abc-exam-net]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: ${REGISTRY}/abc-exam-api:${API_TAG:-latest}
    restart: unless-stopped
    env_file: .env.production
    environment:
      DB_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?sslmode=disable
      REDIS_URL: redis:6379
      ENV: production
    volumes:
      - storage_data:/app/storage
    networks: [abc-exam-net]
    depends_on:
      postgres: {condition: service_healthy}
      redis:    {condition: service_healthy}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8081/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3

  student:
    image: ${REGISTRY}/abc-exam-student:${STUDENT_TAG:-latest}
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com/api
      NEXT_PUBLIC_WS_URL: wss://api.yourdomain.com
    networks: [abc-exam-net]
    depends_on:
      api: {condition: service_healthy}

  admin:
    image: ${REGISTRY}/abc-exam-admin:${ADMIN_TAG:-latest}
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com/api
    networks: [abc-exam-net]
    depends_on:
      api: {condition: service_healthy}

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    networks: [abc-exam-net]
    depends_on: [student, admin, api]
```

---

## 6. Nginx Config (`nginx/nginx.conf`)

Key rules:
- HTTP → HTTPS redirect
- WebSocket upgrade for `/ws` path on the API
- Proxy pass to internal service names

```nginx
events { worker_processes auto; }

http {
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name student.yourdomain.com;
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    location / {
      proxy_pass http://student:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }

  server {
    listen 443 ssl;
    server_name admin.yourdomain.com;
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    location / {
      proxy_pass http://admin:3001;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }

  server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    location /ws {
      proxy_pass http://api:8081;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    location / {
      proxy_pass http://api:8081;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

---

## 7. Environment Variables (`.env.production.example`)

```env
# Database (used by postgres service + api service)
DB_USER=abc_exam
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=abc_exam

# Redis
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# Auth
JWT_SECRET=CHANGE_ME_256BIT_SECRET
JWT_EXPIRY_MIN=15
REFRESH_TOKEN_EXPIRY_DAYS=7

# Payment
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@yourdomain.com

# Storage
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/app/storage

# URLs
FRONTEND_URL=https://student.yourdomain.com
ADMIN_URL=https://admin.yourdomain.com

# Container registry (Docker Hub or GHCR)
REGISTRY=your-dockerhub-username
API_TAG=latest
STUDENT_TAG=latest
ADMIN_TAG=latest
```

---

## 8. Hostinger API Integration (IDE Deploy Script)

### How it works
1. CI/CD (GitHub Actions or local) builds and pushes images to Docker Hub / GHCR
2. `scripts/deploy.js` calls Hostinger API to update the running project (pull new images + recreate)

### Hostinger Docker Manager API endpoints used

| Action | Method | Endpoint |
|---|---|---|
| First deploy | `POST` | `/api/vps/v1/virtual-machines/{vmId}/docker` |
| Redeploy (update images) | `POST` | `/api/vps/v1/virtual-machines/{vmId}/docker/abc-exam/update` |
| Check containers | `GET` | `/api/vps/v1/virtual-machines/{vmId}/docker/abc-exam/containers` |
| View logs | `GET` | `/api/vps/v1/virtual-machines/{vmId}/docker/abc-exam/logs` |
| Restart | `POST` | `/api/vps/v1/virtual-machines/{vmId}/docker/abc-exam/restart` |
| Teardown | `DELETE` | `/api/vps/v1/virtual-machines/{vmId}/docker/abc-exam/down` |

### `scripts/deploy.js` (planned)
```
Usage:
  node scripts/deploy.js deploy   ← first-time deploy (sends compose file)
  node scripts/deploy.js update   ← pull latest images + recreate containers
  node scripts/deploy.js logs     ← stream last 300 log lines
  node scripts/deploy.js status   ← list containers + health

Reads from env:
  HOSTINGER_API_TOKEN   (never commit — set in shell or .env.deploy)
  HOSTINGER_VM_ID       (your VPS virtual machine ID from hPanel)
```

---

## 9. SSL/TLS Setup

Since Managed Docker doesn't provide automatic HTTPS, use one of:

**Option A — Certbot on host (recommended)**
```bash
apt install certbot
certbot certonly --standalone -d yourdomain.com -d student.yourdomain.com \
  -d admin.yourdomain.com -d api.yourdomain.com
# Certs land in /etc/letsencrypt/live/ — mounted into nginx container
```

**Option B — Caddy instead of Nginx** (auto-HTTPS via ACME)  
Replace the nginx container with `caddy:alpine` and a `Caddyfile`. Simpler but less control.

**Option C — Cloudflare proxy** (free, easiest)  
Point DNS to VPS via Cloudflare in proxy mode — TLS terminated at CF edge, nginx serves plain HTTP internally. No cert management needed.

---

## 10. Image Registry Strategy

| Option | Cost | Complexity |
|---|---|---|
| **Docker Hub (free tier)** | Free for public / 1 private repo | Lowest |
| **GitHub Container Registry (GHCR)** | Free for public repos | Low — integrates with GH Actions |
| **Self-hosted Registry on VPS** | Free | Medium — extra container |

**Recommendation: GHCR** — already integrated if using GitHub Actions, free, private.

---

## 11. Deployment Workflow (End-to-End)

```
Developer (IDE)
    │
    ├─ git push → GitHub
    │       │
    │       └─ GitHub Actions CI
    │               ├─ docker build + push (student, admin, api) → GHCR
    │               └─ node scripts/deploy.js update  ← calls Hostinger API
    │
    └─ OR: node scripts/deploy.js update  ← manual from IDE terminal
```

### First-time deploy sequence
1. SSH into VPS (one-time only)
2. Run `certbot` for SSL
3. Create `.env.production` on VPS at `/root/abc-exam/.env.production`
4. Run `node scripts/deploy.js deploy` → Hostinger API creates project from compose file
5. ✅ All containers start, nginx serves traffic

### Subsequent deploys (zero-SSH)
1. Push code → GitHub Actions builds + pushes images
2. `node scripts/deploy.js update` → Hostinger API pulls new images + recreates containers
3. ✅ ~30s downtime per service during recreate (acceptable for exam portal)

> For zero-downtime, blue/green can be added later — out of scope for MVP.

---

## 12. Resource Allocation (KVM 8 sizing)

| Service | RAM estimate | CPU |
|---|---|---|
| postgres | 512 MB–1 GB | 1 vCPU |
| redis | 128 MB | 0.5 vCPU |
| api (Go/Fiber) | 128–256 MB | 1 vCPU |
| student (Next.js) | 256–512 MB | 1 vCPU |
| admin (Next.js) | 256–512 MB | 1 vCPU |
| nginx | 32 MB | minimal |
| **Total** | **~1.5 GB** | **~5 vCPU** |

**KVM 8 headroom: 30 GB RAM and 3 vCPU free** — substantial room for traffic spikes, concurrent exam attempts, and future services.

---

## 13. Implementation Order

- [ ] `apps/student/next.config.ts` — add `output: 'standalone'`
- [ ] `apps/admin/next.config.ts` — add `output: 'standalone'`
- [ ] `apps/student/Dockerfile`
- [ ] `apps/admin/Dockerfile`
- [ ] `services/api/Dockerfile`
- [ ] `nginx/nginx.conf`
- [ ] `docker-compose.yml`
- [ ] `.env.production.example`
- [ ] `scripts/deploy.js` — Hostinger API integration
- [ ] `.github/workflows/deploy.yml` — GitHub Actions CI/CD (optional)
- [ ] First-time VPS setup (SSH, certbot, secrets)
- [ ] First deploy via `deploy.js deploy`
- [ ] Verify all endpoints, WebSocket, payment webhooks

---

## 14. Security Checklist (Pre-Launch)

- [ ] `.env.production` is NOT committed (add to `.gitignore`)
- [ ] `RAZORPAY_WEBHOOK_SECRET` is a real secret, not placeholder
- [ ] `JWT_SECRET` is cryptographically random (32+ bytes)
- [ ] Postgres not exposed to internet (internal network only)
- [ ] Redis not exposed to internet (internal network only)
- [ ] Nginx has `server_tokens off`
- [ ] Hostinger firewall: only ports 80, 443, 22 open
- [ ] SSH key-only auth (disable password SSH)
- [ ] `HOSTINGER_API_TOKEN` stored in GitHub Secrets / local `.env.deploy` (never committed)
