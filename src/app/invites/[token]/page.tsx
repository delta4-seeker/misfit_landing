import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { acceptCofounderInvite } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Co-founder invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const [invite, session, query] = await Promise.all([
    prisma.coFounderInvite.findUnique({ where: { token }, include: { product: { include: { owner: true } } } }),
    auth(), searchParams,
  ]);
  if (!invite) notFound();
  const owner = invite.product.owner.fullName || invite.product.owner.name || invite.product.owner.email;
  const canAccept = invite.status === "PENDING" && invite.expiresAt > new Date();
  return (
    <section className="confirm-card section-shell">
      <span className="warning-mark">↗</span><h1>{invite.product.name}</h1>
      {query.error ? <p className="form-error">{query.error}</p> : canAccept ? <p>{owner} invited you to appear as a co-founder on this product.</p> : <p>This invitation is {invite.status.toLowerCase()}.</p>}
      {canAccept && <form action={acceptCofounderInvite.bind(null, token)}><button className="btn btn-lime" type="submit">{session?.user ? "Accept invitation" : "Sign in to accept"} ↗</button></form>}
    </section>
  );
}
