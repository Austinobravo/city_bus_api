import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { sendEmail } from "@/emails/mailer";
import { BASE_URL, createVerificationToken } from "@/lib/globals";

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Forgot password
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
 *                 format: email
 *     responses:
 *       200:
 *         description: If this email exists, a reset link has been sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
export async function POST(req: Request) {
  let { email } = await req.json();
  email = email.toLowerCase();

  //   await rateLimit(req);

  if (!email) {
    return NextResponse.json({ message: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email, status: "ACTIVE" },
  });

  if (!user) {
    return NextResponse.json(
      { message: "If this email exists, a reset link has been sent" },
      { status: 200 }
    );
  }

  const token = createVerificationToken(user.email as string);
  const RESET_LINK = `${BASE_URL}/reset-password?token=${token}`;

  await prisma.user.update({
    where: {
      id: user?.id,
    },
    data: {
      verificationLink: RESET_LINK,
    },
  });
  await sendEmail({
    to: user.email as string,
    subject: "Reset Your Password!",
    template: "forgot-password",
    data: {
      RESET_LINK,
      name: `${user.firstName} ${user.lastName}`,
      year: new Date().getFullYear(),
      data: { RESET_LINK },
    },
  });

  return NextResponse.json({
    message: "If this email exists, a reset link has been sent",
  });
}
