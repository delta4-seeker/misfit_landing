import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { absoluteUrl } from "@/lib/utils";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: { default: "Misfit Founders Club", template: "%s — Misfit Founders Club" },
  description: "A high-trust club for founders who build from Nepal and think beyond every border.",
  icons: { icon: "/img/misfit-mark.png" },
  openGraph: {
    type: "website",
    siteName: "Misfit Founders Club",
    title: "Misfit Founders Club",
    description: "Meet the founders and products shaping Nepal's next chapter.",
    images: ["/img/misfit-mark.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
