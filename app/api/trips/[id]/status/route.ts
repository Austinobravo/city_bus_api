
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { TripStatus, StopType } from "@prisma/client";

/**
 * @swagger
 * /api/trips/{id}/status:
 *   patch:
 *     summary: Update trip status
 *     tags:
 *       - Trips
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Trip status updated
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status } = body;

        // Validate status
        if (!status || !Object.values(TripStatus).includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        // Update the current trip
        const updatedTrip = await prisma.trip.update({
            where: { id },
            data: {
                status: status,
                arrivalTime: status === "COMPLETED" ? new Date() : undefined
            }
        });

        // Special logic for COMPLETED
        if (status === "COMPLETED") {
            // Fetch strict details
            const trip = await prisma.trip.findUnique({
                where: { id },
                include: {
                    route: {
                        include: { stops: { orderBy: { order: 'asc' } } }
                    },
                    bus: true,
                    driver: true
                }
            });

            if (trip && trip.route) {
                const { route } = trip;
                const newOrigin = route.destination;
                const newDestination = route.origin;
                const reverseName = `${newOrigin} to ${newDestination}`;

                // Check if reverse route exists (checking by name or origin/dest pair)
                let reverseRoute = await prisma.route.findFirst({
                    where: {
                        origin: newOrigin,
                        destination: newDestination
                    }
                });

                if (!reverseRoute) {
                    // Create Reverse Route
                    const reversedStops = [...route.stops].reverse().map((stop, index) => {
                        let newType = stop.stopType;
                        if (stop.stopType === "PICKUP") newType = "DROPOFF" as StopType;
                        else if (stop.stopType === "DROPOFF") newType = "PICKUP" as StopType;

                        return {
                            name: stop.name,
                            latitude: stop.latitude,
                            longitude: stop.longitude,
                            order: index + 1,
                            stopType: newType
                        };
                    });

                    reverseRoute = await prisma.route.create({
                        data: {
                            name: reverseName,
                            origin: newOrigin,
                            destination: newDestination,
                            price: route.price,
                            estimatedTime: route.estimatedTime,
                            stops: {
                                create: reversedStops
                            }
                        }
                    });
                }

                // Create the return trip
                await prisma.trip.create({
                    data: {
                        routeId: reverseRoute.id,
                        busId: trip.busId,
                        driverId: trip.driverId,
                        status: "SCHEDULED",
                        departureTime: new Date() // Scheduled for now
                    }
                });
            }
        }

        return NextResponse.json({ message: "Trip updated", trip: updatedTrip });

    } catch (error) {
        console.error("Error updating trip status:", error);
        return NextResponse.json({ error: "Failed to update trip status" }, { status: 500 });
    }
}
