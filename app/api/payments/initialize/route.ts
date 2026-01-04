
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { initializePayment } from "@/lib/paystack";
import { PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { BASE_URL } from "@/lib/globals";

/**
 * @swagger
 * /api/payments/initialize:
 *   post:
 *     summary: Initialize a payment for a ticket
 *     tags:
 *       - Payments
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { ticketId, paymentMethod } = body;

        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { user: true }
        });

        if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        if (ticket.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        if (paymentMethod === "ONLINE") {
            const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const callbackUrl = `${BASE_URL}/payment/verify?reference=${reference}`;

            await prisma.payment.create({
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
                Number(ticket.price),
                reference,
                callbackUrl,
                { ticketId: ticket.id }
            );

            if (!paystackRes.success) {
                return NextResponse.json({ error: "Paystack initialization failed", details: paystackRes.error }, { status: 502 });
            }

            return NextResponse.json({
                authorization_url: paystackRes.data.authorization_url,
                reference,
                access_code: paystackRes.data.access_code
            });
        }

        return NextResponse.json({ error: "Method not supported in this endpoint" }, { status: 400 });

    } catch (error) {
        console.error("Payment Init Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
