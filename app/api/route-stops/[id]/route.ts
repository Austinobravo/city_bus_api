
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/route-stops/{id}:
 *   patch:
 *     summary: Update a route stop
 *     tags:
 *       - Route Stops
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
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               order:
 *                 type: integer
 *               stopType:
 *                 type: string
 *                 enum: [PICKUP, DROPOFF, BOTH]
 *     responses:
 *       200:
 *         description: Stop updated
 *   delete:
 *     summary: Delete a route stop
 *     tags:
 *       - Route Stops
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stop deleted
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const stop = await prisma.routeStop.update({
            where: { id },
            data: body
        });

        return NextResponse.json(stop);
    } catch (error) {
        console.error("Error updating stop:", error);
        return NextResponse.json({ error: "Failed to update stop" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.routeStop.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Stop deleted successfully" });
    } catch (error) {
        console.error("Error deleting stop:", error);
        return NextResponse.json({ error: "Failed to delete stop" }, { status: 500 });
    }
}
