# SweCash — Unity Developer API Guide

This document covers every backend API endpoint that the Unity mobile client must integrate.
All requests go to the base URL configured per environment.

```
Dev  base URL : https://<koyeb-api-url>
Prod base URL : https://api.swecash.com   (replace with actual domain)
```

All responses are JSON. All authenticated endpoints require the header:
```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Profile](#2-user-profile)
3. [Wallet & Transactions](#3-wallet--transactions)
4. [Gameplay Rewards — Adjoe](#4-gameplay-rewards--adjoe)
5. [Rewarded Ads](#5-rewarded-ads)
6. [Referral System](#6-referral-system)
7. [Payouts](#7-payouts)
8. [Tasks / Missions](#8-tasks--missions)
9. [Currencies](#9-currencies-public)
10. [Countries](#10-countries-public)
11. [Account Deletion](#11-account-deletion)
12. [Error Handling](#12-error-handling)
13. [Flow Diagrams](#13-flow-diagrams)

---

## 1. Authentication

### POST `/auth/google-login`
**Auth required:** No

Call this on every app launch after receiving a Google ID token from the Google Sign-In SDK.
It creates a new account on first call and updates device info on subsequent calls.

**Request body:**
```json
{
  "idToken":   "eyJhbGc...",      // Required — Google ID token
  "deviceId":  "abc-123",         // Recommended — stable unique device ID
  "gaid":      "xxxxxxxx-xxxx",   // Optional — Google Advertising ID
  "fcmToken":  "fcm-token-here",  // Optional — Firebase push token
  "country":   "SE",              // Optional — ISO 3166-1 alpha-2 (2-letter code)
  "emulator":  false              // Set true if running in emulator (fraud signal)
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@gmail.com",
    "profileImageUrl": "https://...",
    "country": "SE",
    "referralCode": "A3F9",
    "accountStatus": "active",
    "fraudStatus": "normal",
    "wallet": {
      "availableBalance": "0.0300",
      "pendingBalance": "0.0000",
      "lifetimeEarnings": "0.0300",
      "lifetimePayouts": "0.0000"
    }
  }
}
```

**Store the `token` — attach it to all future requests as `Authorization: Bearer <token>`.**

> **isNewUser = true** → show onboarding / referral code entry screen.
> The $0.03 signup bonus is credited automatically — no extra call needed.

---

## 2. User Profile

### GET `/user/profile`
**Auth required:** Yes

Fetch the full user profile + live wallet balances. Call this on app resume / after any earning event.

**Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@gmail.com",
  "profileImageUrl": "https://...",
  "country": "SE",
  "referralCode": "A3F9",
  "preferredCurrency": "USD",
  "loginStreak": 3,
  "accountStatus": "active",
  "fraudStatus": "normal",
  "wallet": {
    "availableBalance": "1.2300",
    "pendingBalance": "0.5000",
    "lifetimeEarnings": "2.7300",
    "lifetimePayouts": "1.0000"
  }
}
```

---

### POST `/user/update`
**Auth required:** Yes

Update country, FCM token, or preferred display currency. Call whenever any of these change.

**Request body (all fields optional):**
```json
{
  "country":           "SE",
  "fcmToken":          "new-fcm-token",
  "preferredCurrency": "EUR"
}
```

**Response:** Updated user object (same shape as profile).

---

## 3. Wallet & Transactions

### GET `/wallet`
**Auth required:** Yes

Returns balances in USD and in the user's preferred currency.

**Response:**
```json
{
  "availableBalanceUsd": 1.23,
  "pendingBalanceUsd":   0.50,
  "lifetimeEarningsUsd": 2.73,
  "lifetimePayoutsUsd":  1.00,
  "currency":            "EUR",
  "symbol":              "€",
  "availableBalance":    1.13,
  "pendingBalance":      0.46,
  "lifetimeEarnings":    2.51,
  "lifetimePayouts":     0.92
}
```

> Show `availableBalance` (converted) in the main HUD. Show `pendingBalance` separately so the user understands it requires approval before withdrawal.

---

### GET `/transactions`
**Auth required:** Yes

Paginated ledger history.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `type` | string | — | Filter by type (see below) |

**Transaction types:**
- `adjoe_reward` — gameplay earnings
- `ad_reward` — rewarded-ad bonus
- `referral_reward` — referral commissions
- `bonus` — task rewards / signup bonus
- `payout_request` — withdrawal request (debit)
- `payout_completed` — withdrawal success
- `payout_rejected` — withdrawal reversed

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "amount": "0.0500",
      "type": "adjoe_reward",
      "status": "pending",
      "createdAt": "2026-05-08T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

---

## 4. Gameplay Rewards — Adjoe

Adjoe calls the backend **directly** via its S2S postback — Unity does **not** call this endpoint.

```
POST /adjoe/callback   ← Adjoe server → SweCash backend (no Unity involvement)
```

**What Unity must do:**
1. Initialise the Adjoe SDK with `publisher_sub_id = user.id` (the SweCash UUID).
2. Let Adjoe handle the rest. When the user earns a reward, Adjoe notifies the backend.
3. Unity should poll `GET /wallet` or `GET /user/profile` after a game session to refresh the balance.

---

## 5. Rewarded Ads

### GET `/reward/ad/eligibility`
**Auth required:** Yes

Call this **before** showing the "Watch Ad" button to decide whether the button should be visible.

**Response (eligible):**
```json
{
  "eligible": true,
  "potentialReward": 0.005,
  "basedOnAdjoeAmount": 0.05
}
```

**Response (not eligible):**
```json
{
  "eligible": false,
  "reason": "Ad reward already claimed for your last game reward. Play more to unlock again."
}
```

**Unity flow:**
```
1. Call GET /reward/ad/eligibility
2. If eligible = false  → hide "Watch Ad" button
3. If eligible = true   → show button with potentialReward label (e.g. "+$0.005")
4. User clicks button   → show AdMob rewarded ad
5. Ad completed callback fires → call POST /reward/ad
6. Show success toast with amount earned
7. Refresh wallet balance
```

---

### POST `/reward/ad`
**Auth required:** Yes

Call this **only after** the AdMob rewarded ad has been fully watched (in the `OnUserEarnedReward` callback).
Never call this speculatively — the backend validates the last Adjoe reward and prevents double-claims.

**Request body:** None (empty body)

**Response:**
```json
{
  "reward": 0.005,
  "transactionId": "uuid",
  "message": "+$0.005 added to your pending balance."
}
```

**Error responses:**
- `400` — No Adjoe reward found yet, or ad already claimed for this session
- `403` — Account suspended / fraud-blocked

---

## 6. Referral System

### POST `/referral/apply-code`
**Auth required:** Yes

Apply a referral code. One-time only. Show this screen on first launch when `isNewUser = true`.

**Request body:**
```json
{
  "code": "A3F9"
}
```

**Response:**
```json
{
  "message": "Referral code applied successfully."
}
```

**Error responses:**
- `400` — Already applied a code, or tried to use own code
- `404` — Code not found

---

### GET `/referral/stats`
**Auth required:** Yes

Show this on the "Invite Friends" screen.

**Response:**
```json
{
  "directReferrals": 3,
  "totalCommissionEarned": 0.42,
  "activeReferrals": 2,
  "byLevel": [
    { "level": 1, "count": 3, "earned": 0.30 },
    { "level": 2, "count": 1, "earned": 0.10 },
    { "level": 3, "count": 0, "earned": 0.02 }
  ]
}
```

> Show `user.referralCode` from the profile response as the shareable code.
> Commissions are activated only after the referred user completes their first payout.

---

## 7. Payouts

### POST `/payout/request`
**Auth required:** Yes

Submit a withdrawal request.

**Request body:**
```json
{
  "amount":      5.00,
  "paypalEmail": "john@example.com"
}
```

**Response:**
```json
{
  "payoutId": "uuid",
  "amount":   5.00,
  "status":   "pending",
  "message":  "Payout submitted. Pending admin approval."
}
```

**Validation rules (enforce in Unity UI before calling):**
- Minimum payout: **$1.00**
- Amount must not exceed `availableBalanceUsd`
- Only one in-flight payout at a time
- Account must not be suspended or fraud-flagged
- Country must have payout enabled (check `GET /countries/check`)

**Error responses:**
- `400` — Insufficient balance, below minimum, or payout already in progress
- `403` — Account suspended, fraud-flagged, or too many requests

---

### GET `/payout/history`
**Auth required:** Yes

**Query params:** `page`, `limit` (same as transactions)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "amount": "5.0000",
      "paypalEmail": "john@example.com",
      "status": "completed",
      "createdAt": "2026-05-01T12:00:00Z",
      "processedAt": "2026-05-02T09:00:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

**Payout statuses:**
| Status | Meaning |
|--------|---------|
| `pending` | Awaiting admin approval |
| `approved` | Approved, queued for PayPal transfer |
| `completed` | Money sent to PayPal |
| `rejected` | Rejected — balance restored |
| `frozen` | Under investigation |

---

## 8. Tasks / Missions

### GET `/tasks`
**Auth required:** Yes

Returns all active tasks with the user's current progress. Refresh this after any earning event or login.

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Watch Your First Ad",
    "description": "Watch 1 rewarded ad to unlock a bonus.",
    "icon": "🎬",
    "triggerType": "ad_views",
    "triggerValue": 1,
    "rewardAmount": 0.01,
    "repeatInterval": "none",
    "progress": 0,
    "progressPercent": 0,
    "isCompleted": false,
    "isClaimed": false,
    "canClaim": false
  },
  {
    "id": "uuid2",
    "title": "3-Day Login Streak",
    "description": "Log in 3 days in a row.",
    "icon": "🔥",
    "triggerType": "login_streak",
    "triggerValue": 3,
    "rewardAmount": 0.05,
    "repeatInterval": "none",
    "progress": 2,
    "progressPercent": 66,
    "isCompleted": false,
    "isClaimed": false,
    "canClaim": false
  }
]
```

**Unity UI logic:**
- `canClaim = true` → show "Claim" button (reward is ready)
- `isCompleted && isClaimed` → show completed/greyed state
- `progressPercent` → use for progress bar
- `repeatInterval` values: `none`, `daily`, `weekly`, `monthly`

---

### POST `/tasks/:id/claim`
**Auth required:** Yes

Claim the reward for a completed task. Only call when `canClaim = true`.

**Response:**
```json
{
  "taskId": "uuid",
  "taskTitle": "Watch Your First Ad",
  "rewardAmount": 0.01,
  "message": "+$0.01 added to your balance!"
}
```

> Task rewards go **directly to available balance** (no pending delay). Refresh wallet immediately after.

---

## 9. Currencies (Public)

### GET `/currencies`
**Auth required:** No

Use this to populate the currency picker in Settings.

**Response:**
```json
[
  { "code": "USD", "name": "US Dollar",     "symbol": "$",  "rateToUsd": 1 },
  { "code": "EUR", "name": "Euro",          "symbol": "€",  "rateToUsd": 0.92 },
  { "code": "SEK", "name": "Swedish Krona", "symbol": "kr", "rateToUsd": 10.45 }
]
```

After user picks a currency, call `POST /user/update` with `{ "preferredCurrency": "EUR" }`.

---

## 10. Countries (Public)

### GET `/countries/check?code=XX`
**Auth required:** No

Call this on the signup/onboarding screen before letting the user proceed.

**Example:** `GET /countries/check?code=SE`

**Response (allowed + payout enabled):**
```json
{
  "available": true,
  "payoutEnabled": true
}
```

**Response (allowed, no payout):**
```json
{
  "available": true,
  "payoutEnabled": false,
  "message": "Registration allowed. Payouts are not yet available in your country."
}
```

**Response (blocked):**
```json
{
  "available": false,
  "payoutEnabled": false,
  "message": "This app is not available in your region."
}
```

**Unity logic:**
- `available = false` → show the restriction message and do not allow login/registration
- `available = true, payoutEnabled = false` → allow registration, but disable the Payout screen and show a note

---

### GET `/countries`
**Auth required:** No

Returns all non-restricted, enabled countries. Use for a country-picker dropdown on the signup screen.

**Response:**
```json
[
  { "code": "DE", "name": "Germany",        "payoutEnabled": true },
  { "code": "GB", "name": "United Kingdom", "payoutEnabled": true },
  { "code": "SE", "name": "Sweden",         "payoutEnabled": true },
  { "code": "US", "name": "United States",  "payoutEnabled": true }
]
```

---

## 11. Account Deletion

### DELETE `/user/account`
**Auth required:** Yes

Required for App Store (Apple guideline 5.1.1) and Google Play compliance.

**Request body:** None

**Response:**
```json
{
  "message": "Account deleted successfully. Financial records are retained as required by law."
}
```

**Error responses:**
- `400` — User has available balance (must withdraw first)
- `400` — User has a payout in progress (must wait)

**What happens on the backend:**
- All PII is anonymised (name, email, Google ID, device info wiped)
- Account is locked so the user cannot log back in
- Transaction and payout records are **kept** for legal/financial compliance
- Action is **irreversible** — warn the user before calling

---

## 12. Error Handling

All errors follow this structure:
```json
{
  "statusCode": 400,
  "message": "Human-readable error message here.",
  "error": "Bad Request"
}
```

| HTTP Code | Meaning | Unity Action |
|-----------|---------|--------------|
| `400` | Bad request / validation | Show `message` to user |
| `401` | JWT missing or expired | Force re-login (call `/auth/google-login`) |
| `403` | Account suspended / fraud-blocked | Show `message`, redirect to support |
| `404` | Resource not found | Show generic error |
| `429` | Rate limited | Back off and retry after a few seconds |
| `500` | Server error | Show generic "Try again later" |

---

## 13. Flow Diagrams

### App Launch Flow
```
App opens
    │
    ▼
Google Sign-In SDK  →  get idToken
    │
    ▼
POST /auth/google-login  (+ deviceId, fcmToken, country, gaid)
    │
    ├── isNewUser = true  →  Show onboarding
    │                         └── GET /countries/check?code=XX
    │                         └── POST /referral/apply-code  (if user has a code)
    │
    └── isNewUser = false →  Show main screen
    │
    ▼
Store JWT  →  All subsequent calls use Authorization: Bearer <token>
```

---

### Earning & Ad Reward Flow
```
User plays game (Adjoe SDK running)
    │
    ▼
Adjoe SDK  →  Adjoe server  →  POST /adjoe/callback (backend, no Unity needed)
    │                                   │
    │                                   ▼
    │                         User pending balance credited
    │
    ▼
GET /reward/ad/eligibility
    │
    ├── eligible = false  →  Hide "Watch Ad" button
    │
    └── eligible = true   →  Show "Watch Ad" button  (+$X label)
            │
            ▼
        User taps button  →  Show AdMob rewarded ad
            │
            ▼
        OnUserEarnedReward callback fires
            │
            ▼
        POST /reward/ad
            │
            ▼
        Show success toast  →  Refresh wallet (GET /wallet)
```

---

### Payout Flow
```
User opens Payout screen
    │
    ▼
GET /wallet  (check availableBalanceUsd ≥ $1.00)
GET /countries/check?code=XX  (check payoutEnabled)
    │
    ▼
User enters amount + PayPal email
    │
    ▼
POST /payout/request
    │
    ├── status = "approved"  →  Auto-approved  →  PayPal processes automatically
    │
    └── status = "pending"   →  Awaiting admin approval
            │
            ▼
        Show GET /payout/history to track progress
```

---

### Tasks Flow
```
User opens Missions screen
    │
    ▼
GET /tasks
    │
    ▼
For each task with canClaim = true:
    └── Show "Claim" button
            │
            ▼
        POST /tasks/:id/claim
            │
            ▼
        Show reward toast  →  Refresh GET /wallet  →  Refresh GET /tasks
```

---

## Quick Reference — All Unity Endpoints

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | POST | `/auth/google-login` | No | Login / Register |
| 2 | GET | `/user/profile` | Yes | Fetch profile + wallet |
| 3 | POST | `/user/update` | Yes | Update country / FCM / currency |
| 4 | DELETE | `/user/account` | Yes | Delete account (App Store compliance) |
| 5 | GET | `/wallet` | Yes | Live wallet balances |
| 6 | GET | `/transactions` | Yes | Transaction history |
| 7 | GET | `/reward/ad/eligibility` | Yes | Should "Watch Ad" button show? |
| 8 | POST | `/reward/ad` | Yes | Claim ad reward (after ad completes) |
| 9 | POST | `/referral/apply-code` | Yes | Apply referral code on signup |
| 10 | GET | `/referral/stats` | Yes | Referral screen stats |
| 11 | POST | `/payout/request` | Yes | Request a PayPal withdrawal |
| 12 | GET | `/payout/history` | Yes | Payout history screen |
| 13 | GET | `/tasks` | Yes | Tasks / missions list with progress |
| 14 | POST | `/tasks/:id/claim` | Yes | Claim completed task reward |
| 15 | GET | `/currencies` | No | Currency picker (settings screen) |
| 16 | GET | `/countries/check` | No | Country availability check (signup) |
| 17 | GET | `/countries` | No | Country picker dropdown (signup) |
