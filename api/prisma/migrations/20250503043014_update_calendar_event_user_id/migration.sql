/*
  Warnings:

  - You are about to drop the column `reminders` on the `CalendarEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CalendarEvent" DROP COLUMN "reminders",
ALTER COLUMN "end" DROP NOT NULL;
