-- CreateTable
CREATE TABLE "recurring_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target_type" "NotificationTarget" NOT NULL,
    "target_value" TEXT,
    "frequency" TEXT NOT NULL,
    "cron_expr" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "next_send_at" TIMESTAMP(3),
    "created_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recurring_notifications" ADD CONSTRAINT "recurring_notifications_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
