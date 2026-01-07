import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/trips/search:
 *   get:
 *     summary: Search for trips
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: query
 *         name: startLocation
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: endLocation
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: passengers
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of trips matching search criteria
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const startLocation = searchParams.get("startLocation");
    const endLocation = searchParams.get("endLocation");
    const startDate = searchParams.get("startDate");
    const passengers = parseInt(searchParams.get("passengers") || "1");

    if (!startLocation || !endLocation) {
        return NextResponse.json({ message: "Start and End locations required" }, { status: 400 });
    }

    // Parse date or use now
    const queryDate = startDate ? new Date(startDate) : new Date();

    try {
        // 1. Find Trips matching direct Route Origin/Dest
        let trips = await prisma.trip.findMany({
            where: {
                status: "SCHEDULED",
                departureTime: { gte: queryDate },
                route: {
                    origin: { contains: startLocation, mode: "insensitive" },
                    destination: { contains: endLocation, mode: "insensitive" }
                }
            },
            include: {
                route: true,
                bus: true
            }
        });
        console.log("inside try", trips)

        // 2. If no direct match, check Stops
        if (trips.length === 0) {
            // Find routes that have both stops
            // This is complex in Prisma. We find routes where stops include start AND end (with order start < order end)
            // Simpler: Fetch all scheduled trips and filter in memory if dataset is small.
            // Or fetch routes with stops.

            const potentialTrips = await prisma.trip.findMany({
                where: {
                    status: "SCHEDULED",
                    departureTime: { gte: queryDate },
                    route: {
                        stops: {
                            some: {
                                name: { contains: startLocation, mode: "insensitive" }
                            }
                        }
                    }
                },
                include: {
                    route: {
                        include: { stops: true }
                    },
                    bus: true
                }
            });

            console.log("potential", potentialTrips)

            // Filter for end location in stops with higher order
            trips = potentialTrips.filter(trip => {
                const startStop = trip.route.stops.find(s => s.name.toLowerCase().includes(startLocation.toLowerCase()));
                const endStop = trip.route.stops.find(s => s.name.toLowerCase().includes(endLocation.toLowerCase()));

                if (startStop && endStop && startStop.order < endStop.order) {
                    return true;
                }
                // Checks matching destination as well if stop only matched start
                if (startStop && trip.route.destination.toLowerCase().includes(endLocation.toLowerCase())) {
                    return true;
                }
                return false;
            });

            console.log("trip near filter", trips)
        }

        // 3. Filter by capacity (naive check: bus capacity. Real check: capacity - booked seats)
        // Ignoring granular seat bookings for this example or implement count
        // trips = trips.filter(...)
        // console.log("trips", trips)

        if (trips.length > 0) {
            console.log("trips in nextresponse", trips)
            return NextResponse.json({trips});
        }
        
        // 4. Fallback: Suggested Logic (Return Routes matching start or end)
        // Mimicking suggested logic (Address/Location match)
        // const suggested = await prisma.route.findMany({
        //     where: {
        //         OR: [
        //             { origin: { contains: startLocation, mode: "insensitive" } },
        //             { destination: { contains: startLocation, mode: "insensitive" } },
        //             { stops: { some: { name: { contains: startLocation, mode: "insensitive" } } } }
        //         ]
        //     },
        //     include: { stops: true }
        // });
        
        // console.log("trips 4", trips)
        
        
        console.log("trips outside nextresponse", trips)
        return NextResponse.json({trips});

    } catch (error) {
        console.error("Trip Search Error:", error);
        return NextResponse.json({ message: "Error searching trips" }, { status: 500 });
    }
}
