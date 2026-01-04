import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search for a user by email or phone
 *     tags:
 *       - User
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) return NextResponse.json({ message: "Query required" }, { status: 400 });

    const found = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { equals: query, mode: 'insensitive' } },
                { phone: { equals: query } }
            ]
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
        }
    });

    if (!found) return NextResponse.json({ message: "User not found" }, { status: 404 });

    return NextResponse.json(found);
}
