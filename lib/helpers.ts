import prisma from "@/prisma/prisma"
import bcrypt from "bcryptjs"


const OTP_EXPIRY_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 60
const MAX_OTP_ATTEMPTS = 5

export async function createOtp(userId: string) {
  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = await bcrypt.hash(rawOtp, 10)

  await prisma.otp.create({
    data: {
      userId,
      codeHash: hash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      lastSentAt: new Date(),
    },
  })

  return rawOtp
}


export async function canResendOtp(userId: string) {
  const otp = await prisma.otp.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) return true

  const diffSeconds =
    (Date.now() - otp.lastSentAt.getTime()) / 1000

  if (diffSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
    throw new Error(
      `Please wait ${Math.ceil(
        OTP_RESEND_COOLDOWN_SECONDS - diffSeconds
      )} seconds before requesting another OTP`
    )
  }

  return true
}


export async function checkRateLimit(ip: string) {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

  const count = await prisma.auditLog.count({
    where: {
      action: "LOGIN",
      metadata: {
        path: ["ip"],
        equals: ip,
      },
      createdAt: { gte: oneMinuteAgo },
    },
  })

  if (count >= 10) {
    throw new Error("Too many requests, slow down")
  }
}

export async function verifyOtp(userId: string, otp: string) {
  const record = await prisma.otp.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })


  if (!record) throw new Error("OTP not found")

  if (record.expiresAt < new Date()) {
    throw new Error("OTP expired")
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many attempts. Request a new OTP.")
  }

  const isValid = await bcrypt.compare(otp, record.codeHash)

  await prisma.otp.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  })

  if (!isValid) throw new Error("Invalid OTP")


  // Success → cleanup: Delete that otp.
  await prisma.otp.delete({ where: { id: record.id } })

  return true
}
