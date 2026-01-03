
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/enums";
import { getCurrentUser } from "@/lib/getCurrentUser";

export async function checkRole(req: NextRequest, allowedRoles: UserRole[]) {
    const user = await getCurrentUser(req);
    if (!user) {
        return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    // @ts-ignore: Enum mismatch possible if types aren't perfect but runtime value is string
    if (!allowedRoles.includes(user.role)) {
        return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { authorized: true, user };
}
