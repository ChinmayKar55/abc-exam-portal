# Cloud Deployment Proposal — OSSSC Online Exam Portal

**Prepared for:** OSSSC Online Stakeholders  
**Prepared by:** Development Team  
**Date:** July 2026  
**Target Load:** 300–700 daily concurrent exam-takers; occasional peak bursts up to 1,000 concurrent users.

---

## Executive Summary

We propose deploying the OSSSC Online exam portal on a **single high-performance VPS instance** with enough headroom to serve daily traffic and planned examination peaks without over-provisioning or unnecessary cost. The platform is built on a lightweight, high-throughput Go backend with Redis-backed exam state, PostgreSQL for persistent data, and Next.js for the student/admin frontends.

The selected infrastructure provides:
- **Dedicated compute** with NVMe storage for fast database I/O.
- **Substantial RAM headroom** for caching, concurrent connections, and future growth.
- **A free, automated backup pipeline** to off-site object storage.
- **A clear upgrade path** to multi-node or managed services when user growth justifies it.

---

## Recommended Infrastructure: Hostinger KVM 8 VPS

| Specification | Value |
|---|---|
| **vCPU** | 8 cores |
| **RAM** | 32 GB |
| **Storage** | 400 GB NVMe SSD |
| **Bandwidth** | 32 TB/month |
| **Virtualization** | KVM (full isolation, dedicated resources) |

### Why KVM 8 is the right fit

| Requirement | How KVM 8 satisfies it |
|---|---|
| **Concurrent exam load** | 8 cores + 32 GB RAM comfortably handles 1,000+ simultaneous users on this stack. |
| **Database performance** | 400 GB NVMe gives PostgreSQL extremely low latency for reads/writes during exams. |
| **Memory for caching** | 32 GB allows large PostgreSQL `shared_buffers` plus Redis in-memory attempt state. |
| **Network headroom** | 32 TB/month is effectively unlimited for this application; peak traffic uses only a few Mbps. |
| **Cost efficiency** | No managed-service markup; dedicated resources without paying for idle cloud capacity. |
| **Growth buffer** | Resource usage at 1,000 concurrent users stays well under 50% CPU and 40% RAM. |

### Why not a smaller VPS?

A 4 vCPU / 8 GB instance would likely work for 300 concurrent users but leaves **no headroom** for:
- Exam-day registration and login spikes.
- Admin panel imports of large question banks.
- Future feature expansion (video proctoring logs, analytics exports).

The KVM 8 plan avoids the need to resize mid-campaign and provides a stable, predictable experience during peak exams.

---

## Expected Workload & Resource Estimates

### Normal daily load

| Metric | Estimate |
|---|---|
| Concurrent users | 300–700 |
| Open WebSocket connections | 300–700 |
| Answer-save requests per second | ~10–15 |
| Database writes per second | ~10–15 |
| Average per-user bandwidth | ~1–2 KB/s |

### Peak load (occasional)

| Metric | Estimate |
|---|---|
| Concurrent users | Up to 1,000 |
| Open WebSocket connections | 1,000 |
| Answer-save requests per second | ~20–30 |
| Submit/start request spikes | 1,000 requests over 1–2 minutes |
| Total bandwidth at peak | ~2 MB/s (~16 Mbps) |

### Resource consumption at peak

| Component | RAM | CPU |
|---|---|---|
| Go API (1,000 WS connections) | ~1.0–1.5 GB | ~1 vCPU |
| PostgreSQL | ~6–8 GB | ~1 vCPU |
| Redis | ~300–500 MB | <0.5 vCPU |
| Student + Admin Next.js | ~1.0–1.5 GB | ~1 vCPU |
| nginx + OS + monitoring | ~1 GB | negligible |
| **Total** | **~10–13 GB** | **~3.5 vCPU** |

**Headroom at peak:** ~19 GB RAM and ~4.5 vCPU cores unused. This means the server runs well below stress and can absorb unexpected traffic bursts or background tasks (backups, report generation) without impacting exam-takers.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Hostinger KVM 8 VPS                        │
│           8 vCPU · 32 GB RAM · 400 GB NVMe                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │  nginx  │          │  Go API │          │  Redis  │
   │ (reverse│          │ (Fiber) │          │ (attempt│
   │ proxy +│          │         │          │ state)  │
   │  SSL)   │          │         │          │         │
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
   ┌────▼────────────────────▼────────────────────▼────┐
   │              PostgreSQL (NVMe)                    │
   │           Persistent exam/user data               │
   └───────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Backblaze B2 /      │
                  │   Cloudflare R2       │
                  │  (free daily backups)  │
                  └───────────────────────┘
```

### Stack components on the VPS

| Service | Purpose | Resource footprint |
|---|---|---|
| **nginx** | HTTPS termination, static asset serving, routing | Negligible |
| **Go API** | REST API, WebSocket timer/sync, grading | 1–2 GB RAM, 1 vCPU |
| **PostgreSQL 16** | Users, exams, questions, attempts, results | 6–8 GB RAM, 1 vCPU |
| **Redis 7** | In-progress attempt state + caching layer | 300–500 MB RAM |
| **Student Next.js** | Public-facing exam portal + landing page | 500–800 MB RAM |
| **Admin Next.js** | Staff dashboard for exams/questions/results | 500–700 MB RAM |

---

## Free Backup Strategy

We will implement a **3-2-1 inspired backup plan** using free object storage tiers.

### Daily logical backup with `pg_dump`

Every night at 2:00 AM, the server runs:

1. `pg_dump` of the full `abc_exam` database.
2. Compression with `gzip`.
3. Optional GPG encryption.
4. Upload to **Backblaze B2** or **Cloudflare R2** via `rclone`.
5. Local cleanup of old temporary files.

### Free storage options

| Provider | Free Tier | Best For |
|---|---|---|
| **Backblaze B2** | 10 GB free; 1 GB/day download free | Cheapest long-term cold storage |
| **Cloudflare R2** | 10 GB free; $0 egress forever | Restores to other servers with no cost |

For a compressed database dump of ~100–300 MB/day, we remain within the free tier for a very long time. Even a multi-gigabyte database compresses well and stays under the 10 GB limit for months.

### Backup retention policy

| Tier | Retention |
|---|---|
| Daily backups | Last 7 days |
| Weekly backups | Last 4 weeks |
| Monthly backups | Last 12 months |

Older backups are automatically purged using `rclone delete --min-age` or lifecycle rules in the bucket.

### What is protected

- All user accounts, plans, and payments.
- All question banks, exams, and marking schemes.
- All exam attempts, answers, scores, and results.
- Proctoring events and violation logs.

### Recovery procedure

In the event of data loss, recovery is:

1. Download the latest compressed dump from B2/R2.
2. Create a fresh PostgreSQL database.
3. Run `gunzip < backup.sql.gz | psql -d abc_exam`.
4. Restart the API container.

This procedure will be tested monthly on a non-production database to verify integrity.

---

## Security & Hardening Included

| Layer | Measure |
|---|---|
| **HTTPS** | Free Let's Encrypt certificates managed by `certbot`. |
| **Firewall** | UFW allowing only ports 22, 80, and 443. |
| **DDoS / CDN** | Cloudflare free tier in front of the VPS (optional but recommended). |
| **Authentication** | JWT access tokens + HttpOnly refresh cookies. |
| **Rate limiting** | Per-IP and per-user limits on login, registration, and answer-save endpoints. |
| **OS updates** | Unattended security upgrades enabled. |
| **Backup encryption** | Optional GPG encryption before upload. |

---

## Monitoring & Alerting (Lightweight)

To ensure smooth exam operations, we will deploy:

- **Netdata** or **Docker Stats** for real-time CPU/RAM/disk monitoring.
- **Uptime Kuma** (self-hosted, free) for HTTP/health-check alerts.
- **Log shipping** to a free tier of Grafana Cloud or a simple log rotation on disk.

Alerts will notify the team if:
- CPU usage exceeds 80% for 5 minutes.
- RAM usage exceeds 85%.
- Disk usage exceeds 80%.
- The API `/health` or `/ready` endpoint fails.

---

## Scalability Roadmap

The KVM 8 plan is not just for today — it gives room to grow.

| Phase | Concurrent Users | Action |
|---|---|---|
| **Current** | 300–700 normal / 1,000 peak | Single KVM 8 VPS with free backups. |
| **Growth** | 1,500–2,000 | Move PostgreSQL to a separate VPS; keep API/frontend on KVM 8. |
| **Scale** | 3,000+ | Move to multi-container setup behind a load balancer with managed database and Redis. |

This phased approach avoids over-spending early while ensuring the platform never outgrows its infrastructure unexpectedly.

---

## Summary

| Question | Answer |
|---|---|
| **Recommended server** | Hostinger KVM 8 VPS (8 vCPU / 32 GB RAM / 400 GB NVMe / 32 TB bandwidth) |
| **Why this server?** | Cost-effective, dedicated resources, NVMe speed, massive headroom for peak exams. |
| **Can it handle 300–700 daily concurrent users?** | Yes, comfortably. |
| **Can it handle 1,000 concurrent peak users?** | Yes, with significant CPU and RAM headroom remaining. |
| **Backup strategy** | Free nightly `pg_dump` → compressed → uploaded to Backblaze B2 or Cloudflare R2. |
| **Backup cost** | $0 within free tiers for the foreseeable future. |
| **Monitoring cost** | $0 using Netdata, Uptime Kuma, and Cloudflare free tier. |

This proposal delivers a robust, performant, and budget-conscious production deployment for OSSSC Online, with automated off-site backups and a clear path for future growth.
