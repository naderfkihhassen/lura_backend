import { NotFoundException } from '@nestjs/common';

export class CaseNotFoundException extends NotFoundException {
  constructor(caseId: number) {
    super(`Case with ID ${caseId} not found`);
  }
} 