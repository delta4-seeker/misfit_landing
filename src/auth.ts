import { PrismaAdapter } from "@auth/prisma-adapter";
import type { User as DatabaseUser } from "@prisma/client";
import { cookies } from "next/headers";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { profileCompletion } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET || process.env.SECRET_KEY,
  trustHost: true,
  session: { strategy: "database" },
  pages: { signIn: "/join" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      const googleProfile = profile as { email_verified?: boolean; name?: string; picture?: string } | undefined;
      if (!email || googleProfile?.email_verified !== true) return false;
      const blocked = await prisma.blockedEmail.findUnique({ where: { email } });
      if (blocked) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && (!existing.fullName || !existing.profilePicture)) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: existing.fullName || googleProfile?.name,
            profilePicture: existing.profilePicture || googleProfile?.picture,
          },
        });
      }
      return !existing || existing.status === "ACTIVE";
    },
    async session({ session, user }) {
      // The database-session adapter has already loaded this user for the request.
      const appUser = user as DatabaseUser;
      session.user.id = user.id;
      session.user.fullName = appUser.fullName;
      session.user.profilePicture = appUser.profilePicture || appUser.image;
      session.user.profileCompleted = profileCompletion(appUser).complete;
      session.user.status = appUser.status;
      session.user.isAdmin = appUser.isAdmin;
      session.user.isSuperAdmin = appUser.isSuperAdmin;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const adminEmail = process.env.SEED_ADMIN_EMAIL || process.env.FIRST_ADMIN_EMAIL;
      await prisma.user.update({
        where: { id: user.id! },
        data: {
          fullName: user.name || undefined,
          profilePicture: user.image || undefined,
          isAdmin: user.email?.toLowerCase() === adminEmail?.toLowerCase(),
          isSuperAdmin: user.email?.toLowerCase() === adminEmail?.toLowerCase(),
        },
      });
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

const sessionCookieNames = ["authjs.session-token", "__Secure-authjs.session-token"];

export async function auth() {
  const session = await nextAuth.auth();
  if (session?.user) return session;

  // Auth.js returns a logged-out response when a transient database-session
  // lookup fails. If the browser still has a session cookie, retry once rather
  // than bouncing an authenticated member through /join.
  const cookieStore = await cookies();
  if (!sessionCookieNames.some((name) => cookieStore.has(name))) return session;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return nextAuth.auth();
}
