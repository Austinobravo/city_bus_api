import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { emojiRegex, normalizePhone, validateForEmptySpaces } from "@/lib/globals";
import z from "zod";
import bcrypt from "bcryptjs";
import { UserWhereInput } from "@/lib/generated/prisma/models";


const VerifyEmailOrPhoneFormSchema = z
   .object({
      emailOrPhone: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      otp: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      
    });


/**
 * @swagger
 * /api/auth/verify-email-or-phone:
 *   get:
 *     summary: Email Or Phone verification by OTP
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
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             items:
 *                 type: string
 *       400:
 *         description: Invalid token
 */


const MAX_OTP_ATTEMPTS = 5

async function verifyOtp(userId: string, otp: string) {
  const record = await prisma.otp.findFirst({
    where: { id: userId },
    orderBy: { createdAt: "desc" },
  })


  if (!record) throw new Error("OTP not found")

  if (record.expiresAt < new Date()) {
    throw new Error("OTP expired")
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many attempts. Request a new OTP.")
  }

  const isValid = await bcrypt.compare(otp, record.codeHash)

  await prisma.otp.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  })

  if (!isValid) throw new Error("Invalid OTP")


  // Success → cleanup
  await prisma.otp.delete({ where: { id: record.id } })

  return true
}


export const POST = async (req: Request) => {
  const body = await req.json();
     const parsed = VerifyEmailOrPhoneFormSchema.safeParse(body);
 
     if (!parsed.success) {
       return NextResponse.json(
         { message: "Invalid data", errors: parsed.error.message },
         { status: 400 }
     
       );
     }
 
     const { otp, emailOrPhone } = parsed.data;
 

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
        { status: 409 }
      )
    }
  try {

    if(existingUser?.status === "ACTIVE"){
        return NextResponse.json({ message: "Already verified" }, { status: 400 }); 
    }

    const isUserVerified = await verifyOtp(existingUser.id, otp)

    if(!isUserVerified) {
        return NextResponse.json({ message: "Unable to verify code" }, { status: 400 }); 
    }


    await prisma.user.update({
      where: { id: existingUser.id },
      data: { 
        status: "ACTIVE",
        verificationLink: null
     },
    });

    return NextResponse.json({message: `Verified successfully`}, {status: 200});
  } catch (err) {
    console.log("error in verify email and phoneendpoint", err)
    return NextResponse.json({ message: "Token expired or invalid", error: err }, { status: 400 });
  }
};
