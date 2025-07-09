import { NotFoundException } from '@nestjs/common';

export class WorkspaceNotFoundException extends NotFoundException {
  constructor(workspaceId: number) {
    super(`Workspace with ID ${workspaceId} not found`);
  }
} 