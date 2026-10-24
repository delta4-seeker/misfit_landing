import { auth } from "@/auth";
import { HeaderClient } from "@/components/header-client";
import { founderSlug } from "@/lib/utils";

export async function Header() {
  const session = await auth();
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
    />
  );
}
