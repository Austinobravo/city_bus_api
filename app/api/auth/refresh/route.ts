import { NextRequest, NextResponse } from "next/server"
import prisma from "@/prisma/prisma"
import { verifyToken, signAccessToken, signRefreshToken } from "@/lib/tokens"


/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh a token to get the new access token
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
 *         description: Token refreshed successfully.
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
  const { refreshToken } = await req.json()

  const payload = verifyToken(refreshToken)
  if (payload.type !== "refresh") {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  })

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token revoked. Please log in again." }, { status: 401 })
  }

  // Rotate
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  })

  try{
      const newAccess = signAccessToken(payload.id)
      const newRefresh = signRefreshToken(payload.id)
    
      await prisma.refreshToken.create({
        data: {
          token: newRefresh,
          userId: payload.id,
          expiresAt: new Date(Date.now() + 7 * 864e5),
        },
      })
    
      return NextResponse.json({
        message: "Token refreshed successfully",
        accessToken: newAccess,
        refreshToken: newRefresh,
      })

  }catch(error){
    console.error("Error refreshing token:", error);
    return NextResponse.json({ message: "Something went wrong" , error: error}, { status: 500 });

  }

}
