
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { UserRole } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: List payments
 *     tags:
 *       - Payments
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const skip = (page - 1) * pageSize;
    let where: any = {};

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATIONS) {
        where.userId = user.id;
    }

    try {
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: { ticket: { include: { trip: { include: { route: true } } } } },
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.payment.count({ where })
        ]);

        return NextResponse.json({
            data: payments,
            meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (error) {
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
}
