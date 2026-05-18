import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// All keys that exist in the settings table
export const SETTING_KEYS = {
  ADJOE_REWARD_PER_MILESTONE: 'adjoe_reward_per_milestone',
  AD_REWARD_PER_VIEW: 'ad_reward_per_view',
  MIN_PAYOUT_THRESHOLD: 'min_payout_threshold',
  DAILY_EARNING_CAP: 'daily_earning_cap',
  MAX_AD_REWARDS_PER_DAY: 'max_ad_rewards_per_day',
  REFERRAL_COMMISSION_L1: 'referral_commission_level_1',
  REFERRAL_COMMISSION_L2: 'referral_commission_level_2',
  REFERRAL_COMMISSION_L3: 'referral_commission_level_3',
  PAYOUT_AUTO_APPROVE_ENABLED: 'payout_auto_approve_enabled',
  PAYOUT_AUTO_APPROVE_LIMIT: 'payout_auto_approve_limit',
  PENDING_TO_AVAILABLE_DELAY_HOURS: 'pending_to_available_delay_hours',
  FRAUD_IP_COLLISION_THRESHOLD: 'fraud_ip_collision_threshold',
  FRAUD_GAID_CHANGE_THRESHOLD: 'fraud_gaid_change_threshold',
} as const;

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
    await this.reload();
  }

  // Reload cache from DB — call after any admin update
  async reload() {
    const rows = await this.prisma.setting.findMany();
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.key, row.value);
    }
    this.logger.log(`Settings cache loaded (${rows.length} keys)`);
  }

  getString(key: string, fallback = ''): string {
    return this.cache.get(key) ?? fallback;
  }

  getNumber(key: string, fallback = 0): number {
    const val = this.cache.get(key);
    if (!val) return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }

  getBoolean(key: string, fallback = false): boolean {
    const val = this.cache.get(key);
    if (!val) return fallback;
    return val === 'true';
  }

  async set(key: string, value: string, updatedBy: string) {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });
    this.cache.set(key, value);
  }

  async getAll() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  // ─── Typed Convenience Getters ───────────────────────────────────────────────

  get referralCommissionL1() {
    return this.getNumber(SETTING_KEYS.REFERRAL_COMMISSION_L1, 0.15);
  }

  get referralCommissionL2() {
    return this.getNumber(SETTING_KEYS.REFERRAL_COMMISSION_L2, 0.12);
  }

  get referralCommissionL3() {
    return this.getNumber(SETTING_KEYS.REFERRAL_COMMISSION_L3, 0.05);
  }

  get minPayoutThreshold() {
    return this.getNumber(SETTING_KEYS.MIN_PAYOUT_THRESHOLD, 1.0);
  }

  get payoutAutoApproveEnabled() {
    return this.getBoolean(SETTING_KEYS.PAYOUT_AUTO_APPROVE_ENABLED, false);
  }

  get payoutAutoApproveLimit() {
    return this.getNumber(SETTING_KEYS.PAYOUT_AUTO_APPROVE_LIMIT, 5.0);
  }

  // ─── Seed Defaults ───────────────────────────────────────────────────────────

  private async seed() {
    const defaults: Array<{ key: string; value: string; description: string }> = [
      { key: SETTING_KEYS.REFERRAL_COMMISSION_L1, value: '0.15', description: '15% commission for Level 1 referrals' },
      { key: SETTING_KEYS.REFERRAL_COMMISSION_L2, value: '0.12', description: '12% commission for Level 2 referrals' },
      { key: SETTING_KEYS.REFERRAL_COMMISSION_L3, value: '0.05', description: '5% commission for Level 3 referrals' },
      { key: SETTING_KEYS.MIN_PAYOUT_THRESHOLD, value: '1.00', description: 'Minimum USD balance to request payout' },
      { key: SETTING_KEYS.PAYOUT_AUTO_APPROVE_ENABLED, value: 'false', description: 'Enable automatic payout processing' },
      { key: SETTING_KEYS.PAYOUT_AUTO_APPROVE_LIMIT, value: '5.00', description: 'Auto-approve payouts below this USD amount' },
      { key: SETTING_KEYS.FRAUD_IP_COLLISION_THRESHOLD, value: '3', description: 'Max accounts from same IP in 24h before fraud flag' },
      { key: SETTING_KEYS.FRAUD_GAID_CHANGE_THRESHOLD, value: '2', description: 'Max GAID changes in 30 days before fraud flag' },
    ];

    for (const s of defaults) {
      await this.prisma.setting.upsert({
        where: { key: s.key },
        update: {},
        create: s,
      });
    }
  }
}
