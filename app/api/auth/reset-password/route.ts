import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import { BASE_URL, emojiRegex, validateForEmptySpaces } from "@/lib/globals";
import { sendEmail } from "@/emails/mailer";
import z from "zod";


const ResetForgotPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(1, { message: "This field is mandatory" })
      .refine((value) => validateForEmptySpaces(value), {
        message: "No empty spaces",
      })
      .refine((value) => !value.match(emojiRegex), {
        message: "No emoji's allowed.",
      }),
    confirmNewPassword: z
      .string()
      .min(1, { message: "This field is mandatory" })
      .refine((value) => validateForEmptySpaces(value), {
        message: "No empty spaces",
      })
      .refine((value) => !value.match(emojiRegex), {
        message: "No emoji's allowed.",
      }),
    token: z.string().min(1, { message: "Token is required" }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ["confirmNewPassword"],
  });

/**
 * @swagger
 * /api/auth/reset-password:
 *   get:
 *     summary: Check token validity
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token for password reset
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Invalid or expired token
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  console.log("received token", token);

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      email: string;
    };

    return NextResponse.json({ message: "Valid token", email: decoded.email });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }
}

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset a password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "Unknown IP";

  const reset_time = new Date().toLocaleString("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const body = await req.json();
  console.log("[POST] Reset Password - Request Body:", body); // Log full request input

  const parsed = ResetForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[POST] Zod Validation Failed:", parsed.error.format());
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.format() },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;
  console.log("[POST] Token extracted:", token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      email: string;
    };
    console.log("[POST] Token decoded. Email:", decoded.email);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log("[POST] Password hashed");

    const user = await prisma.user.update({
      where: { email: decoded.email },
      data: {
        passwordHash: hashedPassword,
        verificationLink: null,
      },
    });

    console.log("[POST] User updated:", user?.email);

    await sendEmail({
      to: decoded.email,
      subject: "Password Reset Successful 🎉",
      template: "password-reset-successful",
      data: {
        name: `${user.firstName} ${user.lastName}`,
        loginLink: `https://smegear.agency/login`,
        reset_time,
        ip_address: ip,
        year: new Date().getFullYear(),
      },
    });

    console.log("[POST] Success email sent to:", decoded.email);

    return NextResponse.json({ message: "Password reset successful" });
  } catch (err) {
    return NextResponse.json({ message: "Internal Server Error", error: err }, { status: 400 });
  }
}