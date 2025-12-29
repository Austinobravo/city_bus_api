import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import { BASE_URL, emojiRegex, normalizePhone, validateForEmptySpaces } from "@/lib/globals";
import { sendEmail } from "@/emails/mailer";
import z from "zod";
import { UserWhereInput } from "@/lib/generated/prisma/models";
import { verifyOtp } from "@/lib/helpers";


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
    emailOrPhone: z
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
    otp: z.string().min(1, { message: "Token is required" }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ["confirmNewPassword"],
  });



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
 *               - emailOrPhone
 *               - otp
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *               otp:
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

  const parsed = ResetForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[POST] Zod Validation Failed:", parsed.error.message);
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.message },
      { status: 400 }
    );
  }

  const { otp, newPassword, emailOrPhone } = parsed.data;

  
  
    const isEmail = z.email().safeParse(emailOrPhone).success
    const phone = !isEmail ? normalizePhone(emailOrPhone) : null

    if (!isEmail && !phone) {
    return NextResponse.json(
        { message: "Invalid phone number format" },
        { status: 400 }
    )
    }
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
    where: {
        OR: [
        isEmail ? { email: emailOrPhone } : undefined,
        phone ? { phone } : undefined,
        ].filter(Boolean) as UserWhereInput[],
    },
    })

    if (!existingUser) {
    return NextResponse.json(
        { message: "User does not exist." },
        { status: 400 }
    )
    }

    const isUserVerified = await verifyOtp(existingUser.id, otp)

    if(!isUserVerified) {
        return NextResponse.json({ message: "Unable to verify code" }, { status: 400 }); 
        }
    
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log("[POST] Password hashed");

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash: hashedPassword,
        verificationLink: null,
      },
    });

    if(isEmail){
        await sendEmail({
          to: user.email as string,
          subject: "Password Reset Successful 🎉",
          template: "password-reset-successful",
          data: {
            name: `${user.firstName} ${user.lastName}`,
            reset_time,
            ip_address: ip,
            support_link: "https://citybustransit.com/contact",
            current_year: new Date().getFullYear(),
          },
        });
    }

    return NextResponse.json({ message: "Password reset successful" });
  } catch (err) {
    return NextResponse.json({ message: "Internal Server Error", error: err }, { status: 400 });
  }
}