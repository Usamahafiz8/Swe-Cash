# SweCash — Local & Production Setup

## Step 1 — Create your .env file

```bash
cp apps/api/.env.example apps/api/.env
```

Then fill in the values below.

---

## Step 2 — Neon (Free PostgreSQL)

1. Go to **https://neon.tech** → Sign up → New Project → name it `swecash`
2. Copy the **Connection String** (looks like `postgresql://user:pass@host/dbname?sslmode=require`)
3. In `apps/api/.env` set:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/swecash?sslmode=require
```

---

## Step 3 — Upstash (Free Redis)

1. Go to **https://upstash.com** → Sign up → Create Database → region closest to you
2. Copy **Endpoint**, **Port**, **Password** from the database page
3. In `apps/api/.env` set:

```env
REDIS_HOST=your-db.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password
REDIS_TLS=true
```

---

## Step 4 — JWT Secret

Generate a strong random secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to `.env`:

```env
JWT_SECRET=paste-output-here
JWT_EXPIRES_IN=30d
```

---

## Step 5 — Run the first migration

```bash
pnpm db:migrate
# When prompted for a migration name, enter: init
```

This creates all 11 tables in your Neon database.

---

## Step 6 — Seed the database

```bash
pnpm db:seed
```

Output:
```
✓ Admin created
  Email:    admin@swecash.com
  Password: ChangeMe123!
  ⚠  Change the password immediately after first login!

✓ 22 countries seeded
✅ Seed complete.
```

To use custom credentials:
```bash
SEED_ADMIN_EMAIL=you@yourdomain.com \
SEED_ADMIN_PASSWORD=YourStrongPassword! \
pnpm db:seed
```

---

## Step 7 — Start the API locally

```bash
pnpm api:dev
```

The API starts at **http://localhost:3000**

Test it:
```bash
curl http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@swecash.com","password":"ChangeMe123!"}'
```

---

## Step 8 — (Optional) Remaining .env values

Fill these in as you get access to each service:

| Key | Where to get it |
|-----|----------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs → OAuth 2.0 |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Service Accounts → Generate key |
| `FIREBASE_PRIVATE_KEY` | Same JSON file as above |
| `ADJOE_S2S_ENDPOINT` | Adjoe publisher dashboard |
| `ADMIN_URL` | Your deployed admin dashboard URL |

---

## Production Deploy (Hetzner)

### Server setup (one time)

```bash
# SSH into your Hetzner CX21
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone the repo
git clone your-repo-url /opt/swecash
cd /opt/swecash

# Create production .env
cp apps/api/.env.example .env
# Fill in production values (use live PayPal credentials, real DB URL, etc.)
```

### Deploy

```bash
cd /opt/swecash
docker compose up -d --build
```

The entrypoint automatically runs `prisma migrate deploy` on every container start.

### Update (zero-downtime rolling)

```bash
git pull
docker compose up -d --build --no-deps api
```

### View logs

```bash
docker compose logs -f api
```

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `pnpm api:dev` | Start API in watch mode |
| `pnpm admin:dev` | Start admin dashboard |
| `pnpm db:migrate` | Create + apply a new migration |
| `pnpm db:push` | Push schema changes without migration (dev only) |
| `pnpm db:studio` | Open Prisma Studio (visual DB browser) |
| `pnpm db:seed` | Run the seed script |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
