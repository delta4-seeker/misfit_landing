"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { auth, signIn, signOut } from "@/auth";
import { databaseIsConfigured } from "@/lib/database-url";
import { incompleteProfileMessage, profileCompletion } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/storage";
import { founderSlug, slugify } from "@/lib/utils";
import { instagramHandleSchema, secureExternalUrlSchema } from "@/lib/validation";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export async function googleSignIn() {
  if (!databaseIsConfigured()) {
    redirect("/join?error=database");
  }
  await signIn("google", { redirectTo: "/profile" });
}

export async function logOut() {
  await signOut({ redirectTo: "/" });
}

async function requireActiveMember(nextPath: string) {
  const session = await auth();
  if (!session?.user) redirect(`/join?next=${encodeURIComponent(nextPath)}`);
  if (session.user.status !== "ACTIVE") throw new Error("Your account is not active.");
  return session.user;
}

async function liveProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, slug: true, status: true } });
  if (!product || product.status !== "LIVE") throw new Error("Product not found.");
  return product;
}

export async function toggleProductVote(slug: string) {
  const user = await requireActiveMember(`/products/${slug}`);
  if (!await consumeRateLimit("product-vote", user.id, 30, MINUTE)) return;
  const product = await liveProductBySlug(slug);
  const key = { productId_userId: { productId: product.id, userId: user.id } };
  const existing = await prisma.productVote.findUnique({ where: key, select: { userId: true } });
  if (existing) {
    await prisma.productVote.delete({ where: key });
  } else {
    await prisma.productVote.create({ data: { productId: product.id, userId: user.id } });
  }
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/");
}

const commentSchema = z.string().trim().min(2, "Write at least 2 characters.").max(500, "Keep comments under 500 characters.");

export async function createProductComment(slug: string, formData: FormData) {
  const user = await requireActiveMember(`/products/${slug}#comments`);
  if (!await consumeRateLimit("product-comment", user.id, 10, 10 * MINUTE)) {
    redirect(`/products/${slug}?commentError=Too+many+comments.+Please+try+again+later.#comments`);
  }
  const parsed = commentSchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    redirect(`/products/${slug}?commentError=${encodeURIComponent(parsed.error.issues[0]?.message || "Check your comment.")}#comments`);
  }
  const product = await liveProductBySlug(slug);
  await prisma.productComment.create({ data: { productId: product.id, authorId: user.id, body: parsed.data } });
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  redirect(`/products/${slug}#comments`);
}

export async function deleteProductComment(slug: string, commentId: string) {
  const user = await requireActiveMember(`/products/${slug}#comments`);
  const comment = await prisma.productComment.findUnique({ where: { id: commentId }, select: { authorId: true, product: { select: { slug: true } } } });
  if (!comment || comment.product.slug !== slug) throw new Error("Comment not found.");
  if (comment.authorId !== user.id && !user.isAdmin) throw new Error("Forbidden");
  await prisma.productComment.delete({ where: { id: commentId } });
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  redirect(`/products/${slug}#comments`);
}

export async function subscribeNewsletter(formData: FormData) {
  if (formData.get("website")) return;
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) redirect("/?newsletter=invalid#newsletter");
  if (!await consumeRateLimit("newsletter", parsed.data, 3, HOUR)) redirect("/?newsletter=slowdown#newsletter");
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data.toLowerCase() },
    create: { email: parsed.data.toLowerCase() },
    update: { active: true },
  });
  redirect("/?newsletter=subscribed#newsletter");
}

const profileSchema = z.object({
  fullName: z.string().trim().max(100).refine((value) => !value || value.length >= 2, "Use at least 2 characters for your name."),
  phone: z.string().trim().max(25).refine((value) => !value || /^(?:\+?977[- ]?)?(?:9[678]\d{8}|0?1\d{7})$/.test(value), "Enter a valid Nepal phone number."),
  linkedinUrl: z.string().trim().max(300).refine((value) => {
    if (!value) return true;
    const parsed = secureExternalUrlSchema.safeParse(value);
    return parsed.success && /(^|\.)linkedin\.com$/i.test(new URL(value).hostname);
  }, "Enter a valid LinkedIn URL."),
  instagramHandle: instagramHandleSchema,
});

export async function saveProfile(formData: FormData) {
  const member = await requireActiveMember("/profile");
  if (!await consumeRateLimit("profile-save", member.id, 10, 10 * MINUTE)) redirect("/profile?error=Too+many+updates.+Please+try+again+later.");
  const currentUser = await prisma.user.findUnique({ where: { id: member.id } });
  if (!currentUser) redirect("/join");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check your details.")}`);

  const file = formData.get("profilePicture");
  let uploaded: string | undefined;
  if (file instanceof File && file.size) {
    try {
      uploaded = await uploadImage(file, `profiles/${member.id}`, 5);
    } catch (error) {
      redirect(`/profile?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed.")}`);
    }
  }
  const profilePicture = uploaded || currentUser.profilePicture;
  const update = {
    fullName: parsed.data.fullName || null,
    phone: parsed.data.phone || null,
    linkedinUrl: parsed.data.linkedinUrl || null,
    instagramHandle: parsed.data.instagramHandle || null,
    ...(uploaded ? { profilePicture: uploaded } : {}),
  };
  const completion = profileCompletion({ ...currentUser, ...update, profilePicture });
  const user = await prisma.user.update({
    where: { id: member.id },
    data: { ...update, profileCompleted: completion.complete },
  });
  revalidatePath("/", "layout");
  if (!completion.complete) redirect("/profile?saved=1");
  redirect(`/founders/${founderSlug(user.fullName || user.name || "founder", user.id)}`);
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  companyName: z.string().trim().max(80).optional(),
  websiteUrl: secureExternalUrlSchema,
  linkedinUrl: z.union([z.literal(""), secureExternalUrlSchema]).optional(),
  instagramHandle: instagramHandleSchema.optional(),
  founderType: z.string().trim().max(60).optional(),
  tagline: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(300),
  categoryId: z.string().min(1),
  foundedMonth: z.coerce.number().int().min(1).max(12).optional(),
  foundedYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export async function createProduct(formData: FormData) {
  const member = await requireActiveMember("/products/new");
  if (!await consumeRateLimit("product-create", member.id, 5, DAY)) redirect("/products/new?error=Product+creation+limit+reached.+Please+try+again+later.");
  const currentUser = await prisma.user.findUnique({ where: { id: member.id } });
  if (!currentUser) redirect("/join");
  const completion = profileCompletion(currentUser);
  if (currentUser.profileCompleted !== completion.complete) {
    await prisma.user.update({ where: { id: currentUser.id }, data: { profileCompleted: completion.complete } });
  }
  if (!completion.complete) redirect(`/profile?error=${encodeURIComponent(incompleteProfileMessage(completion.missing))}`);
  const values = Object.fromEntries(formData);
  if (!values.foundedMonth) delete values.foundedMonth;
  if (!values.foundedYear) delete values.foundedYear;
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) redirect(`/products/new?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check the form.")}`);
  const file = formData.get("logo");
  let logoUrl: string | undefined;
  if (file instanceof File && file.size) {
    try {
      logoUrl = await uploadImage(file, `products/${member.id}`, 2);
    } catch (error) {
      redirect(`/products/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed.")}`);
    }
  }
  const baseSlug = slugify(parsed.data.name);
  const duplicateCount = await prisma.product.count({ where: { slug: { startsWith: baseSlug } } });
  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      companyName: parsed.data.companyName || null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      instagramHandle: parsed.data.instagramHandle?.replace(/^@/, "") || null,
      founderType: parsed.data.founderType || null,
      slug: duplicateCount ? `${baseSlug}-${duplicateCount + 1}` : baseSlug,
      ownerId: member.id,
      logoUrl,
      builtInNepal: formData.get("builtInNepal") === "on",
      status: "LIVE",
    },
  });
  const cofounderEmails = String(formData.get("cofounderEmails") || "")
    .split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
  const validEmails = [...new Set(cofounderEmails)].filter((email) => z.string().email().safeParse(email).success && email !== member.email?.toLowerCase()).slice(0, 10);
  if (validEmails.length) {
    const expiresAt = new Date(Date.now() + 14 * 86_400_000);
    await prisma.coFounderInvite.createMany({ data: validEmails.map((email) => ({ productId: product.id, email, expiresAt })) });
  }
  revalidatePath("/products");
  redirect(`/products/${product.slug}`);
}

async function ownedProduct(slug: string, userId: string) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.ownerId !== userId) throw new Error("You do not own this product.");
  return product;
}

export async function updateProduct(slug: string, formData: FormData) {
  const member = await requireActiveMember(`/products/${slug}/manage`);
  if (!await consumeRateLimit("product-update", member.id, 30, HOUR)) redirect(`/products/${slug}/manage?error=Too+many+updates.+Please+try+again+later.`);
  await ownedProduct(slug, member.id);
  const values = Object.fromEntries(formData);
  if (!values.foundedMonth) delete values.foundedMonth;
  if (!values.foundedYear) delete values.foundedYear;
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) redirect(`/products/${slug}/manage?error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check the form.")}`);
  const file = formData.get("logo");
  let logoUrl: string | undefined;
  if (file instanceof File && file.size) {
    try { logoUrl = await uploadImage(file, `products/${member.id}`, 2); }
    catch (error) { redirect(`/products/${slug}/manage?error=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed.")}`); }
  }
  await prisma.product.update({
    where: { slug },
    data: {
      ...parsed.data,
      companyName: parsed.data.companyName || null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      instagramHandle: parsed.data.instagramHandle?.replace(/^@/, "") || null,
      founderType: parsed.data.founderType || null,
      ...(logoUrl ? { logoUrl } : {}),
      builtInNepal: formData.get("builtInNepal") === "on",
    },
  });
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  redirect(`/products/${slug}`);
}

export async function deleteProduct(slug: string) {
  const member = await requireActiveMember(`/products/${slug}/manage`);
  await ownedProduct(slug, member.id);
  await prisma.product.delete({ where: { slug } });
  revalidatePath("/products");
  redirect("/products");
}

export async function inviteCofounder(slug: string, formData: FormData) {
  const member = await requireActiveMember(`/products/${slug}/manage`);
  if (!await consumeRateLimit("cofounder-invite", member.id, 20, DAY)) redirect(`/products/${slug}/manage?error=Invitation+limit+reached.+Please+try+again+later.`);
  const product = await ownedProduct(slug, member.id);
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) redirect(`/products/${slug}/manage?error=Enter+a+valid+co-founder+email.`);
  const email = parsed.data.toLowerCase();
  if (email === member.email?.toLowerCase()) redirect(`/products/${slug}/manage?error=You+are+already+the+owner.`);
  const expiresAt = new Date(Date.now() + 14 * 86_400_000);
  await prisma.coFounderInvite.upsert({
    where: { productId_email: { productId: product.id, email } },
    create: { productId: product.id, email, expiresAt },
    update: { token: crypto.randomUUID(), status: "PENDING", acceptedUserId: null, expiresAt },
  });
  redirect(`/products/${slug}/manage?invited=1`);
}

export async function revokeCofounderInvite(slug: string, inviteId: string) {
  const member = await requireActiveMember(`/products/${slug}/manage`);
  const product = await ownedProduct(slug, member.id);
  const invite = await prisma.coFounderInvite.findFirst({ where: { id: inviteId, productId: product.id } });
  if (!invite) redirect(`/products/${slug}/manage`);
  await prisma.$transaction([
    prisma.coFounderInvite.update({ where: { id: invite.id }, data: { status: "REVOKED" } }),
    ...(invite.acceptedUserId ? [prisma.product.update({ where: { id: product.id }, data: { coFounders: { disconnect: { id: invite.acceptedUserId } } } })] : []),
  ]);
  redirect(`/products/${slug}/manage`);
}

export async function acceptCofounderInvite(token: string) {
  const member = await requireActiveMember(`/invites/${token}`);
  if (!await consumeRateLimit("cofounder-accept", member.id, 20, HOUR)) redirect(`/invites/${token}?error=Too+many+attempts.+Please+try+again+later.`);
  const invite = await prisma.coFounderInvite.findUnique({ where: { token }, include: { product: true } });
  if (!invite) redirect("/?invite=missing");
  if (invite.email !== member.email?.toLowerCase()) redirect(`/invites/${token}?error=Use+the+Google+account+that+received+this+invitation.`);
  if (invite.status !== "PENDING" || invite.expiresAt <= new Date()) redirect(`/products/${invite.product.slug}`);
  await prisma.$transaction([
    prisma.coFounderInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedUserId: member.id } }),
    prisma.product.update({ where: { id: invite.productId }, data: { coFounders: { connect: { id: member.id } } } }),
  ]);
  revalidatePath(`/products/${invite.product.slug}`);
  redirect(`/products/${invite.product.slug}`);
}

async function requireAdmin(superAdmin = false) {
  const session = await auth();
  if (!session?.user) redirect("/join?next=/admin");
  if (session.user.status !== "ACTIVE" || !session.user.isAdmin || (superAdmin && !session.user.isSuperAdmin)) throw new Error("Forbidden");
  return session.user;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, changes?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, changes } });
}

export async function adminUpdateUser(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get("id"));
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || (target.isSuperAdmin && !actor.isSuperAdmin)) throw new Error("Forbidden");
  const status = String(formData.get("status")) as "ACTIVE" | "SUSPENDED" | "BANNED";
  if (!["ACTIVE", "SUSPENDED", "BANNED"].includes(status)) throw new Error("Invalid status");
  if (target.id === actor.id && status !== "ACTIVE") throw new Error("You cannot suspend or ban your own account.");
  await prisma.user.update({ where: { id }, data: { status } });
  await audit(actor.id, "UPDATE_USER_STATUS", "User", id, { status });
  revalidatePath("/admin");
}

export async function adminUpdateProduct(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get("id"));
  const exclusive = formData.get("exclusive") === "on";
  const featured = exclusive && formData.get("featured") === "on";
  const status = String(formData.get("status")) as "DRAFT" | "LIVE" | "HIDDEN";
  if (!["DRAFT", "LIVE", "HIDDEN"].includes(status)) throw new Error("Invalid status");
  const featuredOrder = z.coerce.number().int().min(0).max(9999).parse(formData.get("featuredOrder") || 0);
  await prisma.product.update({ where: { id }, data: { status, exclusive, featured, featuredOrder } });
  await audit(actor.id, "UPDATE_PRODUCT", "Product", id, { status, exclusive, featured });
  revalidatePath("/", "layout");
}

export async function adminCreateCategory(formData: FormData) {
  const actor = await requireAdmin();
  const name = z.string().trim().min(2).max(60).parse(formData.get("name"));
  const sortOrder = z.coerce.number().int().min(0).max(9999).parse(formData.get("sortOrder") || 0);
  const category = await prisma.category.create({ data: { name, slug: slugify(name), sortOrder } });
  await audit(actor.id, "CREATE_CATEGORY", "Category", category.id, { name });
  revalidatePath("/admin");
}

export async function adminCreateEvent(formData: FormData) {
  const actor = await requireAdmin();
  const details = z.object({
    title: z.string().trim().min(2).max(140),
    venue: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(1000),
    lumaUrl: secureExternalUrlSchema,
  }).parse({
    title: formData.get("title"),
    venue: formData.get("venue"),
    description: formData.get("description"),
    lumaUrl: formData.get("lumaUrl"),
  });
  const file = formData.get("coverImage");
  let coverImageUrl: string | undefined;
  if (file instanceof File && file.size) coverImageUrl = await uploadImage(file, "events", 5);
  const startsAt = new Date(String(formData.get("startsAt")));
  if (Number.isNaN(startsAt.getTime())) throw new Error("Choose a valid event date and time.");
  const capacityValue = String(formData.get("capacity") || "").trim();
  const priceValue = String(formData.get("priceNpr") || "").trim();
  const capacity = capacityValue ? z.coerce.number().int().nonnegative().max(100_000).parse(capacityValue) : null;
  const priceNpr = priceValue ? z.coerce.number().nonnegative().max(100_000_000).parse(priceValue) : null;
  const event = await prisma.event.create({
    data: {
      ...details,
      slug: `${slugify(details.title)}-${Date.now().toString(36)}`,
      startsAt,
      coverImageUrl,
      capacity,
      priceNpr,
    },
  });
  await audit(actor.id, "CREATE_EVENT", "Event", event.id, { title: details.title });
  revalidatePath("/events");
}

export async function adminAddGalleryPhoto(formData: FormData) {
  const actor = await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) throw new Error("Choose an image.");
  const imageUrl = await uploadImage(file, "gallery", 8);
  const caption = z.string().trim().max(180).parse(formData.get("caption") || "");
  const photo = await prisma.galleryPhoto.create({ data: { imageUrl, caption: caption || null, uploaderId: actor.id } });
  await audit(actor.id, "ADD_GALLERY_PHOTO", "GalleryPhoto", photo.id);
  revalidatePath("/gallery");
}

export async function adminDelete(kind: "product" | "event" | "photo" | "subscriber" | "category" | "comment" | "user" | "invitation", id: string) {
  const safeKind = z.enum(["product", "event", "photo", "subscriber", "category", "comment", "user", "invitation"]).parse(kind);
  const actor = await requireAdmin(safeKind === "user");
  if (safeKind === "product") await prisma.product.delete({ where: { id } });
  if (safeKind === "event") await prisma.event.delete({ where: { id } });
  if (safeKind === "photo") await prisma.galleryPhoto.delete({ where: { id } });
  if (safeKind === "subscriber") await prisma.newsletterSubscriber.delete({ where: { id } });
  if (safeKind === "category") await prisma.category.delete({ where: { id } });
  if (safeKind === "comment") await prisma.productComment.delete({ where: { id } });
  if (safeKind === "invitation") await prisma.coFounderInvite.delete({ where: { id } });
  if (safeKind === "user") {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isSuperAdmin: true } });
    if (!target || target.id === actor.id || target.isSuperAdmin) throw new Error("This account cannot be deleted.");
    await prisma.$transaction([
      prisma.coFounderInvite.updateMany({ where: { acceptedUserId: id }, data: { acceptedUserId: null, status: "REVOKED" } }),
      prisma.user.delete({ where: { id } }),
    ]);
  }
  await audit(actor.id, `DELETE_${safeKind.toUpperCase()}`, safeKind, id);
  revalidatePath("/", "layout");
}

export async function adminSaveSettings(formData: FormData) {
  const actor = await requireAdmin();
  const optionalUrl = z.union([z.literal(""), secureExternalUrlSchema]);
  const optionalEmail = z.union([z.literal(""), z.email()]);
  const settings = z.object({
    applyFormUrl: optionalUrl,
    instagramUrl: optionalUrl,
    linkedinUrl: optionalUrl,
    contactEmail: optionalEmail,
  }).parse({
    applyFormUrl: String(formData.get("applyFormUrl") || "").trim(),
    instagramUrl: String(formData.get("instagramUrl") || "").trim(),
    linkedinUrl: String(formData.get("linkedinUrl") || "").trim(),
    contactEmail: String(formData.get("contactEmail") || "").trim().toLowerCase(),
  });
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, });
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: {
      applyFormUrl: settings.applyFormUrl || null,
      instagramUrl: settings.instagramUrl || null,
      linkedinUrl: settings.linkedinUrl || null,
      contactEmail: settings.contactEmail || null,
    },
  });
  await audit(actor.id, "UPDATE_SETTINGS", "SiteSettings", "1");
  revalidatePath("/", "layout");
}

export async function adminGrantAccess(formData: FormData) {
  const actor = await requireAdmin(true);
  const email = z.string().email().parse(formData.get("email")).toLowerCase();
  const user = await prisma.user.upsert({ where: { email }, create: { email, isAdmin: true }, update: { isAdmin: true } });
  await audit(actor.id, "GRANT_ADMIN", "User", user.id, { email });
  revalidatePath("/admin");
}

export async function adminRevokeAccess(userId: string) {
  const actor = await requireAdmin(true);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.isSuperAdmin || target.id === actor.id) throw new Error("Super-admin access cannot be revoked here.");
  await prisma.user.update({ where: { id: target.id }, data: { isAdmin: false } });
  await audit(actor.id, "REVOKE_ADMIN", "User", target.id, { email: target.email });
  revalidatePath("/admin");
}

export async function unsubscribeNewsletter(token: string) {
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (subscriber) await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { active: false } });
  redirect("/newsletter/unsubscribed");
}
