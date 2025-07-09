import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityController],
})
export class ActivityModule {} 