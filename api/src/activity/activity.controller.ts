import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getRecentActivity(@Req() req: any) {
    const userId = req.user.id;
    // Fetch the 20 most recent activities for the user
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }
} 