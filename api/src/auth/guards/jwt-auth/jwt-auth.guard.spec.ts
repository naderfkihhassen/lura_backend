import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const mockReflector = {} as Reflector;
    expect(new JwtAuthGuard(mockReflector)).toBeDefined();
  });
});
