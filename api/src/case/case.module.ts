/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CaseTagService } from './case-tag.service';
import { CaseTagController } from './case-tag.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CaseController, CaseTagController],
  providers: [CaseService, CaseTagService],
  exports: [CaseService, CaseTagService],
})
export class CaseModule {}
