/*
  Warnings:

  - You are about to drop the column `userId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the `CaseTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentPermission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CaseTag" DROP CONSTRAINT "CaseTag_caseId_fkey";

-- DropForeignKey
ALTER TABLE "CaseTag" DROP CONSTRAINT "CaseTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentPermission" DROP CONSTRAINT "DocumentPermission_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentPermission" DROP CONSTRAINT "DocumentPermission_userId_fkey";

-- DropIndex
DROP INDEX "Document_caseId_idx";

-- DropIndex
DROP INDEX "Document_userId_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "userId";

-- DropTable
DROP TABLE "CaseTag";

-- DropTable
DROP TABLE "DocumentPermission";

-- DropEnum
DROP TYPE "PermissionType";
