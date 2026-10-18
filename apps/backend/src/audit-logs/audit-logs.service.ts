import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogDto {
  actorId?: string | null;
  page: 'SHIFTS' | 'SHIFT_MANAGEMENT' | 'SERVERS' | 'USERS' | 'PAYROLL' | 'SETTINGS' | 'SYSTEM' | string;
  action: 'EXCEL_IMPORT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK' | 'UNLOCK' | 'SYNC' | 'CLONE';
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: any;
}

export interface QueryAuditLogsDto {
  page?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an activity record
   */
  async log(data: CreateAuditLogDto) {
    try {
      let actorId = data.actorId || null;
      if (actorId) {
        const user = await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { id: true },
        });
        if (!user) {
          actorId = null;
        }
      }

      const record = await this.prisma.auditLog.create({
        data: {
          actor_id: actorId,
          page: data.page,
          action: data.action,
          entity_type: data.entityType,
          entity_id: data.entityId ? String(data.entityId) : null,
          summary: data.summary,
          metadata: data.metadata || undefined,
        },
        include: {
          actor: {
            select: { id: true, username: true, full_name: true, role: true },
          },
        },
      });
      return record;
    } catch (error) {
      this.logger.error('Failed to write audit log:', error);
      return null;
    }
  }

  /**
   * Query logs with filters & pagination
   */
  async findAll(query: QueryAuditLogsDto) {
    const where: any = {};

    if (query.page && query.page !== 'ALL') {
      where.page = query.page;
    }

    if (query.action && query.action !== 'ALL') {
      where.action = query.action;
    }

    if (query.actorId) {
      where.actor_id = query.actorId;
    }

    if (query.startDate || query.endDate) {
      where.created_at = {};
      if (query.startDate) {
        where.created_at.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    if (query.search) {
      where.OR = [
        { summary: { contains: query.search, mode: 'insensitive' } },
        { entity_type: { contains: query.search, mode: 'insensitive' } },
        { actor: { full_name: { contains: query.search, mode: 'insensitive' } } },
        { actor: { username: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const limit = query.limit ? Number(query.limit) : 50;
    const offset = query.offset ? Number(query.offset) : 0;

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, username: true, full_name: true, role: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      data: logs,
    };
  }

  /**
   * Retrieve logs for a specific page with optional search and date filters
   */
  async findByPage(
    page: string,
    query?: { search?: string; startDate?: string; endDate?: string; limit?: number } | number,
  ) {
    const where: any = { page };

    let limit = 100;

    if (typeof query === 'number') {
      limit = query;
    } else if (query) {
      if (query.startDate || query.endDate) {
        where.created_at = {};
        if (query.startDate) {
          where.created_at.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          where.created_at.lte = end;
        }
      }

      if (query.search) {
        where.OR = [
          { summary: { contains: query.search, mode: 'insensitive' } },
          { entity_type: { contains: query.search, mode: 'insensitive' } },
          { actor: { full_name: { contains: query.search, mode: 'insensitive' } } },
          { actor: { username: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      if (query.limit) {
        limit = Number(query.limit);
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, username: true, full_name: true, role: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
