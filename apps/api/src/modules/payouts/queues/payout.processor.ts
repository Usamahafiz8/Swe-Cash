import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PaypalService } from '../paypal.service';
import { PayoutsService, PAYOUT_QUEUE } from '../payouts.service';

export interface PayoutJobData {
  payoutId: string;
  userId: string;
  amount: number;
  paypalEmail: string;
}

@Processor(PAYOUT_QUEUE)
export class PayoutProcessor {
  private readonly logger = new Logger(PayoutProcessor.name);

  constructor(
    private readonly paypalService: PaypalService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Process('process-payout')
  async handle(job: Job<PayoutJobData>) {
    const { payoutId, userId, amount, paypalEmail } = job.data;
    this.logger.log(`Processing payout job: payout=${payoutId} user=${userId} amount=${amount}`);

    try {
      const result = await this.paypalService.createPayout({
        batchId: `swecash_${payoutId}`,
        payoutId,
        recipientEmail: paypalEmail,
        amount,
      });

      await this.payoutsService.completePayout(payoutId, result.batchId);
      this.logger.log(`Payout job done: payout=${payoutId} paypal_batch=${result.batchId}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'PayPal API error';
      this.logger.error(`Payout job failed: payout=${payoutId} attempt=${job.attemptsMade + 1} — ${reason}`);

      // On final attempt, restore balance
      if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
        await this.payoutsService.failPayout(payoutId, reason);
      }

      throw err; // let Bull retry
    }
  }
}
