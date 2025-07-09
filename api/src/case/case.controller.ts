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
  BadRequestException,
} from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';

@Controller('workspaces/:workspaceId/cases')
@UseGuards(JwtAuthGuard)
export class CaseController {
  private readonly logger = new Logger(CaseController.name);

  constructor(private readonly caseService: CaseService) {}

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() createCaseDto: CreateCaseDto,
  ) {
    try {
      // Validate and convert workspaceId to number
      const workspaceIdNum = parseInt(workspaceId, 10);
      if (isNaN(workspaceIdNum)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      this.logger.log(
        `Creating case in workspace ${workspaceIdNum} for user ${req.user.id}`,
      );
      return await this.caseService.create(workspaceIdNum, req.user.id, createCaseDto);
    } catch (error) {
      this.logger.error(`Error creating case: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to create case',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async findAll(@Param('workspaceId') workspaceId: string, @Req() req) {
    try {
      // Validate and convert workspaceId to number
      const workspaceIdNum = parseInt(workspaceId, 10);
      if (isNaN(workspaceIdNum)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      this.logger.log(
        `Finding all cases in workspace ${workspaceIdNum} for user ${req.user.id}`,
      );
      return await this.caseService.findAll(workspaceIdNum, req.user.id);
    } catch (error) {
      this.logger.error(`Error finding cases: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to fetch cases',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req,
  ) {
    try {
      // Validate and convert id to number
      const caseId = parseInt(id, 10);
      if (isNaN(caseId)) {
        throw new BadRequestException('Invalid case ID format');
      }

      // Validate and convert workspaceId to number
      const workspaceIdNum = parseInt(workspaceId, 10);
      if (isNaN(workspaceIdNum)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      this.logger.log(
        `Finding case ${caseId} in workspace ${workspaceIdNum} for user ${req.user.id}`,
      );
      return await this.caseService.findOne(caseId, workspaceIdNum, req.user.id);
    } catch (error) {
      this.logger.error(
        `Error finding case ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to fetch case',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Body() updateCaseDto: UpdateCaseDto,
  ) {
    try {
      // Validate and convert id to number
      const caseId = parseInt(id, 10);
      if (isNaN(caseId)) {
        throw new BadRequestException('Invalid case ID format');
      }

      // Validate and convert workspaceId to number
      const workspaceIdNum = parseInt(workspaceId, 10);
      if (isNaN(workspaceIdNum)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      this.logger.log(
        `Updating case ${caseId} in workspace ${workspaceIdNum} for user ${req.user.id}`,
      );
      this.logger.log('Incoming updateCaseDto: ' + JSON.stringify(updateCaseDto));
      const result = await this.caseService.update(caseId, workspaceIdNum, req.user.id, updateCaseDto);
      this.logger.log('Update result: ' + JSON.stringify(result));
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating case ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to update case',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req,
  ) {
    try {
      // Validate and convert id to number
      const caseId = parseInt(id, 10);
      if (isNaN(caseId)) {
        throw new BadRequestException('Invalid case ID format');
      }

      // Validate and convert workspaceId to number
      const workspaceIdNum = parseInt(workspaceId, 10);
      if (isNaN(workspaceIdNum)) {
        throw new BadRequestException('Invalid workspace ID format');
      }

      this.logger.log(
        `Removing case ${caseId} from workspace ${workspaceIdNum} for user ${req.user.id}`,
      );
      return await this.caseService.remove(caseId, workspaceIdNum, req.user.id);
    } catch (error) {
      this.logger.error(
        `Error removing case ${id}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to delete case',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
