import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CaseTagService {
  constructor(private prisma: PrismaService) {}

  async getCaseTags(workspaceId: number, caseId: number) {
    const caseItem = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        workspaceId: workspaceId,
      },
      include: {
        caseTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    return caseItem.caseTags.map(caseTag => caseTag.tag);
  }

  async addTagToCase(workspaceId: number, caseId: number, tagId: number) {
    // Verify case exists and belongs to workspace
    const caseItem = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        workspaceId: workspaceId,
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    // Verify tag exists and belongs to workspace
    const tag = await this.prisma.tag.findFirst({
      where: {
        id: tagId,
        workspaceId: workspaceId,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Add tag to case
    return this.prisma.caseTag.create({
      data: {
        caseId,
        tagId,
      },
      include: {
        tag: true,
      },
    });
  }

  async removeTagFromCase(workspaceId: number, caseId: number, tagId: number) {
    // Verify case exists and belongs to workspace
    const caseItem = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        workspaceId: workspaceId,
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    // Remove tag from case
    return this.prisma.caseTag.delete({
      where: {
        caseId_tagId: {
          caseId,
          tagId,
        },
      },
      include: {
        tag: true,
      },
    });
  }
} 