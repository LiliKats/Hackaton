import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private leaveRequestsRepository: Repository<LeaveRequest>,
    private usersService: UsersService,
  ) {}

  async create(leaveRequestData: Partial<LeaveRequest>, userId: string): Promise<LeaveRequest> {
    const user = await this.usersService.findOne(userId);
    const totalDays = this.calculateLeaveDays(leaveRequestData.startDate, leaveRequestData.endDate);

    const remainingDays = await this.usersService.getRemainingLeaveDays(userId);
    if (totalDays > remainingDays) {
      throw new BadRequestException('Insufficient leave balance');
    }

    const leaveRequest = this.leaveRequestsRepository.create({
      ...leaveRequestData,
      user,
      totalDays,
    });

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async findAll(): Promise<LeaveRequest[]> {
    return this.leaveRequestsRepository.find({
      relations: ['user', 'approvedBy'],
    });
  }

  async findByUser(userId: string): Promise<LeaveRequest[]> {
    return this.leaveRequestsRepository.find({
      where: { user: { id: userId } },
      relations: ['user', 'approvedBy'],
      order: { createdAt: 'DESC' },
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

  async approve(id: string, approverId: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);
    const approver = await this.usersService.findOne(approverId);

    leaveRequest.status = LeaveStatus.APPROVED;
    leaveRequest.approvedBy = approver;
    leaveRequest.approvedAt = new Date();

    const user = await this.usersService.findOne(leaveRequest.user.id);
    await this.usersService.update(user.id, {
      usedLeaveDays: user.usedLeaveDays + leaveRequest.totalDays,
    });

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async reject(id: string, approverId: string, reason: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);
    const approver = await this.usersService.findOne(approverId);

    leaveRequest.status = LeaveStatus.REJECTED;
    leaveRequest.approvedBy = approver;
    leaveRequest.approvedAt = new Date();
    leaveRequest.rejectionReason = reason;

    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async cancel(id: string): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);

    if (leaveRequest.status === LeaveStatus.APPROVED) {
      const user = await this.usersService.findOne(leaveRequest.user.id);
      await this.usersService.update(user.id, {
        usedLeaveDays: user.usedLeaveDays - leaveRequest.totalDays,
      });
    }

    leaveRequest.status = LeaveStatus.CANCELLED;
    return this.leaveRequestsRepository.save(leaveRequest);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    return this.leaveRequestsRepository.find({
      where: {
        startDate: Between(startDate, endDate),
        status: LeaveStatus.APPROVED,
      },
      relations: ['user'],
    });
  }

  private calculateLeaveDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }
}
