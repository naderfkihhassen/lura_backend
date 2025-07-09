/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { WorkspaceRole } from '@prisma/client';

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    workspaceId: number,
    userId: number,
    createCaseDto: CreateCaseDto,
  ) {
    this.logger.log(
      `Creating case in workspace ${workspaceId} by user ${userId}`,
    );

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Check if user has permission to create cases
    // Only OWNER, ADMIN, and MEMBER roles can create cases
    const canCreate = [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ].includes(userWorkspace.role as 'OWNER' | 'ADMIN' | 'MEMBER');
    if (!canCreate) {
      throw new ForbiddenException(
        'You do not have permission to create cases in this workspace',
      );
    }

    return this.prisma.case.create({
      data: {
        ...createCaseDto,
        workspace: {
          connect: { id: workspaceId },
        },
      },
    });
  }

  async findAll(workspaceId: number, userId: number) {
    this.logger.log(
      `Finding all cases in workspace ${workspaceId} for user ${userId}`,
    );

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const cases = await this.prisma.case.findMany({
      where: {
        workspaceId,
      },
      include: {
        caseTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Transform the response to include tags in a more usable format
    return cases.map(caseItem => ({
      ...caseItem,
      tags: caseItem.caseTags.map((ct) => ct.tag),
    }));
  }

  async findOne(id: number, workspaceId: number, userId: number) {
    this.logger.log(
      `Finding case ${id} in workspace ${workspaceId} for user ${userId}`,
    );

    // Validate id is a valid number
    if (isNaN(id) || !Number.isInteger(id)) {
      throw new NotFoundException('Invalid case ID');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { users: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const caseItem = await this.prisma.case.findFirst({
      where: {
        id: id,
        workspaceId: workspaceId
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
      throw new NotFoundException(`Case with ID ${id} not found in workspace ${workspaceId}`);
    }

    // Transform the response to include tags in a more usable format
    return {
      ...caseItem,
      tags: caseItem.caseTags.map((ct) => ct.tag),
    };
  }

  async update(
    id: number,
    workspaceId: number,
    userId: number,
    updateCaseDto: UpdateCaseDto,
  ) {
    this.logger.log(
      `Updating case ${id} in workspace ${workspaceId} by user ${userId}`,
    );
    this.logger.log('Service received updateCaseDto: ' + JSON.stringify(updateCaseDto));

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Check if user has permission to update cases
    // Only OWNER, ADMIN, and MEMBER roles can update cases
    const canUpdate = [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ].includes(userWorkspace.role as 'OWNER' | 'ADMIN' | 'MEMBER');
    if (!canUpdate) {
      throw new ForbiddenException(
        'You do not have permission to update cases in this workspace',
      );
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id },
    });

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        'This case does not belong to the specified workspace',
      );
    }

    // Start a transaction to update case and tags
    return this.prisma.$transaction(async (prisma) => {
      // Update case fields
      const updatedCase = await prisma.case.update({
        where: { id },
        data: {
          ...(updateCaseDto.title !== undefined && { title: updateCaseDto.title }),
          ...(updateCaseDto.description !== undefined && { description: updateCaseDto.description }),
          ...(updateCaseDto.status !== undefined && { status: updateCaseDto.status }),
          ...(updateCaseDto.priority !== undefined && { priority: updateCaseDto.priority }),
        },
      });

      // Update tags if provided
      if (updateCaseDto.tagIds) {
        // First, remove all existing tags
        await prisma.caseTag.deleteMany({
          where: {
            caseId: id,
          },
        });

        // Then, add the new tags
        for (const tagId of updateCaseDto.tagIds) {
          // Check if tag exists and belongs to the workspace
          const tag = await prisma.tag.findUnique({
            where: { id: tagId },
          });

          if (!tag) {
            throw new NotFoundException(`Tag with ID ${tagId} not found`);
          }

          if (tag.workspaceId !== workspaceId) {
            throw new ForbiddenException(
              `Tag with ID ${tagId} does not belong to the specified workspace`,
            );
          }

          await prisma.caseTag.create({
            data: {
              case: {
                connect: { id },
              },
              tag: {
                connect: { id: tagId },
              },
            },
          });
        }
      }

      // Get the updated case with tags
      const updatedCaseWithTags = await prisma.case.findUnique({
        where: { id },
        include: {
          caseTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      // Transform the response to include tags in a more usable format
      const result = {
        ...updatedCaseWithTags,
        tags: updatedCaseWithTags.caseTags.map((ct) => ct.tag),
      };
      this.logger.log('Service returning updated case: ' + JSON.stringify(result));
      return result;
    });
  }

  async remove(id: number, workspaceId: number, userId: number) {
    this.logger.log(
      `Removing case ${id} from workspace ${workspaceId} by user ${userId}`,
    );

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Check if user has permission to delete cases
    // Only OWNER and ADMIN roles can delete cases
    const canDelete = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(
      userWorkspace.role as 'OWNER' | 'ADMIN',
    );
    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete cases in this workspace',
      );
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id },
    });

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException(
        'This case does not belong to the specified workspace',
      );
    }

    return this.prisma.case.delete({
      where: { id },
    });
  }
}
