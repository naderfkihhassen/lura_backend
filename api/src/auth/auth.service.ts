import {
  Injectable,
  UnauthorizedException,
  NotImplementedException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { hash, verify } from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(forwardRef(() => UserService)) private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateLocalUser(email: string, password: string) {
    throw new NotImplementedException('Local authentication is not supported');
  }

  async findOrCreateUser(email: string, name?: string) {
    let user = await this.userService.findByEmail(email);

    if (!user) {
      // Create a new user without a password
      this.logger.log(`Creating new user with email: ${email}`);
      user = await this.userService.create({
        email,
        name: name || email.split('@')[0], // Use part of email as name if not provided
        password: '', // No password for magic link users
      });
    } else {
      this.logger.log(
        `Found existing user with email: ${email}, ID: ${user.id}`,
      );
    }

    return user;
  }

  async login(userId: number, name: string, role: Role) {
    this.logger.log(`Generating login tokens for user: ${userId}`);
    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRT = await hash(refreshToken);
    await this.userService.updateHashedRefreshToken(userId, hashedRT);

    return {
      id: userId,
      name,
      role,
      accessToken,
      refreshToken,
    };
  }

  async generateTokens(userId: number) {
    const payload = { sub: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('REFRESH_JWT_SECRET'),
        expiresIn: this.configService.get('REFRESH_JWT_EXPIRES_IN', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async validateJwtUser(userId: number) {
    this.logger.debug(`Validating JWT user: ${userId}`);
    const user = await this.userService.findOne(userId);

    if (!user) {
      this.logger.warn(`User not found for ID: ${userId}`);
      throw new UnauthorizedException('User not found!');
    }

    this.logger.debug(`User validated: ${user.id}, role: ${user.role}`);
    return { id: user.id, role: user.role };
  }

  async validateRefreshToken(userId: number, refreshToken: string) {
    this.logger.debug(`Validating refresh token for user: ${userId}`);
    const user = await this.userService.findOne(userId);

    if (!user) {
      this.logger.warn(`User not found for ID: ${userId}`);
      throw new UnauthorizedException('User not found!');
    }

    if (!user.hashedRefreshToken) {
      this.logger.warn(`No refresh token found for user: ${userId}`);
      throw new UnauthorizedException('No refresh token found!');
    }

    const refreshTokenMatched = await verify(
      user.hashedRefreshToken,
      refreshToken,
    );
    if (!refreshTokenMatched) {
      this.logger.warn(`Invalid refresh token for user: ${userId}`);
      throw new UnauthorizedException('Invalid Refresh Token!');
    }

    this.logger.debug(`Refresh token validated for user: ${userId}`);
    return { id: user.id };
  }

  async refreshToken(userId: number, name: string) {
    this.logger.log(`Refreshing token for user: ${userId}`);
    const user = await this.userService.findOne(userId);

    if (!user) {
      this.logger.warn(`User not found for ID: ${userId}`);
      throw new UnauthorizedException('User not found!');
    }

    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRT = await hash(refreshToken);
    await this.userService.updateHashedRefreshToken(userId, hashedRT);

    return {
      id: userId,
      name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async signOut(userId: number) {
    this.logger.log(`Signing out user: ${userId}`);
    return await this.userService.updateHashedRefreshToken(userId, null);
  }
}
