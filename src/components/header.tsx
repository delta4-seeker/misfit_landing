import { auth } from "@/auth";
import { connection } from "next/server";
import { HeaderClient } from "@/components/header-client";
import { getSiteSettings } from "@/lib/data";
import { DEFAULT_LUMA_CALENDAR_URL } from "@/lib/luma";
import { founderSlug } from "@/lib/utils";

export async function Header() {
  await connection();
  const [session, settings] = await Promise.all([auth(), getSiteSettings()]);
  const user = session?.user;
  const name = user?.fullName || user?.name || user?.email?.split("@")[0] || "founder";
  const profileHref = !user
    ? "/join"
    : user.status === "ACTIVE" && user.profileCompleted
      ? `/founders/${founderSlug(name, user.id)}`
      : "/profile";
  return (
    <HeaderClient
      authenticated={Boolean(user)}
      isAdmin={Boolean(user?.status === "ACTIVE" && user?.isAdmin)}
      profileHref={profileHref}
      profileImage={user?.profilePicture || user?.image || null}
      lumaCalendarUrl={settings?.lumaCalendarUrl || DEFAULT_LUMA_CALENDAR_URL}
    />
  );
}
