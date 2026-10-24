import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { unsubscribeNewsletter } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!subscriber) notFound();
  return <section className="confirm-card section-shell"><span className="warning-mark">✉</span><h1>Leave the list?</h1><p>Unsubscribe {subscriber.email} from Misfit Founders Club updates.</p><form action={unsubscribeNewsletter.bind(null, token)}><button className="btn btn-dark" type="submit">Unsubscribe</button></form></section>;
}
