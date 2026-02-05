import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { TeamsModule } from './modules/teams/teams.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { SimpleWorkflowsController } from './modules/workflows/simple-workflows.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: './database.sqlite',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    LeaveRequestsModule,
    TeamsModule,
    CalendarModule,
    WorkflowsModule, // Re-enabled after fixing compilation issues
  ],
  controllers: [AppController, SimpleWorkflowsController],
  providers: [AppService],
})
export class AppModule {}
