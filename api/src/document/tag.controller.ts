import { Controller, Get, Post, Body, UseGuards, Req, HttpException, HttpStatus, Logger, Param } from "@nestjs/common"
import { JwtAuthGuard } from "../auth/guards/jwt-auth/jwt-auth.guard"
import { DocumentService } from "./document.service"
import { CreateTagDto } from "./dto/create-tag.dto"

@Controller("workspaces/:workspaceId/tags")
@UseGuards(JwtAuthGuard)
export class TagController {
  private readonly logger = new Logger(TagController.name)

  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async getTags(@Param('workspaceId') workspaceId: string, @Req() req) {
    try {
      return await this.documentService.getTags(+workspaceId, req.user.id)
    } catch (error) {
      throw new HttpException(error.message || "Failed to get tags", error.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post()
  async createTag(@Param('workspaceId') workspaceId: string, @Req() req, @Body() createTagDto: CreateTagDto) {
    try {
      return await this.documentService.createTag(+workspaceId, req.user.id, createTagDto)
    } catch (error) {
      throw new HttpException(error.message || "Failed to create tag", error.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
} 