import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { DelegationService, CreateDelegationDto } from './delegation.service';
import { ActingManagerService, ActingManagerAssignment } from './acting-manager.service';
import { ManagerDelegation } from './entities/manager-delegation.entity';

class CreateDelegationRequestDto implements CreateDelegationDto {
  delegatedFromId: string;
  delegatedToId: string;
  delegationType: any;
  effectiveFrom: Date;
  effectiveTo: Date;
  reason?: string;
  comments?: string;
  permissions?: any;
  shouldTransferPendingApprovals?: boolean;
}

class AssignActingManagerDto implements ActingManagerAssignment {
  managerId: string;
  actingManagerId: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  reason: string;
  scope: 'full' | 'approval_only' | 'specific_users' | 'specific_teams';
  scopeDetails?: any;
}

class RevokeDelegationDto {
  reason: string;
}

@ApiTags('Delegations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('delegations')
export class DelegationController {
  constructor(
    private readonly delegationService: DelegationService,
    private readonly actingManagerService: ActingManagerService,
  ) {}

  @Post()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new manager delegation' })
  @ApiResponse({ status: 201, description: 'Delegation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid delegation parameters' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createDelegation(
    @Body(ValidationPipe) createDelegationDto: CreateDelegationRequestDto,
    @GetUser() currentUser: User,
  ): Promise<ManagerDelegation> {
    // Ensure user can only delegate their own authority (unless admin/HR)
    if (
      createDelegationDto.delegatedFromId !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.HR
    ) {
      throw new ForbiddenException('You can only delegate your own approval authority');
    }

    return await this.delegationService.createDelegation(createDelegationDto);
  }

  @Get('my-delegations')
  @ApiOperation({ summary: 'Get current user\'s delegations (from and to)' })
  @ApiResponse({ status: 200, description: 'User delegations retrieved successfully' })
  async getMyDelegations(@GetUser() user: User) {
    return await this.delegationService.getUserDelegations(user.id);
  }

  @Get('user/:userId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get delegations for a specific user' })
  @ApiResponse({ status: 200, description: 'User delegations retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDelegations(
    @Param('userId', ParseUUIDPipe) userId: string,
    @GetUser() currentUser: User,
  ) {
    // Allow users to see their own delegations, or managers/HR/admin to see any
    if (
      userId !== currentUser.id &&
      currentUser.role !== UserRole.MANAGER &&
      currentUser.role !== UserRole.HR &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to view user delegations');
    }

    return await this.delegationService.getUserDelegations(userId);
  }

  @Get('date-range')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get delegations within a date range' })
  @ApiResponse({ status: 200, description: 'Delegations retrieved successfully' })
  async getDelegationsInRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ManagerDelegation[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 format.');
    }

    return await this.delegationService.getDelegationsInRange(start, end);
  }

  @Patch(':delegationId/revoke')
  @ApiOperation({ summary: 'Revoke an active delegation' })
  @ApiResponse({ status: 200, description: 'Delegation revoked successfully' })
  @ApiResponse({ status: 404, description: 'Delegation not found' })
  @ApiResponse({ status: 400, description: 'Cannot revoke delegation' })
  async revokeDelegation(
    @Param('delegationId', ParseUUIDPipe) delegationId: string,
    @Body(ValidationPipe) revokeDelegationDto: RevokeDelegationDto,
    @GetUser() currentUser: User,
  ): Promise<ManagerDelegation> {
    return await this.delegationService.revokeDelegation(
      delegationId,
      currentUser.id,
      revokeDelegationDto.reason,
    );
  }

  @Get(':delegationId/effective-approver/:userId')
  @ApiOperation({ summary: 'Get effective approver considering delegations' })
  @ApiResponse({ status: 200, description: 'Effective approver retrieved successfully' })
  async getEffectiveApprover(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<User | null> {
    return await this.delegationService.getEffectiveApprover(userId);
  }

  @Post(':delegationId/validate-approval')
  @ApiOperation({ summary: 'Validate if delegate can approve a specific request' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  async validateDelegateApproval(
    @Param('delegationId', ParseUUIDPipe) delegationId: string,
    @Body() approvalData: {
      approverId: string;
      userId: string;
      leaveType: string;
      totalDays: number;
      department?: string;
    },
  ) {
    return await this.delegationService.validateDelegateApproval(
      delegationId,
      approvalData.approverId,
      {
        userId: approvalData.userId,
        leaveType: approvalData.leaveType,
        totalDays: approvalData.totalDays,
        department: approvalData.department,
      },
    );
  }

  // Acting Manager endpoints

  @Post('acting-managers')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign an acting manager' })
  @ApiResponse({ status: 201, description: 'Acting manager assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid assignment parameters' })
  async assignActingManager(
    @Body(ValidationPipe) assignment: AssignActingManagerDto,
    @GetUser() currentUser: User,
  ): Promise<User> {
    // Ensure user can only assign acting managers for themselves (unless admin/HR)
    if (
      assignment.managerId !== currentUser.id &&
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.HR
    ) {
      throw new ForbiddenException('You can only assign acting managers for yourself');
    }

    return await this.actingManagerService.assignActingManager(assignment);
  }

  @Delete('acting-managers/:managerId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove an acting manager assignment' })
  @ApiResponse({ status: 200, description: 'Acting manager removed successfully' })
  @HttpCode(HttpStatus.OK)
  async removeActingManager(
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Body() body: { reason: string },
    @GetUser() currentUser: User,
  ): Promise<{ message: string }> {
    await this.actingManagerService.removeActingManager(
      managerId,
      currentUser.id,
      body.reason,
    );

    return { message: 'Acting manager removed successfully' };
  }

  @Get('acting-managers/active')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all active acting manager assignments' })
  @ApiResponse({ status: 200, description: 'Active acting managers retrieved successfully' })
  async getActiveActingManagers(): Promise<User[]> {
    return await this.actingManagerService.getActiveActingManagers();
  }

  @Get('acting-managers/current')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get users currently acting as managers' })
  @ApiResponse({ status: 200, description: 'Current acting managers retrieved successfully' })
  async getCurrentActingManagers(): Promise<User[]> {
    return await this.actingManagerService.getCurrentActingManagers();
  }

  @Get('acting-managers/candidates/:managerId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Find suitable acting manager candidates' })
  @ApiResponse({ status: 200, description: 'Acting manager candidates found' })
  async findActingManagerCandidates(
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Query('exclude') excludeUserIds?: string,
  ): Promise<User[]> {
    const excludeIds = excludeUserIds ? excludeUserIds.split(',') : [];
    return await this.actingManagerService.findActingManagerCandidates(managerId, excludeIds);
  }

  @Get('acting-managers/:actingManagerId/load')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get acting manager workload' })
  @ApiResponse({ status: 200, description: 'Acting manager load retrieved' })
  async getActingManagerLoad(
    @Param('actingManagerId', ParseUUIDPipe) actingManagerId: string,
  ): Promise<{ currentLoad: number; managingFor: string[] }> {
    const currentLoad = await this.actingManagerService.getActingManagerLoad(actingManagerId);

    // Get the list of managers they're acting for
    const activeAssignments = await this.actingManagerService.getActiveActingManagers();
    const managingFor = activeAssignments
      .filter(manager => manager.actingManager?.id === actingManagerId)
      .map(manager => manager.id);

    return {
      currentLoad,
      managingFor,
    };
  }

  @Post('acting-managers/validate')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Validate an acting manager assignment' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  async validateActingManagerAssignment(
    @Body(ValidationPipe) assignment: AssignActingManagerDto,
  ) {
    return await this.actingManagerService.validateActingManagerAssignment(assignment);
  }

  // Utility endpoints

  @Post('expire')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually expire outdated delegations and acting manager assignments' })
  @ApiResponse({ status: 200, description: 'Expiration process completed' })
  @HttpCode(HttpStatus.OK)
  async expireAssignments(): Promise<{
    expiredDelegations: number;
    expiredActingManagers: number;
  }> {
    const [expiredDelegations, expiredActingManagers] = await Promise.all([
      this.delegationService.expireDelegations(),
      this.actingManagerService.expireActingManagerAssignments(),
    ]);

    return {
      expiredDelegations,
      expiredActingManagers,
    };
  }
}

// Import necessary decorators and exceptions
import { ForbiddenException, BadRequestException } from '@nestjs/common';