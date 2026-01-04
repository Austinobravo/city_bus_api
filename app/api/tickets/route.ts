
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { TicketStatus, UserRole, TicketType, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { initializePayment } from "@/lib/paystack";
import { z } from "zod";

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Get tickets (User sees own, Admin sees all)
 *     tags:
 *       - Tickets
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
 *   post:
 *     summary: Book a ticket
 *     tags:
 *       - Tickets
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - estimatedUsage
 *               - price
 *               - callbackUrl
 *             properties:
 *               name:
 *                 type: string
 *               estimatedUsage:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [SINGLE, ROUND]
 *               price:
 *                 type: integer
 *               beneficiaryId:
 *                 type: string
 *               promoCode:
 *                 type: string
 *               callbackUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Coverage recorded
 *       400:
 *         description: Validation error or Ticket exhausted
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
                ticketCoverages: {
                    include: { trip: { include: { route: true } } }
                },
                payment: true
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



const TicketSchema = z.object({
    name: z.string().min(1, "Name is required"),
    estimatedUsage: z.number().int().min(1, "Estimated usage must be at least 1"),
    type: z.enum(TicketType).optional().default(TicketType.SINGLE),
    price: z.number().min(0, "Price must be positive"),
    beneficiaryId: z.string().optional(),
    promoCode: z.string().optional(),
    callbackUrl: z.string().url("Callback URL must be a valid URL"),
});

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const parsed = TicketSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
        }

        const { name, estimatedUsage, type, price, beneficiaryId, promoCode, callbackUrl } = parsed.data;

        let finalPrice = price;
        let promoId = null;

        // 1. Validations
        // Validate Promo Code
        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({
                where: { code: promoCode }
            });

            if (promo) {
                if (!promo.isActive) return NextResponse.json({ error: "Promo code is inactive" }, { status: 400 });
                if (promo.expiresAt < new Date()) return NextResponse.json({ error: "Promo code expired" }, { status: 400 });

                // Apply discount
                finalPrice = Math.max(0, finalPrice - promo.discountPct); // Assuming discountPct is amount or percentage? Schema says Int. "minus the discountPrice".
                // Schema: discountPct Int. Name implies Percentage? User says "minus the discountPrice".
                // If it's percentage: price * (1 - pct/100).
                // If it's fixed amount, just minus.
                // "minus the discountPrice...".
                // I'll assume it's a fixed amount if user calls it "price", but "discountPct" implies percent.
                // I will assume it's a fixed deduction based on user wording "minus the discountPrice". 
                // Wait, schema field is `discountPct`. User says `discountPrice`.
                // I'll assume `discountPct` holds the value to deduct.
                finalPrice = finalPrice - promo.discountPct;
                if (finalPrice < 0) finalPrice = 0;

                promoId = promo.id;
            } else {
                return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
            }
        }

        // 2. Create Ticket (RESERVED)
        // We use a transaction to ensure integrity if payment init fails?
        // But payment init is external.

        const ticket = await prisma.ticket.create({
            data: {
                userId: user.id,
                name,
                beneficiaryId,
                price: Number(finalPrice),
                estimatedUsage,
                type,
                status: TicketStatus.RESERVED,
            }
        });

        // 3. Initialize Payment
        // Create Payment Record
        const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const payment = await prisma.payment.create({
            data: {
                userId: user.id,
                ticketId: ticket.id,
                amount: ticket.price,
                method: PaymentMethod.ONLINE,
                status: PaymentStatus.PENDING,
                reference
            }
        });

        // Call Paystack
        const paystackRes = await initializePayment(
            user.email || "no-email@cbt.com",
            Number(finalPrice) * 100, // Paystack is in kobo
            reference,
            callbackUrl,
            { ticketId: ticket.id, beneficiaryId }
        );

        if (!paystackRes.success) {
            // Rollback? Optionally delete ticket/payment or leave as failed.
            // Leaving as failed allow retry?
            // User says "chained... if one fails all fails".
            // So I should delete.
            await prisma.payment.delete({ where: { id: payment.id } });
            await prisma.ticket.delete({ where: { id: ticket.id } });

            return NextResponse.json({ error: "Payment initialization failed", details: paystackRes.error }, { status: 502 });
        }

        return NextResponse.json({
            message: "Ticket created, proceed to payment",
            ticket,
            payment: {
                authorization_url: paystackRes.data?.authorization_url, // access data safely
                reference,
                access_code: paystackRes.data?.access_code
            }
        }, { status: 201 });

    } catch (error) {
        console.error("Booking error:", error);
        return NextResponse.json({ error: "Booking failed" }, { status: 500 });
    }
}
