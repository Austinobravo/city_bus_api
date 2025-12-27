import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

function mergeCookies(existing: string[] = [], incoming: string[] = []) {
  return [...existing, ...incoming].join("; ");
}

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailOrPhone
 *               - password
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       401:
 *         description: Invalid credentials.
 *       200:
 *         description: Login Successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { emailOrPhone, password } = body;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;

    // Step 1: CSRF
    const csrfRes = await axios.get(`${baseUrl}/api/auth/csrf`, {
      withCredentials: true,
    });
    const csrfToken = csrfRes.data?.csrfToken;
    const csrfCookies = csrfRes.headers["set-cookie"] ?? [];

    if (!csrfToken) {
      return NextResponse.json({ error: "Unable to get CSRF token" }, { status: 400 });
    }

    // Step 2: Login
    const loginRes = await axios.post(
      `${baseUrl}/api/auth/callback/credentials`,
      new URLSearchParams({
        csrfToken,
        email: emailOrPhone.trim(),
        password: password.trim(),
        callbackUrl: "/",
        json: "true",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: csrfCookies.join(";"),
        },
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
      }
    );

    const loginCookies = loginRes.headers["set-cookie"] ?? [];
    const combinedCookies = mergeCookies(csrfCookies, loginCookies);

    // Step 3: Fetch session
    const sessionRes = await axios.get(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: combinedCookies },
    });

    const session = sessionRes.data;

    if (!session?.user) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Step 4: Return session and set cookies locally
    const res = NextResponse.json({ success: true, session });

    [...csrfCookies, ...loginCookies].forEach((cookie) => {
      res.headers.append("Set-Cookie", cookie);
    });

    return res;
  } catch (err: any) {
    console.error(" login error:", err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data || err.message },
      { status: 500 }
    );
  }
}
