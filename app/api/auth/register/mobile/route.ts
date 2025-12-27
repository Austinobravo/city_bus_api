import { sendEmail } from "@/emails/mailer";
import { UserWhereInput } from "@/lib/generated/prisma/models";
import { emojiRegex, normalizePhone } from "@/lib/globals";
import {
  validateForEmptySpaces,
} from "@/lib/globals";
import { createOtp } from "@/lib/helpers";
import { sendSmsOtp } from "@/lib/twilio";
import prisma from "@/prisma/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import z from "zod";

// User creation schema
const CreateUserSchema = z
   .object({
      firstName: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      lastName: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      emailOrPhone: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      confirmPassword: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      password: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      callbackUrl: z
        .string()
        .min(1, { message: "This field is mandatory" })
        .refine((value) => !value || validateForEmptySpaces(value), {
          message: "No empty spaces",
        })
        .refine((value) => !value.match(emojiRegex), {
          message: "No emoji's alllowed.",
        }),
      // role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]).optional(),
    })
    .refine((data) => data.confirmPassword === data.password, {
      message: "Password don't match",
      path: ["confirmPassword"],
    });


/**
 * @swagger
 * /api/auth/register/mobile:
 *   post:
 *     summary: Create a new user on the mobile
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
 *               - password
 *               - username
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: User created successfully, Please verify your email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 emailOrPhone:
 *                   type: string
 *       400:
 *         description: Invalid request
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid data", errors: parsed.error.message },
        { status: 400 }
    
      );
    }

    const { firstName, lastName, password, emailOrPhone } = parsed.data;


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

    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
        const user = await prisma.user.create({
      data: {
        email: isEmail ? emailOrPhone : null,
        phone,
        firstName,
        lastName,
        passwordHash: hashedPassword,
        role: "PASSENGER",
      },
      select: { id: true, firstName: true },
    })



    const otp = await createOtp(user.id);

    if (isEmail) {
      await sendEmail({
        to: emailOrPhone,
        subject: "Verify your account",
        template: "pin-otp",
        data: {
          name: `${firstName} ${lastName}`,
          otp_code: otp,
        },
      })
    } else if (phone) {
      await sendSmsOtp(phone, otp)
    }

    return NextResponse.json(
      {
        data: user,
        message: `User created successfully, Please verify your ${isEmail ? "email" : "number"}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({message: "Internal Server Error", error: error }, { status: 500 });
  }
  
}
