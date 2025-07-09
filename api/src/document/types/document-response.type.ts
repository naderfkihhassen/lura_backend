import { Document } from "@prisma/client"

export interface DocumentResponse extends Document {
  canEdit?: boolean;
  canDelete?: boolean;
  permissions?: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isUploader: boolean;
  };
  userRole?: string;
  isOwner?: boolean;
  tags?: Array<{
    id: number;
    name: string;
    color: string;
    workspaceId: number;
  }>;
} 