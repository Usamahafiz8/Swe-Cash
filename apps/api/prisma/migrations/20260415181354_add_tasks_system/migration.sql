-- CreateEnum
CREATE TYPE "TaskTriggerType" AS ENUM ('ad_views', 'adjoe_earnings', 'login_streak', 'referral_count', 'earning_milestone', 'profile_complete', 'manual');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_streak_date" TIMESTAMP(3),
ADD COLUMN     "login_streak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'star',
    "trigger_type" "TaskTriggerType" NOT NULL,
    "trigger_value" DECIMAL(12,4) NOT NULL,
    "reward_amount" DECIMAL(12,4) NOT NULL,
    "repeat_interval" TEXT NOT NULL DEFAULT 'none',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_task_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "progress" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "period_key" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_task_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_task_progress_user_id_idx" ON "user_task_progress"("user_id");

-- CreateIndex
CREATE INDEX "user_task_progress_task_id_idx" ON "user_task_progress"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_task_progress_user_id_task_id_period_key_key" ON "user_task_progress"("user_id", "task_id", "period_key");

-- AddForeignKey
ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_task_progress" ADD CONSTRAINT "user_task_progress_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
