import { sendEmail } from "@/emails/mailer";
import { getCurrentUser } from "@/lib/getCurrentUser";
import prisma from "@/prisma/prisma";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import { format } from "date-fns"

/**
 * @swagger
 * /api/trips/{id}/save:
 *   post:
 *     summary: Save trip
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trip saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserTrip'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message
 */


// const SaveTripSchema = z.object({
//     tripId: z.string().min(1, {error: "Trip ID is required"}),
// })



export async function POST(req:NextRequest, {params}: {params: Promise<{id:string}>}){
    const id = (await params).id
    const body = await req.json()
    const user = await getCurrentUser(req)
    if(!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // const { tripId } = SaveTripSchema.parse(body)
    // if(!tripId) return NextResponse.json({ message: "Trip ID is required" }, { status: 400 });

    const existingTrip = await prisma.userTrip.findUnique({
        where: {
            tripId_userId: {
                tripId: id,
                userId: user.id
            }
        }
    })
    if(existingTrip) return NextResponse.json({ message: "Trip already saved" }, { status: 400 });

    try {
        const userTrip = await prisma.userTrip.create({
            data: {
                tripId: id,
                userId: user.id
            },
            include: {
                trip: {
                    include: {
                        route: true
                    }
                },
            }
        })
        try{
            if(user.email){
                await sendEmail({
                to: user.email,
                subject: "Trip saved successfully",
                template: "trip-saved",
                data: { 
                    name: `${user.firstName} ${user.lastName}`,
                    to: userTrip.trip.route.destination,
                    from: userTrip.trip.route.origin,
                    trip_date: format(userTrip.trip.createdAt, "dd, MMMM yyyy"),
                    departure_time: format(userTrip.trip.departureTime, "dd, MMMM yyyy hh:mm a"),
                    booking_reference: userTrip.id,
                    arrival_buffer_minutes: 30,
                    trip_details_url: `https://citybustransit.com/plan-journey/${userTrip.trip.id}`, 
                    year: new Date().getFullYear()
                },
                });
            }

        }catch(error){}
        return NextResponse.json(userTrip)
    } catch (error) {
        console.error("UserTrip POST Error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}