import {
  Injectable, Logger, OnModuleInit,
  NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { TaskTriggerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/tasks.dto';

// ─── Default tasks seeded on startup ─────────────────────────────────────────

const DEFAULT_TASKS = [
  {
    title: 'Watch Your First Ad',
    description: 'Watch 1 rewarded ad to unlock a bonus.',
    icon: '🎬',
    triggerType: TaskTriggerType.ad_views,
    triggerValue: 1,
    rewardAmount: 0.01,
    repeatInterval: 'none',
    sortOrder: 1,
  },
  {
    title: 'Ad Enthusiast',
    description: 'Watch 10 rewarded ads.',
    icon: '📺',
    triggerType: TaskTriggerType.ad_views,
    triggerValue: 10,
    rewardAmount: 0.05,
    repeatInterval: 'none',
    sortOrder: 2,
  },
  {
    title: 'Daily Ad Watcher',
    description: 'Watch 3 ads today.',
    icon: '📅',
    triggerType: TaskTriggerType.ad_views,
    triggerValue: 3,
    rewardAmount: 0.02,
    repeatInterval: 'daily',
    sortOrder: 3,
  },
  {
    title: 'First Game Reward',
    description: 'Earn your first reward from playing a game.',
    icon: '🎮',
    triggerType: TaskTriggerType.adjoe_earnings,
    triggerValue: 0.01,
    rewardAmount: 0.03,
    repeatInterval: 'none',
    sortOrder: 4,
  },
  {
    title: 'Earning Milestone: $1',
    description: 'Reach $1.00 in lifetime earnings.',
    icon: '💰',
    triggerType: TaskTriggerType.earning_milestone,
    triggerValue: 1.00,
    rewardAmount: 0.10,
    repeatInterval: 'none',
    sortOrder: 5,
  },
  {
    title: 'Earning Milestone: $5',
    description: 'Reach $5.00 in lifetime earnings.',
    icon: '🏆',
    triggerType: TaskTriggerType.earning_milestone,
    triggerValue: 5.00,
    rewardAmount: 0.50,
    repeatInterval: 'none',
    sortOrder: 6,
  },
  {
    title: '3-Day Login Streak',
    description: 'Log in 3 days in a row.',
    icon: '🔥',
    triggerType: TaskTriggerType.login_streak,
    triggerValue: 3,
    rewardAmount: 0.05,
    repeatInterval: 'none',
    sortOrder: 7,
  },
  {
    title: '7-Day Login Streak',
    description: 'Log in every day for a week.',
    icon: '⚡',
    triggerType: TaskTriggerType.login_streak,
    triggerValue: 7,
    rewardAmount: 0.15,
    repeatInterval: 'weekly',
    sortOrder: 8,
  },
  {
    title: 'First Referral',
    description: 'Refer 1 friend to SweCash.',
    icon: '👥',
    triggerType: TaskTriggerType.referral_count,
    triggerValue: 1,
    rewardAmount: 0.10,
    repeatInterval: 'none',
    sortOrder: 9,
  },
  {
    title: 'Referral Champion',
    description: 'Refer 5 friends to SweCash.',
    icon: '🌟',
    triggerType: TaskTriggerType.referral_count,
    triggerValue: 5,
    rewardAmount: 0.50,
    repeatInterval: 'none',
    sortOrder: 10,
  },
  {
    title: 'Complete Your Profile',
    description: 'Set your country to unlock full features.',
    icon: '✅',
    triggerType: TaskTriggerType.profile_complete,
    triggerValue: 1,
    rewardAmount: 0.05,
    repeatInterval: 'none',
    sortOrder: 11,
  },
];

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  // ─── Mobile API ───────────────────────────────────────────────────────────

  async getTasksForUser(userId: string) {
    const [tasks, progresses] = await Promise.all([
      this.prisma.task.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.userTaskProgress.findMany({
        where: { userId, periodKey: { in: ['', this.periodKey('daily'), this.periodKey('weekly'), this.periodKey('monthly')] } },
      }),
    ]);

    return tasks.map((task) => {
      const pk = task.repeatInterval === 'none' ? '' : this.periodKey(task.repeatInterval);
      const prog = progresses.find((p) => p.taskId === task.id && p.periodKey === pk);
      const triggerVal = task.triggerValue.toNumber();
      const progress = prog ? Math.min(prog.progress.toNumber(), triggerVal) : 0;

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        icon: task.icon,
        triggerType: task.triggerType,
        triggerValue: triggerVal,
        rewardAmount: task.rewardAmount.toNumber(),
        repeatInterval: task.repeatInterval,
        progress,
        progressPercent: Math.floor((progress / triggerVal) * 100),
        isCompleted: !!prog?.completedAt,
        isClaimed: !!prog?.claimedAt,
        canClaim: !!prog?.completedAt && !prog?.claimedAt,
      };
    });
  }

  async claim(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.isActive) throw new NotFoundException('Task not found.');

    const pk = task.repeatInterval === 'none' ? '' : this.periodKey(task.repeatInterval);
    const prog = await this.prisma.userTaskProgress.findUnique({
      where: { userId_taskId_periodKey: { userId, taskId, periodKey: pk } },
    });

    if (!prog?.completedAt) throw new BadRequestException('Task not completed yet.');
    if (prog.claimedAt) throw new BadRequestException('Reward already claimed.');

    const rewardAmount = task.rewardAmount.toNumber();

    const ledger = await this.walletService.credit({
      userId,
      amount: rewardAmount,
      type: 'bonus',
      referenceId: taskId,
      metadata: { source: 'task_reward', task_id: taskId, task_title: task.title },
    });

    // Auto-release to available balance immediately
    await this.walletService.releasePending(ledger.id);

    await this.prisma.userTaskProgress.update({
      where: { id: prog.id },
      data: { claimedAt: new Date() },
    });

    this.logger.log(`Task claimed: user=${userId} task=${taskId} reward=$${rewardAmount}`);

    return {
      taskId,
      taskTitle: task.title,
      rewardAmount,
      message: `+$${rewardAmount} added to your balance!`,
    };
  }

  // ─── Evaluate (called after each trigger event) ───────────────────────────

  /**
   * Called after any triggering action.
   * currentValue = the user's current count/amount for this trigger type.
   * E.g. after watching an ad: triggerType=ad_views, currentValue=totalAdViews
   */
  async evaluate(userId: string, triggerType: TaskTriggerType, currentValue: number) {
    const tasks = await this.prisma.task.findMany({
      where: { isActive: true, triggerType },
    });

    for (const task of tasks) {
      try {
        const pk = task.repeatInterval === 'none' ? '' : this.periodKey(task.repeatInterval);
        const triggerVal = task.triggerValue.toNumber();

        const prog = await this.prisma.userTaskProgress.upsert({
          where: { userId_taskId_periodKey: { userId, taskId: task.id, periodKey: pk } },
          update: { progress: Math.min(currentValue, triggerVal) },
          create: { userId, taskId: task.id, periodKey: pk, progress: Math.min(currentValue, triggerVal) },
        });

        // Mark complete if threshold reached and not already completed
        if (currentValue >= triggerVal && !prog.completedAt) {
          await this.prisma.userTaskProgress.update({
            where: { id: prog.id },
            data: { completedAt: new Date() },
          });
          this.logger.log(`Task completed: user=${userId} task=${task.id} (${task.title})`);
        }
      } catch (err) {
        this.logger.error(`Task evaluate error: task=${task.id}`, err);
      }
    }
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async adminList() {
    const tasks = await this.prisma.task.findMany({ orderBy: { sortOrder: 'asc' } });
    const stats = await this.prisma.userTaskProgress.groupBy({
      by: ['taskId'],
      _count: { id: true },
      where: { completedAt: { not: null } },
    });
    const claimed = await this.prisma.userTaskProgress.groupBy({
      by: ['taskId'],
      _count: { id: true },
      where: { claimedAt: { not: null } },
    });

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      icon: t.icon,
      triggerType: t.triggerType,
      triggerValue: t.triggerValue.toNumber(),
      rewardAmount: t.rewardAmount.toNumber(),
      repeatInterval: t.repeatInterval,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      completionCount: stats.find((s) => s.taskId === t.id)?._count.id ?? 0,
      claimedCount: claimed.find((s) => s.taskId === t.id)?._count.id ?? 0,
      createdAt: t.createdAt,
    }));
  }

  async adminCreate(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        icon: dto.icon ?? '⭐',
        triggerType: dto.triggerType,
        triggerValue: dto.triggerValue,
        rewardAmount: dto.rewardAmount,
        repeatInterval: dto.repeatInterval,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async adminUpdate(taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found.');

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.triggerValue !== undefined && { triggerValue: dto.triggerValue }),
        ...(dto.rewardAmount !== undefined && { rewardAmount: dto.rewardAmount }),
        ...(dto.repeatInterval !== undefined && { repeatInterval: dto.repeatInterval }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async adminDelete(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found.');
    await this.prisma.userTaskProgress.deleteMany({ where: { taskId } });
    await this.prisma.task.delete({ where: { id: taskId } });
    return { message: 'Task deleted.' };
  }

  // ─── Login streak helper ──────────────────────────────────────────────────

  async updateLoginStreak(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loginStreak: true, lastStreakDate: true },
    });
    if (!user) return 0;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const lastDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
    if (lastDate) lastDate.setUTCHours(0, 0, 0, 0);

    let newStreak = user.loginStreak;

    if (!lastDate) {
      newStreak = 1;
    } else {
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays === 0) return newStreak; // same day, no change
      if (diffDays === 1) newStreak += 1;   // consecutive day
      else newStreak = 1;                   // streak broken
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { loginStreak: newStreak, lastStreakDate: today },
    });

    return newStreak;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private periodKey(interval: string): string {
    const now = new Date();
    if (interval === 'daily') {
      return now.toISOString().slice(0, 10); // 2026-04-15
    }
    if (interval === 'weekly') {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // start of week (Sunday)
      const week = Math.ceil(now.getUTCDate() / 7);
      return `${now.getUTCFullYear()}-W${String(this.isoWeek(now)).padStart(2, '0')}`;
    }
    if (interval === 'monthly') {
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    return '';
  }

  private isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private async seedDefaults() {
    for (const t of DEFAULT_TASKS) {
      const existing = await this.prisma.task.findFirst({ where: { title: t.title } });
      if (!existing) {
        await this.prisma.task.create({ data: t });
      }
    }
    this.logger.log('Default tasks seeded.');
  }
}
