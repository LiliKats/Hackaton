import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveRequestsSeedService } from './seeds/leave-requests.seed';
import { UsersModule } from '../users/users.module';
import { WorkflowInstance } from '../workflows/entities/workflow-instance.entity';
import { ApprovalStep } from '../workflows/entities/approval-step.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      User,
      WorkflowInstance,
      ApprovalStep,
    ]),
    UsersModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [
    LeaveRequestsService,
    LeaveRequestsSeedService,
  ],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
