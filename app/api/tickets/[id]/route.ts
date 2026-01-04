import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Get ticket details
 *     tags:
 *       - Tickets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket details including coverage
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                ticketCoverages: {
                    include: { trip: { include: { route: true, bus: true } } }
                },
                payment: true
            }
        });

        if (!ticket) return NextResponse.json({ message: "Not found" }, { status: 404 });

        // Ownership check: User must be Owner OR Beneficiary OR Admin/Ops
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATIONS) {
            if (ticket.userId !== user.id && ticket.beneficiaryId !== user.id) {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            }
        }

        return NextResponse.json(ticket);
    } catch (error) {
        return NextResponse.json({ message: "Error fetching ticket" }, { status: 500 });
    }
}
