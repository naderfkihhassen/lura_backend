/*
  Warnings:

  - Added the required column `userId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- First, make the userId column nullable
ALTER TABLE "Document" ADD COLUMN "userId" INTEGER;

-- Update existing documents to use the workspace owner's ID
UPDATE "Document" d
SET "userId" = (
  SELECT w."ownerId"
  FROM "Case" c
  JOIN "Workspace" w ON c."workspaceId" = w.id
  WHERE c.id = d."caseId"
);

-- Now make the column required
ALTER TABLE "Document" ALTER COLUMN "userId" SET NOT NULL;

-- Add the foreign key constraint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
