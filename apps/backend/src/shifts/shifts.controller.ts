import { Controller, Get, Post, Body, Put, Delete, Param, UseGuards, Query, Request } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportExcelDto } from './import-excel.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  findAllShifts(@Query('week_start_date') weekStartDate?: string) {
    return this.shiftsService.findAllShifts(weekStartDate);
  }

  @Post('clone-week')
  cloneWeek(@Request() req: any, @Body() body: { from_week: string; to_week: string }) {
    return this.shiftsService.cloneWeek(body.from_week, body.to_week, req.user?.userId);
  }

  @Post('import-excel')
  importExcel(@Request() req: any, @Body() dto: ImportExcelDto) {
    return this.shiftsService.importExcel(dto, req.user?.userId);
  }

  @Post()
  createShift(@Request() req: any, @Body() data: any) {
    return this.shiftsService.createShift(data, req.user?.userId);
  }

  @Put(':id')
  updateShift(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateShift(id, data, req.user?.userId);
  }

  @Delete(':id')
  removeShift(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.removeShift(id, req.user?.userId);
  }

  @Get('assignments')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  getAssignments(@Query() query?: any) {
    return this.shiftsService.getAssignments(query);
  }

  @Get('my-assignments')
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  getMyAssignments(
    @Request() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.shiftsService.getAssignments({
      start_date: startDate,
      end_date: endDate,
      user_id: req.user.userId,
    });
  }

  @Post('sync-assignments')
  syncAssignments(@Request() req: any, @Body() data: { shift_id: string; work_date: string; user_ids: string[] }) {
    return this.shiftsService.syncAssignments(data, req.user?.userId);
  }

  @Post('assign')
  assignShift(@Request() req: any, @Body() data: any) {
    return this.shiftsService.assignShift(data, req.user?.userId);
  }

  @Put('assignments/:id')
  updateAssignment(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateAssignment(id, data, req.user?.userId);
  }

  @Delete('assignments/:id')
  removeAssignment(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.removeAssignment(id, req.user?.userId);
  }
}
