import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { LeaveRequest, LeaveStatus, LeaveType } from './entities/leave-request.entity';
import { UsersService } from '../users/users.service';
import { CreateLeaveRequestDto, UpdateLeaveRequestDto, QueryLeaveRequestDto, LeaveBalanceDto, TeamLeaveCalendarDto } from './dto';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestsRepository: Repository<LeaveRequest>,
    private usersService: UsersService,
  ) {}

  async create(createLeaveRequestDto: CreateLeaveRequestDto, userId: string): Promise<LeaveRequest> {
    const user = await this.usersService.findOne(userId);

    // Calculate total days excluding weekends
    const totalDays = this.calculateBusinessDays(createLeaveRequestDto.startDate, createLeaveRequestDto.endDate);

    // Validate business rules
    await this.validateLeaveRequest(createLeaveRequestDto, totalDays, userId);

    // Check for overlapping requests
    await this.checkForOverlappingRequests(userId, createLeaveRequestDto.startDate, createLeaveRequestDto.endDate);

    // Check team capacity if annual leave
    if (createLeaveRequestDto.type === LeaveType.ANNUAL && user.team) {
      await this.checkTeamCapacity(user.team.id, createLeaveRequestDto.startDate, createLeaveRequestDto.endDate);
    }

    const leaveRequest = this.leaveRequestsRepository.create({
      ...createLeaveRequestDto,
      user,
      totalDays,
    });

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async findAll(queryDto: QueryLeaveRequestDto): Promise<{ data: LeaveRequest[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.leaveRequestsRepository
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.user', 'user')
      .leftJoinAndSelect('leaveRequest.approvedBy', 'approvedBy');

    // Apply filters
    if (queryDto.status) {
      queryBuilder.andWhere('leaveRequest.status = :status', { status: queryDto.status });
    }

    if (queryDto.type) {
      queryBuilder.andWhere('leaveRequest.type = :type', { type: queryDto.type });
    }

    if (queryDto.userId) {
      queryBuilder.andWhere('leaveRequest.user.id = :userId', { userId: queryDto.userId });
    }

    if (queryDto.teamId) {
      queryBuilder.andWhere('user.teamId = :teamId', { teamId: queryDto.teamId });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('leaveRequest.startDate >= :startDate', { startDate: queryDto.startDate });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('leaveRequest.endDate <= :endDate', { endDate: queryDto.endDate });
    }

    // Apply sorting
    queryBuilder.orderBy(`leaveRequest.${queryDto.sortBy}`, queryDto.sortOrder);

    // Apply pagination
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      totalPages,
    };
  }

  async findByUser(userId: string): Promise<LeaveRequest[]> {
    return this.leaveRequestsRepository.find({
      where: { user: { id: userId } },
      relations: ['user', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    return this.leaveRequestsRepository.find({
      where: [
        {
          startDate: Between(startDate, endDate),
          status: LeaveStatus.APPROVED,
        },
        {
          endDate: Between(startDate, endDate),
          status: LeaveStatus.APPROVED,
        },
        {
          startDate: LessThanOrEqual(startDate),
          endDate: MoreThanOrEqual(endDate),
          status: LeaveStatus.APPROVED,
        },
      ],
      relations: ['user'],
      order: { startDate: 'ASC' },
    });
  }

  async findOne(id: string): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestsRepository.findOne({
      where: { id },
      relations: ['user', 'approvedBy'],
    });
    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }
    return leaveRequest;
  }

  async update(id: string, updateLeaveRequestDto: UpdateLeaveRequestDto, userId: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);

    // Only allow updates if request is pending and belongs to user
    if (leaveRequest.user.id !== userId) {
      throw new ForbiddenException('You can only update your own leave requests');
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Cannot update leave request that is not in pending status');
    }

    // Recalculate days if dates changed
    let totalDays = leaveRequest.totalDays;
    if (updateLeaveRequestDto.startDate || updateLeaveRequestDto.endDate) {
      const startDate = updateLeaveRequestDto.startDate || leaveRequest.startDate;
      const endDate = updateLeaveRequestDto.endDate || leaveRequest.endDate;
      totalDays = this.calculateBusinessDays(startDate, endDate);

      // Re-validate with new dates
      const updatedRequest = { ...leaveRequest, ...updateLeaveRequestDto };
      await this.validateLeaveRequest(updatedRequest, totalDays, userId);
      await this.checkForOverlappingRequests(userId, startDate, endDate, id);
    }

    Object.assign(leaveRequest, updateLeaveRequestDto);
    leaveRequest.totalDays = totalDays;

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async approve(id: string, approverId: string, comments?: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);
    const approver = await this.usersService.findOne(approverId);

    // Validate approver has permission
    await this.validateApproverPermission(approver, leaveRequest.user);

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request is not in pending status');
    }

    leaveRequest.status = LeaveStatus.APPROVED;
    leaveRequest.approvedBy = approver;
    leaveRequest.approvedAt = new Date();

    // Only update used leave days for annual leave
    if (leaveRequest.type === LeaveType.ANNUAL) {
      const user = await this.usersService.findOne(leaveRequest.user.id);
      await this.usersService.update(user.id, {
        usedLeaveDays: user.usedLeaveDays + leaveRequest.totalDays,
      });
    }

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async reject(id: string, approverId: string, reason: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);
    const approver = await this.usersService.findOne(approverId);

    // Validate approver has permission
    await this.validateApproverPermission(approver, leaveRequest.user);

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request is not in pending status');
    }

    leaveRequest.status = LeaveStatus.REJECTED;
    leaveRequest.approvedBy = approver;
    leaveRequest.approvedAt = new Date();
    leaveRequest.rejectionReason = reason;

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async cancel(id: string, userId: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);

    // Only allow cancellation by the requester
    if (leaveRequest.user.id !== userId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    // Cannot cancel if already rejected or cancelled
    if ([LeaveStatus.REJECTED, LeaveStatus.CANCELLED].includes(leaveRequest.status)) {
      throw new BadRequestException('Cannot cancel a request that is already rejected or cancelled');
    }

    // If approved, restore leave balance
    if (leaveRequest.status === LeaveStatus.APPROVED && leaveRequest.type === LeaveType.ANNUAL) {
      const user = await this.usersService.findOne(leaveRequest.user.id);
      await this.usersService.update(user.id, {
        usedLeaveDays: user.usedLeaveDays - leaveRequest.totalDays,
      });
    }

    leaveRequest.status = LeaveStatus.CANCELLED;
    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async getLeaveBalance(userId: string): Promise<LeaveBalanceDto> {
    const user = await this.usersService.findOne(userId);

    // Get pending annual leave
    const pendingAnnualLeave = await this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .where('lr.user.id = :userId', { userId })
      .andWhere('lr.type = :type', { type: LeaveType.ANNUAL })
      .andWhere('lr.status = :status', { status: LeaveStatus.PENDING })
      .select('SUM(lr.totalDays)', 'total')
      .getRawOne();

    // Get other leave types taken this year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);

    const sickLeave = await this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .where('lr.user.id = :userId', { userId })
      .andWhere('lr.type = :type', { type: LeaveType.SICK })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startDate >= :startDate AND lr.startDate <= :endDate', {
        startDate: startOfYear,
        endDate: endOfYear
      })
      .select('SUM(lr.totalDays)', 'total')
      .getRawOne();

    const otherLeave = await this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .where('lr.user.id = :userId', { userId })
      .andWhere('lr.type NOT IN (:...types)', { types: [LeaveType.ANNUAL, LeaveType.SICK] })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startDate >= :startDate AND lr.startDate <= :endDate', {
        startDate: startOfYear,
        endDate: endOfYear
      })
      .select('SUM(lr.totalDays)', 'total')
      .getRawOne();

    const pending = pendingAnnualLeave?.total || 0;
    const sick = sickLeave?.total || 0;
    const other = otherLeave?.total || 0;

    return {
      totalAnnualLeave: user.annualLeaveDays,
      usedAnnualLeave: user.usedLeaveDays,
      remainingAnnualLeave: user.annualLeaveDays - user.usedLeaveDays,
      pendingAnnualLeave: pending,
      availableAnnualLeave: user.annualLeaveDays - user.usedLeaveDays - pending,
      sickLeaveTaken: sick,
      otherLeaveTaken: other,
    };
  }

  async getTeamLeaveCalendar(teamId: string, startDate: Date, endDate: Date): Promise<TeamLeaveCalendarDto[]> {
    const leaveRequests = await this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .where('user.teamId = :teamId', { teamId })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startDate <= :endDate AND lr.endDate >= :startDate', {
        startDate,
        endDate
      })
      .getMany();

    return leaveRequests.map(lr => ({
      userId: lr.user.id,
      userName: `${lr.user.firstName} ${lr.user.lastName}`,
      startDate: lr.startDate,
      endDate: lr.endDate,
      type: lr.type,
      totalDays: lr.totalDays,
    }));
  }

  async checkConflicts(userId: string, startDate: Date, endDate: Date, excludeId?: string): Promise<boolean> {
    const queryBuilder = this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .where('lr.user.id = :userId', { userId })
      .andWhere('lr.status IN (:...statuses)', { statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED] })
      .andWhere('lr.startDate <= :endDate AND lr.endDate >= :startDate', {
        startDate,
        endDate
      });

    if (excludeId) {
      queryBuilder.andWhere('lr.id != :excludeId', { excludeId });
    }

    const conflicts = await queryBuilder.getCount();
    return conflicts > 0;
  }

  // Private helper methods

  private async validateLeaveRequest(request: any, totalDays: number, userId: string): Promise<void> {
    // Validate leave balance for annual leave
    if (request.type === LeaveType.ANNUAL) {
      const remainingDays = await this.usersService.getRemainingLeaveDays(userId);
      if (totalDays > remainingDays) {
        throw new BadRequestException(`Insufficient leave balance. Requested: ${totalDays} days, Available: ${remainingDays} days`);
      }
    }

    // Validate maximum consecutive days for annual leave
    if (request.type === LeaveType.ANNUAL && totalDays > 21) {
      throw new BadRequestException('Maximum consecutive annual leave is 21 days');
    }

    // Validate minimum notice period
    const today = new Date();
    const requestStartDate = new Date(request.startDate);
    const daysDifference = Math.ceil((requestStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (request.type === LeaveType.ANNUAL && daysDifference < 14) {
      throw new BadRequestException('Annual leave requires minimum 14 days advance notice');
    }
  }

  private async checkForOverlappingRequests(userId: string, startDate: Date, endDate: Date, excludeId?: string): Promise<void> {
    const hasConflicts = await this.checkConflicts(userId, startDate, endDate, excludeId);
    if (hasConflicts) {
      throw new BadRequestException('You have overlapping leave requests for this period');
    }
  }

  private async checkTeamCapacity(teamId: string, startDate: Date, endDate: Date): Promise<void> {
    // Get team size
    const teamMembers = await this.usersService.findAll();
    const teamSize = teamMembers.filter(user => user.team?.id === teamId).length;

    // Get approved leave for the team during this period
    const teamLeaveCount = await this.leaveRequestsRepository
      .createQueryBuilder('lr')
      .leftJoin('lr.user', 'user')
      .where('user.teamId = :teamId', { teamId })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startDate <= :endDate AND lr.endDate >= :startDate', {
        startDate,
        endDate
      })
      .getCount();

    // Check if adding this request exceeds 30% capacity
    const maxTeamLeave = Math.floor(teamSize * 0.3);
    if (teamLeaveCount >= maxTeamLeave) {
      throw new BadRequestException(`Team capacity exceeded. Maximum ${maxTeamLeave} out of ${teamSize} team members can be on leave simultaneously`);
    }
  }

  private async validateApproverPermission(approver: User, requester: User): Promise<void> {
    // HR and Admin can approve any request
    if ([UserRole.HR, UserRole.ADMIN].includes(approver.role)) {
      return;
    }

    // Manager can approve subordinates' requests
    if (approver.role === UserRole.MANAGER) {
      const subordinates = await this.usersService.findAll();
      const isSubordinate = subordinates.some(user =>
        user.manager?.id === approver.id && user.id === requester.id
      );

      if (isSubordinate) {
        return;
      }
    }

    throw new ForbiddenException('You do not have permission to approve this leave request');
  }

  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
        businessDays++;
      }
    }

    return businessDays;
  }

  // Legacy method for backward compatibility
  private calculateLeaveDays(startDate: Date, endDate: Date): number {
    return this.calculateBusinessDays(startDate, endDate);
  }
}
