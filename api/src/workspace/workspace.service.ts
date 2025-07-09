/* eslint-disable prettier/prettier */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddUserDto } from './dto/add-user.dto';
import { WorkspaceRole, WorkspaceStatus } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: number, createWorkspaceDto: CreateWorkspaceDto) {
    this.logger.log(
      `Creating workspace for user ${userId} with data:`,
      createWorkspaceDto,
    );

    return this.prisma.workspace.create({
      data: {
        ...createWorkspaceDto,
        owner: {
          connect: { id: userId },
        },
        users: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
          },
        },
        status: WorkspaceStatus.ACTIVE,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(userId: number) {
    this.logger.log(`Finding all workspaces for user ${userId}`);

    // Get workspaces owned by the user
    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    this.logger.log(`Found ${ownedWorkspaces.length} owned workspaces`);

    // Get workspaces shared with the user
    const sharedWorkspaces = await this.prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId,
            NOT: {
              workspace: {
                ownerId: userId,
              },
            },
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    this.logger.log(`Found ${sharedWorkspaces.length} shared workspaces`);

    return {
      owned: ownedWorkspaces,
      shared: sharedWorkspaces,
    };
  }

  async findOne(id: number, userId: number) {
    this.logger.log(`Finding workspace ${id} for user ${userId}`);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Check if user has access to this workspace
    const hasAccess =
      workspace.ownerId === userId ||
      workspace.users.some((wu) => wu.userId === userId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return workspace;
  }

  async update(
    id: number,
    userId: number,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    this.logger.log(
      `Updating workspace ${id} for user ${userId} with data:`,
      updateWorkspaceDto,
    );

    // Check if workspace exists and get user's role
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      this.logger.warn(`Workspace with ID ${id} not found`);
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Find the user's role in this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);

    if (!userWorkspace) {
      this.logger.warn(
        `User ${userId} does not have access to workspace ${id}`,
      );
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Check if user has permission to update
    // Allow OWNER, ADMIN, and MEMBER roles to update basic workspace info
    const canUpdate = [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ].includes(userWorkspace.role as 'OWNER' | 'ADMIN' | 'MEMBER');

    if (!canUpdate) {
      this.logger.warn(
        `User ${userId} with role ${userWorkspace.role} does not have permission to update workspace ${id}`,
      );
      throw new ForbiddenException(
        'You do not have permission to update this workspace',
      );
    }

    // If user is not OWNER or ADMIN, they can only update name and description, not status
    if (
      userWorkspace.role === WorkspaceRole.MEMBER &&
      updateWorkspaceDto.status
    ) {
      this.logger.warn(
        `User ${userId} with MEMBER role attempted to update workspace status`,
      );
      throw new ForbiddenException(
        'Members can only update workspace name and description',
      );
    }

    this.logger.log(
      `User ${userId} with role ${userWorkspace.role} updating workspace ${id}`,
    );

    // Proceed with the update
    return this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    this.logger.log(`Removing workspace ${id} for user ${userId}`);

    // Check if workspace exists and user is the owner
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Only the owner can delete the workspace
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the workspace owner can delete it');
    }

    return this.prisma.workspace.delete({
      where: { id },
    });
  }

  async addUser(id: number, userId: number, addUserDto: AddUserDto) {
    this.logger.log(
      `Adding user ${addUserDto.email} to workspace ${id} by user ${userId}`,
    );

    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Check if user has permission to add users
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId);
    if (!userWorkspace) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    if (
      userWorkspace.role !== WorkspaceRole.OWNER &&
      userWorkspace.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to add users to this workspace',
      );
    }

    // Find the user to add by email
    const userToAdd = await this.prisma.user.findUnique({
      where: { email: addUserDto.email },
    });

    if (!userToAdd) {
      throw new NotFoundException(
        `User with email ${addUserDto.email} not found`,
      );
    }

    // Check if user is trying to add themselves
    if (userToAdd.id === userId) {
      throw new ForbiddenException(
        'You cannot add yourself to a workspace you already have access to',
      );
    }

    // Check if user is already in the workspace
    const existingUser = workspace.users.find(
      (wu) => wu.user.email === addUserDto.email,
    );
    if (existingUser) {
      // Update the role if the user already exists
      return this.prisma.workspaceUser.update({
        where: {
          workspaceId_userId: {
            workspaceId: id,
            userId: userToAdd.id,
          },
        },
        data: {
          role: addUserDto.role,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }

    // Add the user to the workspace
    try {
      return await this.prisma.workspaceUser.create({
        data: {
          workspace: {
            connect: { id },
          },
          user: {
            connect: { id: userToAdd.id },
          },
          role: addUserDto.role,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Prisma error adding user to workspace:', error);
      throw new Error(`Failed to add user to workspace: ${error.message}`);
    }
  }

  async removeUser(workspaceId: number, userId: number, targetUserId: number) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { 
        users: {
          include: {
            user: true
          }
        }
      },
    });

    if (!workspace) {
      throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
    }

    const isAdmin = workspace.users.some(
      (workspaceUser) => workspaceUser.userId === userId && workspaceUser.role === 'ADMIN',
    );

    if (!isAdmin) {
      throw new HttpException(
        'Only workspace admins can remove users',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        users: {
          delete: {
            workspaceId_userId: {
              workspaceId,
              userId: targetUserId
            }
          }
        }
      },
      include: { 
        users: {
          include: {
            user: true
          }
        }
      },
    });
  }

  async getUsers(workspaceId: number, userId: number) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { 
        users: {
          include: {
            user: true
          }
        }
      },
    });

    if (!workspace) {
      throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
    }

    const isMember = workspace.users.some((workspaceUser) => workspaceUser.userId === userId);

    if (!isMember) {
      throw new HttpException(
        'You must be a member of the workspace to view its users',
        HttpStatus.FORBIDDEN,
      );
    }

    return workspace.users.map(workspaceUser => workspaceUser.user);
  }
}
