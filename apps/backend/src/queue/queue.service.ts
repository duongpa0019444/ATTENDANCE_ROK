import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('notification-queue') private notificationQueue: Queue,
    @InjectQueue('escalation-queue') private escalationQueue: Queue,
  ) {}

  async addNotificationJob(data: any, delay: number = 0) {
    await this.notificationQueue.add('send-notification', data, {
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async addEscalationJob(data: any, delay: number = 0) {
    await this.escalationQueue.add('trigger-escalation', data, { delay });
  }
}
