import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/prisma/prisma";

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Email verification
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token for verification
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

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) return NextResponse.json({ message: "Invalid token" }, { status: 400 });

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET!) as { email: string };

    const isUserVerified = await prisma.user.findUnique({
        where:{email}
    })

    if(!isUserVerified){
        return NextResponse.json({ message: "Wrong data." }, { status: 400 }); 
    }

    if(isUserVerified?.status === "ACTIVE"){
        return NextResponse.json({ message: "Already verified" }, { status: 400 }); 
    }

     await prisma.user.update({
          where: { id: isUserVerified.id },
          data: { 
            status: "ACTIVE",
            verificationLink: null
         },
        });

    return NextResponse.json({message: `Verified successfully`}, {status: 200});
  } catch (err) {
    console.log("error in verify email endpoint", err)
    return NextResponse.json({ message: "Token expired or invalid", error: err }, { status: 400 });
  }
};
