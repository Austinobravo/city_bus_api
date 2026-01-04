import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    try {
        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) return NextResponse.json({ message: "Not found" }, { status: 404 });
        if (notification.userId !== user.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const updated = await prisma.notification.update({
            where: { id },
            data: { read: true }
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ message: "Error updating notification" }, { status: 500 });
    }
}
