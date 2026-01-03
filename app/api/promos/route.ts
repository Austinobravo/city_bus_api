
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { UserRole } from "@/lib/generated/prisma/enums";
import { checkRole } from "@/lib/auth";

/**
 * @swagger
 * /api/promos:
 *   get:
 *     summary: Get all promo codes
 *     tags:
 *       - Promos
 *     responses:
 *       200:
 *         description: List of promo codes
 *   post:
 *     summary: Create a new promo code
 *     tags:
 *       - Promos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - discountPct
 *               - expiresAt
 *     responses:
 *       201:
 *         description: Promo created
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "10");
        const search = searchParams.get("search") || "";

        const skip = (page - 1) * pageSize;

        const auth = await checkRole(req, [UserRole.ADMIN, UserRole.OPERATIONS]);
        if (!auth.authorized) return auth.response;

        const where = search ? { code: { contains: search, mode: "insensitive" as const } } : {};

        const [promos, total] = await Promise.all([
            prisma.promoCode.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.promoCode.count({ where })
        ]);

        return NextResponse.json({
            data: promos,
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (error) {
        console.error("Error fetching promos:", error);
        return NextResponse.json({ error: "Failed to fetch promos" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await checkRole(req, [UserRole.ADMIN, UserRole.OPERATIONS]);
    if (!auth.authorized) return auth.response;

    try {
        const body = await req.json();
        const { code, discountPct, expiresAt, routeId } = body;

        const promo = await prisma.promoCode.create({
            data: {
                code: code.toUpperCase(),
                discountPct,
                expiresAt: new Date(expiresAt),
                routeId: routeId || null
            }
        });

        return NextResponse.json(promo, { status: 201 });
    } catch (error) {
        console.error("Error creating promo:", error);
        return NextResponse.json({ error: "Failed to create promo" }, { status: 500 });
    }
}
