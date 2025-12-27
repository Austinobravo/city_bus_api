import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/prisma/prisma";
import { comparePassword } from "@/lib/utils";
import { emailRegex, emojiRegex, normalizePhone } from "@/lib/globals";
import { UserRole } from "@/lib/generated/prisma/enums";
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import FacebookProvider from "next-auth/providers/facebook"
import bcrypt from "bcryptjs";
import z from "zod";

export const options: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "email", placeholder: "Your email", type: "email" },
        password: { label: "password", placeholder: "Your Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) throw new Error("Invalid credentials");

        const email = credentials.email.toLowerCase();
        const password = credentials.password;

        if (email.trim().length <= 1 || password.trim().length <= 1) throw new Error("Invalid credentials");
        if (email.match(emojiRegex) || password.match(emojiRegex)) throw new Error("Invalid credentials");

        const isEmail = z.email().safeParse(email).success
        const phone = !isEmail ? normalizePhone(email) : null
        
        const user = await prisma.user.findFirst({
          where: { OR: [{ email }, { phone }] },
        });

        if (!user) throw new Error("Invalid credentials");
        if (user?.status !== "ACTIVE") throw new Error("Unverified account. Please contact support.");

        const isCorrectPassword = await comparePassword(password, user.passwordHash.trim());
        if (!isCorrectPassword) throw new Error("Invalid credentials");

        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      },
    }),

     GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),

    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
      token.id = (user as any).id;
      token.email = (user as any).email;

      const dbUser = await prisma.user.findUnique({
        where: { id: (user as any).id },
        select: { role: true },
      });

      token.role = dbUser?.role ?? "PASSENGER";
    }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        email: token.email as string,
        role: token.role as UserRole,
      };
      // Embed signed JWT for cross-domain use
      (session as any).accessToken = token
      return session;
    },
  
  async signIn({ user, account }) {
    if (!user.email) return false

    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    })

    if (!existing) {
          const hashedPassword = await bcrypt.hash(user.email, 10);
      
      await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: hashedPassword,
          firstName: user.name?.split(" ")[0] ?? "",
          lastName: user.name?.split(" ").slice(1).join(" ") ?? "",
          role: "PASSENGER",
          status: "ACTIVE",
          socialAuth: true,
        },
      })
    }

    return true
  }
}}
