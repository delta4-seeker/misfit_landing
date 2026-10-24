import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      fullName?: string | null;
      profilePicture?: string | null;
      profileCompleted: boolean;
      status: "ACTIVE" | "SUSPENDED" | "BANNED";
      isAdmin: boolean;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }
}
