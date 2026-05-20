import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Scanning for upcoming shifts...');
    // Logic pseudo-code:
    // 1. Lấy tất cả các ca làm sắp diễn ra trong 15 phút tới
    // 2. Tìm danh sách User chưa confirm (AttendanceLog status = PENDING)
    // 3. Đẩy vào Queue để bot gửi tin nhắn Telegram
    
    // Example:
    // await this.queueService.addNotificationJob({
    //   chatId: 'TELEGRAM_CHAT_ID',
    //   type: 'REMINDER',
    //   assignmentId: 'assign-id',
    //   shiftName: 'Ca Sáng',
    //   minutesLeft: 15
    // });
  }
}
