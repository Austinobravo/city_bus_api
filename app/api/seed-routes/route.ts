
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";

export async function POST(req: NextRequest) {
    try {
        // Check if route already exists to avoid duplicates
        const existingRoute = await prisma.route.findFirst({
            where: { name: "Orji to Wetheral" }
        });

        if (existingRoute) {
            return NextResponse.json({ message: "Route already exists", route: existingRoute });
        }

        const route = await prisma.route.create({
            data: {
                name: "Orji to Wetheral",
                origin: "Orji Flyover",
                destination: "Wetheral Roundabout",
                price: 150,
                estimatedTime: 30, // 30 mins
                stops: {
                    create: [
                        {
                            name: "Orji Flyover (Peace Mass)",
                            latitude: 5.505,
                            longitude: 7.040,
                            order: 1,
                            stopType: "PICKUP"
                        },
                        {
                            name: "Everyday Supermarket",
                            latitude: 5.502,
                            longitude: 7.038,
                            order: 2,
                            stopType: "BOTH"
                        },
                        {
                            name: "IMSU Junction",
                            latitude: 5.498,
                            longitude: 7.035,
                            order: 3,
                            stopType: "BOTH"
                        },
                        {
                            name: "MCC Junction",
                            latitude: 5.490,
                            longitude: 7.032,
                            order: 4,
                            stopType: "BOTH"
                        },
                        {
                            name: "Fire Service Junction",
                            latitude: 5.485,
                            longitude: 7.030,
                            order: 5,
                            stopType: "BOTH"
                        },
                        {
                            name: "Wetheral Roundabout",
                            latitude: 5.480,
                            longitude: 7.025,
                            order: 6,
                            stopType: "DROPOFF"
                        }
                    ]
                }
            },
            include: {
                stops: true
            }
        });

        return NextResponse.json({ message: "Seed successful", route });
    } catch (error) {
        console.error("Error seeding routes:", error);
        return NextResponse.json({ error: "Failed to seed routes" }, { status: 500 });
    }
}
