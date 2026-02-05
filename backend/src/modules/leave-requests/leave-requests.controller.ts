import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequest } from './entities/leave-request.entity';
import { UserRole } from '../users/entities/user.entity';
import {
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  ApproveLeaveRequestDto,
  RejectLeaveRequestDto,
  BulkApprovalDto,
  QueryLeaveRequestDto,
  LeaveBalanceDto,
  TeamLeaveCalendarDto
} from './dto';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Leave Requests')
@Controller('leave-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new leave request' })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 400, description: 'Invalid request data or business rule violation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
    @Request() req: RequestWithUser
  ): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.create(createLeaveRequestDto, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all leave requests with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Leave requests retrieved successfully'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by leave type' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async findAll(
    @Query() queryDto: QueryLeaveRequestDto,
    @Request() req: RequestWithUser
  ) {
    try {
      return await this.leaveRequestsService.findAll(queryDto);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve leave requests',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get current user\'s leave requests' })
  @ApiResponse({
    status: 200,
    description: 'User leave requests retrieved successfully',
    type: [LeaveRequest]
  })
  async getMyRequests(@Request() req: RequestWithUser): Promise<LeaveRequest[]> {
    try {
      return await this.leaveRequestsService.findByUser(req.user.id);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve your leave requests',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get current user\'s leave balance' })
  @ApiResponse({
    status: 200,
    description: 'Leave balance retrieved successfully',
    type: LeaveBalanceDto
  })
  async getMyBalance(@Request() req: RequestWithUser): Promise<LeaveBalanceDto> {
    try {
      return await this.leaveRequestsService.getLeaveBalance(req.user.id);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve leave balance',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('balance/:userId')
  @ApiOperation({ summary: 'Get user\'s leave balance (managers/HR only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave balance retrieved successfully',
    type: LeaveBalanceDto
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async getUserBalance(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<LeaveBalanceDto> {
    try {
      return await this.leaveRequestsService.getLeaveBalance(userId);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve leave balance',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('conflicts')
  @ApiOperation({ summary: 'Check for conflicts with proposed leave dates' })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'excludeId', required: false, description: 'Exclude request ID from conflict check' })
  @ApiResponse({
    status: 200,
    description: 'Conflict check completed',
    schema: { type: 'object', properties: { hasConflicts: { type: 'boolean' } } }
  })
  async checkConflicts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('excludeId') excludeId: string | undefined,
    @Request() req: RequestWithUser
  ): Promise<{ hasConflicts: boolean }> {
    try {
      const hasConflicts = await this.leaveRequestsService.checkConflicts(
        req.user.id,
        new Date(startDate),
        new Date(endDate),
        excludeId
      );
      return { hasConflicts };
    } catch (error) {
      throw new HttpException(
        'Failed to check conflicts',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('team/:teamId/calendar')
  @ApiOperation({ summary: 'Get team leave calendar' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Team calendar retrieved successfully',
    type: [TeamLeaveCalendarDto]
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async getTeamCalendar(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<TeamLeaveCalendarDto[]> {
    try {
      return await this.leaveRequestsService.getTeamLeaveCalendar(
        teamId,
        new Date(startDate),
        new Date(endDate)
      );
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve team calendar',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get leave requests by user (managers/HR only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User leave requests retrieved successfully',
    type: [LeaveRequest]
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async findByUser(@Param('userId', ParseUUIDPipe) userId: string): Promise<LeaveRequest[]> {
    try {
      return await this.leaveRequestsService.findByUser(userId);
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve user leave requests',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request retrieved successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.findOne(id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update leave request (pending requests only)' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request updated successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 400, description: 'Cannot update non-pending request' })
  @ApiResponse({ status: 403, description: 'Can only update own requests' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLeaveRequestDto: UpdateLeaveRequestDto,
    @Request() req: RequestWithUser
  ): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.update(id, updateLeaveRequestDto, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve leave request (managers/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request approved successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 400, description: 'Request is not in pending status' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to approve' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveLeaveRequestDto,
    @Request() req: RequestWithUser
  ): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.approve(id, req.user.id, approveDto.approvalComments);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to approve leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject leave request (managers/HR only)' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request rejected successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 400, description: 'Request is not in pending status or missing rejection reason' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to reject' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectLeaveRequestDto,
    @Request() req: RequestWithUser
  ): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.reject(id, req.user.id, rejectDto.rejectionReason);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to reject leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel leave request' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request cancelled successfully',
    type: LeaveRequest
  })
  @ApiResponse({ status: 400, description: 'Cannot cancel this request' })
  @ApiResponse({ status: 403, description: 'Can only cancel own requests' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: RequestWithUser
  ): Promise<LeaveRequest> {
    try {
      return await this.leaveRequestsService.cancel(id, req.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to cancel leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('bulk-approve')
  @ApiOperation({ summary: 'Bulk approve multiple leave requests (managers/HR only)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk approval completed',
    schema: {
      type: 'object',
      properties: {
        approved: { type: 'array', items: { type: 'string' } },
        failed: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async bulkApprove(
    @Body() bulkApprovalDto: BulkApprovalDto,
    @Request() req: RequestWithUser
  ) {
    const results = { approved: [], failed: [] };

    for (const requestId of bulkApprovalDto.requestIds) {
      try {
        await this.leaveRequestsService.approve(requestId, req.user.id, bulkApprovalDto.comments);
        results.approved.push(requestId);
      } catch (error) {
        results.failed.push({
          requestId,
          error: error.message || 'Unknown error'
        });
      }
    }

    return results;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete leave request (admin only)' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({ status: 204, description: 'Leave request deleted successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    try {
      const leaveRequest = await this.leaveRequestsService.findOne(id);
      // Implement soft delete or hard delete based on business requirements
      // For now, we'll just mark as cancelled
      await this.leaveRequestsService.cancel(id, leaveRequest.user.id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete leave request',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
