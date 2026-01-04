import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { AuditAction } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/tickets/{id}/beneficiary/remove:
 *   patch:
 *     summary: Remove ticket beneficiary
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
 *         description: Beneficiary removed successfully
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    try {
        const ticket = await prisma.ticket.findUnique({ where: { id } });
        if (!ticket) return NextResponse.json({ message: "Ticket not found" }, { status: 404 });

        if (ticket.userId !== user.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        await prisma.ticket.update({
            where: { id },
            data: { beneficiaryId: null }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: AuditAction.UPDATE,
                entity: "Ticket",
                entityId: id,
                metadata: { action: "REMOVE_BENEFICIARY" }
            }
        });

        return NextResponse.json({ message: "Beneficiary removed" });
    } catch (error) {
        return NextResponse.json({ message: "Error" }, { status: 500 });
    }
}
