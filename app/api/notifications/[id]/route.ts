import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: View a single notification
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
 *         description: Notification details
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    try {
        const notification = await prisma.notification.findUnique({
            where: { id },
        });

        if (!notification) return NextResponse.json({ message: "Not found" }, { status: 404 });
        if (notification.userId !== user.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        return NextResponse.json(notification);
    } catch (error) {
        return NextResponse.json({ message: "Error fetching notification" }, { status: 500 });
    }
}
