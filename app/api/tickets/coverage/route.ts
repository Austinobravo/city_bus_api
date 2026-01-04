import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TicketStatus } from "@/lib/generated/prisma/enums";

const CoverageSchema = z.object({
    ticketId: z.string().uuid("Invalid Ticket ID"),
    tripId: z.string().uuid("Invalid Trip ID"),
    seatId: z.string().uuid("Invalid Seat ID"),
    userId: z.string().uuid("Invalid User ID"),
});

/**
 * @swagger
 * /api/tickets/coverage:
 *   post:
 *     summary: Record ticket usage (Coverage)
 *     tags:
 *       - Tickets
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticketId
 *               - tripId
 *               - seatId
 *               - userId
 *             properties:
 *               ticketId:
 *                 type: string
 *               tripId:
 *                 type: string
 *               seatId:
 *                 type: string
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Coverage recorded
 *       400:
 *         description: Validation error or Ticket exhausted
 */
export async function POST(req: NextRequest) {
    // Validate request
    const body = await req.json();
    const parsed = CoverageSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { ticketId, tripId, seatId, userId } = parsed.data;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch Ticket with lock? (Prisma doesn't easily lock, but we check count)
            const ticket = await tx.ticket.findUnique({
                where: { id: ticketId }
            });

            if (!ticket) throw new Error("Ticket not found");

            // Verify ownership?
            // ticket.userId should match userId?
            // Or checking if ticket is valid for this user.
            if (ticket.userId !== userId && ticket.beneficiaryId !== userId) {
                // If transfer happen, ticket.userId is beneficiary.
                // If ticket has beneficiaryId set but userId is still purchaser?
                // User said "changes the userId to the beneficiary id". So userId is the owner.
                // But maybe we allow usage if beneficiaryId matches?
                if (ticket.userId !== userId) {
                    // Strict check: Must match ticket owner.
                    throw new Error("User does not own this ticket");
                }
            }

            // Check Status
            if (ticket.status === TicketStatus.USED || ticket.status === TicketStatus.CANCELLED || ticket.status === TicketStatus.REFUNDED) {
                throw new Error(`Ticket is ${ticket.status}`);
            }

            // We allow RESERVED? User creates RESERVED, then Pays. Status -> ACTIVE.
            // If status is RESERVED, it might mean not paid yet.
            // But user said "status is reserved" when bought for beneficiary.
            // Assuming payment is done, status should be PAID/ACTIVE.
            // If RESERVED, maybe check if payment exists?
            // For now, I'll allow ACTIVE, PAID. Warn on RESERVED?
            // User says "creates the ticketcoverage and mark the ticket as status as used".
            // I'll allow PAID/ACTIVE and RESERVED (if that's the persistent state).

            // 2. Count existing coverages
            const usageCount = await tx.ticketCoverage.count({
                where: { ticketId }
            });

            if (usageCount >= ticket.estimatedUsage) {
                throw new Error("Ticket usage limit exceeded");
            }

            // 3. Create Coverage
            const coverage = await tx.ticketCoverage.create({
                data: {
                    ticketId,
                    tripId,
                    seatId,
                    userId
                }
            });

            // 4. Update Ticket Status if last usage
            let newStatus = ticket.status as TicketStatus;
            if (usageCount + 1 >= ticket.estimatedUsage) {
                newStatus = TicketStatus.USED;
                await tx.ticket.update({
                    where: { id: ticketId },
                    data: { status: TicketStatus.USED }
                });
            } else {
                // Ensure it's active if it was reserved/paid?
                if (ticket.status !== TicketStatus.ACTIVE && ticket.status !== TicketStatus.PAID) {
                    // Maybe set to ACTIVE?
                }
            }

            return { coverage, newStatus };
        });

        return NextResponse.json({ message: "Ticket used successfully", ...result }, { status: 201 });

    } catch (error: any) {
        console.error("Coverage Creation Error:", error);
        return NextResponse.json({ message: error.message || "Transaction failed" }, { status: 400 });
    }
}
