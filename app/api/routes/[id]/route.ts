
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/routes/{id}:
 *   get:
 *     summary: Get a route by ID
 *     tags:
 *       - Routes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Route details
 *       404:
 *         description: Route not found
 *   patch:
 *     summary: Update a route
 *     tags:
 *       - Routes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               origin:
 *                 type: string
 *               destination:
 *                 type: string
 *               price:
 *                 type: number
 *               estimatedTime:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Route updated
 *   delete:
 *     summary: Delete a route
 *     tags:
 *       - Routes
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Route deleted
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const route = await prisma.route.findUnique({
            where: { id },
            include: {
                stops: {
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        });

        if (!route) {
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        return NextResponse.json(route);
    } catch (error) {
        console.error("Error fetching route:", error);
        return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const route = await prisma.route.update({
            where: { id },
            data: body,
            include: { stops: true }
        });

        return NextResponse.json(route);
    } catch (error) {
        console.error("Error updating route:", error);
        return NextResponse.json({ error: "Failed to update route" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.route.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Route deleted successfully" });
    } catch (error) {
        console.error("Error deleting route:", error);
        return NextResponse.json({ error: "Failed to delete route" }, { status: 500 });
    }
}
