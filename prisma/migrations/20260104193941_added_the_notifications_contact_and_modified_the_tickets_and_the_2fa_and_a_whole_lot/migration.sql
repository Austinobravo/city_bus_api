/*
  Warnings:

  - You are about to drop the column `seatId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `tripId` on the `Ticket` table. All the data in the column will be lost.
  - Added the required column `name` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SINGLE', 'ROUND');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'TRIP_UPDATE', 'PROMOTION', 'REMINDER', 'PAYMENT');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'ACTIVE';

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_seatId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_tripId_fkey";

-- AlterTable
ALTER TABLE "BusLocation" ADD COLUMN     "heading" DOUBLE PRECISION,
ADD COLUMN     "speedKmh" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "seatId",
DROP COLUMN "tripId",
ADD COLUMN     "beneficiaryId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "estimatedUsage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'SINGLE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is2faVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workAddress" TEXT;

-- CreateTable
CREATE TABLE "TicketCoverage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,

    CONSTRAINT "TicketCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactUs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactUs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusLocation_tripId_recordedAt_idx" ON "BusLocation"("tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_order_idx" ON "RouteStop"("routeId", "order");

-- AddForeignKey
ALTER TABLE "TicketCoverage" ADD CONSTRAINT "TicketCoverage_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoverage" ADD CONSTRAINT "TicketCoverage_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoverage" ADD CONSTRAINT "TicketCoverage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoverage" ADD CONSTRAINT "TicketCoverage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
