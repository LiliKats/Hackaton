import {
  Controller,
  Get,
  Post,
  Patch,
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
import { WorkflowEngineService, WorkflowContext } from './workflow-engine.service';
import { WorkflowTemplateService, CreateWorkflowTemplateDto } from './workflow-template.service';
import { ApprovalChainService } from './approval-chain.service';
import { ParallelApprovalService } from './parallel-approval.service';
import { ConditionalRoutingService } from './conditional-routing.service';
import { AutoApprovalService } from '../automation/auto-approval.service';
import { ManagerAnalyticsService } from '../analytics/manager-analytics.service';
import { AuditTrailService } from '../audit/audit-trail.service';
import { WorkflowApprovalsService } from './workflow-approvals.service';

class ProcessApprovalDto {
  decision: 'approve' | 'reject';
  comments?: string;
  metadata?: Record<string, any>;
}

class EscalateStepDto {
  reason: string;
}

class CancelWorkflowDto {
  reason: string;
}

class CreateRoutingRuleDto {
  name: string;
  priority: number;
  conditions: any[];
  actions: any[];
  isActive?: boolean;
}

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly workflowTemplateService: WorkflowTemplateService,
    private readonly approvalChainService: ApprovalChainService,
    private readonly parallelApprovalService: ParallelApprovalService,
    private readonly conditionalRoutingService: ConditionalRoutingService,
    private readonly autoApprovalService: AutoApprovalService,
    private readonly managerAnalyticsService: ManagerAnalyticsService,
    private readonly auditTrailService: AuditTrailService,
    private readonly workflowApprovalsService: WorkflowApprovalsService,
  ) {}

  // Workflow Templates

  @Get('templates')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all active workflow templates' })
  @ApiResponse({ status: 200, description: 'Workflow templates retrieved successfully' })
  async getActiveTemplates() {
    return await this.workflowTemplateService.getActiveTemplates();
  }

  @Post('templates')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new workflow template' })
  @ApiResponse({ status: 201, description: 'Workflow template created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid template configuration' })
  async createTemplate(
    @Body(ValidationPipe) createTemplateDto: CreateWorkflowTemplateDto,
  ) {
    return await this.workflowTemplateService.createTemplate(createTemplateDto);
  }

  @Get('templates/:id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get workflow template by ID' })
  @ApiResponse({ status: 200, description: 'Workflow template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return await this.workflowTemplateService.getTemplate(id);
  }

  @Patch('templates/:id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update workflow template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updates: Partial<CreateWorkflowTemplateDto>,
  ) {
    return await this.workflowTemplateService.updateTemplate(id, updates);
  }

  @Post('templates/defaults')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create default workflow templates' })
  @ApiResponse({ status: 201, description: 'Default templates created successfully' })
  async createDefaultTemplates() {
    return await this.workflowTemplateService.createDefaultTemplates();
  }

  // Workflow Instances

  @Post('initiate')
  @Roles(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Initiate a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid workflow context' })
  async initiateWorkflow(
    @Body() context: WorkflowContext,
    @GetUser() currentUser: User,
  ) {
    // Ensure user can only initiate workflows for their own requests
    if (context.requestorId !== currentUser.id &&
        currentUser.role !== UserRole.HR &&
        currentUser.role !== UserRole.ADMIN) {
      context.requestorId = currentUser.id;
    }

    return await this.workflowEngineService.initiateWorkflow(context);
  }

  @Get('instances/:instanceId')
  @ApiOperation({ summary: 'Get workflow instance status' })
  @ApiResponse({ status: 200, description: 'Workflow status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Workflow instance not found' })
  async getWorkflowStatus(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return await this.workflowEngineService.getWorkflowStatus(instanceId);
  }

  @Patch('instances/:instanceId/cancel')
  @ApiOperation({ summary: 'Cancel an active workflow' })
  @ApiResponse({ status: 200, description: 'Workflow cancelled successfully' })
  async cancelWorkflow(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body(ValidationPipe) cancelDto: CancelWorkflowDto,
    @GetUser() currentUser: User,
  ) {
    await this.workflowEngineService.cancelWorkflow(
      instanceId,
      cancelDto.reason,
      currentUser.id,
    );
    return { message: 'Workflow cancelled successfully' };
  }

  @Get('instances/:instanceId/progress')
  @ApiOperation({ summary: 'Get workflow progress information' })
  @ApiResponse({ status: 200, description: 'Workflow progress retrieved successfully' })
  async getWorkflowProgress(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return await this.approvalChainService.getChainProgress(instanceId);
  }

  // Approval Steps

  @Post('steps/:stepId/approve')
  @ApiOperation({ summary: 'Process approval decision for a workflow step' })
  @ApiResponse({ status: 200, description: 'Approval processed successfully' })
  @ApiResponse({ status: 403, description: 'Not authorized to approve this step' })
  async processApproval(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body(ValidationPipe) approvalDto: ProcessApprovalDto,
    @GetUser() currentUser: User,
  ) {
    return await this.workflowApprovalsService.processApprovalDecision(
      stepId,
      currentUser.id,
      approvalDto.decision,
      approvalDto.comments,
      approvalDto.metadata,
    );
  }

  @Post('steps/:stepId/escalate')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Escalate a workflow step' })
  @ApiResponse({ status: 200, description: 'Step escalated successfully' })
  async escalateStep(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body(ValidationPipe) escalateDto: EscalateStepDto,
    @GetUser() currentUser: User,
  ) {
    return await this.workflowEngineService.escalateStep(
      stepId,
      escalateDto.reason,
      currentUser.id,
    );
  }

  @Get('my-pending-approvals')
  @ApiOperation({ summary: 'Get pending approvals for current user' })
  @ApiResponse({ status: 200, description: 'Pending approvals retrieved successfully' })
  async getMyPendingApprovals(@GetUser() currentUser: User) {
    return await this.workflowApprovalsService.getPendingApprovalsForUser(currentUser.id);
  }

  @Get('parallel-approvals/:stepId/status')
  @ApiOperation({ summary: 'Get parallel approval status' })
  @ApiResponse({ status: 200, description: 'Parallel approval status retrieved' })
  async getParallelApprovalStatus(@Param('stepId', ParseUUIDPipe) stepId: string) {
    return await this.parallelApprovalService.getParallelApprovalStatus(stepId);
  }

  @Get('my-parallel-approvals')
  @ApiOperation({ summary: 'Get pending parallel approvals for current user' })
  @ApiResponse({ status: 200, description: 'Pending parallel approvals retrieved' })
  async getMyParallelApprovals(@GetUser() currentUser: User) {
    return await this.parallelApprovalService.getPendingParallelApprovals(currentUser.id);
  }

  // Auto-Approval

  @Post('steps/:stepId/evaluate-auto-approval')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Evaluate if a step should be auto-approved' })
  @ApiResponse({ status: 200, description: 'Auto-approval evaluation completed' })
  async evaluateAutoApproval(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() context: Record<string, any> = {},
  ) {
    return await this.autoApprovalService.evaluateAutoApproval(stepId, context);
  }

  @Get('auto-approval/rules')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get active auto-approval rules' })
  @ApiResponse({ status: 200, description: 'Auto-approval rules retrieved' })
  async getAutoApprovalRules() {
    return this.autoApprovalService.getActiveRules();
  }

  @Get('auto-approval/statistics')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get auto-approval usage statistics' })
  @ApiResponse({ status: 200, description: 'Auto-approval statistics retrieved' })
  async getAutoApprovalStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.autoApprovalService.getAutoApprovalStatistics(start, end);
  }

  // Conditional Routing

  @Post('conditional-routing/evaluate')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Evaluate conditional routing for a workflow' })
  @ApiResponse({ status: 200, description: 'Conditional routing evaluated' })
  async evaluateConditionalRouting(
    @Body() data: {
      workflowInstanceId: string;
      context: WorkflowContext;
      triggerEvent: 'workflow_start' | 'step_completed' | 'step_timeout' | 'external_event';
    },
  ) {
    return await this.conditionalRoutingService.evaluateRouting(
      data.workflowInstanceId,
      data.context,
      data.triggerEvent,
    );
  }

  @Post('conditional-routing/rules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a custom routing rule' })
  @ApiResponse({ status: 201, description: 'Routing rule created successfully' })
  async createRoutingRule(@Body(ValidationPipe) ruleDto: CreateRoutingRuleDto) {
    return await this.conditionalRoutingService.createCustomRoutingRule(ruleDto);
  }

  // Manager Analytics

  @Get('analytics/dashboard')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get manager dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getManagerDashboard(@GetUser() currentUser: User) {
    return await this.managerAnalyticsService.getManagerDashboard(currentUser.id);
  }

  @Get('analytics/team/:teamId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get team analytics report' })
  @ApiResponse({ status: 200, description: 'Team analytics retrieved successfully' })
  async getTeamAnalytics(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.managerAnalyticsService.getTeamAnalyticsReport(teamId, start, end);
  }

  @Get('analytics/performance')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get approval performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  async getPerformanceMetrics(
    @Query('managerId') managerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @GetUser() currentUser?: User,
  ) {
    const targetManagerId = managerId || currentUser?.id;
    if (!targetManagerId) {
      throw new Error('Manager ID is required');
    }

    // Only allow viewing own performance unless HR/Admin
    if (targetManagerId !== currentUser?.id &&
        currentUser?.role !== UserRole.HR &&
        currentUser?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to view performance metrics');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await this.managerAnalyticsService.getApprovalPerformanceMetrics(
      targetManagerId,
      start,
      end,
    );
  }

  @Get('analytics/team-capacity/:teamId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get team capacity and availability data' })
  @ApiResponse({ status: 200, description: 'Team capacity data retrieved successfully' })
  async getTeamCapacity(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query('forecastDays') forecastDays?: string,
  ) {
    const days = forecastDays ? parseInt(forecastDays, 10) : 30;
    return await this.managerAnalyticsService.getTeamCapacityData(teamId, days);
  }

  @Get('analytics/efficiency')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get workflow efficiency report' })
  @ApiResponse({ status: 200, description: 'Efficiency report retrieved successfully' })
  async getWorkflowEfficiency(
    @Query('managerId') managerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.managerAnalyticsService.getWorkflowEfficiencyReport(
      managerId,
      start,
      end,
    );
  }

  // Audit and Compliance

  @Get('audit-trail')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Query audit trail' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  async getAuditTrail(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('performedById') performedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeSystem') includeSystem?: string,
  ) {
    const query = {
      entityType,
      entityId,
      performedById,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      includeSystemGenerated: includeSystem === 'true',
    };

    return await this.auditTrailService.queryAuditTrail(query);
  }

  @Get('audit-trail/compliance-report')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated successfully' })
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('framework') framework?: 'SOX' | 'GDPR' | 'HIPAA' | 'Custom',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return await this.auditTrailService.generateComplianceReport(
      start,
      end,
      framework || 'Custom',
    );
  }

  @Get('audit-trail/sla-metrics')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Calculate SLA performance metrics' })
  @ApiResponse({ status: 200, description: 'SLA metrics calculated successfully' })
  async getSLAMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('slaThreshold') slaThreshold?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const threshold = slaThreshold ? parseInt(slaThreshold, 10) : 48;

    return await this.auditTrailService.calculateSLAMetrics(start, end, threshold);
  }

  @Post('audit-trail/verify-integrity')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify audit trail integrity' })
  @ApiResponse({ status: 200, description: 'Integrity verification completed' })
  async verifyAuditIntegrity(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.auditTrailService.verifyAuditIntegrity(start, end);
  }

  @Get('audit-trail/export')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Export audit data' })
  @ApiResponse({ status: 200, description: 'Audit data exported successfully' })
  async exportAuditData(
    @Query('format') format: 'json' | 'csv' | 'xml' = 'json',
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query = {
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return await this.auditTrailService.exportAuditData(query, format);
  }
}

// Import necessary decorators and exceptions
import { ForbiddenException } from '@nestjs/common';