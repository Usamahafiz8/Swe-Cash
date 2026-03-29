#!/bin/sh
set -e

echo "▶ Running database migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma

echo "▶ Starting SweCash API..."
exec node dist/main
