
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { UserRole } from "@/lib/generated/prisma/enums";
import { checkRole } from "@/lib/auth";

/**
 * @swagger
 * /api/promos/{id}:
 *   get:
 *     summary: Get promo by ID
 *     tags:
 *       - Promos
 *   patch:
 *     summary: Update promo
 *     tags:
 *       - Promos
 *   delete:
 *     summary: Delete promo
 *     tags:
 *       - Promos
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await checkRole(req, [UserRole.ADMIN, UserRole.OPERATIONS]);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    const promo = await prisma.promoCode.findUnique({ where: { id } });
    if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(promo);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await checkRole(req, [UserRole.ADMIN, UserRole.OPERATIONS]);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    const body = await req.json();

    try {
        const promo = await prisma.promoCode.update({
            where: { id },
            data: body
        });
        return NextResponse.json(promo);
    } catch (error) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await checkRole(req, [UserRole.ADMIN, UserRole.OPERATIONS]);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    try {
        await prisma.promoCode.delete({ where: { id } });
        return NextResponse.json({ message: "Deleted" });
    } catch (error) {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
}
