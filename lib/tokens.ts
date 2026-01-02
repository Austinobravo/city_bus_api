import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET!

export const ACCESS_EXPIRES = "15m"
export const REFRESH_EXPIRES = "7d"

export function signAccessToken(userId: string) {
  return jwt.sign({ id: userId, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  })
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ id: userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  })
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { id: string; type: string }
}
