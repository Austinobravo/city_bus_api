import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { options } from "@/app/api/auth/[...nextauth]/options";
import { NextRequest } from "next/server";
import { Session } from "next-auth";
import prisma from "@/prisma/prisma";
import jwt from "jsonwebtoken";
import { User } from "./generated/prisma/client";

export const getCurrentUser = async (req?: NextRequest): Promise<User | null> => {
  try {
    // 1 Try getServerSession first
    const session = await getServerSession(options);
    if (session?.user?.id) {
      return session.user as User;
    }

    if(req){   
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      if (token?.id) {
        return await prisma.user.findUnique({
          where: { id: token.id as string },
        });
      }
    
      // No cookie session found — maybe a Bearer token
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const bearerToken = authHeader.split(" ")[1];
        const decoded = jwt.verify(bearerToken, process.env.NEXTAUTH_SECRET!) as unknown as { id: string };
        if (decoded?.id) {
          return await prisma.user.findUnique({
            where: { id: decoded.id as string },
          });
        }
      }

    }


    // Not authenticated
    return null;

  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
};

export const getCurrentSession = async (req?: NextRequest): Promise<Session | null> => {
  try {
    // 1 Try getServerSession first
    const session = await getServerSession(options);
    if (session?.user?.id) {
      return session;
    }

    // Not authenticated
    return null;

  } catch (error) {
    console.error("Error in getCurrentSession:", error);
    return null;
  }
};
