import { JwtService } from '@nestjs/jwt';

/**
 * Create a mock JwtService
 */
export function createMockJwtService(): jest.Mocked<JwtService> {
  return {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    verify: jest.fn().mockReturnValue({ sub: 1, email: 'test@example.com' }),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 1, email: 'test@example.com' }),
    decode: jest.fn().mockReturnValue({ sub: 1, email: 'test@example.com' }),
  } as any;
}
