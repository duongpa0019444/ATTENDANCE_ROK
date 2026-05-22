import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a secure random token, save it to DB,
   * and return a Telegram deep link for the user.
   */
  async createLink(username: string) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new HttpException(
        `Không tìm thấy nhân sự với username "${username}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Generate secure random token
    const token = randomBytes(16).toString('hex');

    // Token expires in 10 minutes
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 10);

    // Save token to database
    await this.prisma.telegramLinkToken.create({
      data: {
        username,
        token,
        expired_at: expiredAt,
      },
    });

    // Build deep link
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    // Extract bot username from bot info - for now use env variable
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || '';

    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    this.logger.log(`Created Telegram link token for user "${username}", expires at ${expiredAt.toISOString()}`);

    return {
      deepLink,
      token,
      expiresAt: expiredAt.toISOString(),
      username: user.username,
      fullName: user.full_name,
    };
  }

  /**
   * Verify a token: check it exists, is not used, and not expired.
   * Returns the associated username if valid.
   */
  async verifyToken(token: string) {
    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { token },
    });

    if (!linkToken) {
      return { valid: false, reason: 'Token không tồn tại' };
    }

    if (linkToken.used) {
      return { valid: false, reason: 'Token đã được sử dụng' };
    }

    if (new Date() > linkToken.expired_at) {
      return { valid: false, reason: 'Token đã hết hạn' };
    }

    return { valid: true, username: linkToken.username };
  }

  /**
   * Mark token as used and save telegram info to user.
   */
  async completeLinking(token: string, telegramId: string, telegramUsername?: string) {
    const verification = await this.verifyToken(token);

    if (!verification.valid) {
      this.logger.warn(`Token verification failed: ${verification.reason}`);
      return { success: false, reason: verification.reason };
    }

    const username = verification.username!;

    // Update user with telegram info
    await this.prisma.user.update({
      where: { username },
      data: {
        telegram_id: telegramId,
        telegram_username: telegramUsername || null,
        telegram_linked_at: new Date(),
      },
    });

    // Mark token as used
    await this.prisma.telegramLinkToken.update({
      where: { token },
      data: { used: true },
    });

    this.logger.log(`Successfully linked Telegram ID ${telegramId} to user "${username}"`);

    return { success: true, username };
  }

  /**
   * Check if a link token has been completed.
   */
  async getLinkStatus(token: string) {
    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { token },
    });

    if (!linkToken) {
      throw new HttpException('Token không tồn tại', HttpStatus.NOT_FOUND);
    }

    if (linkToken.used) {
      const user = await this.prisma.user.findUnique({
        where: { username: linkToken.username },
        select: { telegram_id: true, telegram_username: true, full_name: true },
      });
      return { status: 'LINKED', user };
    }

    if (new Date() > linkToken.expired_at) {
      return { status: 'EXPIRED' };
    }

    return { status: 'PENDING' };
  }
}
