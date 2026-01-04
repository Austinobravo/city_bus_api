import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { verifyOtp } from "@/lib/helpers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const VerifySchema = z.object({
    otp: z.string().min(1, "OTP is required"),
});

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify OTP and toggle 2FA status
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA toggled successfully
 *       400:
 *         description: Invalid OTP or Unauthorized
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = VerifySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { otp } = parsed.data;

        // Verify OTP using helper
        await verifyOtp(user.id, otp);

        // Toggle otpEnabled status
        // We fetching fresh status just in case, though user object has it.
        // Actually user object from getCurrentUser might be stale? getCurrentUser hits DB usually.
        // Let's toggle.
        const currentUserState = await prisma.user.findUnique({ where: { id: user.id }, select: { otpEnabled: true } });

        const newState = !currentUserState?.otpEnabled;

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { otpEnabled: newState },
            select: { id: true, otpEnabled: true }
        });

        return NextResponse.json({
            message: `2FA is now ${updatedUser.otpEnabled ? 'enabled' : 'disabled'}`,
            otpEnabled: updatedUser.otpEnabled
        });

    } catch (error: any) {
        console.error("2FA Verify Error:", error);
        return NextResponse.json({ message: error.message || "Failed to verify" }, { status: 400 });
    }
}
