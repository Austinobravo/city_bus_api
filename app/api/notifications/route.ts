import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications for the logged-in user
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *           description: Filter by read status
 *     responses:
 *       200:
 *         description: List of notifications
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const read = searchParams.get("read"); // "true" or "false"

    const skip = (page - 1) * pageSize;

    let where: any = { userId: user.id, isDeleted: false };
    if (read !== null) {
        where.read = read === "true";
    }

    try {
        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: pageSize
            }),
            prisma.notification.count({ where })
        ]);

        return NextResponse.json({
            data: notifications,
            meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to fetch notifications" }, { status: 500 });
    }
}
