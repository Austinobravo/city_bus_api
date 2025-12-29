// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// CORS origins for API routes only
const allowedOrigins = ["http://localhost:3000", "https://city-bus-api.vercel.app"];;

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    const headers = new Headers();

    // CORS
    const origin = req.headers.get("origin");
    if (origin && allowedOrigins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
    }
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization"
    );


    const res = NextResponse.next();
    headers.forEach((v, k) => res.headers.set(k, v));
    return res;
  }

 
  return NextResponse.next();
}

// Run on both API and page routes; skip static/assets/Next internals
export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next|static|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|css|js|map)).*)",
  ],
};
