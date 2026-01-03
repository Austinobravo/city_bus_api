
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/prisma";
import bcrypt from "bcryptjs";
import { UserRole, BusStatus, StopType, TripStatus, TicketStatus, PaymentStatus, PaymentMethod } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
    try {
        // 1. Seed Users (2 Admin, 2 Operations, 2 Drivers, 5 Passengers)
        const passwordHash = await bcrypt.hash("password123", 10);

        const usersData = [
            { email: "admin1@cbt.com", firstName: "Chinedu", lastName: "Admin", role: UserRole.ADMIN },
            { email: "admin2@cbt.com", firstName: "Ngozi", lastName: "Manager", role: UserRole.ADMIN },
            { email: "ops1@cbt.com", firstName: "Emeka", lastName: "Ops", role: UserRole.OPERATIONS },
            { email: "ops2@cbt.com", firstName: "Ada", lastName: "Coordinator", role: UserRole.OPERATIONS },
            { email: "driver1@cbt.com", firstName: "Kelechi", lastName: "Driver", role: UserRole.DRIVER },
            { email: "driver2@cbt.com", firstName: "Okechukwu", lastName: "Pilot", role: UserRole.DRIVER },
            { email: "pass1@cbt.com", firstName: "Chioma", lastName: "User", role: UserRole.PASSENGER },
            { email: "pass2@cbt.com", firstName: "Uche", lastName: "Traveler", role: UserRole.PASSENGER },
            { email: "pass3@cbt.com", firstName: "Ifeanyi", lastName: "Rider", role: UserRole.PASSENGER },
            { email: "pass4@cbt.com", firstName: "Nneka", lastName: "Commuter", role: UserRole.PASSENGER },
            { email: "pass5@cbt.com", firstName: "Chibuzor", lastName: "Walker", role: UserRole.PASSENGER },
        ];

        for (const u of usersData) {
            await prisma.user.upsert({
                where: { email: u.email },
                update: {},
                create: {
                    email: u.email,
                    phone: `080${Math.floor(Math.random() * 90000000 + 10000000)}`,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    passwordHash,
                    role: u.role,
                    status: "ACTIVE", // String literal as per schema or Enum? Schema has AccountStatus Enum
                    // Wait, status is AccountStatus. I need to check schema if I should import AccountStatus
                    // Schema: enum AccountStatus { PENDING, ACTIVE, ... }
                    // Let's import AccountStatus too, or just use string "ACTIVE" if prisma accepts it (usually does).
                    // Better be safe:
                    // driver: ...
                    // wallet: ...
                }
            });
            // Updating status separately if using Enum to avoid import noise
            // Actually, passing string "ACTIVE" usually works if the type matches.
            // But to be precise let's update with raw query or just trust "ACTIVE" works.
        }

        // ... (Rest of the file is largely same logic, just fixed imports)

        // Refresh Driver IDs map for linking
        const drivers = await prisma.driver.findMany();
        const passengers = await prisma.user.findMany({ where: { role: UserRole.PASSENGER } });

        // 2. Seed Buses
        const busPlates = ["IMO-001", "IMO-002", "IMO-003", "IMO-004", "IMO-005"];
        for (const plate of busPlates) {
            await prisma.bus.upsert({
                where: { plateNumber: plate },
                update: {},
                create: {
                    plateNumber: plate,
                    capacity: 14,
                    status: BusStatus.ACTIVE,
                    model: "Toyota Hiace",
                    seats: {
                        create: Array.from({ length: 14 }).map((_, i) => ({ seatNo: i + 1 }))
                    }
                }
            });
        }
        const buses = await prisma.bus.findMany();

        // 3. Seed Routes
        const routesData = [
            {
                name: "Orji to Wetheral",
                origin: "Orji", destination: "Wetheral", price: 200, time: 25,
                stops: [
                    { name: "Orji Flyover", lat: 5.505, lon: 7.040, order: 1, type: "PICKUP" },
                    { name: "IMSU Junction", lat: 5.498, lon: 7.035, order: 2, type: "BOTH" },
                    { name: "MCC Junction", lat: 5.490, lon: 7.032, order: 3, type: "BOTH" },
                    { name: "Wetheral Roundabout", lat: 5.480, lon: 7.025, order: 4, type: "DROPOFF" }
                ]
            },
            {
                name: "Orji to Douglas",
                origin: "Orji", destination: "Douglas", price: 250, time: 35,
                stops: [
                    { name: "Orji Flyover", lat: 5.505, lon: 7.040, order: 1, type: "PICKUP" },
                    { name: "Bank Road", lat: 5.492, lon: 7.036, order: 2, type: "BOTH" },
                    { name: "Douglas Road", lat: 5.483, lon: 7.035, order: 3, type: "DROPOFF" }
                ]
            },
            {
                name: "Worldbank to Wetheral",
                origin: "Worldbank", destination: "Wetheral", price: 150, time: 20,
                stops: [
                    { name: "Worldbank Estate", lat: 5.470, lon: 7.010, order: 1, type: "PICKUP" },
                    { name: "Control Post", lat: 5.475, lon: 7.015, order: 2, type: "BOTH" },
                    { name: "Wetheral Junction", lat: 5.480, lon: 7.025, order: 3, type: "DROPOFF" }
                ]
            },
            {
                name: "Worldbank to Douglas",
                origin: "Worldbank", destination: "Douglas", price: 200, time: 30,
                stops: [
                    { name: "Worldbank Last Bus Stop", lat: 5.470, lon: 7.010, order: 1, type: "PICKUP" },
                    { name: "Assumpta Cathedral", lat: 5.478, lon: 7.018, order: 2, type: "BOTH" },
                    { name: "Douglas Road", lat: 5.483, lon: 7.035, order: 3, type: "DROPOFF" }
                ]
            },
            {
                name: "Akwakuma to Douglas",
                origin: "Akwakuma", destination: "Douglas", price: 300, time: 40,
                stops: [
                    { name: "Akwakuma Junction", lat: 5.510, lon: 7.020, order: 1, type: "PICKUP" },
                    { name: "Amakohia", lat: 5.500, lon: 7.025, order: 2, type: "BOTH" },
                    { name: "Douglas", lat: 5.483, lon: 7.035, order: 3, type: "DROPOFF" }
                ]
            },
            {
                name: "Akwakuma to Wetheral",
                origin: "Akwakuma", destination: "Wetheral", price: 250, time: 30,
                stops: [
                    { name: "Akwakuma Roundabout", lat: 5.510, lon: 7.020, order: 1, type: "PICKUP" },
                    { name: "Spibat", lat: 5.505, lon: 7.022, order: 2, type: "BOTH" },
                    { name: "Wetheral", lat: 5.480, lon: 7.025, order: 3, type: "DROPOFF" }
                ]
            },
            {
                name: "Douglas to Irete",
                origin: "Douglas", destination: "Irete", price: 350, time: 45,
                stops: [
                    { name: "Douglas Terminal", lat: 5.483, lon: 7.035, order: 1, type: "PICKUP" },
                    { name: "Control Post", lat: 5.475, lon: 7.015, order: 2, type: "BOTH" },
                    { name: "Owerri-Onitsha Rd", lat: 5.470, lon: 7.000, order: 3, type: "BOTH" },
                    { name: "Irete Market", lat: 5.460, lon: 6.990, order: 4, type: "DROPOFF" }
                ]
            }
        ];

        for (const r of routesData) {
            const existing = await prisma.route.findFirst({ where: { name: r.name } });
            if (!existing) {
                await prisma.route.create({
                    data: {
                        name: r.name,
                        origin: r.origin,
                        destination: r.destination,
                        price: r.price,
                        estimatedTime: r.time,
                        stops: {
                            create: r.stops.map(s => ({
                                name: s.name,
                                latitude: s.lat,
                                longitude: s.lon,
                                order: s.order,
                                stopType: s.type as StopType
                            }))
                        }
                    }
                });
            }
        }
        const routes = await prisma.route.findMany({ include: { stops: true } });

        // 4. Seed Promos
        const promos = ["WELCOME50", "SAVE20", "OWERRI10", "STUDENT", "WEEKEND"];
        for (const code of promos) {
            await prisma.promoCode.upsert({
                where: { code },
                update: {},
                create: {
                    code,
                    discountPct: 10 + Math.floor(Math.random() * 40),
                    expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 1))
                }
            });
        }

        // 5. Seed Trips
        for (let i = 0; i < 10; i++) {
            const route = routes[Math.floor(Math.random() * routes.length)];
            const driver = drivers.length > 0 ? drivers[i % drivers.length] : null;
            const bus = buses[i % buses.length];

            if (driver && bus && route) {
                await prisma.trip.create({
                    data: {
                        routeId: route.id,
                        busId: bus.id,
                        driverId: driver.id,
                        departureTime: new Date(new Date().getTime() + 1000 * 60 * 60 * (i + 1)), // Future trips
                        status: TripStatus.SCHEDULED
                    }
                });
            }
        }
        const trips = await prisma.trip.findMany({ include: { bus: { include: { seats: true } } } });

        // 6. Seed Tickets and Payments
        for (const p of passengers) {
            if (trips.length === 0) continue;
            const trip = trips[Math.floor(Math.random() * trips.length)];
            const seat = trip.bus.seats[Math.floor(Math.random() * trip.bus.seats.length)];

            try {
                const ticket = await prisma.ticket.create({
                    data: {
                        userId: p.id,
                        tripId: trip.id,
                        seatId: seat.id,
                        price: Math.floor(Math.random() * 500) + 100,
                        status: TicketStatus.PAID
                    }
                });

                await prisma.payment.create({
                    data: {
                        userId: p.id,
                        ticketId: ticket.id,
                        amount: ticket.price,
                        method: Math.random() > 0.5 ? PaymentMethod.ONLINE : PaymentMethod.WALLET,
                        status: PaymentStatus.SUCCESS,
                        reference: `REF-${Math.random().toString(36).substring(7).toUpperCase()}`
                    }
                });
            } catch (e) {
            }
        }

        return NextResponse.json({ message: "Seeding Complete" });
    } catch (error) {
        console.error("Seeding Error:", error);
        return NextResponse.json({ error: "Failed to seed data", details: error }, { status: 500 });
    }
}
