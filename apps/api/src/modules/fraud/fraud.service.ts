import { Injectable, Logger } from '@nestjs/common';
import { FraudStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

const PAYOUT_HAMMER_MAX = 3;
const PAYOUT_HAMMER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GAID_CHANGE_WINDOW_DAYS = 30;

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ─── Detection Checks ────────────────────────────────────────────────────

  /** Called on every login when GAID is updated */
  async checkGaidChange(userId: string, newGaid: string) {
    const threshold = this.settings.getNumber('fraud_gaid_change_threshold', 2);
    const since = new Date(Date.now() - GAID_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const changeCount = await this.prisma.fraudLog.count({
      where: {
        userId,
        eventType: 'gaid_change',
        createdAt: { gte: since },
      },
    });

    // Always log the GAID change event
    await this.prisma.fraudLog.create({
      data: {
        userId,
        eventType: 'gaid_change',
        detectedValue: newGaid,
        actionTaken: changeCount >= threshold ? 'flagged_suspicious' : 'logged',
      },
    });

    if (changeCount >= threshold) {
      await this.setFraudStatus(userId, FraudStatus.suspicious);
      this.logger.warn(`Fraud: GAID change threshold exceeded user=${userId}`);
    }
  }

  /** Called after every reward credit to catch reward farming */
  async checkRapidRewards(userId: string) {
    // Use settings for threshold — TBD by client, defaulting to 50 rewards / 10 min
    const maxRewards = this.settings.getNumber('fraud_rapid_reward_max_count', 50);
    const windowMinutes = this.settings.getNumber('fraud_rapid_reward_window_minutes', 10);
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentCount = await this.prisma.transaction.count({
      where: {
        userId,
        type: { in: ['adjoe_reward', 'ad_reward'] },
        createdAt: { gte: since },
      },
    });

    if (recentCount > maxRewards) {
      await this.flag(
        userId,
        'rapid_rewards',
        `${recentCount} rewards in ${windowMinutes}min`,
        'flagged_suspicious',
      );
    }
  }

  /** Called on every payout request — freezes account if hammering detected */
  async checkPayoutHammering(userId: string): Promise<boolean> {
    const since = new Date(Date.now() - PAYOUT_HAMMER_WINDOW_MS);

    const recentPayouts = await this.prisma.payout.count({
      where: {
        userId,
        createdAt: { gte: since },
      },
    });

    if (recentPayouts >= PAYOUT_HAMMER_MAX) {
      await this.flag(
        userId,
        'payout_hammering',
        `${recentPayouts + 1} requests in 1 hour`,
        'frozen_payout',
      );
      await this.setFraudStatus(userId, FraudStatus.suspicious);
      this.logger.warn(`Fraud: payout hammering detected user=${userId}`);
      return true; // blocked
    }

    return false;
  }

  // ─── Status Management ────────────────────────────────────────────────────

  async escalateToBlocked(userId: string, adminVerdict = 'confirmed_fraud') {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { fraudStatus: FraudStatus.blocked },
      }),
      this.prisma.fraudLog.create({
        data: {
          userId,
          eventType: 'manual_block',
          detectedValue: 'admin_action',
          actionTaken: 'blocked',
          reviewedByAdmin: true,
          adminVerdict,
        },
      }),
    ]);
    this.logger.warn(`Fraud: user=${userId} escalated to BLOCKED`);
  }

  async reviewLog(logId: string, status: string) {
    return this.prisma.fraudLog.update({
      where: { id: logId },
      data: { reviewedByAdmin: true, adminVerdict: status },
    });
  }

  async getLogsForUser(userId: string) {
    const logs = await this.prisma.fraudLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return logs.map(this.mapLog);
  }

  async listFraudLogs(status?: string) {
    const where = status
      ? status === 'pending'
        ? { reviewedByAdmin: false }
        : { reviewedByAdmin: true, adminVerdict: { contains: status } }
      : {};
    const logs = await this.prisma.fraudLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return logs.map(this.mapLog);
  }

  private mapLog(log: {
    id: string; userId: string; eventType: string; detectedValue: string;
    actionTaken: string; reviewedByAdmin: boolean; adminVerdict: string | null; createdAt: Date;
  }) {
    const severityMap: Record<string, string> = {
      ip_collision: 'high', gaid_change: 'medium', rapid_rewards: 'high',
      payout_hammering: 'medium', admin_status_change: 'low',
    };
    let logStatus = 'pending';
    if (log.reviewedByAdmin) {
      const v = log.adminVerdict ?? '';
      if (v.includes('escalated')) logStatus = 'escalated';
      else if (v.includes('dismissed')) logStatus = 'dismissed';
      else logStatus = 'reviewed';
    }
    return {
      id: log.id,
      userId: log.userId,
      type: log.eventType,
      description: log.detectedValue,
      severity: severityMap[log.eventType] ?? 'medium',
      status: logStatus,
      createdAt: log.createdAt,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async flag(
    userId: string,
    eventType: string,
    detectedValue: string,
    actionTaken: string,
    relatedUserId?: string,
  ) {
    await this.prisma.fraudLog.create({
      data: {
        userId,
        eventType,
        detectedValue,
        actionTaken,
        relatedUserId: relatedUserId ?? null,
      },
    });
    this.logger.warn(`FraudLog: user=${userId} event=${eventType} value=${detectedValue}`);
  }

  private async setFraudStatus(userId: string, status: FraudStatus) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fraudStatus: status },
    });
  }
}
