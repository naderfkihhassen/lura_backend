/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CaseTagService } from './case-tag.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

@Controller('workspaces/:workspaceId/cases/:caseId/tags')
@UseGuards(JwtAuthGuard)
export class CaseTagController {
  constructor(private readonly caseTagService: CaseTagService) {}

  @Get()
  async getCaseTags(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
  ) {
    return this.caseTagService.getCaseTags(
      parseInt(workspaceId),
      parseInt(caseId),
    );
  }

  @Post(':tagId')
  async addTagToCase(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.caseTagService.addTagToCase(
      parseInt(workspaceId),
      parseInt(caseId),
      parseInt(tagId),
    );
  }

  @Delete(':tagId')
  async removeTagFromCase(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.caseTagService.removeTagFromCase(
      parseInt(workspaceId),
      parseInt(caseId),
      parseInt(tagId),
    );
  }
} 