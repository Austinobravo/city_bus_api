
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string | null;
      firstName: string;
      lastName: string;
      role: string
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    email: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    role: string

  }
}
