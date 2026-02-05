import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsController } from './workflows.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowTemplateService } from './workflow-template.service';
import { ApprovalChainService } from './approval-chain.service';
import { ParallelApprovalService } from './parallel-approval.service';
import { ConditionalRoutingService } from './conditional-routing.service';
import { WorkflowApprovalsService } from './workflow-approvals.service';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalHistory } from '../audit/entities/approval-history.entity';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { ManagerDelegation } from '../delegations/entities/manager-delegation.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { UsersModule } from '../users/users.module';
import { LeaveRequestsModule } from '../leave-requests/leave-requests.module';
import { ApprovalRulesService } from './approval-rules.service';
import { AutoApprovalService } from '../automation/auto-approval.service';
import { ManagerAnalyticsService } from '../analytics/manager-analytics.service';
import { AuditTrailService } from '../audit/audit-trail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowInstance,
      WorkflowTemplate,
      ApprovalStep,
      ApprovalHistory,
      User,
      Team,
      ManagerDelegation,
      LeaveRequest,
    ]),
    UsersModule,
    LeaveRequestsModule,
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowEngineService,
    WorkflowTemplateService,
    ApprovalRulesService,
    ApprovalChainService,
    ParallelApprovalService,
    ConditionalRoutingService,
    WorkflowApprovalsService,
    AutoApprovalService,
    ManagerAnalyticsService,
    AuditTrailService,
  ],
  exports: [
    WorkflowEngineService,
    WorkflowTemplateService,
    WorkflowApprovalsService,
    ApprovalChainService,
    ParallelApprovalService,
  ],
})
export class WorkflowsModule {}