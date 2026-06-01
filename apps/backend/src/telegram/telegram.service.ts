import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramLinkService } from './telegram-link.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private telegramLinkService: TelegramLinkService,
    private realtimeGateway: RealtimeGateway,
  ) { }

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token && token !== 'your_telegram_bot_token_here') {
      this.bot = new Telegraf(token);

      // Handle /start with deep-link token
      this.bot.start(async (ctx) => {
        const payload = ctx.startPayload; // The part after /start

        if (payload) {
          // This is a deep-link flow — verify the token
          this.logger.log(`Received /start with token: ${payload} from chat ${ctx.chat.id}`);

          const telegramId = ctx.chat.id.toString();
          const telegramUsername = ctx.from?.username || undefined;

          const result = await this.telegramLinkService.completeLinking(
            payload,
            telegramId,
            telegramUsername,
          );

          if (result.success) {
            await ctx.reply(
              `✅ Liên kết thành công!\n\n` +
              `👤 Tài khoản: ${result.username}\n` +
              `📱 Telegram ID: ${telegramId}\n` +
              `${telegramUsername ? `@${telegramUsername}` : ''}\n\n` +
              `Từ giờ bạn sẽ nhận thông báo ca làm tại đây. 🎉`,
            );
          } else {
            await ctx.reply(
              `❌ Liên kết thất bại: ${result.reason}\n\n` +
              `Vui lòng quay lại trang quản lý và tạo lại link liên kết mới.`,
            );
          }
        } else {
          // Normal /start without payload
          await ctx.reply(
            `👋 Chào mừng đến với Attendance Bot!\n\n` +
            `Để liên kết tài khoản, vui lòng sử dụng nút "Liên kết Telegram" trên trang quản lý nông dân.`,
          );
        }
      });

      // Handle shift confirmation actions
      this.bot.action(/confirm_shift_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        await this.handleReadyAction(ctx, shiftAssignmentId);
      });

      this.bot.action(/ready_shift_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        await this.handleReadyAction(ctx, shiftAssignmentId);
      });

      // Legacy text-based linking (fallback)
      this.bot.on('text', async (ctx) => {
        const text = ctx.message.text.trim();
        if (text.startsWith('/')) return; // Ignore other commands

        const user = await this.prisma.user.findUnique({
          where: { username: text }
        });

        if (!user) {
          await ctx.reply(
            `❌ Không tìm thấy nông dân nào có Username là "${text}".\n\n` +
            `Để liên kết tài khoản, vui lòng sử dụng nút "Liên kết Telegram" trên trang quản lý nông dân.`,
          );
          return;
        }

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            telegram_id: ctx.chat.id.toString(),
            telegram_username: ctx.from?.username || null,
            telegram_linked_at: new Date(),
          }
        });

        await ctx.reply(`✅ Đã liên kết thành công tài khoản [${user.full_name}] với Telegram. Từ giờ bạn sẽ nhận thông báo ca làm tại đây.`);
      });

      this.bot.launch();
      this.logger.log('Telegram Bot started');

      // Graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } else {
      this.logger.warn('Telegram Bot Token is missing or invalid. Bot is not started.');
    }
  }

  async sendT10Reminder(chatId: string, shiftName: string, startTime: string, endTime: string, assignmentId: string, minutesLeft?: number, dateStr?: string) {
    if (!this.bot) return;
    try {
      const minText = minutesLeft ? ` (Còn ${minutesLeft} phút)` : '';
      const dateText = dateStr ? `Ngày: ${dateStr}\n` : '';
      const timeText = endTime ? `${startTime} - ${endTime}` : startTime;
      const formattedShiftName = shiftName && shiftName !== 'null' ? shiftName : 'N/A';
      await this.bot.telegram.sendMessage(
        chatId,
        `🔔 Sắp tới ca làm${minText}\n\nServer: ${formattedShiftName}\n${dateText}Thời gian: ${timeText}\n\nVui lòng xác nhận bạn đã sẵn sàng.`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tôi đã sẵn sàng', `ready_shift_${assignmentId}`)]
          ]).reply_markup
        }
      );
    } catch (error) {
      this.logger.error(`Error sending T10 reminder to ${chatId}`, error);
    }
  }

  async sendMessage(chatId: string, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
    }
  }

  // --- Bot Action Helpers ---

  private async handleReadyAction(ctx: any, assignmentId: string) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { shift_assignment_id: assignmentId },
      include: { shift_assignment: { include: { user: true, shift: { include: { server: true } } } } }
    });
    if (!log) {
      await ctx.reply(`❌ Không tìm thấy thông tin ca làm.`);
      await ctx.answerCbQuery();
      return;
    }

    if (await this.prisma.isDateLocked(log.shift_assignment.work_date, log.shift_assignment.shift_id)) {
      await ctx.reply(`❌ Ca làm này đã được chốt bảng lương. Không thể cập nhật điểm danh.`);
      await ctx.answerCbQuery();
      return;
    }

    if (log.status === 'READY') {
      await ctx.reply(`ℹ️ Ca làm này đã được bạn xác nhận trước đó.`);
      await ctx.answerCbQuery();
      return;
    }

    const assignment = log.shift_assignment;
    const workDate = new Date(assignment.work_date);
    const [hours, minutes] = assignment.shift.start_time.split(':').map(Number);
    const shiftStart = new Date(
      workDate.getUTCFullYear(),
      workDate.getUTCMonth(),
      workDate.getUTCDate(),
      hours,
      minutes,
      0
    );

    const now = new Date();
    if (now > shiftStart) {
      await ctx.reply(`❌ Không thể xác nhận ca làm này vì ca làm đã bắt đầu hoặc đã qua thời gian xác nhận.`);
      await ctx.answerCbQuery();
      return;
    }

    const updatedLog = await this.prisma.attendanceLog.update({
      where: { id: log.id },
      data: {
        status: 'READY',
        confirm_at: new Date(),
      },
      include: { shift_assignment: { include: { user: true, shift: { include: { server: true } } } } }
    });

    await this.prisma.auditLog.create({
      data: {
        actor_id: log.user_id,
        action: 'READY',
        entity_type: 'AttendanceLog',
        entity_id: log.id,
        metadata: { source: 'TELEGRAM' }
      }
    });

    const shift = updatedLog.shift_assignment.shift;
    const shiftDisplayName = shift.name ? `${shift.server?.name} (${shift.name})` : (shift.server?.name || 'N/A');

    this.realtimeGateway.notifyDashboard('attendance-updated', {
      id: updatedLog.id,
      userId: updatedLog.user_id,
      name: updatedLog.shift_assignment.user.full_name,
      shift: `${shiftDisplayName} (${shift.start_time}${shift.end_time ? ` - ${shift.end_time}` : ''})`,
      status: 'READY',
    });

    await ctx.reply(`✅ Đã ghi nhận bạn sẵn sàng vào ca.`, Markup.removeKeyboard());
    await ctx.answerCbQuery();
  }
}
