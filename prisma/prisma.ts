import { PrismaClient } from "@/lib/generated/prisma/client"
import { withAccelerate } from '@prisma/extension-accelerate'


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    accelerateUrl: process.env.PRISMA_ACCELERATE_URL!,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
  // .$extends(withOptimize())
  // .$extends(withAccelerate())

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
