import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class DevBypassGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // For development, create a mock user
    request.user = {
      id: 'dev-admin-001',
      email: 'admin@dev.local',
      firstName: 'Dev',
      lastName: 'Admin',
      role: 'ADMIN',
    };

    return true;
  }
}