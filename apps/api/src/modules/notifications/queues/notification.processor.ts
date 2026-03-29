import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  NotificationsService,
  NOTIFICATION_QUEUE,
  NotificationJobData,
} from '../notifications.service';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('dispatch-notification')
  async handle(job: Job<NotificationJobData>) {
    this.logger.log(`Dispatching notification: id=${job.data.notificationId}`);
    await this.notificationsService.dispatch(job.data);
  }
}
