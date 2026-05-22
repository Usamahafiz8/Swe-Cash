CREATE TABLE "reward_cards" (
    "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "amount"     DECIMAL(10,4) NOT NULL,
    "badge"      TEXT,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "sort_order" INTEGER      NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_cards_pkey" PRIMARY KEY ("id")
);
