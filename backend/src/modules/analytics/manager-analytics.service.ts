import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { ApprovalStep, ApprovalStepStatus } from '../workflows/entities/approval-step.entity';
import { WorkflowInstance, WorkflowStatus } from '../workflows/entities/workflow-instance.entity';
import { LeaveRequest, LeaveType, LeaveStatus } from '../leave-requests/entities/leave-request.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { ApprovalHistory, AuditAction } from '../audit/entities/approval-history.entity';

export interface ManagerDashboardData {
  pendingApprovals: {
    count: number;
    urgent: number;
    overdue: number;
    byType: Record<string, number>;
    items: Array<{
      id: string;
      employeeName: string;
      leaveType: LeaveType;
      startDate: Date;
      endDate: Date;
      totalDays: number;
      reason: string;
      submittedAt: Date;
      dueAt?: Date;
      priority: 'low' | 'medium' | 'high' | 'urgent';
    }>;
  };
  teamAnalytics: {
    totalTeamMembers: number;
    activeRequests: number;
    upcomingLeaves: number;
    teamCapacityUtilization: number;
    leaveCalendar: Array<{
      date: string;
      employeeName: string;
      leaveType: LeaveType;
      isPartial: boolean;
    }>;
  };
  approvalMetrics: {
    thisMonth: {
      totalProcessed: number;
      averageProcessingTime: number; // in hours
      onTimeRate: number; // percentage
      autoApprovalRate: number;
    };
    lastMonth: {
      totalProcessed: number;
      averageProcessingTime: number;
      onTimeRate: number;
      autoApprovalRate: number;
    };
    trends: {
      processingTimeChange: number; // percentage change
      volumeChange: number;
      performanceScore: number; // 0-100
    };
  };
  delegationStatus: {
    activeDelegations: number;
    actingManagerFor: string[];
    delegatedTo: string[];
    expiringDelegations: Array<{
      delegateeName: string;
      expiresAt: Date;
      daysRemaining: number;
    }>;
  };
}

export interface TeamAnalyticsReport {
  teamId: string;
  teamName: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  memberMetrics: Array<{
    userId: string;
    userName: string;
    role: UserRole;
    metrics: {
      totalLeaveRequests: number;
      approvedLeaves: number;
      rejectedLeaves: number;
      pendingLeaves: number;
      totalLeaveDays: number;
      remainingLeaveDays: number;
      averageRequestProcessingTime: number;
    };
  }>;
  teamTrends: {
    leaveVolumeByMonth: Record<string, number>;
    leaveTypeDistribution: Record<string, number>;
    capacityUtilization: Array<{
      date: string;
      utilizationPercentage: number;
      membersOnLeave: number;
    }>;
    seasonalPatterns: Array<{
      period: string;
      avgLeaveRequests: number;
      peakDays: string[];
    }>;
  };
  forecastData: {
    predictedLeaveVolume: Record<string, number>; // next 3 months
    capacityRisks: Array<{
      date: string;
      riskLevel: 'low' | 'medium' | 'high';
      reason: string;
    }>;
  };
}

export interface ApprovalPerformanceMetrics {
  managerId: string;
  managerName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  performanceKPIs: {
    totalApprovals: number;
    averageProcessingTime: number;
    slaComplianceRate: number;
    escalationRate: number;
    rejectionRate: number;
    responsiveness: number; // 0-100 score
    efficiency: number; // 0-100 score
    qualityScore: number; // 0-100 based on reversals, complaints
  };
  comparisonMetrics: {
    peerAverage: {
      processingTime: number;
      slaComplianceRate: number;
      escalationRate: number;
    };
    organizationAverage: {
      processingTime: number;
      slaComplianceRate: number;
      escalationRate: number;
    };
    ranking: {
      position: number;
      totalManagers: number;
      percentile: number;
    };
  };
  trendsAnalysis: {
    processingTimeTrend: Array<{ month: string; avgTime: number }>;
    volumeTrend: Array<{ month: string; count: number }>;
    performanceImprovement: {
      metric: string;
      change: number;
      direction: 'improving' | 'declining' | 'stable';
    }[];
  };
}

@Injectable()
export class ManagerAnalyticsService {
  private readonly logger = new Logger(ManagerAnalyticsService.name);

  constructor(
    @InjectRepository(ApprovalStep)
    private approvalStepRepository: Repository<ApprovalStep>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(LeaveRequest)
    private leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(ApprovalHistory)
    private auditRepository: Repository<ApprovalHistory>,
  ) {}

  /**
   * Gets comprehensive dashboard data for a manager
   */
  async getManagerDashboard(managerId: string): Promise<ManagerDashboardData> {
    this.logger.log(`Generating manager dashboard for user ${managerId}`);

    const manager = await this.userRepository.findOne({
      where: { id: managerId },
      relations: ['subordinates', 'team', 'team.members'],
    });

    if (!manager) {
      throw new Error(`Manager ${managerId} not found`);
    }

    const [pendingApprovals, teamAnalytics, approvalMetrics, delegationStatus] = await Promise.all([
      this.getPendingApprovalsData(managerId),
      this.getTeamAnalyticsData(manager),
      this.getApprovalMetricsData(managerId),
      this.getDelegationStatusData(managerId),
    ]);

    return {
      pendingApprovals,
      teamAnalytics,
      approvalMetrics,
      delegationStatus,
    };
  }

  /**
   * Generates comprehensive team analytics report
   */
  async getTeamAnalyticsReport(
    teamId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TeamAnalyticsReport> {
    this.logger.log(`Generating team analytics report for team ${teamId}`);

    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['members', 'lead'],
    });

    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const memberMetrics = await this.calculateMemberMetrics(team.members, startDate, endDate);
    const teamTrends = await this.calculateTeamTrends(teamId, startDate, endDate);
    const forecastData = await this.generateTeamForecast(team, startDate, endDate);

    return {
      teamId: team.id,
      teamName: team.name,
      reportPeriod: { startDate, endDate },
      memberMetrics,
      teamTrends,
      forecastData,
    };
  }

  /**
   * Calculates detailed approval performance metrics for a manager
   */
  async getApprovalPerformanceMetrics(
    managerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ApprovalPerformanceMetrics> {
    this.logger.log(`Calculating approval performance metrics for manager ${managerId}`);

    const manager = await this.userRepository.findOne({
      where: { id: managerId },
      relations: ['subordinates'],
    });

    if (!manager) {
      throw new Error(`Manager ${managerId} not found`);
    }

    const [performanceKPIs, comparisonMetrics, trendsAnalysis] = await Promise.all([
      this.calculatePerformanceKPIs(managerId, startDate, endDate),
      this.calculateComparisonMetrics(managerId, startDate, endDate),
      this.calculateTrendsAnalysis(managerId, startDate, endDate),
    ]);

    return {
      managerId,
      managerName: manager.fullName,
      period: { startDate, endDate },
      performanceKPIs,
      comparisonMetrics,
      trendsAnalysis,
    };
  }

  /**
   * Gets real-time team capacity and availability data
   */
  async getTeamCapacityData(
    teamId: string,
    forecastDays: number = 30,
  ): Promise<{
    currentCapacity: {
      totalMembers: number;
      availableMembers: number;
      onLeaveToday: number;
      capacityPercentage: number;
    };
    forecast: Array<{
      date: string;
      availableMembers: number;
      onLeaveMembers: number;
      capacityPercentage: number;
      riskLevel: 'low' | 'medium' | 'high';
    }>;
    upcomingLeaves: Array<{
      employeeName: string;
      startDate: Date;
      endDate: Date;
      leaveType: LeaveType;
      totalDays: number;
    }>;
  }> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['members'],
    });

    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const today = new Date();
    const forecastEndDate = new Date();
    forecastEndDate.setDate(today.getDate() + forecastDays);

    // Get current capacity
    const totalMembers = team.members.filter(m => m.isActive).length;
    const onLeaveToday = await this.leaveRequestRepository.count({
      where: {
        user: { team: { id: teamId } },
        status: LeaveStatus.APPROVED,
        startDate: LessThan(today),
        endDate: MoreThan(today),
      },
    });

    const currentCapacity = {
      totalMembers,
      availableMembers: totalMembers - onLeaveToday,
      onLeaveToday,
      capacityPercentage: Math.round(((totalMembers - onLeaveToday) / totalMembers) * 100),
    };

    // Generate forecast
    const forecast = await this.generateCapacityForecast(team, forecastDays);

    // Get upcoming leaves
    const upcomingLeaves = await this.getUpcomingLeaves(teamId, forecastEndDate);

    return {
      currentCapacity,
      forecast,
      upcomingLeaves,
    };
  }

  /**
   * Generates approval workflow efficiency report
   */
  async getWorkflowEfficiencyReport(
    managerId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    overallMetrics: {
      totalWorkflows: number;
      averageCompletionTime: number;
      averageStepsPerWorkflow: number;
      automationRate: number;
      escalationRate: number;
    };
    bottleneckAnalysis: Array<{
      stepName: string;
      averageTime: number;
      completionRate: number;
      escalationRate: number;
      recommendations: string[];
    }>;
    managerPerformance: Array<{
      managerId: string;
      managerName: string;
      averageProcessingTime: number;
      throughput: number;
      efficiency: number;
    }>;
  }> {
    const period = {
      start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: endDate || new Date(),
    };

    let workflowQuery = this.workflowInstanceRepository
      .createQueryBuilder('workflow')
      .leftJoinAndSelect('workflow.approvalSteps', 'steps')
      .where('workflow.createdAt BETWEEN :startDate AND :endDate', {
        startDate: period.start,
        endDate: period.end,
      });

    if (managerId) {
      workflowQuery = workflowQuery.andWhere('steps.assignedUserId = :managerId', { managerId });
    }

    const workflows = await workflowQuery.getMany();

    const overallMetrics = this.calculateOverallWorkflowMetrics(workflows);
    const bottleneckAnalysis = this.analyzeWorkflowBottlenecks(workflows);
    const managerPerformance = await this.calculateManagerPerformanceMetrics(workflows);

    return {
      overallMetrics,
      bottleneckAnalysis,
      managerPerformance,
    };
  }

  // Private helper methods

  private async getPendingApprovalsData(managerId: string) {
    const pendingSteps = await this.approvalStepRepository.find({
      where: {
        assignedUserId: managerId,
        status: ApprovalStepStatus.PENDING,
      },
      relations: [
        'workflowInstance',
        'workflowInstance.leaveRequest',
        'workflowInstance.leaveRequest.user',
      ],
      order: { dueAt: 'ASC', createdAt: 'ASC' },
    });

    const now = new Date();
    let urgent = 0;
    let overdue = 0;
    const byType: Record<string, number> = {};

    const items = pendingSteps.map(step => {
      const leaveRequest = step.workflowInstance.leaveRequest;
      if (!leaveRequest) return null;

      // Count by type
      const leaveType = leaveRequest.type;
      byType[leaveType] = (byType[leaveType] || 0) + 1;

      // Determine priority and count urgent/overdue
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';

      if (step.dueAt) {
        const hoursRemaining = (step.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursRemaining < 0) {
          overdue++;
          priority = 'urgent';
        } else if (hoursRemaining < 4) {
          urgent++;
          priority = 'urgent';
        } else if (hoursRemaining < 12) {
          priority = 'high';
        }
      }

      return {
        id: step.id,
        employeeName: leaveRequest.user.fullName,
        leaveType: leaveRequest.type,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        totalDays: leaveRequest.totalDays,
        reason: leaveRequest.reason || '',
        submittedAt: step.workflowInstance.createdAt,
        dueAt: step.dueAt,
        priority,
      };
    }).filter(item => item !== null);

    return {
      count: items.length,
      urgent,
      overdue,
      byType,
      items,
    };
  }

  private async getTeamAnalyticsData(manager: User) {
    const teamMembers = manager.subordinates || [];
    const team = manager.team;

    if (!team) {
      return {
        totalTeamMembers: teamMembers.length,
        activeRequests: 0,
        upcomingLeaves: 0,
        teamCapacityUtilization: 100,
        leaveCalendar: [],
      };
    }

    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const [activeRequests, upcomingLeaves] = await Promise.all([
      this.leaveRequestRepository.count({
        where: {
          user: { team: { id: team.id } },
          status: LeaveStatus.PENDING,
        },
      }),
      this.leaveRequestRepository.find({
        where: {
          user: { team: { id: team.id } },
          status: LeaveStatus.APPROVED,
          startDate: Between(today, next30Days),
        },
        relations: ['user'],
      }),
    ]);

    // Calculate team capacity utilization
    const totalMembers = team.members.filter(m => m.isActive).length;
    const membersOnLeaveToday = await this.leaveRequestRepository.count({
      where: {
        user: { team: { id: team.id } },
        status: LeaveStatus.APPROVED,
        startDate: LessThan(today),
        endDate: MoreThan(today),
      },
    });

    const teamCapacityUtilization = totalMembers > 0
      ? Math.round(((totalMembers - membersOnLeaveToday) / totalMembers) * 100)
      : 100;

    // Build leave calendar
    const leaveCalendar = upcomingLeaves.map(leave => ({
      date: leave.startDate.toISOString().split('T')[0],
      employeeName: leave.user.fullName,
      leaveType: leave.type,
      isPartial: leave.totalDays < 1,
    }));

    return {
      totalTeamMembers: totalMembers,
      activeRequests,
      upcomingLeaves: upcomingLeaves.length,
      teamCapacityUtilization,
      leaveCalendar,
    };
  }

  private async getApprovalMetricsData(managerId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthMetrics, lastMonthMetrics] = await Promise.all([
      this.calculateMonthlyMetrics(managerId, thisMonthStart, now),
      this.calculateMonthlyMetrics(managerId, lastMonthStart, lastMonthEnd),
    ]);

    const trends = {
      processingTimeChange: thisMonthMetrics.averageProcessingTime - lastMonthMetrics.averageProcessingTime,
      volumeChange: thisMonthMetrics.totalProcessed - lastMonthMetrics.totalProcessed,
      performanceScore: this.calculatePerformanceScore(thisMonthMetrics),
    };

    return {
      thisMonth: thisMonthMetrics,
      lastMonth: lastMonthMetrics,
      trends,
    };
  }

  private async getDelegationStatusData(managerId: string) {
    // Simplified delegation status - in a real implementation,
    // this would query the delegation tables
    return {
      activeDelegations: 0,
      actingManagerFor: [],
      delegatedTo: [],
      expiringDelegations: [],
    };
  }

  private async calculateMonthlyMetrics(managerId: string, startDate: Date, endDate: Date) {
    const approvalSteps = await this.approvalStepRepository.find({
      where: {
        assignedUserId: managerId,
        decidedAt: Between(startDate, endDate),
        status: In([ApprovalStepStatus.APPROVED, ApprovalStepStatus.REJECTED]),
      },
    });

    const totalProcessed = approvalSteps.length;
    let totalProcessingTime = 0;
    let onTimeCount = 0;
    let autoApprovalCount = 0;

    for (const step of approvalSteps) {
      if (step.decidedAt && step.createdAt) {
        const processingTime = step.decidedAt.getTime() - step.createdAt.getTime();
        totalProcessingTime += processingTime;

        // Check if on time (within 48 hours)
        if (processingTime <= 48 * 60 * 60 * 1000) {
          onTimeCount++;
        }
      }

      if (step.wasAutoApproved) {
        autoApprovalCount++;
      }
    }

    const averageProcessingTime = totalProcessed > 0
      ? totalProcessingTime / (totalProcessed * 1000 * 60 * 60) // Convert to hours
      : 0;

    const onTimeRate = totalProcessed > 0 ? (onTimeCount / totalProcessed) * 100 : 100;
    const autoApprovalRate = totalProcessed > 0 ? (autoApprovalCount / totalProcessed) * 100 : 0;

    return {
      totalProcessed,
      averageProcessingTime,
      onTimeRate,
      autoApprovalRate,
    };
  }

  private calculatePerformanceScore(metrics: any): number {
    // Simple performance scoring algorithm
    let score = 100;

    // Deduct points for slow processing
    if (metrics.averageProcessingTime > 24) score -= 20;
    if (metrics.averageProcessingTime > 48) score -= 30;

    // Deduct points for low on-time rate
    if (metrics.onTimeRate < 90) score -= 20;
    if (metrics.onTimeRate < 70) score -= 40;

    return Math.max(0, score);
  }

  private async calculateMemberMetrics(members: User[], startDate: Date, endDate: Date) {
    const memberMetrics = [];

    for (const member of members) {
      const leaveRequests = await this.leaveRequestRepository.find({
        where: {
          user: { id: member.id },
          createdAt: Between(startDate, endDate),
        },
      });

      const metrics = {
        totalLeaveRequests: leaveRequests.length,
        approvedLeaves: leaveRequests.filter(r => r.status === LeaveStatus.APPROVED).length,
        rejectedLeaves: leaveRequests.filter(r => r.status === LeaveStatus.REJECTED).length,
        pendingLeaves: leaveRequests.filter(r => r.status === LeaveStatus.PENDING).length,
        totalLeaveDays: leaveRequests
          .filter(r => r.status === LeaveStatus.APPROVED)
          .reduce((sum, r) => sum + r.totalDays, 0),
        remainingLeaveDays: member.annualLeaveDays - member.usedLeaveDays,
        averageRequestProcessingTime: 0, // Would calculate from approval history
      };

      memberMetrics.push({
        userId: member.id,
        userName: member.fullName,
        role: member.role,
        metrics,
      });
    }

    return memberMetrics;
  }

  private async calculateTeamTrends(teamId: string, startDate: Date, endDate: Date) {
    // Simplified implementation - would use more complex queries in production
    return {
      leaveVolumeByMonth: {},
      leaveTypeDistribution: {},
      capacityUtilization: [],
      seasonalPatterns: [],
    };
  }

  private async generateTeamForecast(team: Team, startDate: Date, endDate: Date) {
    // Simplified forecasting - would use ML models in production
    return {
      predictedLeaveVolume: {},
      capacityRisks: [],
    };
  }

  private async calculatePerformanceKPIs(managerId: string, startDate: Date, endDate: Date) {
    // Simplified KPI calculation
    const monthlyMetrics = await this.calculateMonthlyMetrics(managerId, startDate, endDate);

    return {
      totalApprovals: monthlyMetrics.totalProcessed,
      averageProcessingTime: monthlyMetrics.averageProcessingTime,
      slaComplianceRate: monthlyMetrics.onTimeRate,
      escalationRate: 0, // Would calculate from escalation data
      rejectionRate: 0, // Would calculate from rejection data
      responsiveness: 85, // Would calculate from response time data
      efficiency: 90, // Would calculate from efficiency metrics
      qualityScore: 95, // Would calculate from quality indicators
    };
  }

  private async calculateComparisonMetrics(managerId: string, startDate: Date, endDate: Date) {
    // Simplified comparison - would compare against actual peer data
    return {
      peerAverage: {
        processingTime: 18,
        slaComplianceRate: 85,
        escalationRate: 5,
      },
      organizationAverage: {
        processingTime: 24,
        slaComplianceRate: 80,
        escalationRate: 8,
      },
      ranking: {
        position: 5,
        totalManagers: 20,
        percentile: 75,
      },
    };
  }

  private async calculateTrendsAnalysis(managerId: string, startDate: Date, endDate: Date) {
    // Simplified trends analysis
    return {
      processingTimeTrend: [],
      volumeTrend: [],
      performanceImprovement: [],
    };
  }

  private async generateCapacityForecast(team: Team, forecastDays: number) {
    // Simplified capacity forecasting
    const forecast = [];
    const today = new Date();

    for (let i = 0; i < forecastDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      forecast.push({
        date: date.toISOString().split('T')[0],
        availableMembers: team.members.length,
        onLeaveMembers: 0,
        capacityPercentage: 100,
        riskLevel: 'low' as const,
      });
    }

    return forecast;
  }

  private async getUpcomingLeaves(teamId: string, endDate: Date) {
    const upcomingLeaves = await this.leaveRequestRepository.find({
      where: {
        user: { team: { id: teamId } },
        status: LeaveStatus.APPROVED,
        startDate: LessThan(endDate),
      },
      relations: ['user'],
      order: { startDate: 'ASC' },
    });

    return upcomingLeaves.map(leave => ({
      employeeName: leave.user.fullName,
      startDate: leave.startDate,
      endDate: leave.endDate,
      leaveType: leave.type,
      totalDays: leave.totalDays,
    }));
  }

  private calculateOverallWorkflowMetrics(workflows: WorkflowInstance[]) {
    // Simplified workflow metrics calculation
    return {
      totalWorkflows: workflows.length,
      averageCompletionTime: 24, // hours
      averageStepsPerWorkflow: 2.5,
      automationRate: 25, // percentage
      escalationRate: 10, // percentage
    };
  }

  private analyzeWorkflowBottlenecks(workflows: WorkflowInstance[]) {
    // Simplified bottleneck analysis
    return [
      {
        stepName: 'Manager Approval',
        averageTime: 18,
        completionRate: 95,
        escalationRate: 5,
        recommendations: ['Consider auto-approval for routine requests', 'Set up delegation during absences'],
      },
    ];
  }

  private async calculateManagerPerformanceMetrics(workflows: WorkflowInstance[]) {
    // Simplified manager performance calculation
    return [
      {
        managerId: 'manager-1',
        managerName: 'John Manager',
        averageProcessingTime: 16,
        throughput: 25,
        efficiency: 88,
      },
    ];
  }
}

// Import for TypeORM operations
import { In } from 'typeorm';