import { sendEmail } from "@/emails/mailer";
import { emojiRegex, normalizePhone } from "@/lib/globals";

import {
  BASE_URL,
  createVerificationToken,
  validateForEmptySpaces,
} from "@/lib/globals";
import { createOtp } from "@/lib/helpers";
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
      .optional()
      .refine((value) => !value || validateForEmptySpaces(value), {
        message: "No empty spaces",
      })
      .refine((val) => !val || /^\d+(\.\d{1,2})?$/.test(val), {
        message: "Phone must be a valid number",
      })
      .refine((value) => !value || !value.match(emojiRegex), {
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
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
 *                 lastName:
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

    const { email:gottenEmail, firstName, lastName, password, phone:gottenPhone } = parsed.data;


    const phone = gottenPhone ? normalizePhone(gottenPhone as string) : null
    const email = gottenEmail.toLocaleLowerCase()
   
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
        phone,
        passwordHash: hashedPassword,
        role: "PASSENGER"
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    const otp = await createOtp(user.id);
    const current_year = new Date().getFullYear()
    const name = `${firstName} ${lastName}`


    await sendEmail({
      to: email,
      subject: "You're In! Welcome to CBT 🎉",
      template: "signup-verification",
      data: { 
        name,
        otp, 
        current_year 
      },
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
