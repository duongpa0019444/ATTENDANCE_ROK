import { Controller, Get, Post, Body, Put, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  findAllShifts() {
    return this.shiftsService.findAllShifts();
  }

  @Post()
  createShift(@Body() data: any) {
    return this.shiftsService.createShift(data);
  }

  @Put(':id')
  updateShift(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateShift(id, data);
  }

  @Delete(':id')
  removeShift(@Param('id') id: string) {
    return this.shiftsService.removeShift(id);
  }

  @Get('assignments')
  getAssignments(@Query() query?: any) {
    return this.shiftsService.getAssignments(query);
  }

  @Post('sync-assignments')
  syncAssignments(@Body() data: { shift_id: string; work_date: string; user_ids: string[] }) {
    return this.shiftsService.syncAssignments(data);
  }

  @Post('assign')
  assignShift(@Body() data: any) {
    return this.shiftsService.assignShift(data);
  }

  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() data: any) {
    return this.shiftsService.updateAssignment(id, data);
  }

  @Delete('assignments/:id')
  removeAssignment(@Param('id') id: string) {
    return this.shiftsService.removeAssignment(id);
  }
}
