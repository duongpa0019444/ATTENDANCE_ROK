import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TelegramService } from '../telegram/telegram.service';
import { Logger } from '@nestjs/common';

@Processor('notification-queue')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private telegramService: TelegramService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    const { chatId, type, message, assignmentId, shiftName, minutesLeft } = job.data;
    
    if (type === 'REMINDER') {
      await this.telegramService.sendReminder(chatId, shiftName, assignmentId, minutesLeft);
    } else {
      await this.telegramService.sendMessage(chatId, message);
    }
  }
}
