import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationTarget } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { NOTIFICATION_QUEUE } from './notifications.service';
import { CreateRecurringNotificationDto, FrequencyType } from './dto/recurring-notification.dto';

export const RECURRING_JOB_PREFIX = 'recurring:';

@Injectable()
export class RecurringNotificationsService {
  private readonly logger = new Logger(RecurringNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notifQueue: Queue,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateRecurringNotificationDto, adminId: string) {
    const cronExpr = this.buildCron(dto);

    const record = await this.prisma.recurringNotification.create({
      data: {
        title: dto.title,
        body: dto.body,
        targetType: dto.target,
        targetValue: dto.targetValue ?? null,
        frequency: dto.frequency,
        cronExpr,
        isActive: true,
        createdByAdminId: adminId,
      },
    });

    // Register Bull repeatable job
    await this.notifQueue.add(
      'dispatch-recurring',
      { recurringId: record.id },
      { repeat: { cron: cronExpr }, jobId: `${RECURRING_JOB_PREFIX}${record.id}` },
    );

    this.logger.log(`Recurring notification created: id=${record.id} cron="${cronExpr}"`);
    return record;
  }

  async list() {
    const records = await this.prisma.recurringNotification.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    return records.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      target: r.targetType,
      targetValue: r.targetValue ?? undefined,
      frequency: r.frequency,
      cronExpr: r.cronExpr,
      isActive: r.isActive,
      lastSentAt: r.lastSentAt ?? undefined,
      nextSendAt: r.nextSendAt ?? undefined,
      createdBy: r.createdBy.name,
      createdAt: r.createdAt,
    }));
  }

  async toggle(id: string) {
    const record = await this.prisma.recurringNotification.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Recurring notification not found.');

    const isActive = !record.isActive;

    if (isActive) {
      // Re-register Bull job
      await this.notifQueue.add(
        'dispatch-recurring',
        { recurringId: record.id },
        { repeat: { cron: record.cronExpr }, jobId: `${RECURRING_JOB_PREFIX}${record.id}` },
      );
    } else {
      // Remove Bull repeatable job
      await this.removeJob(record.id, record.cronExpr);
    }

    return this.prisma.recurringNotification.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(id: string) {
    const record = await this.prisma.recurringNotification.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Recurring notification not found.');

    await this.removeJob(record.id, record.cronExpr);
    await this.prisma.recurringNotification.delete({ where: { id } });

    return { message: 'Recurring notification deleted.' };
  }

  // ─── Called by queue processor ────────────────────────────────────────────

  async dispatch(recurringId: string) {
    const record = await this.prisma.recurringNotification.findUnique({
      where: { id: recurringId },
    });

    if (!record || !record.isActive) {
      this.logger.warn(`Recurring ${recurringId}: skipped (not found or inactive)`);
      return;
    }

    const tokens = await this.getTargetTokens(record.targetType, record.targetValue ?? undefined);

    if (tokens.length === 0) {
      this.logger.warn(`Recurring ${recurringId}: no tokens found`);
    } else {
      await this.firebase.sendToTokens(tokens, record.title, record.body);
    }

    await this.prisma.recurringNotification.update({
      where: { id: recurringId },
      data: { lastSentAt: new Date() },
    });

    this.logger.log(`Recurring ${recurringId}: dispatched to ${tokens.length} tokens`);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private buildCron(dto: CreateRecurringNotificationDto): string {
    const hour = dto.hour ?? 9; // default 9am UTC

    switch (dto.frequency as FrequencyType) {
      case 'daily':
        return `0 ${hour} * * *`;

      case 'weekly': {
        const day = dto.dayOfWeek ?? 1; // default Monday
        return `0 ${hour} * * ${day}`;
      }

      case 'monthly': {
        const dom = dto.dayOfMonth ?? 1; // default 1st
        return `0 ${hour} ${dom} * *`;
      }

      case 'custom':
        if (!dto.cronExpr) {
          throw new BadRequestException('cronExpr is required for custom frequency.');
        }
        return dto.cronExpr;

      default:
        throw new BadRequestException(`Unknown frequency: ${dto.frequency}`);
    }
  }

  private async removeJob(recordId: string, cronExpr: string) {
    try {
      const repeatableJobs = await this.notifQueue.getRepeatableJobs();
      const job = repeatableJobs.find(
        (j) => j.id === `${RECURRING_JOB_PREFIX}${recordId}` || j.cron === cronExpr,
      );
      if (job) {
        await this.notifQueue.removeRepeatableByKey(job.key);
      }
    } catch (err) {
      this.logger.error(`Failed to remove Bull job for recurring ${recordId}`, err);
    }
  }

  private async getTargetTokens(
    targetType: NotificationTarget,
    targetValue?: string,
  ): Promise<string[]> {
    const where: Record<string, unknown> = { fcmToken: { not: null } };

    if (targetType === NotificationTarget.country && targetValue) {
      where.country = targetValue;
    } else if (targetType === NotificationTarget.activity_level && targetValue) {
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

    const users = await this.prisma.user.findMany({
      where: where as any,
      select: { fcmToken: true },
    });
    return users.map((u) => u.fcmToken).filter((t): t is string => !!t);
  }
}
