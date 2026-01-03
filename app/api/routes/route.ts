
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/routes:
 *   get:
 *     summary: Get all routes
 *     tags:
 *       - Routes
 *     responses:
 *       200:
 *         description: List of all routes
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
 *                   price:
 *                     type: number
 *                   estimatedTime:
 *                     type: integer
 *                   stops:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *   post:
 *     summary: Create a new route
 *     tags:
 *       - Routes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - origin
 *               - destination
 *               - price
 *               - estimatedTime
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
 *               stops:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     order:
 *                       type: integer
 *                     stopType:
 *                       type: string
 *                       enum: [PICKUP, DROPOFF, BOTH]
 *     responses:
 *       201:
 *         description: Route created successfully
 *       400:
 *         description: Invalid input
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * pageSize;

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { origin: { contains: search, mode: 'insensitive' as const } },
        { destination: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        include: {
          stops: {
            orderBy: {
              order: 'asc'
            }
          }
        },
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.route.count({ where })
    ]);

    return NextResponse.json({
      data: routes,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json({ error: "Failed to fetch routes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, origin, destination, price, estimatedTime, stops } = body;

    // Basic validation
    if (!name || !origin || !destination || price === undefined || estimatedTime === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const route = await prisma.route.create({
      data: {
        name,
        origin,
        destination,
        price,
        estimatedTime,
        stops: stops && Array.isArray(stops) ? {
          create: stops.map((stop: any) => ({
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            order: stop.order,
            stopType: stop.stopType || "BOTH"
          }))
        } : undefined
      },
      include: {
        stops: true
      }
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error("Error creating route:", error);
    return NextResponse.json({ error: "Failed to create route" }, { status: 500 });
  }
}
