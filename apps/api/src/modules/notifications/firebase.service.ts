import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) return; // already initialised

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY', '')
      .replace(/\\n/g, '\n');

    const isPlaceholder = (v: string) => !v || v === 'pending' || v === 'SKIP';
    if (isPlaceholder(projectId) || isPlaceholder(clientEmail) || isPlaceholder(privateKey)) {
      this.logger.warn('Firebase credentials not set — notifications disabled.');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log('Firebase Admin SDK initialised.');
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (admin.apps.length === 0 || tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    // FCM supports max 500 tokens per multicast batch
    const chunks = this.chunk(tokens, 500);

    for (const chunk of chunks) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
        });
        successCount += response.successCount;
        failureCount += response.failureCount;
      } catch (err) {
        this.logger.error(`FCM batch send failed`, err);
        failureCount += chunk.length;
      }
    }

    this.logger.log(
      `FCM sent: success=${successCount} failure=${failureCount} total=${tokens.length}`,
    );

    return { successCount, failureCount };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }
}
