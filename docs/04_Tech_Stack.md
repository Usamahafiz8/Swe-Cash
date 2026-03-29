# SweCash — Tech Stack & Infrastructure Decision

Version: 1.0
Date: March 2026
Status: Confirmed

---

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Backend API | NestJS + TypeScript |
| Database ORM | Prisma |
| Database | PostgreSQL |
| Job Queue | BullMQ |
| Cache / Queue Broker | Redis |
| Admin Dashboard | Next.js + shadcn/ui |
| Push Notifications | Firebase FCM (free forever) |
| Authentication | JWT + Google OAuth 2.0 (Passport.js) |

---

## Infrastructure by Phase

### Development & Testing — $0/mo

| Service | Provider | Purpose |
|---------|----------|---------|
| Backend API | Koyeb (free tier) | Host NestJS API |
| PostgreSQL | Neon (free tier) | Serverless PostgreSQL — no pausing |
| Redis | Upstash (free tier) | BullMQ job queue broker |
| Admin Dashboard | Vercel (free tier) | Host Next.js admin panel |
| Push Notifications | Firebase FCM | Push to Android + iOS |

### Production (Go Live) — ~$6/mo

| Service | Provider | Purpose |
|---------|----------|---------|
| Everything backend | Hetzner VPS CX21 | NestJS + PostgreSQL + Redis (Docker Compose) |
| Admin Dashboard | Vercel (free tier) | Host Next.js admin panel |
| Push Notifications | Firebase FCM | Push to Android + iOS |
| SSL | Let's Encrypt | Free HTTPS |

---

## Project Structure

```
swecash/
├── apps/
│   ├── api/                        # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # Module 1 — Google Sign-In, JWT
│   │   │   │   ├── users/          # Module 1 — User profiles
│   │   │   │   ├── wallet/         # Module 2 — Wallet + Ledger
│   │   │   │   ├── adjoe/          # Module 3 — Adjoe S2S callbacks
│   │   │   │   ├── ads/            # Module 4 — Rewarded ads (AdMob client-side)
│   │   │   │   ├── referral/       # Module 5 — Referral system
│   │   │   │   ├── payouts/        # Module 6 — PayPal Payouts
│   │   │   │   ├── fraud/          # Module 7 — Fraud detection
│   │   │   │   ├── notifications/  # Module 9 — Firebase FCM
│   │   │   │   └── settings/       # Settings key-value table
│   │   │   ├── common/
│   │   │   │   ├── guards/         # Auth guards, fraud guards
│   │   │   │   ├── decorators/     # CurrentUser, Roles, etc.
│   │   │   │   ├── pipes/          # Validation pipes
│   │   │   │   └── interceptors/   # Logging, response shaping
│   │   │   ├── queues/             # BullMQ job processors
│   │   │   │   ├── payout.queue.ts
│   │   │   │   └── notification.queue.ts
│   │   │   ├── prisma/             # Prisma service + client
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Full DB schema
│   │   │   └── migrations/
│   │   ├── .env.development
│   │   ├── .env.production
│   │   └── package.json
│   │
│   └── admin/                      # Next.js Admin Dashboard
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login/
│       │   ├── (dashboard)/
│       │   │   ├── users/
│       │   │   ├── payouts/
│       │   │   ├── fraud/
│       │   │   ├── notifications/
│       │   │   ├── settings/
│       │   │   └── countries/
│       │   └── layout.tsx
│       ├── components/
│       │   └── ui/                 # shadcn/ui components
│       └── package.json
│
├── docker-compose.yml              # Production: all services on Hetzner
├── docker-compose.dev.yml          # Local development
└── README.md
```

---

## Build Order

| Phase | Module | Depends On | Status |
|-------|--------|-----------|--------|
| 1 | Project Setup + DB Schema | — | |
| 1 | Module 1 — Auth + Users | Google OAuth credentials | |
| 2 | Module 2 — Wallet + Ledger | Module 1 | |
| 2 | Module 7 — Fraud Prevention | Module 1, 2 | |
| 3 | Module 3 — Adjoe Integration | Module 2, Adjoe credentials | |
| 3 | Module 4 — Rewarded Ads | Module 2, 7 | |
| 3 | Module 5 — Referral System | Module 1, 2 | |
| 4 | Module 6 — PayPal Payouts | Module 2, 7, PayPal credentials | |
| 4 | Module 8 — Admin Dashboard | All backend modules | |
| 5 | Module 9 — Notifications | Module 1, Firebase credentials | |
| 5 | Testing + QA | All modules | |
| 6 | Production Deploy (Hetzner) | All modules stable | |

---

## Confirmed Business Rules

| Rule | Value |
|------|-------|
| Signup bonus | $0.03 (one-time, immediately withdrawable) |
| Adjoe rewards | Based on S2S postback data (varies per task) |
| Rewarded ad reward | +10% of user's last Adjoe reward |
| Minimum payout | $1 |
| Daily earning cap | None |
| Daily ad view limit | None (for now) |
| Pending → Available | Admin approval required |
| Payout flow | Admin approval by default; auto-approve toggle (under $5) |
| Referral — Level 1 | 15% |
| Referral — Level 2 | 12% |
| Referral — Level 3 | 5% |
| Referral activation | Only after referred user's first payout is approved |
| Ad network | AdMob + mediation (Unity Ads, Meta, AppLovin) — client-side only |
| Payout countries | Tier 1 only (US, UK, Canada, Germany, etc.) |
| Restricted countries | Cannot register — show "not available in your region" |

---

## Credentials Status

| Item | Status |
|------|--------|
| Adjoe SDK Hash + S2S Token | Received |
| Adjoe S2S Endpoint | Pending |
| PayPal Sandbox Credentials | Received |
| PayPal Live Credentials | Received (verify Client ID — may have copy-paste issue) |
| Google OAuth (GCP) | Pending |
| Firebase Admin SDK Key | Pending |
| Backend server access | Shared with Ali |
