import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  async getPayroll(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    return this.payrollService.calculatePayroll(startDate, endDate);
  }

  @Get('my-payroll')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  async getMyPayroll(
    @Request() req: any,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Missing start_date or end_date');
    }
    const result = await this.payrollService.calculatePayroll(startDate, endDate, req.user.userId);
    return result[0] || null;
  }

  @Get('settings')
  async getSettings() {
    return this.payrollService.getSettings();
  }

  @Post('settings')
  async updateSettings(
    @Body()
    body: {
      nightShift22_3Bonus?: number;
      nightShift3_7Bonus?: number;
      weekendBonus?: number;
      defaultServerSalary?: number;
    },
  ) {
    return this.payrollService.updateSettings(body);
  }
}
