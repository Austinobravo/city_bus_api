import { NextRequest, NextResponse } from "next/server";

import { BASE_URL, emojiRegex, normalizePhone } from "@/lib/globals";
import prisma from "@/prisma/prisma";

import { signAccessToken, signRefreshToken } from "@/lib/tokens";
import z from "zod";
import { comparePassword } from "@/lib/utils";
import { UserWhereUniqueInput } from "@/lib/generated/prisma/models";


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
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
 *               password:
 *                 type: string
 *     responses:
 *       401:
 *         description: Invalid credentials.
 *       200:
 *         description: Login Successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 */
export async function POST(req: NextRequest) {
  const { emailOrPhone, password } = await req.json()


  const identifier = emailOrPhone.trim().toLowerCase()

  if (identifier.trim().length <= 1 || password.trim().length <= 1)  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  if (identifier.match(emojiRegex) || password.match(emojiRegex))  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      
  const isEmail = z.email().safeParse(identifier).success

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

  // const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

   if (user?.status !== "ACTIVE")  return NextResponse.json({ error: "Unverified account. Please contact support." }, { status: 401 })

  
  const isCorrectPassword = await comparePassword(password, user.passwordHash.trim());
  if (!isCorrectPassword) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  

  // const valid = await bcrypt.compare(password, user.passwordHash)
  if (!isCorrectPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  try{

    const accessToken = signAccessToken(user.id)
    const refreshToken = signRefreshToken(user.id)
  
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
    })
  
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
    })
  
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        method: "CREDENTIALS",
        ip: req.headers.get("x-forwarded-for") ?? "unknown",
        userAgent: req.headers.get("user-agent") ?? "unknown",
      },
    })
  
     return NextResponse.json({
        message: "Login Successful",
        accessToken,
        refreshToken
      });
  }catch(error:any){
    console.error("Error Login:", error)
    return NextResponse.json({ message: "Something went wrong" , error: error}, { status: 500 });
  }

}

