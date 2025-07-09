import { NotFoundException } from '@nestjs/common';

export class DocumentNotFoundException extends NotFoundException {
  constructor(documentId: number) {
    super(`Document with ID ${documentId} not found`);
  }
} 