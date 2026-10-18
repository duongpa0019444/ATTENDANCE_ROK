import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditLogsService, QueryAuditLogsDto } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  async findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditLogsService.findAll(query);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('page/:page')
  async findByPage(
    @Param('page') page: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditLogsService.findByPage(page.toUpperCase(), {
      search,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 100,
    });
  }
}
