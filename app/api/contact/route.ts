import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ContactSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.email("Invalid email").trim(),
    subject: z.string().trim().min(1, "Subject is required"),
    message: z.string().trim().min(1, "Message is required"),
});

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact form
 *     tags:
 *       - General
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = ContactSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: "Invalid data", errors: parsed.error.flatten() }, { status: 400 });
        }

        const { name, email, subject, message } = parsed.data;

        await prisma.contactUs.create({
            data: { name, email, subject, message }
        });

        // Optionally send email to admin?
        // Not requested, but good practice.
        // I'll leave it as DB storage only for now.

        return NextResponse.json({ message: "Message sent successfully" }, { status: 201 });
    } catch (error: any) {
        console.error("Contact Form Error:", error);
        return NextResponse.json({ message: "Something went wrong", error: error.message }, { status: 500 });
    }
}
