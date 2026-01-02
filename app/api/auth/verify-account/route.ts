import { NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import { emojiRegex, normalizePhone, validateForEmptySpaces } from "@/lib/globals";
import z from "zod";
import bcrypt from "bcryptjs";
import { UserWhereInput } from "@/lib/generated/prisma/models";
import { verifyOtp } from "@/lib/helpers";


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
 * /api/auth/verify-account:
 *   post:
 *     summary: Verify an account
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
    const email = isEmail ? emailOrPhone.toLocaleLowerCase() : emailOrPhone
    const phone = !isEmail ? normalizePhone(emailOrPhone) : null
    
    
        if (!isEmail && !phone) {
        return NextResponse.json(
            { message: "Invalid phone number format" },
            { status: 400 }
        )
        }
      
      let existingUser = null
      
      // Check if user already exists
        if (isEmail) {
          existingUser = await prisma.user.findUnique({
            where: { email: email },
          })
    
        } else {
          const phone = normalizePhone(email)
    
          if (!phone) {
            return NextResponse.json({ error: "Invalid phone number" }, { status: 401 })
          }
    
          existingUser = await prisma.user.findUnique({
            where: { phone },
          })
    
        }

        if (!existingUser) {
          return NextResponse.json(
            { message: "User does not exists." },
            { status: 400 }
          );
        }
  try {

    if(existingUser.status === "ACTIVE"){
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
    console.log("Error in verify account endpoint", err)
    return NextResponse.json({ message: "Token expired or invalid", error: err }, { status: 400 });
  }
};
