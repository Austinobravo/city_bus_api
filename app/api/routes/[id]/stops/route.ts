
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/routes/{id}/stops:
 *   get:
 *     summary: Get stops for a route
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
 *         description: List of stops
 *   post:
 *     summary: Add a stop to a route
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
 *             required:
 *               - name
 *               - latitude
 *               - longitude
 *               - order
 *               - stopType
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
 *       201:
 *         description: Stop added
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const stops = await prisma.routeStop.findMany({
            where: { routeId: id },
            orderBy: { order: 'asc' }
        });
        return NextResponse.json(stops);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch stops" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const stop = await prisma.routeStop.create({
            data: {
                ...body,
                routeId: id
            }
        });

        return NextResponse.json(stop, { status: 201 });
    } catch (error) {
        console.error("Error creating stop:", error);
        return NextResponse.json({ error: "Failed to create stop" }, { status: 500 });
    }
}
