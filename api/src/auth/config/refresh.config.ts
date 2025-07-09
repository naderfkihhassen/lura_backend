import { registerAs } from '@nestjs/config';

// Make sure this returns an object with secret and expiresIn properties
export default registerAs('refresh-jwt', () => ({
  secret: process.env.REFRESH_JWT_SECRET || 'default-refresh-secret',
  expiresIn: process.env.REFRESH_JWT_EXPIRES_IN || '7d',
}));
