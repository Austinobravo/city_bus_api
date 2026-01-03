// /app/api/auth/social/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";
import { signAccessToken, signRefreshToken } from "@/lib/tokens";
import { sendEmail } from "@/emails/mailer";

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;
const JWT_EXPIRES_IN = "1h"; // access token
const REFRESH_EXPIRES_IN = "7d"; // refresh token

type SocialProvider = "google" | "apple" | "facebook";

interface SocialLoginBody {
  provider: SocialProvider;
  token: string;
  email?: string;
}

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

async function verifyGoogleToken(idToken: string) {
  const googleResp = await axios.get(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  return googleResp.data; // contains email, name, sub
}

async function verifyAppleToken(identityToken: string) {
  // Apple token verification: you may need a library like 'apple-signin-auth'
  const apple = await import("apple-signin-auth");
  const appleResp = await apple.verifyIdToken(identityToken, {
    audience: process.env.APPLE_CLIENT_ID!,
  });
  return appleResp; // contains email, sub
}

async function verifyFacebookToken(accessToken: string) {
  const fbResp = await axios.get(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
  );
  return fbResp.data; // id, name, email
}



/**
 * @swagger
 * /api/auth/social:
 *   post:
 *     summary: Authenticate a user using socials. Providers are google, facebook, apple
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, apple]
 * 
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
  try {
    const body: SocialLoginBody = await req.json();
    const { provider, token, email: optionalEmail } = body;

    if (!provider || !token) {
      return NextResponse.json({ error: "Missing provider or token" }, { status: 400 });
    }

    let socialUser: { email?: string; name?: string; sub: string };
    switch (provider) {
      case "google":
        socialUser = await verifyGoogleToken(token);
        break;
      case "apple":
        socialUser = await verifyAppleToken(token);
        break;
      case "facebook":
        socialUser = await verifyFacebookToken(token);
        break;
      default:
        return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    if (!socialUser.email && !optionalEmail) {
      return NextResponse.json({ error: "Email not provided by social login" }, { status: 400 });
    }

    const email = (socialUser.email || optionalEmail!).toLocaleLowerCase();
    const name = socialUser.name || email.split("@")[0];

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    // Account linking: if user exists, mark socialAuth true
    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(email + Date.now(), 10); // dummy password
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" "),
          role: "PASSENGER",
          status: "ACTIVE",
          socialAuth: true,
        },
      });
    } else if (!user.socialAuth) {
      // Link social account to existing email/password user
      await prisma.user.update({
        where: { id: user.id },
        data: { socialAuth: true },
      });
    }

    // Generate access + refresh tokens
    // const { accessToken, refreshToken } = generateTokens(user.id);
    const accessToken = signAccessToken(user.id)
    const refreshToken = signRefreshToken(user.id)

    // Save refresh token in DB
    // await prisma.refreshToken.create({
    //   data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    // });
    
    await prisma.refreshToken.create({
        data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 864e5),
        },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: provider,
        action: "LOGIN",
        method: "SOCIAL",
        ip: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
      },
    });

        try{
          if(user.email){
            await sendEmail({
              to: user.email,
              subject: "Login Notification",
              template: "signin",
              data: { 
                name: `${user.firstName} ${user.lastName}`,
                contact_url: `https://citybustransit.com/contact`, 
                year: new Date().getFullYear()
              },
            });
          }
    
        }catch(error){
          console.log("error in sending email", error)
        }

    return NextResponse.json({
      message: "Login Successful",
      accessToken,
      refreshToken
    });
  } catch (err: any) {
    console.error("Social login error:", err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data || err.message },
      { status: 500 }
    );
  }
}
