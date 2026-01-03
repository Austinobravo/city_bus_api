
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { verifyPayment } from "@/lib/paystack";
import { PaymentStatus, TicketStatus } from "@/lib/generated/prisma/enums";

/**
 * @swagger
 * /api/payments/verify:
 *   get:
 *     summary: Verify a payment reference
 *     tags:
 *       - Payments
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) return NextResponse.json({ error: "No reference provided" }, { status: 400 });

    try {
        const payment = await prisma.payment.findUnique({
            where: { reference },
            include: { ticket: true }
        });

        if (!payment) return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
        if (payment.status === PaymentStatus.SUCCESS) {
            return NextResponse.json({ message: "Already verified", payment });
        }

        const verification = await verifyPayment(reference);

        if (verification.success && verification.data.status === "success") {
            const updatedPayment = await prisma.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.SUCCESS }
            });

            await prisma.ticket.update({
                where: { id: payment.ticketId },
                data: { status: TicketStatus.PAID }
            });

            return NextResponse.json({ message: "Payment verified successfully", payment: updatedPayment });
        }

        return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });

    } catch (error) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
