import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/emails/mailer";
import { BASE_URL, createVerificationToken } from "@/lib/globals";

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email not found or already verified
 */

export const POST = async (req: Request) => {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: "Email not found" }, { status: 404 });
    }

    if (user.status === "ACTIVE") {
      return NextResponse.json({ message: "Email is already verified" }, { status: 400 });
    }


    const token = createVerificationToken(email);
    const VERIFICATION_LINK = `${BASE_URL}/verify-email?token=${token}`;
    

    await prisma.user.update({
      where: { id: user?.id },
      data: { verificationLink: VERIFICATION_LINK },
    });

    
    await sendEmail({
      to: email,
      subject: "You're In! Welcome to SmeGear 🎉",
      template: "signup-verification",
      data: { VERIFICATION_LINK },
    });

    return NextResponse.json({ message: "Verification email sent" }, { status: 200 });

  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json({ message: "Something went wrong" , error: error}, { status: 500 });
  }
};
