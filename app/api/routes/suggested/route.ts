
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { verifyToken } from "@/lib/tokens";

/**
 * @swagger
 * /api/routes/suggested:
 *   get:
 *     summary: Get suggested routes based on user address or location
 *     tags:
 *       - Routes
 *     parameters:
 *       - in: path
 *         name: page
 *         schema:
 *           type: string
 *       - in: path
 *         name: pageSize
 *         schema:
 *           type: string
 *       - in: path
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of suggested routes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   origin:
 *                     type: string
 *                   destination:
 *                     type: string
 */
export async function GET(req: NextRequest) {
    try {
        let suggestedRoutes: any[] = [];
        let userId: string | null = null;
        let houseAddress: string | null = null;
        let workAddress: string | null = null;

        // 1. Try to get User ID from Token
        const authHeader = req.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const token = authHeader.split(" ")[1];
                const payload = verifyToken(token);
                userId = payload.id;
            } catch (e) {
                // Token invalid or expired, proceed as anonymous/IP-based
            }
        }

        // 2. If User, get House/Work Address
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { houseAddress: true, workAddress: true }
            });
            if (user?.houseAddress) houseAddress = user.houseAddress;
            if (user?.workAddress) workAddress = user.workAddress;
        }

        // 3. Logic: Address Match
        const addresses = [houseAddress, workAddress].filter(Boolean) as string[];

        if (addresses.length > 0) {
            // Extract first part of addresses as keywords
            const keywords = addresses.map(addr => addr.split(',')[0].trim());

            // Build OR conditions for each keyword
            const conditions = keywords.flatMap(keyword => [
                { name: { contains: keyword, mode: 'insensitive' } },
                { origin: { contains: keyword, mode: 'insensitive' } },
                { destination: { contains: keyword, mode: 'insensitive' } },
                {
                    stops: {
                        some: {
                            name: { contains: keyword, mode: 'insensitive' }
                        }
                    }
                }
            ]);

            suggestedRoutes = await prisma.route.findMany({
                where: { OR: conditions as any }, // Type assertion might be needed if complex OR
                include: { stops: true }
            });
        }

        // 4. Fallback: IP-based Location (if no address match or no address)
        if (suggestedRoutes.length === 0) {
            const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
            let lat = 0;
            let lon = 0;

            // Mock coordinates for Owerri if localhost or failure
            if (ip === "127.0.0.1" || ip === "::1") {
                // Owerri approximate center
                lat = 5.489;
                lon = 7.033;
            } else {
                try {
                    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon`);
                    const data = await res.json();
                    if (data.status === 'success') {
                        lat = data.lat;
                        lon = data.lon;
                    } else {
                        // Fallback to Owerri if IP look up fails (for demo purposes)
                        lat = 5.489;
                        lon = 7.033;
                    }
                } catch (e) {
                    lat = 5.489;
                    lon = 7.033;
                }
            }

            // Find stops within ~2km of the user location (approx 0.018 lat/lon degrees)
            // Prisma doesn't do geospatial queries easily without PostGIS, so we fetch routes and filter in memory or minimal range check
            // For efficiency with small dataset, we can fetch all and filter.

            const allRoutes = await prisma.route.findMany({ include: { stops: true } });

            suggestedRoutes = allRoutes.filter(route => {
                // Check if origin or dest is close
                // Or check if any stop is close
                return route.stops.some(stop => {
                    const dist = Math.sqrt(Math.pow(stop.latitude - lat, 2) + Math.pow(stop.longitude - lon, 2));
                    return dist < 0.05; // Roughly 5km radius for broader matching
                });
            });

            // If still empty, use all routes
            if (suggestedRoutes.length === 0) {
                suggestedRoutes = allRoutes;
            }
        }

        // 5. Fallback: If nothing found yet, just return all
        if (suggestedRoutes.length === 0) {
            suggestedRoutes = await prisma.route.findMany({ include: { stops: true } });
        }

        // 6. Shuffle the results
        const shuffled = suggestedRoutes.sort(() => Math.random() - 0.5);

        return NextResponse.json(shuffled);

    } catch (error) {
        console.error("Error in suggested routes:", error);
        return NextResponse.json({ error: "Failed to fetch suggested routes" }, { status: 500 });
    }
}
