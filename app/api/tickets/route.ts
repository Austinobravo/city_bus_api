
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { TicketStatus, UserRole } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Get tickets (User sees own, Admin sees all)
 *     tags:
 *       - Tickets
 *   post:
 *     summary: Book a ticket
 *     tags:
 *       - Tickets
 */
export async function GET(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const status = searchParams.get("status");

    const skip = (page - 1) * pageSize;
    let where: any = {};

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OPERATIONS) {
        // Regular user only sees their own tickets
        where.userId = user.id;
    }

    if (status) {
        where.status = status as TicketStatus;
    }

    const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
            where,
            include: {
                trip: { include: { route: true, bus: true } },
                seat: true
            },
            skip,
            take: pageSize,
            orderBy: { createdAt: "desc" }
        }),
        prisma.ticket.count({ where })
    ]);

    return NextResponse.json({
        data: tickets,
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
}

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { tripId, seatId } = body;

        // Check availability
        const existingTicket = await prisma.ticket.findFirst({
            where: {
                tripId,
                seatId,
                status: {
                    in: [TicketStatus.PAID, TicketStatus.RESERVED]
                }
            }
        });

        if (existingTicket) {
            return NextResponse.json({ error: "Seat already taken" }, { status: 409 });
        }

        // Get Trip Price
        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
            include: { route: true }
        });

        if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

        const ticket = await prisma.ticket.create({
            data: {
                userId: user.id,
                tripId,
                seatId,
                price: trip.route.price,
                status: TicketStatus.RESERVED // Reserved until payment
            }
        });

        return NextResponse.json(ticket, { status: 201 });

    } catch (error) {
        console.error("Booking error:", error);
        return NextResponse.json({ error: "Booking failed" }, { status: 500 });
    }
}
