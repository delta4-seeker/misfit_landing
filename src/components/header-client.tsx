"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

import { ProfileAvatar } from "@/components/profile-avatar";

type Props = {
  authenticated: boolean;
  isAdmin: boolean;
  profileHref: string;
  profileImage: string | null;
};

export function HeaderClient({ authenticated, isAdmin, profileHref, profileImage }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

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
        <a href="https://luma.com/user/misfitfounders" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Events ↗</a>
      </nav>
      <div className="header-actions">
        {isAdmin && <Link className="admin-link" href="/admin">Admin</Link>}
        {authenticated ? (
          <Link className="profile-link" href={profileHref} aria-label="Open your profile">
            <ProfileAvatar className="profile-avatar" src={profileImage} alt="Your profile picture" />
          </Link>
        ) : <Link className="btn btn-dark btn-small" href="/join">Join Club</Link>}
      </div>
    </header>
  );
}
