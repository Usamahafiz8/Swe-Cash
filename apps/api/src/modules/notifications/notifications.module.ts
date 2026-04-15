import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsService, NOTIFICATION_QUEUE } from './notifications.service';
import { RecurringNotificationsService } from './recurring-notifications.service';
import { FirebaseService } from './firebase.service';
import { NotificationProcessor } from './queues/notification.processor';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  providers: [
    NotificationsService,
    RecurringNotificationsService,
    FirebaseService,
    NotificationProcessor,
  ],
  exports: [NotificationsService, RecurringNotificationsService],
})
export class NotificationsModule {}
