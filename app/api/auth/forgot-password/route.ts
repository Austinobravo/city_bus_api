import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { sendEmail } from "@/emails/mailer";
import { BASE_URL, createVerificationToken, normalizePhone } from "@/lib/globals";
import { createOtp } from "@/lib/helpers";
import z from "zod";
import { UserWhereInput } from "@/lib/generated/prisma/models";
import { sendSmsOtp } from "@/lib/twilio";

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
 *               - emailOrPhone
 *             properties:
 *               emailOrPhone:
 *                 type: string
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
  //   await rateLimit(req);

  // if (!email) {
  //   return NextResponse.json({ message: "Email is required" }, { status: 400 });
  // }

    let user = null

    if (isEmail) {
      user = await prisma.user.findUnique({
        where: { email: identifier },
      })

    } else {
      const phone = normalizePhone(identifier)

      if (!phone) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 401 })
      }

      user = await prisma.user.findUnique({
        where: { phone },
      })

    }

  if (!user) {
    return NextResponse.json(
      { message: "If this email exists, a reset link has been sent" },
      { status: 200 }
    );
  }

  const otp = await createOtp(user.id);
  const current_year = new Date().getFullYear()

  if(isEmail){
    await sendEmail({
      to: user.email as string,
      subject: "Reset Your Password!",
      template: "forgot-password",
      data: {
        otp,
        current_year,
      },
    });
  }else{
    await sendSmsOtp(user.phone as string, otp)
  }
  

  return NextResponse.json({
    message: "If this email exists, a reset link has been sent",
  });
}
