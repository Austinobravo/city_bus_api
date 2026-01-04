import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { TicketStatus, TicketType } from "@/lib/generated/prisma/enums";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MockTicketSchema = z.object({
    name: z.string().default("Mock Ticket"),
    estimatedUsage: z.number().int().default(15),
    createCoverage: z.boolean().default(false),
    type: z.enum(TicketType).default(TicketType.SINGLE),
});

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, estimatedUsage, createCoverage, type } = MockTicketSchema.parse(body);

        const ticket = await prisma.ticket.create({
            data: {
                userId: user.id,
                name,
                price: 0,
                status: TicketStatus.ACTIVE, // Bypass payment, set active
                estimatedUsage,
                type
            }
        });

        let coverage = null;
        if (createCoverage) {
            // Find existing trip and seat to link
            const trip = await prisma.trip.findFirst();
            const seat = await prisma.seat.findFirst();

            if (trip && seat) {
                coverage = await prisma.ticketCoverage.create({
                    data: {
                        ticketId: ticket.id,
                        userId: user.id,
                        tripId: trip.id,
                        seatId: seat.id
                    }
                });
            }
        }

        return NextResponse.json({ ticket, coverage });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
