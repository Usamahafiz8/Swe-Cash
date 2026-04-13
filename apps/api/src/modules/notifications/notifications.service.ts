import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationTarget, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { SendNotificationDto } from './dto/send-notification.dto';

export const NOTIFICATION_QUEUE = 'notification-queue';

export interface NotificationJobData {
  notificationId: string;
  title: string;
  body: string;
  targetType: NotificationTarget;
  targetValue?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notifQueue: Queue,
  ) {}

  async send(dto: SendNotificationDto, adminId: string) {
    const scheduledAt = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const isScheduled = scheduledAt && scheduledAt > new Date();

    const record = await this.prisma.notification.create({
      data: {
        title: dto.title,
        body: dto.body,
        targetType: dto.target,
        targetValue: dto.targetValue ?? null,
        status: isScheduled ? 'scheduled' : 'draft',
        scheduledAt,
        createdByAdminId: adminId,
      },
    });

    const jobData: NotificationJobData = {
      notificationId: record.id,
      title: dto.title,
      body: dto.body,
      targetType: dto.target,
      targetValue: dto.targetValue,
    };

    const delay = isScheduled ? scheduledAt!.getTime() - Date.now() : 0;

    await this.notifQueue.add('dispatch-notification', jobData, {
      delay: delay > 0 ? delay : 0,
      attempts: 2,
      removeOnComplete: true,
    });

    this.logger.log(
      `Notification queued: id=${record.id} target=${dto.targetType} scheduled=${isScheduled}`,
    );

    return {
      notificationId: record.id,
      status: isScheduled ? 'scheduled' : 'queued',
      scheduledAt,
    };
  }

  // Called by the queue processor
  async dispatch(data: NotificationJobData) {
    const tokens = await this.getTargetTokens(data.targetType, data.targetValue);

    if (tokens.length === 0) {
      this.logger.warn(`Notification ${data.notificationId}: no FCM tokens found for target`);
      await this.markSent(data.notificationId, 0, 0);
      return;
    }

    const result = await this.firebase.sendToTokens(tokens, data.title, data.body);

    await this.markSent(data.notificationId, result.successCount, result.failureCount);
  }

  async getHistory(page = 1, limit = 20) {
    const skip = ((page ?? 1) - 1) * (limit ?? 20);
    const items = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit ?? 20,
    });
    return items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      target: n.targetType,
      targetValue: n.targetValue ?? undefined,
      scheduledFor: n.scheduledAt ?? undefined,
      sentAt: n.sentAt ?? undefined,
      status: n.status ?? undefined,
      createdAt: n.createdAt,
    }));
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async getTargetTokens(
    targetType: NotificationTarget,
    targetValue?: string,
  ): Promise<string[]> {
    const where: Record<string, unknown> = { fcmToken: { not: null } };

    if (targetType === NotificationTarget.country && targetValue) {
      where.country = targetValue;
    } else if (targetType === NotificationTarget.activity_level && targetValue) {
      // High = users with >10 transactions, low = ≤2
      const minTx = targetValue === 'high' ? 10 : targetValue === 'medium' ? 3 : 0;
      const maxTx = targetValue === 'high' ? undefined : targetValue === 'medium' ? 9 : 2;
      const subquery = await this.prisma.transaction.groupBy({
        by: ['userId'],
        having: {
          userId: { _count: { gte: minTx, ...(maxTx !== undefined ? { lte: maxTx } : {}) } },
        },
      });
      where.id = { in: subquery.map((r) => r.userId) };
    }
    // earnings_tier and all: no additional filter

    const users = await this.prisma.user.findMany({
      where: where as Prisma.UserWhereInput,
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken).filter((t): t is string => !!t);
  }

  private async markSent(
    notificationId: string,
    successCount: number,
    failureCount: number,
  ) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: failureCount > 0 && successCount === 0 ? 'failed' : 'sent',
        sentAt: new Date(),
        metadata: { successCount, failureCount } as object,
      },
    });
  }
}
