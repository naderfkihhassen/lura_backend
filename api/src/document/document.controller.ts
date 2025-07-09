/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  BadRequestException,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { DocumentService } from "./document.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth/jwt-auth.guard"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
import * as fs from "fs"
import { Response } from "express"
import { CreateDocumentDto } from "./dto/create-document.dto"
import { Request } from "express"
import { DocumentResponse } from "./types/document-response.type"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"
import { extname } from "path"

@Controller("workspaces/:workspaceId/cases/:caseId/documents")
@UseGuards(JwtAuthGuard)
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name)

  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async getDocuments(@Param('workspaceId') workspaceId: string, @Param('caseId') caseId: string, @Req() req) {
    try {
      this.logger.log(`Getting documents for case ${caseId} in workspace ${workspaceId} for user ${req.user.id}`)

      // Add more detailed logging
      this.logger.log(`Parameters: workspaceId=${workspaceId}, caseId=${caseId}, userId=${req.user.id}`)

      const documents = await this.documentService.getDocuments(+workspaceId, +caseId, req.user.id)

      this.logger.log(`Found ${documents.length} documents`)

      return documents
    } catch (error) {
      this.logger.error(`Error getting documents: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to get documents",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request & { user: { id: number } },
  ): Promise<DocumentResponse> {
    this.logger.log(`Uploading document: ${file.originalname}`)
    this.logger.log(`Request body: ${JSON.stringify(body)}`)

    try {
      const { workspaceId, caseId } = body
      const userId = req.user.id

      if (!workspaceId || !caseId) {
        throw new BadRequestException('Workspace ID and Case ID are required')
      }

      if (!file) {
        throw new BadRequestException('No file uploaded')
      }

      // Ensure the uploads directory exists
      const uploadsDir = join('uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
        this.logger.log(`Created uploads directory at: ${uploadsDir}`)
      }

      // Generate a unique filename
      const uniqueSuffix = uuidv4()
      const ext = extname(file.originalname)
      const filename = `${uniqueSuffix}${ext}`
      const filePath = join(uploadsDir, filename)

      // Move the file to the uploads directory
      fs.renameSync(file.path, filePath)

      // Use displayName if provided, otherwise use originalName
      let displayName = body.displayName ? body.displayName.trim() : ''
      if (!displayName) {
        displayName = file.originalname
      }
      // Ensure displayName is a valid UTF-8 string
      displayName = Buffer.from(displayName, 'utf8').toString('utf8')
      const createDocumentDto: CreateDocumentDto = {
        name: displayName,
        originalName: Buffer.from(file.originalname, 'utf8').toString('utf8'),
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        workspaceId: parseInt(workspaceId),
        caseId: parseInt(caseId),
      }

      this.logger.log(`Creating document with DTO: ${JSON.stringify(createDocumentDto)}`)

      const document = await this.documentService.createDocument(
        parseInt(workspaceId),
        parseInt(caseId),
        userId,
        createDocumentDto,
      )

      this.logger.log(`Document created successfully: ${JSON.stringify(document)}`)
      return document
    } catch (error) {
      this.logger.error(`Error uploading document: ${error.message}`, error.stack)
      throw error
    }
  }

  @Get(":id")
  async getDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Getting document ${documentId} for case ${caseId} in workspace ${workspaceId} for user ${req.user.id}`,
      )
      return await this.documentService.getDocument(+workspaceId, +caseId, +documentId, req.user.id)
    } catch (error) {
      this.logger.error(`Error getting document: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to get document",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get(":id/download")
  async downloadDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      this.logger.log(
        `Downloading document ${documentId} for case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )

      const document = await this.documentService.getDocument(+workspaceId, +caseId, +documentId, req.user.id)

      // Get the absolute path by joining the current directory with the relative path
      let absolutePath = document.path
      if (!fs.existsSync(absolutePath)) {
        // Try resolving as relative to process.cwd() (for new and fixed docs)
        absolutePath = join(process.cwd(), document.path)
      }
      if (!fs.existsSync(absolutePath)) {
        // Try resolving as relative to uploads directory (for legacy docs)
        absolutePath = join(process.cwd(), 'uploads', document.path.split(/[/\\]/).pop())
      }
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new HttpException("Document file not found", HttpStatus.NOT_FOUND)
      }
      const file = fs.createReadStream(absolutePath)

      // Set appropriate headers
      res.set({
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.originalName)}"`,
      })

      return new StreamableFile(file)
    } catch (error) {
      this.logger.error(`Error downloading document: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to download document",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Patch(":id")
  async updateDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
    @Body() updateData: { name?: string; tagIds?: number[] },
  ) {
    try {
      this.logger.log(
        `Updating document ${documentId} for case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )
      return await this.documentService.updateDocument(+workspaceId, +caseId, +documentId, req.user.id, updateData)
    } catch (error) {
      this.logger.error(`Error updating document: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to update document",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Delete(":id")
  async deleteDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Deleting document ${documentId} for case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )
      return await this.documentService.deleteDocument(+workspaceId, +caseId, +documentId, req.user.id)
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to delete document",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  // Comment endpoints
  @Post(":id/comments")
  async createComment(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    try {
      this.logger.log(
        `Creating comment for document ${documentId} in case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )
      return await this.documentService.createComment(+workspaceId, +caseId, +documentId, req.user.id, createCommentDto)
    } catch (error) {
      this.logger.error(`Error creating comment: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to create comment",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get(":id/comments")
  async getComments(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Getting comments for document ${documentId} in case ${caseId} in workspace ${workspaceId} for user ${req.user.id}`,
      )
      return await this.documentService.getComments(+workspaceId, +caseId, +documentId, req.user.id)
    } catch (error) {
      this.logger.error(`Error getting comments: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to get comments",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Patch(":id/comments/:commentId")
  async updateComment(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Param('commentId') commentId: string,
    @Req() req,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    try {
      this.logger.log(
        `Updating comment ${commentId} for document ${documentId} in case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )
      return await this.documentService.updateComment(
        +workspaceId,
        +caseId,
        +documentId,
        +commentId,
        req.user.id,
        updateCommentDto,
      )
    } catch (error) {
      this.logger.error(`Error updating comment: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to update comment",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Delete(":id/comments/:commentId")
  async deleteComment(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Param('id') documentId: string,
    @Param('commentId') commentId: string,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Deleting comment ${commentId} from document ${documentId} in case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`,
      )
      return await this.documentService.deleteComment(+workspaceId, +caseId, +documentId, +commentId, req.user.id)
    } catch (error) {
      this.logger.error(`Error deleting comment: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to delete comment",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post("bulk")
  async bulkUpdateDocuments(
    @Param('workspaceId') workspaceId: string,
    @Param('caseId') caseId: string,
    @Req() req,
    @Body() bulkUpdateData: { documentIds: number[]; tagIds: number[] },
  ) {
    try {
      this.logger.log(`Bulk updating documents for case ${caseId} in workspace ${workspaceId} by user ${req.user.id}`)
      return await this.documentService.bulkUpdateDocuments(+workspaceId, +caseId, req.user.id, bulkUpdateData)
    } catch (error) {
      this.logger.error(`Error bulk updating documents: ${error.message}`, error.stack)
      throw new HttpException(
        error.message || "Failed to bulk update documents",
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
