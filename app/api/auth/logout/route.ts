import { NextRequest, NextResponse } from "next/server"
import prisma from "@/prisma/prisma"

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout the user.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       401:
 *         description: Invalid token.
 *       200:
 *         description: Logged out successfully.
 */
export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json()

  try{
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      })
    
      return NextResponse.json({ message: "Logged out successfully" })

  }catch(error:any){
    console.error("Error Logout:", error);
    return NextResponse.json({ message: "Something went wrong" , error: error}, { status: 500 });
  }

}
