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
 *               - emailOrPhone
 *               - password
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully, Please verify your email or number.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
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
        { message: "Invalid data", errors: parsed.error.message },
        { status: 400 }
    
      );
    }

    const { firstName, lastName, password, emailOrPhone:gottenData } = parsed.data;


     const isEmail = z.email().safeParse(gottenData).success
    const emailOrPhone = isEmail ? gottenData.toLocaleLowerCase() : gottenData
    const phone = !isEmail ? normalizePhone(gottenData) : null
    
    
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
            where: { email: emailOrPhone },
          })
    
        } else {
          const phone = normalizePhone(emailOrPhone)
    
          if (!phone) {
            return NextResponse.json({ error: "Invalid phone number" }, { status: 401 })
          }
    
          existingUser = await prisma.user.findUnique({
            where: { phone },
          })
    
        }
    

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
      select: { id: true, firstName: true, lastName: true, role: true },
    })



    const otp = await createOtp(user.id);
    const current_year = new Date().getFullYear()
    const name = `${firstName} ${lastName}`


    if (isEmail) {
      await sendEmail({
        to: emailOrPhone,
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
