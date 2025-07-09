import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import { hash } from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    // If you need to inject AuthService, use forwardRef
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;

    // If password is empty (like in Google auth), don't hash it
    const hashedPassword = password ? await hash(password) : '';

    return this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        role: Role.USER,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateHashedRefreshToken(userId: number, hashedRT: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: hashedRT },
    });
  }
}
