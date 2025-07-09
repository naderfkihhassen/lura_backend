/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { WorkspaceRole } from "@prisma/client"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
import * as fs from "fs"
import { CreateTagDto } from "./dto/create-tag.dto"
import { CreateDocumentDto } from "./dto/create-document.dto"
import { WorkspaceNotFoundException } from "./exceptions/workspace-not-found.exception"
import { CaseNotFoundException } from "./exceptions/case-not-found.exception"
import { DocumentResponse } from "./types/document-response.type"

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name)

  constructor(private prisma: PrismaService) {}

  async getDocuments(workspaceId: number, caseId: number, userId: number): Promise<DocumentResponse[]> {
    this.logger.log(`Getting documents for case ${caseId} in workspace ${workspaceId} for user ${userId}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        this.logger.error(`Workspace with ID ${workspaceId} not found`)
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        this.logger.error(`User ${userId} does not have access to workspace ${workspaceId}`)
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Check if case exists and belongs to the workspace
      const caseItem = await this.prisma.case.findUnique({
        where: { id: caseId },
      })

      if (!caseItem) {
        this.logger.error(`Case with ID ${caseId} not found`)
        throw new NotFoundException(`Case with ID ${caseId} not found`)
      }

      if (caseItem.workspaceId !== workspaceId) {
        this.logger.error(`Case ${caseId} does not belong to workspace ${workspaceId}`)
        throw new ForbiddenException("This case does not belong to the specified workspace")
      }

      // Get all documents for this case with their tags
      this.logger.log(`Fetching documents for case ${caseId}`)
      const documents = await this.prisma.document.findMany({
        where: {
          caseId,
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      this.logger.log(`Found ${documents.length} documents for case ${caseId}`)

      // Transform the response to include tags in a more usable format
      return documents.map((doc) => ({
        ...doc,
        tags: doc.tags.map((dt) => dt.tag),
        canEdit: true,
        canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                  userWorkspace.role === WorkspaceRole.ADMIN || 
                  doc.userId === userId,
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                    userWorkspace.role === WorkspaceRole.ADMIN || 
                    doc.userId === userId,
          isUploader: doc.userId === userId
        }
      }))
    } catch (error) {
      this.logger.error(`Error in getDocuments: ${error.message}`, error.stack)
      throw error
    }
  }

  async getTags(workspaceId: number, userId: number) {
    this.logger.log(`Getting tags for workspace ${workspaceId} for user ${userId}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        this.logger.error(`Workspace with ID ${workspaceId} not found`)
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        this.logger.error(`User ${userId} does not have access to workspace ${workspaceId}`)
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Get all tags for this workspace
      const tags = await this.prisma.tag.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          name: "asc",
        },
      })

      this.logger.log(`Found ${tags.length} tags for workspace ${workspaceId}`)
      return tags
    } catch (error) {
      this.logger.error(`Error in getTags: ${error.message}`, error.stack)
      throw error
    }
  }

  async createTag(workspaceId: number, userId: number, createTagDto: CreateTagDto) {
    this.logger.log(`Creating tag for workspace ${workspaceId} by user ${userId}`)
    this.logger.log(`Tag data: ${JSON.stringify(createTagDto)}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        this.logger.error(`Workspace with ID ${workspaceId} not found`)
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        this.logger.error(`User ${userId} does not have access to workspace ${workspaceId}`)
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Create tag
      const tag = await this.prisma.tag.create({
        data: {
          name: createTagDto.name,
          color: createTagDto.color,
          workspace: {
            connect: { id: workspaceId },
          },
        },
      })

      this.logger.log(`Tag created successfully with ID: ${tag.id}`)
      return tag
    } catch (error) {
      this.logger.error(`Error creating tag: ${error.message}`, error.stack)
      throw error
    }
  }

  async createDocument(
    workspaceId: number,
    caseId: number,
    userId: number,
    createDocumentDto: CreateDocumentDto,
  ): Promise<DocumentResponse> {
    this.logger.log(`Creating document in workspace ${workspaceId}, case ${caseId} by user ${userId}`)
    this.logger.log(`Document data: ${JSON.stringify(createDocumentDto)}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        throw new WorkspaceNotFoundException(workspaceId)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Check if case exists and belongs to the workspace
      const caseItem = await this.prisma.case.findUnique({
        where: { id: caseId },
      })

      if (!caseItem) {
        throw new CaseNotFoundException(caseId)
      }

      if (caseItem.workspaceId !== workspaceId) {
        throw new ForbiddenException("This case does not belong to the specified workspace")
      }

      // Verify the file exists at the specified path
      if (!fs.existsSync(createDocumentDto.path)) {
        throw new NotFoundException(`File not found at path: ${createDocumentDto.path}`)
      }

      // Create document with all necessary relations
      const document = await this.prisma.document.create({
        data: {
          name: createDocumentDto.name,
          originalName: createDocumentDto.originalName,
          mimeType: createDocumentDto.mimeType,
          size: createDocumentDto.size,
          path: createDocumentDto.path,
          case: {
            connect: { id: caseId },
          },
          user: {
            connect: { id: userId },
          },
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          user: true,
          comments: {
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
      })

      this.logger.log(`Document created successfully with ID: ${document.id}`)

      // Transform the response to include tags in a more usable format and permissions
      return {
        ...document,
        tags: document.tags.map((dt) => dt.tag),
        userRole: userWorkspace.role,
        isOwner: document.userId === userId,
        canEdit: true,
        canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                  userWorkspace.role === WorkspaceRole.ADMIN || 
                  document.userId === userId,
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                    userWorkspace.role === WorkspaceRole.ADMIN || 
                    document.userId === userId,
          isUploader: document.userId === userId
        }
      }
    } catch (error) {
      this.logger.error(`Error creating document: ${error.message}`, error.stack)
      throw error
    }
  }

  async getDocument(
    workspaceId: number,
    caseId: number,
    documentId: number,
    userId: number
  ): Promise<DocumentResponse> {
    this.logger.log(`Getting document ${documentId} for case ${caseId} in workspace ${workspaceId} for user ${userId}`);

    try {
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
        throw new ForbiddenException("You do not have access to this workspace");
      }

      // Get document with all necessary relations
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          case: {
            include: {
              workspace: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          user: true,
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Check if document belongs to the specified case and workspace
      if (document.caseId !== caseId || document.case.workspaceId !== workspaceId) {
        throw new ForbiddenException("Document not found in the specified case and workspace");
      }

      // Transform the response to include tags in a more usable format
      return {
        ...document,
        tags: document.tags.map((dt) => dt.tag),
        userRole: userWorkspace.role,
        isOwner: document.userId === userId,
        canEdit: true,
        canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                   userWorkspace.role === WorkspaceRole.ADMIN || 
                   document.userId === userId
      };
    } catch (error) {
      this.logger.error(`Error getting document: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateDocument(
    workspaceId: number,
    caseId: number,
    documentId: number,
    userId: number,
    updateData: { name?: string; tagIds?: number[] },
  ): Promise<DocumentResponse> {
    this.logger.log(`Updating document ${documentId} for case ${caseId} in workspace ${workspaceId} by user ${userId}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Check if case exists and belongs to the workspace
      const caseItem = await this.prisma.case.findUnique({
        where: { id: caseId },
      })

      if (!caseItem) {
        throw new NotFoundException(`Case with ID ${caseId} not found`)
      }

      if (caseItem.workspaceId !== workspaceId) {
        throw new ForbiddenException("This case does not belong to the specified workspace")
      }

      // Check if document exists and belongs to the case
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      })

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`)
      }

      if (document.caseId !== caseId) {
        throw new ForbiddenException("This document does not belong to the specified case")
      }

      // Update document name if provided
      this.logger.log(`updateData received: ${JSON.stringify(updateData)}`)
      if (updateData.name !== undefined) {
        let newName = (updateData.name || '').trim();
        if (!newName) {
          // fallback to originalName if name is empty
          const original = await this.prisma.document.findUnique({ where: { id: documentId } });
          newName = original?.originalName || '';
        }
        this.logger.log(`Updating document name to: ${newName}`)
        await this.prisma.document.update({
          where: { id: documentId },
          data: {
            name: newName,
          },
        })
        const afterUpdate = await this.prisma.document.findUnique({ where: { id: documentId } });
        this.logger.log(`Document after update: ${JSON.stringify(afterUpdate)}`)
      }

      // Update document tags if provided
      if (updateData.tagIds && updateData.tagIds.length > 0) {
        // First, remove all existing tags
        await this.prisma.documentTag.deleteMany({
          where: {
            documentId,
          },
        })

        // Then, add the new tags
        for (const tagId of updateData.tagIds) {
          // Check if tag exists and belongs to the workspace
          const tag = await this.prisma.tag.findUnique({
            where: { id: tagId },
          })

          if (!tag) {
            throw new NotFoundException(`Tag with ID ${tagId} not found`)
          }

          if (tag.workspaceId !== workspaceId) {
            throw new ForbiddenException(`Tag with ID ${tagId} does not belong to the specified workspace`)
          }

          await this.prisma.documentTag.create({
            data: {
              document: {
                connect: { id: documentId },
              },
              tag: {
                connect: { id: tagId },
              },
            },
          })
        }
      }

      // Get the updated document with tags
      const updatedDocumentWithTags = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          user: true,
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      this.logger.log(`Document updated successfully with ID: ${updatedDocumentWithTags.id}`)

      // Transform the response to include tags in a more usable format and permissions
      return {
        ...updatedDocumentWithTags,
        tags: updatedDocumentWithTags.tags.map((dt) => dt.tag),
        userRole: userWorkspace.role,
        isOwner: updatedDocumentWithTags.userId === userId,
        canEdit: true,
        canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                  userWorkspace.role === WorkspaceRole.ADMIN || 
                  updatedDocumentWithTags.userId === userId,
        permissions: {
          canView: true,
          canEdit: true,
          canDelete: userWorkspace.role === WorkspaceRole.OWNER || 
                    userWorkspace.role === WorkspaceRole.ADMIN || 
                    updatedDocumentWithTags.userId === userId,
          isUploader: updatedDocumentWithTags.userId === userId
        }
      }
    } catch (error) {
      this.logger.error(`Error updating document: ${error.message}`, error.stack)
      throw error
    }
  }

  async deleteDocument(workspaceId: number, caseId: number, documentId: number, userId: number) {
    this.logger.log(`Deleting document ${documentId} for case ${caseId} in workspace ${workspaceId} by user ${userId}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Check if case exists and belongs to the workspace
      const caseItem = await this.prisma.case.findUnique({
        where: { id: caseId },
      })

      if (!caseItem) {
        throw new NotFoundException(`Case with ID ${caseId} not found`)
      }

      if (caseItem.workspaceId !== workspaceId) {
        throw new ForbiddenException("This case does not belong to the specified workspace")
      }

      // Check if document exists and belongs to the case
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      })

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`)
      }

      if (document.caseId !== caseId) {
        throw new ForbiddenException("This document does not belong to the specified case")
      }

      // Delete the file from the filesystem
      try {
        if (fs.existsSync(document.path)) {
          fs.unlinkSync(document.path)
          this.logger.log(`File deleted from path: ${document.path}`)
        } else {
          this.logger.warn(`File not found at path: ${document.path}`)
        }
      } catch (fileError) {
        this.logger.error(`Error deleting file: ${fileError.message}`, fileError.stack)
        // Continue with database deletion even if file deletion fails
      }

      // Delete document from database
      await this.prisma.document.delete({
        where: { id: documentId },
      })

      this.logger.log(`Document deleted successfully with ID: ${documentId}`)
      return { success: true, message: "Document deleted successfully" }
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`, error.stack)
      throw error
    }
  }

  async bulkUpdateDocuments(
    workspaceId: number,
    caseId: number,
    userId: number,
    bulkUpdateData: { documentIds: number[]; tagIds: number[] },
  ) {
    this.logger.log(`Bulk updating documents for case ${caseId} in workspace ${workspaceId} by user ${userId}`)

    try {
      // Check if workspace exists and user has access
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          users: true,
        },
      })

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
      }

      // Check if user has access to this workspace
      const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
      if (!userWorkspace) {
        throw new ForbiddenException("You do not have access to this workspace")
      }

      // Check if case exists and belongs to the workspace
      const caseItem = await this.prisma.case.findUnique({
        where: { id: caseId },
      })

      if (!caseItem) {
        throw new NotFoundException(`Case with ID ${caseId} not found`)
      }

      if (caseItem.workspaceId !== workspaceId) {
        throw new ForbiddenException("This case does not belong to the specified workspace")
      }

      // Validate all document IDs
      for (const documentId of bulkUpdateData.documentIds) {
        const document = await this.prisma.document.findUnique({
          where: { id: documentId },
        })

        if (!document) {
          throw new NotFoundException(`Document with ID ${documentId} not found`)
        }

        if (document.caseId !== caseId) {
          throw new ForbiddenException(`Document with ID ${documentId} does not belong to the specified case`)
        }
      }

      // Validate all tag IDs
      for (const tagId of bulkUpdateData.tagIds) {
        const tag = await this.prisma.tag.findUnique({
          where: { id: tagId },
        })

        if (!tag) {
          throw new NotFoundException(`Tag with ID ${tagId} not found`)
        }

        if (tag.workspaceId !== workspaceId) {
          throw new ForbiddenException(`Tag with ID ${tagId} does not belong to the specified workspace`)
        }
      }

      // Update tags for all documents
      const updatedDocuments = []
      for (const documentId of bulkUpdateData.documentIds) {
        // For each document, add the specified tags
        for (const tagId of bulkUpdateData.tagIds) {
          // Check if the tag is already associated with the document
          const existingTag = await this.prisma.documentTag.findUnique({
            where: {
              documentId_tagId: {
                documentId,
                tagId,
              },
            },
          })

          // If the tag is not already associated, create the association
          if (!existingTag) {
            await this.prisma.documentTag.create({
              data: {
                document: {
                  connect: { id: documentId },
                },
                tag: {
                  connect: { id: tagId },
                },
              },
            })
          }
        }

        // Get the updated document with tags
        const updatedDocument = await this.prisma.document.findUnique({
          where: { id: documentId },
          include: {
            tags: {
              include: {
                tag: true,
              },
            },
          },
        })

        // Transform the response to include tags in a more usable format
        updatedDocuments.push({
          ...updatedDocument,
          tags: updatedDocument.tags.map((dt) => dt.tag),
        })
      }

      this.logger.log(`Bulk updated ${updatedDocuments.length} documents successfully`)
      return updatedDocuments
    } catch (error) {
      this.logger.error(`Error bulk updating documents: ${error.message}`, error.stack)
      throw error
    }
  }

  // Comment-related methods
  async createComment(
    workspaceId: number,
    caseId: number,
    documentId: number,
    userId: number,
    createCommentDto: CreateCommentDto,
  ) {
    this.logger.log(`Creating comment for document ${documentId} in case ${caseId} by user ${userId}`)

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    })

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
    if (!userWorkspace) {
      throw new ForbiddenException("You do not have access to this workspace")
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
    })

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${caseId} not found`)
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException("This case does not belong to the specified workspace")
    }

    // Check if document exists and belongs to the case
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`)
    }

    if (document.caseId !== caseId) {
      throw new ForbiddenException("This document does not belong to the specified case")
    }

    // Create comment
    try {
      const comment = await this.prisma.comment.create({
        data: {
          content: createCommentDto.content,
          document: {
            connect: { id: documentId },
          },
          user: {
            connect: { id: userId },
          },
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
      })

      this.logger.log(`Comment created successfully with ID: ${comment.id}`)
      return comment
    } catch (error) {
      this.logger.error(`Error creating comment: ${error.message}`, error.stack)
      throw error
    }
  }

  async getComments(workspaceId: number, caseId: number, documentId: number, userId: number) {
    this.logger.log(`Getting comments for document ${documentId} in case ${caseId} for user ${userId}`)

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    })

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
    if (!userWorkspace) {
      throw new ForbiddenException("You do not have access to this workspace")
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
    })

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${caseId} not found`)
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException("This case does not belong to the specified workspace")
    }

    // Check if document exists and belongs to the case
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`)
    }

    if (document.caseId !== caseId) {
      throw new ForbiddenException("This document does not belong to the specified case")
    }

    // Get comments
    return this.prisma.comment.findMany({
      where: {
        documentId,
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
      orderBy: {
        createdAt: "desc",
      },
    })
  }

  async updateComment(
    workspaceId: number,
    caseId: number,
    documentId: number,
    commentId: number,
    userId: number,
    updateCommentDto: UpdateCommentDto,
  ) {
    this.logger.log(`Updating comment ${commentId} for document ${documentId} in case ${caseId} by user ${userId}`)

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    })

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
    if (!userWorkspace) {
      throw new ForbiddenException("You do not have access to this workspace")
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
    })

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${caseId} not found`)
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException("This case does not belong to the specified workspace")
    }

    // Check if document exists and belongs to the case
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`)
    }

    if (document.caseId !== caseId) {
      throw new ForbiddenException("This document does not belong to the specified case")
    }

    // Check if comment exists and belongs to the document
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`)
    }

    if (comment.documentId !== documentId) {
      throw new ForbiddenException("This comment does not belong to the specified document")
    }

    // Check if user is the owner of the comment or has admin rights
    if (
      comment.userId !== userId &&
      userWorkspace.role !== WorkspaceRole.OWNER &&
      userWorkspace.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to update this comment")
    }

    // Update comment
    try {
      const updatedComment = await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          content: updateCommentDto.content,
          updatedAt: new Date(),
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
      })

      this.logger.log(`Comment updated successfully with ID: ${updatedComment.id}`)
      return updatedComment
    } catch (error) {
      this.logger.error(`Error updating comment: ${error.message}`, error.stack)
      throw error
    }
  }

  async deleteComment(workspaceId: number, caseId: number, documentId: number, commentId: number, userId: number) {
    this.logger.log(`Deleting comment ${commentId} from document ${documentId} in case ${caseId} by user ${userId}`)

    // Check if workspace exists and user has access
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        users: true,
      },
    })

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`)
    }

    // Check if user has access to this workspace
    const userWorkspace = workspace.users.find((wu) => wu.userId === userId)
    if (!userWorkspace) {
      throw new ForbiddenException("You do not have access to this workspace")
    }

    // Check if case exists and belongs to the workspace
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
    })

    if (!caseItem) {
      throw new NotFoundException(`Case with ID ${caseId} not found`)
    }

    if (caseItem.workspaceId !== workspaceId) {
      throw new ForbiddenException("This case does not belong to the specified workspace")
    }

    // Check if document exists and belongs to the case
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`)
    }

    if (document.caseId !== caseId) {
      throw new ForbiddenException("This document does not belong to the specified case")
    }

    // Check if comment exists and belongs to the document
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`)
    }

    if (comment.documentId !== documentId) {
      throw new ForbiddenException("This comment does not belong to the specified document")
    }

    // Check if user is the owner of the comment or has admin rights
    if (
      comment.userId !== userId &&
      userWorkspace.role !== WorkspaceRole.OWNER &&
      userWorkspace.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException("You do not have permission to delete this comment")
    }

    // Delete comment
    try {
      await this.prisma.comment.delete({
        where: { id: commentId },
      })

      this.logger.log(`Comment deleted successfully with ID: ${commentId}`)
      return { success: true, message: "Comment deleted successfully" }
    } catch (error) {
      this.logger.error(`Error deleting comment: ${error.message}`, error.stack)
      throw error
    }
  }
}
