import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRewardCardDto, UpdateRewardCardDto } from './dto/reward-card.dto';

const DEFAULT_CARDS = [
  { amount: 0.01, badge: null,        sortOrder: 1 },
  { amount: 0.01, badge: null,        sortOrder: 2 },
  { amount: 0.01, badge: null,        sortOrder: 3 },
  { amount: 15.00, badge: 'TOP VALUE', sortOrder: 4 },
  { amount: 0.01, badge: null,        sortOrder: 5 },
  { amount: 0.01, badge: null,        sortOrder: 6 },
  { amount: 0.01, badge: null,        sortOrder: 7 },
];

@Injectable()
export class RewardCardsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.rewardCard.count();
    if (count === 0) {
      await this.prisma.rewardCard.createMany({ data: DEFAULT_CARDS });
    }
  }

  // ─── User: list active cards ──────────────────────────────────────────────

  async listActive() {
    const cards = await this.prisma.rewardCard.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return cards.map((c) => ({
      id:        c.id,
      amount:    c.amount.toNumber(),
      badge:     c.badge ?? null,
      sortOrder: c.sortOrder,
    }));
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async adminList() {
    return this.prisma.rewardCard.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminCreate(dto: CreateRewardCardDto) {
    return this.prisma.rewardCard.create({
      data: {
        amount:    dto.amount,
        badge:     dto.badge ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async adminUpdate(id: string, dto: UpdateRewardCardDto) {
    const card = await this.prisma.rewardCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Reward card not found.');

    return this.prisma.rewardCard.update({
      where: { id },
      data: {
        ...(dto.amount    !== undefined && { amount:    dto.amount }),
        ...(dto.badge     !== undefined && { badge:     dto.badge }),
        ...(dto.isActive  !== undefined && { isActive:  dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async adminDelete(id: string) {
    const card = await this.prisma.rewardCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Reward card not found.');
    await this.prisma.rewardCard.delete({ where: { id } });
    return { message: 'Reward card deleted.' };
  }
}
