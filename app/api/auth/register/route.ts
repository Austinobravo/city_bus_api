import { sendEmail } from "@/emails/mailer";
import { emojiRegex } from "@/lib/globals";

import {
  BASE_URL,
  createVerificationToken,
  validateForEmptySpaces,
} from "@/lib/globals";
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
    phone: z
      .string()
      .refine((value) => !value || validateForEmptySpaces(value), {
        message: "No empty spaces",
      })
      .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
        message: "Phone must be a valid number",
      })
      .refine((value) => !value.match(emojiRegex), {
        message: "No emoji's alllowed.",
      }),
    email: z
      .email({ message: "Invalid email" })
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
 * /api/auth/register:
 *   post:
 *     summary: Create a new user
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
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               callbackUrl:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
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
 *                 email:
 *                   type: string
 *                 firstName:
 *                   type: string
 *                 role:
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
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
    
      );
    }

    const { email, firstName, lastName, password, callbackUrl, phone } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where:{
          OR: [
          {
              email: email
          },
          {
              phone: phone
          }
          ]
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash: hashedPassword,
        role: "PASSENGER"
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        // role: true,
      },
    });

    const token = createVerificationToken(email);
    const VERIFICATION_LINK = `${callbackUrl}?token=${token}`;

    await prisma.user.update({
      where: { id: user?.id },
      data: { verificationLink: VERIFICATION_LINK },
    });


    const current_year = new Date().getFullYear()

    await sendEmail({
      to: email,
      subject: "You're In! Welcome to CBT 🎉",
      template: "signup-verification",
      data: { VERIFICATION_LINK, current_year },
    });

    return NextResponse.json(
      {
        data: user,
        message: "User created successfully, Please verify your email.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({message: "Internal Server Error", error: error }, { status: 500 });
  }
  
}
