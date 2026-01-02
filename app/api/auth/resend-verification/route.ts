import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/emails/mailer";
import { BASE_URL, createVerificationToken, normalizePhone } from "@/lib/globals";
import { UserWhereInput } from "@/lib/generated/prisma/models";
import { sendSmsOtp } from "@/lib/twilio";
import { createOtp } from "@/lib/helpers";
import z from "zod";

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification message
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
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification message sent
 *       400:
 *         description: Email not found or already verified
 */

export const POST = async (req: Request) => {
  try {
    let { emailOrPhone:gottenData } = await req.json();
   

    const isEmail = z.email().safeParse(gottenData).success
    const identifier = isEmail ? gottenData.toLocaleLowerCase() : gottenData
    const phone = !isEmail ? normalizePhone(gottenData) : null


    if (!isEmail && !phone) {
    return NextResponse.json(
        { message: "Invalid phone number format" },
        { status: 400 }
    )
    }


    let user = null

    if (isEmail) {
        user = await prisma.user.findUnique({
        where: { email: identifier },
        })

    } else {

        user = await prisma.user.findUnique({
        where: { phone: phone as string },
        })

    }

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.status === "ACTIVE") {
      return NextResponse.json({ message: "Account is already verified" }, { status: 400 });
    }


    const otp = await createOtp(user.id);
    const current_year = new Date().getFullYear()
    const name = `${user.firstName} ${user.lastName}`


    if (isEmail) {
      await sendEmail({
        to: user.email as string,
        subject: "You're In! Welcome to CBT 🎉",
        template: "signup-verification",
        data: {
          name: name,
          otp: otp,
          current_year
        },
      })
    } else if (phone) {
      await sendSmsOtp(phone, otp)
    }

    return NextResponse.json({ message: "Verification message sent" }, { status: 200 });

  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json({ message: "Something went wrong" , error: error}, { status: 500 });
  }
};
