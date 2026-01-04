
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/trips:
 *   get:
 *     summary: Get all trips
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of trips
 *   post:
 *     summary: Create a new trip
 *     tags:
 *       - Trips
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routeId
 *               - busId
 *               - driverId
 *               - departureTime
 *             properties:
 *               routeId:
 *                 type: string
 *               busId:
 *                 type: string
 *               driverId:
 *                 type: string
 *               departureTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Trip created
 */
export async function GET(req: NextRequest) {
    try {
        const trips = await prisma.trip.findMany({
            include: {
                route: true,
                bus: true,
                driver: { include: { user: true } }
            },
            orderBy: { departureTime: 'desc' }
        });
        return NextResponse.json(trips);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch trips" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { routeId, busId, driverId, departureTime } = body;

        const trip = await prisma.trip.create({
            data: {
                routeId,
                busId,
                driverId,
                departureTime: new Date(departureTime),
                status: "SCHEDULED"
            }
        });

        return NextResponse.json(trip, { status: 201 });
    } catch (error) {
        console.error("Error creating trip:", error);
        return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
    }
}
