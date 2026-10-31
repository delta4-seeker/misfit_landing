"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

import { ProfileAvatar } from "@/components/profile-avatar";

type Props = {
  authenticated: boolean;
  isAdmin: boolean;
  profileImage: string | null;
  lumaCalendarUrl: string;
};

type SessionResponse = {
  user?: {
    image?: string | null;
    profilePicture?: string | null;
    status?: string;
    isAdmin?: boolean;
  };
};

export function HeaderClient({ authenticated: initialAuthenticated, isAdmin: initialIsAdmin, profileImage: initialProfileImage, lumaCalendarUrl }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState({ authenticated: initialAuthenticated, isAdmin: initialIsAdmin, profileImage: initialProfileImage });

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshAccount = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
          const session = response.ok ? await response.json() as SessionResponse : null;
          if (!active) return;
          const user = session?.user;
          if (user) {
            setAccount({
              authenticated: true,
              isAdmin: Boolean(user.status === "ACTIVE" && user.isAdmin),
              profileImage: user.profilePicture || user.image || null,
            });
            return;
          }
        } catch {
          // A second attempt below handles short database-pooler interruptions.
        }
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (active && !initialAuthenticated) setAccount({ authenticated: false, isAdmin: false, profileImage: null });
    };
    void refreshAccount();
    return () => { active = false; };
  }, [initialAuthenticated, pathname]);

  const links = [
    ["/products", "Products"],
    ["/gallery", "Gallery"],
    ["/blog", "Blog"],
  ] as const;

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <Link className="brand" href="/" aria-label="Misfit Founders Club home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/misfit-mark.png" alt="" width="46" height="46" />
        <span>Misfit<span className="brand-hide"> Founders Club</span></span>
      </Link>
      <button
        className="menu-toggle"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      ><span /><span /></button>
      <nav className={`site-nav${open ? " open" : ""}`} aria-label="Main navigation">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
            onClick={() => setOpen(false)}
          >{label}</Link>
        ))}
        <a href={lumaCalendarUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Events ↗</a>
      </nav>
      <div className="header-actions">
        {account.isAdmin && <Link className="admin-link" href="/admin">Admin</Link>}
        {account.authenticated ? (
          <Link className="profile-link" href="/profile" aria-label="Open your account">
            <ProfileAvatar className="profile-avatar" src={account.profileImage} alt="Your profile picture" />
          </Link>
        ) : <Link className="btn btn-dark btn-small" href="/join">Join Club</Link>}
      </div>
    </header>
  );
}
