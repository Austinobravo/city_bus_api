
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";
import { getCurrentUser } from "@/lib/getCurrentUser";

/**
 * @swagger
 * /api/trips/{id}:
 *   get:
 *     summary: Get trip details
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trip'
 *       404:
 *         description: Trip not found
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser(req)

    const id = (await params).id
    if(!id) return NextResponse.json({ message: "Trip ID is required" }, { status: 400 });
    try {
        const trip = await prisma.trip.findUnique({ where: { id }, include: { route: true, bus: true, driver: true, userTrips: true } });
        if (!trip) {
            return NextResponse.json({ message: "Trip not found" }, { status: 404 });
        }

        const userTrip = await prisma.userTrip.findUnique({ where: { tripId_userId: { tripId: id, userId: user?.id as string } } });

        return NextResponse.json({ trip, userTrip });
    } catch (error) {
        console.error("Trip GET Error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}