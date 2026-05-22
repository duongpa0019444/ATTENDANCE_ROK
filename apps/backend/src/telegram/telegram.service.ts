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
  private adminSettingOfficeState = new Map<string, boolean>();

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
            `Để liên kết tài khoản, vui lòng sử dụng nút "Liên kết Telegram" trên trang quản lý nhân sự.`,
          );
        }
      });

      // Handle /setoffice command
      this.bot.command('setoffice', async (ctx) => {
        const telegramId = ctx.chat.id.toString();
        const user = await this.prisma.user.findFirst({
          where: { telegram_id: telegramId },
        });

        if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
          await ctx.reply('❌ Bạn không có quyền thực hiện lệnh này.');
          return;
        }

        this.adminSettingOfficeState.set(telegramId, true);
        await ctx.reply(
          '📍 Vui lòng chia sẻ/gửi vị trí của văn phòng mới.\n' +
          'Bạn có thể gửi một Location (vị trí) từ ứng dụng Telegram.',
        );
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

      // Listen to location messages for GPS check-in or office setting
      this.bot.on('location', async (ctx) => {
        const telegramId = ctx.chat.id.toString();
        if (this.adminSettingOfficeState.get(telegramId)) {
          this.adminSettingOfficeState.delete(telegramId);
          await this.handleSetOfficeLocation(ctx);
        } else {
          await this.handleLocationCheckin(ctx);
        }
      });

      // Manager Actions
      this.bot.action(/mgr_remind_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        await this.handleManagerRemindAction(ctx, shiftAssignmentId);
      });

      this.bot.action(/mgr_warn_(.+)/, async (ctx) => {
        const shiftAssignmentId = ctx.match[1];
        await this.handleManagerWarnAction(ctx, shiftAssignmentId);
      });

      this.bot.action(/mgr_replace_(.+)/, async (ctx) => {
        await ctx.reply(`👥 Tính năng gán người thay thế đang được xử lý.`);
        await ctx.answerCbQuery();
      });

      this.bot.action(/mgr_resolve_absent_(.+)/, async (ctx) => {
        const logId = ctx.match[1];
        try {
          await this.prisma.attendanceLog.update({
            where: { id: logId },
            data: { status: 'ABSENT' }
          });
          await ctx.reply(`✅ Đã ghi nhận nhân sự vắng mặt và đánh dấu đã xử lý.`);
        } catch (err) {
          await ctx.reply(`❌ Xử lý thất bại.`);
        }
        await ctx.answerCbQuery();
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
            `❌ Không tìm thấy nhân sự nào có Username là "${text}".\n\n` +
            `Để liên kết tài khoản, vui lòng sử dụng nút "Liên kết Telegram" trên trang quản lý nhân sự.`,
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

  async sendReminder(chatId: string, shiftName: string, assignmentId: string, minutesLeft: number, dateStr?: string) {
    if (!this.bot) return;
    try {
      const dateText = dateStr ? ` ngày ${dateStr}` : '';
      await this.bot.telegram.sendMessage(
        chatId,
        `🔔 Nhắc nhở: Còn ${minutesLeft} phút nữa là tới ca làm [${shiftName}]${dateText}. Vui lòng chuẩn bị!`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Xác nhận chuẩn bị', `confirm_shift_${assignmentId}`),
          Markup.button.callback('⚠️ Xin đi trễ', `late_shift_${assignmentId}`),
        ]),
      );
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
    }
  }

  async sendT10Reminder(chatId: string, shiftName: string, startTime: string, endTime: string, assignmentId: string, minutesLeft?: number, dateStr?: string) {
    if (!this.bot) return;
    try {
      const minText = minutesLeft ? ` (Còn ${minutesLeft} phút)` : '';
      const dateText = dateStr ? `Ngày: ${dateStr}\n` : '';
      await this.bot.telegram.sendMessage(
        chatId,
        `🔔 Sắp tới ca làm${minText}\n\nCa: ${shiftName}\n${dateText}Thời gian: ${startTime} - ${endTime}\n\nVui lòng xác nhận bạn đã sẵn sàng.\n*(Bạn cũng có thể gửi vị trí trực tiếp để check-in sớm)*`,
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

  async sendT5Warning(chatId: string, startTime: string, assignmentId: string, dateStr?: string) {
    if (!this.bot) return;
    try {
      const dateText = dateStr ? ` ngày ${dateStr}` : '';
      await this.bot.telegram.sendMessage(
        chatId,
        `⚠️ Bạn chưa xác nhận ca làm.\n\nCa bắt đầu lúc ${startTime}${dateText}.\nCòn 5 phút.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Tôi đã sẵn sàng', `ready_shift_${assignmentId}`)]
        ])
      );
    } catch (error) {
      this.logger.error(`Error sending T5 warning to ${chatId}`, error);
    }
  }

  async sendT0Checkin(chatId: string, assignmentId: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(
        chatId,
        `🟢 Đến giờ check-in.\n\nVui lòng chia sẻ vị trí của bạn để check-in.`,
        Markup.keyboard([
          [Markup.button.locationRequest('📍 Chia sẻ vị trí để check-in')]
        ]).resize().oneTime()
      );
    } catch (error) {
      this.logger.error(`Error sending T0 check-in prompt to ${chatId}`, error);
    }
  }

  async sendLateT5Alert(chatId: string, staffName: string, startTime: string, assignmentId: string, lateMinutes: number = 5, dateStr?: string) {
    if (!this.bot) return;
    try {
      const dateText = dateStr ? ` ngày ${dateStr}` : '';
      await this.bot.telegram.sendMessage(
        chatId,
        `⚠️ Nhân sự đi trễ\n\nTên: ${staffName}\nCa: ${startTime}${dateText}\nTrễ: ${lateMinutes} phút`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📞 Nhắc lại', `mgr_remind_${assignmentId}`)],
          [
            Markup.button.callback('⚠️ Ghi vi phạm', `mgr_warn_${assignmentId}`),
          ]
        ])
      );
    } catch (error) {
      this.logger.error(`Error sending Late T5 alert to manager ${chatId}`, error);
    }
  }

  async sendEscalation(chatId: string, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, `🚨 CẢNH BÁO: ${message}`);
    } catch (error) {
      this.logger.error(`Error sending telegram message to ${chatId}`, error);
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

  async getBotUsername(): Promise<string | null> {
    if (!this.bot) return null;
    try {
      const me = await this.bot.telegram.getMe();
      return me.username || null;
    } catch (error) {
      this.logger.error('Failed to get bot info', error);
      return null;
    }
  }

  // --- Bot Action Helpers ---

  private async handleReadyAction(ctx: any, assignmentId: string) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { shift_assignment_id: assignmentId },
      include: { shift_assignment: { include: { user: true, shift: true } } }
    });
    if (!log) {
      await ctx.reply(`❌ Không tìm thấy thông tin ca làm.`);
      await ctx.answerCbQuery();
      return;
    }

    const updatedLog = await this.prisma.attendanceLog.update({
      where: { id: log.id },
      data: {
        status: 'READY',
        confirm_at: new Date(),
      },
      include: { shift_assignment: { include: { user: true, shift: true } } }
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

    this.realtimeGateway.notifyDashboard('attendance-updated', {
      id: updatedLog.id,
      userId: updatedLog.user_id,
      name: updatedLog.shift_assignment.user.full_name,
      shift: `${updatedLog.shift_assignment.shift.name} (${updatedLog.shift_assignment.shift.start_time} - ${updatedLog.shift_assignment.shift.end_time})`,
      status: 'READY',
    });

    await ctx.reply(
      `✅ Đã ghi nhận bạn sẵn sàng vào ca.\n\n📍 Bạn có thể chia sẻ vị trí ngay bây giờ để check-in sớm nếu đã đến văn phòng.`,
      Markup.keyboard([
        [Markup.button.locationRequest('📍 Chia sẻ vị trí để check-in')]
      ]).resize().oneTime()
    );
    await ctx.answerCbQuery();
  }

  private async handleSetOfficeLocation(ctx: any) {
    const location = ctx.message.location;
    if (!location) {
      await ctx.reply('❌ Không nhận được thông tin vị trí.');
      return;
    }

    const userLat = location.latitude.toString();
    const userLng = location.longitude.toString();

    await this.prisma.setSetting('OFFICE_LATITUDE', userLat);
    await this.prisma.setSetting('OFFICE_LONGITUDE', userLng);

    await ctx.reply(
      `✅ Đã cập nhật vị trí văn phòng thành công!\n` +
      `📍 Vĩ độ (Latitude): ${userLat}\n` +
      `📍 Kinh độ (Longitude): ${userLng}`
    );
  }

  private getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  private async handleLocationCheckin(ctx: any) {
    const location = ctx.message.location;
    if (!location) {
      await ctx.reply('❌ Không nhận được thông tin vị trí.');
      return;
    }

    const telegramId = ctx.chat.id.toString();

    // Find the user by telegram_id
    const user = await this.prisma.user.findFirst({
      where: { telegram_id: telegramId },
    });

    if (!user) {
      await ctx.reply(
        `❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào trong hệ thống.\n` +
        `Vui lòng quay lại trang Dashboard và liên kết tài khoản.`,
        Markup.removeKeyboard()
      );
      return;
    }

    // Query active/pending attendance logs for this user today/yesterday/tomorrow
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        user_id: user.id,
        status: { in: ['PENDING', 'READY', 'LATE'] },
        shift_assignment: {
          work_date: {
            gte: yesterday,
            lte: tomorrow,
          },
        },
      },
      include: {
        shift_assignment: {
          include: {
            user: true,
            shift: true,
          },
        },
      },
    });

    if (logs.length === 0) {
      await ctx.reply(
        `ℹ️ Bạn không có ca làm việc nào đang chờ check-in tại thời điểm này.`,
        Markup.removeKeyboard()
      );
      return;
    }

    // Find the log closest in time to the current time
    const sortedLogs = logs.map(item => {
      const workDate = new Date(item.shift_assignment.work_date);
      const [hours, minutes] = item.shift_assignment.shift.start_time.split(':').map(Number);
      const shiftStart = new Date(
        workDate.getUTCFullYear(),
        workDate.getUTCMonth(),
        workDate.getUTCDate(),
        hours,
        minutes,
        0
      );
      const diffMs = Math.abs(shiftStart.getTime() - now.getTime());
      return { log: item, diffMs };
    }).sort((a, b) => a.diffMs - b.diffMs);

    const log = sortedLogs[0].log;

    // Geolocation verification
    const officeLat = parseFloat(
      await this.prisma.getSetting(
        'OFFICE_LATITUDE',
        this.configService.get<string>('OFFICE_LATITUDE') || '21.028511'
      )
    );
    const officeLng = parseFloat(
      await this.prisma.getSetting(
        'OFFICE_LONGITUDE',
        this.configService.get<string>('OFFICE_LONGITUDE') || '105.804817'
      )
    );
    const officeRadius = parseFloat(
      await this.prisma.getSetting(
        'OFFICE_RADIUS_METERS',
        this.configService.get<string>('OFFICE_RADIUS_METERS') || '100'
      )
    );

    const userLat = location.latitude;
    const userLng = location.longitude;

    const distance = this.getDistanceInMeters(userLat, userLng, officeLat, officeLng);

    if (distance <= officeRadius) {
      // SUCCESSFUL CHECK-IN
      const updatedLog = await this.prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          status: 'CHECKED_IN',
          checkin_at: new Date(),
        },
        include: {
          shift_assignment: {
            include: {
              user: true,
              shift: true,
            },
          },
        },
      });

      // Write AuditLog
      await this.prisma.auditLog.create({
        data: {
          actor_id: user.id,
          action: 'CHECKED_IN',
          entity_type: 'AttendanceLog',
          entity_id: log.id,
          metadata: {
            source: 'TELEGRAM_GPS',
            distance: Math.round(distance),
            latitude: userLat,
            longitude: userLng,
          },
        },
      });

      // Notify Dashboard
      this.realtimeGateway.notifyDashboard('attendance-updated', {
        id: updatedLog.id,
        userId: updatedLog.user_id,
        name: updatedLog.shift_assignment.user.full_name,
        shift: `${updatedLog.shift_assignment.shift.name} (${updatedLog.shift_assignment.shift.start_time} - ${updatedLog.shift_assignment.shift.end_time})`,
        status: 'CHECKED_IN',
      });

      await ctx.reply(
        `✅ Check-in thành công cho ca [${updatedLog.shift_assignment.shift.name}]!\n` +
        `📍 Khoảng cách tới văn phòng: ${Math.round(distance)}m (Yêu cầu: <= ${officeRadius}m).`,
        Markup.removeKeyboard()
      );
    } else {
      // FAILED CHECK-IN
      await ctx.reply(
        `❌ Check-in thất bại: Bạn đang ở quá xa văn phòng!\n` +
        `📍 Khoảng cách hiện tại: ${Math.round(distance)}m (Yêu cầu: <= ${officeRadius}m).\n\n` +
        `Vui lòng di chuyển vào khu vực văn phòng và bấm nút chia sẻ vị trí để thử lại.`
      );
    }
  }

  private async handleManagerRemindAction(ctx: any, assignmentId: string) {
    const assign = await this.prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true }
    });
    if (assign && assign.user.telegram_id) {
      try {
        await this.bot.telegram.sendMessage(
          assign.user.telegram_id,
          `🔔 Quản lý nhắc nhở bạn cần vào ca ngay lập tức!`
        );
        await ctx.reply(`✅ Đã gửi nhắc nhở tới nhân sự ${assign.user.full_name}.`);
      } catch (err) {
        await ctx.reply(`❌ Gửi nhắc nhở thất bại.`);
      }
    } else {
      await ctx.reply(`❌ Nhân sự chưa liên kết Telegram.`);
    }
    await ctx.answerCbQuery();
  }

  private async handleManagerWarnAction(ctx: any, assignmentId: string) {
    const log = await this.prisma.attendanceLog.findFirst({
      where: { shift_assignment_id: assignmentId },
      include: { shift_assignment: { include: { user: true } } }
    });
    if (log) {
      await this.prisma.auditLog.create({
        data: {
          actor_id: ctx.chat.id.toString(),
          action: 'VIOLATION_LOGGED',
          entity_type: 'AttendanceLog',
          entity_id: log.id,
          metadata: { details: 'Manager logged tardiness violation via Telegram' }
        }
      });
      await ctx.reply(`⚠️ Đã ghi nhận vi phạm đi trễ cho nhân sự ${log.shift_assignment.user.full_name}.`);
    } else {
      await ctx.reply(`❌ Không tìm thấy thông tin ca làm.`);
    }
    await ctx.answerCbQuery();
  }

  async notifyManagers(message: string, buttons?: any) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        telegram_id: { not: null }
      }
    });
    for (const mgr of managers) {
      if (mgr.telegram_id) {
        try {
          if (buttons) {
            await this.bot.telegram.sendMessage(mgr.telegram_id, message, buttons);
          } else {
            await this.bot.telegram.sendMessage(mgr.telegram_id, message);
          }
        } catch (err) {
          this.logger.error(`Failed to send alert to manager ${mgr.telegram_id}`, err);
        }
      }
    }
  }
}
