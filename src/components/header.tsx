import { auth } from "@/auth";
import { connection } from "next/server";
import { HeaderClient } from "@/components/header-client";
import { getSiteSettings } from "@/lib/data";
import { DEFAULT_LUMA_CALENDAR_URL } from "@/lib/luma";

export async function Header() {
  await connection();
  const [session, settings] = await Promise.all([auth(), getSiteSettings()]);
  const user = session?.user;
  return (
    <HeaderClient
      authenticated={Boolean(user)}
      isAdmin={Boolean(user?.status === "ACTIVE" && user?.isAdmin)}
      profileImage={user?.profilePicture || user?.image || null}
      lumaCalendarUrl={settings?.lumaCalendarUrl || DEFAULT_LUMA_CALENDAR_URL}
    />
  );
}
