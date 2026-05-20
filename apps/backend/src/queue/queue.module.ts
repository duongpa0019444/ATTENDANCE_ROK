import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationProcessor } from './notification.processor';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-queue',
    }),
    BullModule.registerQueue({
      name: 'escalation-queue',
    })
  ],
  providers: [NotificationProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
