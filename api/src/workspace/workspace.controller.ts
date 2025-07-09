/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddUserDto } from './dto/add-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async create(@Req() req, @Body() createWorkspaceDto: CreateWorkspaceDto) {
    try {
      this.logger.log(`Creating workspace for user ${req.user.id}`);
      return await this.workspaceService.create(
        req.user.id,
        createWorkspaceDto,
      );
    } catch (error) {
      this.logger.error(
        `Error creating workspace: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to create workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(@Req() req) {
    try {
      this.logger.log(`Finding all workspaces for user ${req.user.id}`);
      return await this.workspaceService.findAll(req.user.id);
    } catch (error) {
      this.logger.error(
        `Error finding workspaces: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to fetch workspaces',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    try {
      this.logger.log(`Finding workspace ${id} for user ${req.user.id}`);
      return await this.workspaceService.findOne(+id, req.user.id);
    } catch (error) {
      this.logger.error(
        `Error finding workspace ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to fetch workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    try {
      this.logger.log(`Updating workspace ${id} for user ${req.user.id}`);
      return await this.workspaceService.update(
        +id,
        req.user.id,
        updateWorkspaceDto,
      );
    } catch (error) {
      this.logger.error(
        `Error updating workspace ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to update workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    try {
      this.logger.log(`Removing workspace ${id} for user ${req.user.id}`);
      return await this.workspaceService.remove(+id, req.user.id);
    } catch (error) {
      this.logger.error(
        `Error removing workspace ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to delete workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/users')
  async addUser(
    @Param('id') id: string,
    @Req() req,
    @Body() addUserDto: AddUserDto,
  ) {
    try {
      this.logger.log(`Adding user to workspace ${id} by user ${req.user.id}`);
      const result = await this.workspaceService.addUser(
        +id,
        req.user.id,
        addUserDto,
      );
      this.logger.log('User added successfully');
      return result;
    } catch (error) {
      this.logger.error(
        `Error adding user to workspace ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to add user to workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id/users/:userId')
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Removing user ${userId} from workspace ${id} by user ${req.user.id}`,
      );
      return await this.workspaceService.removeUser(+id, req.user.id, +userId);
    } catch (error) {
      this.logger.error(
        `Error removing user from workspace: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to remove user from workspace',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/users')
  async getUsers(@Param('id') id: string, @Req() req) {
    try {
      this.logger.log(`Getting users for workspace ${id} by user ${req.user.id}`);
      return await this.workspaceService.getUsers(+id, req.user.id);
    } catch (error) {
      this.logger.error(
        `Error getting workspace users: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to get workspace users',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
