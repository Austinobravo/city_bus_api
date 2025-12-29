import prisma from "@/prisma/prisma"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import slug from "slug"

export const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu
export const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/



export const createVerificationToken = (email: string) => {
    const secret = process.env.JWT_SECRET!
    return jwt.sign({ email }, secret, { expiresIn: "1h" })
  }
export const validateForEmptySpaces = (value: string) => {
    return value.trim().length >= 1
}

export const formatDate = (date: number | string) => {
    const language = "en-US"
    const options:Intl.DateTimeFormatOptions = {weekday:"long",day: "2-digit", month: "short", year: "numeric"}
    return new Date(date).toLocaleDateString(language, options )
}

export const BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.API_URL;


export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function normalizePhone(phone: string) {
  if(!phone) return null

  let cleaned = phone.replace(/[^\d+]/g, "")

  if (cleaned.startsWith("0")) {
    cleaned = "+234" + cleaned.slice(1)
  }

  if (cleaned.startsWith("234")) {
    cleaned = "+" + cleaned
  }

  if (!cleaned.startsWith("+")) return null

  return cleaned
}
