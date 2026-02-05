import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';

@ApiTags('Leave Requests')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create leave request' })
  create(@Body() createData: any) {
    return this.leaveRequestsService.create(createData, createData.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leave requests' })
  findAll() {
    return this.leaveRequestsService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get leave requests by user' })
  findByUser(@Param('userId') userId: string) {
    return this.leaveRequestsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  findOne(@Param('id') id: string) {
    return this.leaveRequestsService.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve leave request' })
  approve(@Param('id') id: string, @Body() body: { approverId: string }) {
    return this.leaveRequestsService.approve(id, body.approverId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject leave request' })
  reject(@Param('id') id: string, @Body() body: { approverId: string; reason: string }) {
    return this.leaveRequestsService.reject(id, body.approverId, body.reason);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel leave request' })
  cancel(@Param('id') id: string) {
    return this.leaveRequestsService.cancel(id);
  }
}
