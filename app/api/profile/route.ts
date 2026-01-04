import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";



// User update schema
const UpdateUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
  lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().trim().optional(),
  houseAddress: z.string().trim().optional(),
  workAddress: z.string().trim().optional(),
  // role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]).optional(),
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: My profile
 *     tags:
 *       - User
 *     responses:
 *       200:
 *         description: My profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 type: object
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const foundUser = await prisma.user.findUnique({
    where: { id: user?.id },
    omit: {
      passwordHash: true,
      verificationLink: true,
      isDeleted: true,
      deletedAt: true,
      otpEnabled: true,
      socialAuth: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  return NextResponse.json(foundUser);
}



/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Update my account
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               houseAddress:
 *                 type: string
 *               workAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { firstName, lastName, phone, password, houseAddress, workAddress } = parsed.data;

    let updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    // if (role) updateData.role = role;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (houseAddress) updateData.houseAddress = houseAddress;
    if (workAddress) updateData.workAddress = workAddress;

    const updatedUser = await prisma.user.update({
      where: { email: user.email as string },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        houseAddress: true,
        workAddress: true,
      },

    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ data: error, message: "Something went wrong." }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/profile:
 *   delete:
 *     summary: Delete my account
 *     tags:
 *       - User
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await prisma.user.delete({
      where: { email: user.email as string },
    });

    return NextResponse.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ data: error, message: "Something went wrong." }, { status: 500 });
  }
}