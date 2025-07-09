/*
  Warnings:

  - The primary key for the `CalendarEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `CalendarEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id");
