import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface PayPalTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CreatePayoutParams {
  batchId: string;
  payoutId: string;
  recipientEmail: string;
  amount: number;
  currency?: string;
}

export interface PayPalPayoutResult {
  batchId: string;
  itemId: string;
  status: string;
}

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  // Token cache
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private readonly config: ConfigService) {
    const mode = config.get<string>('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    if (mode === 'live') {
      this.clientId = config.get<string>('PAYPAL_LIVE_CLIENT_ID', '');
      this.clientSecret = config.get<string>('PAYPAL_LIVE_SECRET', '');
    } else {
      this.clientId = config.get<string>('PAYPAL_SANDBOX_CLIENT_ID', '');
      this.clientSecret = config.get<string>('PAYPAL_SANDBOX_SECRET', '');
    }
  }

  async createPayout(params: CreatePayoutParams): Promise<PayPalPayoutResult> {
    const token = await this.getAccessToken();

    const payload = {
      sender_batch_header: {
        sender_batch_id: params.batchId,
        email_subject: 'Your SweCash withdrawal has been processed',
        email_message: 'Your withdrawal request is complete. Thank you for using SweCash.',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: params.amount.toFixed(2),
            currency: params.currency ?? 'USD',
          },
          receiver: params.recipientEmail,
          note: 'SweCash withdrawal',
          sender_item_id: params.payoutId,
        },
      ],
    };

    try {
      const response = await axios.post<{
        batch_header: { payout_batch_id: string; batch_status: string };
        items: Array<{ payout_item_id: string; transaction_status: string }>;
      }>(`${this.baseUrl}/v1/payments/payouts`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const batchId = response.data.batch_header.payout_batch_id;
      const item = response.data.items?.[0];

      this.logger.log(`PayPal payout created: batch=${batchId} item=${item?.payout_item_id}`);

      return {
        batchId,
        itemId: item?.payout_item_id ?? '',
        status: response.data.batch_header.batch_status,
      };
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data)
        : String(err);
      this.logger.error(`PayPal payout API failed: ${message}`);
      throw new InternalServerErrorException('PayPal payout failed.');
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (
      this.cachedToken &&
      this.tokenExpiresAt &&
      this.tokenExpiresAt > new Date(Date.now() + 60_000)
    ) {
      return this.cachedToken;
    }

    try {
      const response = await axios.post<PayPalTokenResponse>(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: this.clientId, password: this.clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      this.cachedToken = response.data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      this.logger.log('PayPal access token refreshed');
      return this.cachedToken;
    } catch (err) {
      this.logger.error('PayPal token fetch failed', err);
      throw new InternalServerErrorException('PayPal authentication failed.');
    }
  }
}
