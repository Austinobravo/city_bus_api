import { getCurrentUser } from "@/lib/getCurrentUser";
import { createOtp } from "@/lib/helpers";
import { sendEmail } from "@/emails/mailer";
import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/auth/2fa/send:
 *   post:
 *     summary: Send OTP code for 2FA toggling
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       401:
 *         description: Unauthorized
 */
export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req);
    if (!user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const otp = await createOtp(user.id);
        const name = `${user.firstName} ${user.lastName}`;
        const current_year = new Date().getFullYear();

        if (user.email) {
            await sendEmail({
                to: user.email,
                subject: "Your Security Code",
                template: "signup-verification", // Reusing verification template
                data: { name, otp, current_year }
            });
            return NextResponse.json({ message: "OTP sent to your email" });
        } else {
            // If no email, maybe phone? We don't have SMS setup confirmed yet.
            // For now, return error or mock success if in dev?
            return NextResponse.json({ message: "No email linked to account. SMS not supported yet." }, { status: 400 });
        }


    } catch (error: any) {
        console.error("2FA Send Error:", error);
        return NextResponse.json({ message: "Failed to send OTP", error: error.message }, { status: 500 });
    }
}
