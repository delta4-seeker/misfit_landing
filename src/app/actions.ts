"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { auth, signIn, signOut } from "@/auth";
import { databaseIsConfigured } from "@/lib/database-url";
import { incompleteProfileMessage, profileCompletion } from "@/lib/profile";
import { normalizeLumaUrl, resolveLumaEvent } from "@/lib/luma";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { deleteStoredImage, uploadGalleryImages, uploadImage } from "@/lib/storage";
import { displayName, founderSlug, slugify } from "@/lib/utils";
import { instagramHandleSchema, secureExternalUrlSchema } from "@/lib/validation";
import { parseWhatsAppExport } from "@/lib/whatsapp-import";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export async function googleSignIn() {
  if (!databaseIsConfigured()) {
    redirect("/join?error=database");
  }
  await signIn("google", { redirectTo: "/" });
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
  updateTag("products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/");
}

const commentSchema = z.string().trim().min(2, "Write at least 2 characters.").max(500, "Keep comments under 500 characters.");

export async function createProductComment(slug: string, formData: FormData) {
  const user = await requireActiveMember(`/products/${slug}#comments`);
  const parsed = commentSchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    redirect(`/products/${slug}?commentError=${encodeURIComponent(parsed.error.issues[0]?.message || "Check your comment.")}#comments`);
  }
  const product = await liveProductBySlug(slug);
  if (!await consumeRateLimit("product-comment", user.id, 10, 10 * MINUTE)) {
    redirect(`/products/${slug}?commentError=Too+many+comments.+Please+try+again+later.#comments`);
  }
  await prisma.productComment.create({ data: { productId: product.id, authorId: user.id, body: parsed.data } });
  updateTag("products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  redirect(`/products/${slug}?commentPosted=1#comments`);
}

export async function deleteProductComment(slug: string, commentId: string) {
  const user = await requireActiveMember(`/products/${slug}#comments`);
  const comment = await prisma.productComment.findUnique({ where: { id: commentId }, select: { authorId: true, product: { select: { slug: true } } } });
  if (!comment || comment.product.slug !== slug) throw new Error("Comment not found.");
  if (comment.authorId !== user.id && !user.isAdmin) throw new Error("Forbidden");
  await prisma.productComment.delete({ where: { id: commentId } });
  updateTag("products");
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
  if (uploaded && currentUser.profilePicture && currentUser.profilePicture !== uploaded) {
    await deleteStoredImage(currentUser.profilePicture);
  }
  updateTag("products");
  updateTag("founders");
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
  updateTag("products");
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
  const existingProduct = await ownedProduct(slug, member.id);
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
    },
  });
  if (logoUrl && existingProduct.logoUrl && existingProduct.logoUrl !== logoUrl) {
    await deleteStoredImage(existingProduct.logoUrl);
  }
  updateTag("products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  redirect(`/products/${slug}`);
}

export async function deleteProduct(slug: string) {
  const member = await requireActiveMember(`/products/${slug}/manage`);
  const product = await ownedProduct(slug, member.id);
  await prisma.product.delete({ where: { slug } });
  await deleteStoredImage(product.logoUrl);
  updateTag("products");
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
  updateTag("products");
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
  updateTag("products");
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
  updateTag("products");
  updateTag("founders");
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
  updateTag("products");
  revalidatePath("/", "layout");
}

export async function adminCreateCategory(formData: FormData) {
  const actor = await requireAdmin();
  const name = z.string().trim().min(2).max(60).parse(formData.get("name"));
  const sortOrder = z.coerce.number().int().min(0).max(9999).parse(formData.get("sortOrder") || 0);
  const category = await prisma.category.create({ data: { name, slug: slugify(name), sortOrder } });
  await audit(actor.id, "CREATE_CATEGORY", "Category", category.id, { name });
  updateTag("categories");
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
  const startsAt = new Date(String(formData.get("startsAt")));
  if (Number.isNaN(startsAt.getTime())) throw new Error("Choose a valid event date and time.");
  const capacityValue = String(formData.get("capacity") || "").trim();
  const priceValue = String(formData.get("priceNpr") || "").trim();
  const capacity = capacityValue ? z.coerce.number().int().nonnegative().max(100_000).parse(capacityValue) : null;
  const priceNpr = priceValue ? z.coerce.number().nonnegative().max(100_000_000).parse(priceValue) : null;
  const file = formData.get("coverImage");
  let coverImageUrl: string | undefined;
  if (file instanceof File && file.size) coverImageUrl = await uploadImage(file, "events", 5);
  const event = await prisma.event.create({ data: {
    ...details,
    slug: `${slugify(details.title)}-${Date.now().toString(36)}`,
    startsAt,
    coverImageUrl,
    capacity,
    priceNpr,
  } }).catch(async (error) => {
    await deleteStoredImage(coverImageUrl);
    throw error;
  });
  await audit(actor.id, "CREATE_EVENT", "Event", event.id, { title: details.title });
  updateTag("events");
  revalidatePath("/events");
}

export async function adminSaveHomepageLumaEvent(formData: FormData) {
  const actor = await requireAdmin();
  const input = String(formData.get("homepageLumaEventUrl") || "").trim();
  const visible = formData.get("homepageLumaEventVisible") === "on";
  let event: { url: string; eventId: string } | null = null;

  if (input) {
    try {
      if (input.length > 500) throw new Error("The event link is too long.");
      event = await resolveLumaEvent(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the Luma event.";
      redirect(`/admin?view=events&error=${encodeURIComponent(message)}`);
    }
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      homepageLumaEventUrl: event?.url ?? null,
      homepageLumaEventId: event?.eventId ?? null,
      homepageLumaEventVisible: visible,
    },
    update: {
      homepageLumaEventUrl: event?.url ?? null,
      homepageLumaEventId: event?.eventId ?? null,
      homepageLumaEventVisible: visible,
    },
  });
  await audit(actor.id, "UPDATE_HOMEPAGE_LUMA_EVENT", "SiteSettings", "1", { url: event?.url ?? null, visible });
  updateTag("settings");
  revalidatePath("/");
  redirect("/admin?view=events&saved=1");
}

const blogSchema = z.object({
  title: z.string().trim().min(4).max(160),
  kicker: z.string().trim().max(80),
  excerpt: z.string().trim().min(20).max(320),
  body: z.string().trim().min(100).max(50_000),
  authorName: z.string().trim().min(2).max(100),
});

export async function adminSaveBlog(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const parsed = blogSchema.safeParse({
    title: formData.get("title"),
    kicker: formData.get("kicker") || "",
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    authorName: formData.get("authorName"),
  });
  if (!parsed.success) redirect(`/admin?view=blogs${id ? `&edit=${encodeURIComponent(id)}` : ""}&error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check the article.")}`);
  const existing = id ? await prisma.blogPost.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new Error("Blog post not found.");
  const file = formData.get("coverImage");
  let coverImageUrl: string | undefined;
  if (file instanceof File && file.size) {
    try { coverImageUrl = await uploadImage(file, "blogs", 6); }
    catch (error) { redirect(`/admin?view=blogs${id ? `&edit=${encodeURIComponent(id)}` : ""}&error=${encodeURIComponent(error instanceof Error ? error.message : "Cover upload failed.")}`); }
  }
  const status = formData.get("published") === "on" ? "PUBLISHED" as const : "DRAFT" as const;
  const readingMinutes = Math.max(1, Math.ceil(parsed.data.body.split(/\s+/).length / 220));
  let slug = existing?.slug;
  if (!slug) {
    const base = slugify(parsed.data.title) || "post";
    slug = base;
    let suffix = 2;
    while (await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
  }
  const data = {
    title: parsed.data.title,
    slug,
    kicker: parsed.data.kicker || null,
    excerpt: parsed.data.excerpt,
    body: parsed.data.body,
    authorName: parsed.data.authorName,
    tags: [],
    status,
    readingMinutes,
    ...(coverImageUrl ? { coverImageUrl } : {}),
    publishedAt: status === "PUBLISHED" ? existing?.publishedAt || new Date() : null,
  };
  let post;
  try {
    post = existing
      ? await prisma.blogPost.update({ where: { id: existing.id }, data })
      : await prisma.blogPost.create({ data });
  } catch (error) {
    if (coverImageUrl) await deleteStoredImage(coverImageUrl);
    throw error;
  }
  if (coverImageUrl && existing?.coverImageUrl && existing.coverImageUrl !== coverImageUrl) await deleteStoredImage(existing.coverImageUrl);
  await audit(actor.id, existing ? "UPDATE_BLOG" : "CREATE_BLOG", "BlogPost", post.id, { title: post.title, status: post.status });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/admin");
  redirect("/admin?view=blogs&saved=1");
}

const memberBlogSchema = z.object({
  title: z.string().trim().min(4).max(160),
  excerpt: z.string().trim().min(20).max(320),
  body: z.string().trim().min(100).max(50_000),
});

function memberBlogEditorHref(id: string, message: string) {
  const edit = id ? `?edit=${encodeURIComponent(id)}&` : "?";
  return `/blog/write${edit}error=${encodeURIComponent(message)}`;
}

export async function saveMemberBlog(formData: FormData) {
  const actor = await requireActiveMember("/blog/write");
  const id = String(formData.get("id") || "").trim();
  if (!await consumeRateLimit("blog-save", actor.id, 20, HOUR)) redirect(memberBlogEditorHref(id, "Too many saves. Please try again later."));
  const parsed = memberBlogSchema.safeParse({
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect(memberBlogEditorHref(id, parsed.error.issues[0]?.message || "Check your story."));
  const existing = id ? await prisma.blogPost.findUnique({ where: { id } }) : null;
  if (id && (!existing || existing.authorId !== actor.id)) throw new Error("Blog post not found.");
  const file = formData.get("coverImage");
  const hasNewCover = file instanceof File && file.size > 0;
  if (!hasNewCover && !existing?.coverImageUrl) redirect(memberBlogEditorHref(id, "Add a banner image before saving your story."));
  let coverImageUrl: string | undefined;
  if (hasNewCover) {
    try { coverImageUrl = await uploadImage(file, "blogs", 6); }
    catch (error) { redirect(memberBlogEditorHref(id, error instanceof Error ? error.message : "Banner upload failed.")); }
  }
  const status = formData.get("published") === "on" ? "PUBLISHED" as const : "DRAFT" as const;
  const readingMinutes = Math.max(1, Math.ceil(parsed.data.body.split(/\s+/).length / 220));
  let slug = existing?.slug;
  if (!slug) {
    const base = slugify(parsed.data.title) || "story";
    slug = base;
    let suffix = 2;
    while (await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
  }
  const data = {
    title: parsed.data.title,
    slug,
    kicker: null,
    excerpt: parsed.data.excerpt,
    body: parsed.data.body,
    authorName: displayName(actor),
    authorId: actor.id,
    tags: [],
    status,
    readingMinutes,
    ...(coverImageUrl ? { coverImageUrl } : {}),
    publishedAt: status === "PUBLISHED" ? existing?.publishedAt || new Date() : null,
  };
  let post;
  try {
    post = existing
      ? await prisma.blogPost.update({ where: { id: existing.id }, data })
      : await prisma.blogPost.create({ data });
  } catch (error) {
    if (coverImageUrl) await deleteStoredImage(coverImageUrl);
    throw error;
  }
  if (coverImageUrl && existing?.coverImageUrl && existing.coverImageUrl !== coverImageUrl) await deleteStoredImage(existing.coverImageUrl);
  await audit(actor.id, existing ? "UPDATE_OWN_BLOG" : "CREATE_OWN_BLOG", "BlogPost", post.id, { title: post.title, status: post.status });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath(`/founders/${founderSlug(displayName(actor), actor.id)}`);
  redirect(status === "PUBLISHED" ? `/blog/${post.slug}` : `/blog/write?edit=${encodeURIComponent(post.id)}&saved=1`);
}

export async function deleteMemberBlog(postId: string) {
  const actor = await requireActiveMember("/profile");
  const post = await prisma.blogPost.findUnique({ where: { id: postId }, select: { id: true, slug: true, title: true, authorId: true, coverImageUrl: true } });
  if (!post || (post.authorId !== actor.id && !actor.isAdmin)) throw new Error("Blog post not found.");
  await prisma.blogPost.delete({ where: { id: post.id } });
  await deleteStoredImage(post.coverImageUrl);
  await audit(actor.id, "DELETE_OWN_BLOG", "BlogPost", post.id, { title: post.title });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/profile");
  revalidatePath("/blog/write");
  revalidatePath(`/founders/${founderSlug(displayName(actor), actor.id)}`);
}

export async function toggleBlogLike(slug: string) {
  const actor = await requireActiveMember(`/blog/${slug}`);
  if (!await consumeRateLimit("blog-like", actor.id, 60, HOUR)) return;
  const post = await prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() }, OR: [{ authorId: null }, { author: { status: "ACTIVE" } }] }, select: { id: true, authorId: true } });
  if (!post) throw new Error("Blog post not found.");
  const key = { postId_userId: { postId: post.id, userId: actor.id } };
  const existing = await prisma.blogLike.findUnique({ where: key, select: { userId: true } });
  if (existing) await prisma.blogLike.delete({ where: key });
  else await prisma.blogLike.create({ data: { postId: post.id, userId: actor.id } });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  if (post.authorId) revalidatePath("/founders", "layout");
}

const blogCommentSchema = z.string().trim().min(2, "Write at least 2 characters.").max(1_000, "Keep comments under 1,000 characters.");

export async function createBlogComment(slug: string, formData: FormData) {
  const actor = await requireActiveMember(`/blog/${slug}#discussion`);
  const parsed = blogCommentSchema.safeParse(formData.get("body"));
  if (!parsed.success) redirect(`/blog/${slug}?commentError=${encodeURIComponent(parsed.error.issues[0]?.message || "Check your comment.")}#discussion`);
  if (!await consumeRateLimit("blog-comment", actor.id, 10, 10 * MINUTE)) redirect(`/blog/${slug}?commentError=Too+many+comments.+Please+try+again+later.#discussion`);
  const post = await prisma.blogPost.findFirst({ where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() }, OR: [{ authorId: null }, { author: { status: "ACTIVE" } }] }, select: { id: true } });
  if (!post) throw new Error("Blog post not found.");
  await prisma.blogComment.create({ data: { postId: post.id, authorId: actor.id, body: parsed.data } });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect(`/blog/${slug}?commentPosted=1#discussion`);
}

export async function deleteBlogComment(slug: string, commentId: string) {
  const actor = await requireActiveMember(`/blog/${slug}#discussion`);
  const comment = await prisma.blogComment.findUnique({ where: { id: commentId }, select: { authorId: true, post: { select: { slug: true } } } });
  if (!comment || comment.post.slug !== slug) throw new Error("Comment not found.");
  if (comment.authorId !== actor.id && !actor.isAdmin) throw new Error("Forbidden");
  await prisma.blogComment.delete({ where: { id: commentId } });
  updateTag("blogs");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect(`/blog/${slug}#discussion`);
}

const testimonialSchema = z.object({
  quote: z.string().trim().min(40).max(2_000),
  name: z.string().trim().min(2).max(100),
  role: z.string().trim().min(2).max(160),
  company: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export async function adminSaveTestimonial(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const parsed = testimonialSchema.safeParse({
    quote: formData.get("quote"),
    name: formData.get("name"),
    role: formData.get("role"),
    company: formData.get("company"),
    sortOrder: formData.get("sortOrder") || "0",
  });
  if (!parsed.success) redirect(`/admin?view=testimonials${id ? `&edit=${encodeURIComponent(id)}` : ""}&error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check the testimonial.")}`);
  const existing = id ? await prisma.testimonial.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new Error("Testimonial not found.");
  const file = formData.get("photo");
  if ((!existing || !existing.photoUrl) && (!(file instanceof File) || !file.size)) {
    redirect(`/admin?view=testimonials${id ? `&edit=${encodeURIComponent(id)}` : ""}&error=Choose+a+photo+for+this+testimonial.`);
  }
  let photoUrl: string | undefined;
  if (file instanceof File && file.size) {
    try { photoUrl = await uploadImage(file, "testimonials", 5); }
    catch (error) { redirect(`/admin?view=testimonials${id ? `&edit=${encodeURIComponent(id)}` : ""}&error=${encodeURIComponent(error instanceof Error ? error.message : "Photo upload failed.")}`); }
  }
  const data = {
    ...parsed.data,
    active: formData.get("active") === "on",
    ...(photoUrl ? { photoUrl } : {}),
  };
  let testimonial;
  try {
    testimonial = existing
      ? await prisma.testimonial.update({ where: { id: existing.id }, data })
      : await prisma.testimonial.create({ data });
  } catch (error) {
    if (photoUrl) await deleteStoredImage(photoUrl);
    throw error;
  }
  if (photoUrl && existing?.photoUrl && existing.photoUrl !== photoUrl) await deleteStoredImage(existing.photoUrl);
  await audit(actor.id, existing ? "UPDATE_TESTIMONIAL" : "CREATE_TESTIMONIAL", "Testimonial", testimonial.id, { name: testimonial.name, active: testimonial.active });
  updateTag("testimonials");
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?view=testimonials&saved=1");
}

export async function adminAddGalleryPhoto(formData: FormData) {
  const actor = await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) redirect("/admin?view=gallery&error=Choose+an+image.");
  let images: Awaited<ReturnType<typeof uploadGalleryImages>>;
  try { images = await uploadGalleryImages(file); }
  catch (error) { redirect(`/admin?view=gallery&error=${encodeURIComponent(error instanceof Error ? error.message : "Image upload failed.")}`); }
  const photo = await prisma.galleryPhoto.create({ data: { ...images, uploaderId: actor.id } })
    .catch(async (error) => {
      await Promise.all([deleteStoredImage(images.imageUrl), deleteStoredImage(images.thumbnailUrl)]);
      throw error;
    });
  await audit(actor.id, "ADD_GALLERY_PHOTO", "GalleryPhoto", photo.id);
  updateTag("gallery");
  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/admin");
  redirect("/admin?view=gallery&saved=1");
}

export async function adminReplaceGalleryPhoto(photoId: string, formData: FormData) {
  const actor = await requireAdmin();
  const existing = await prisma.galleryPhoto.findUnique({ where: { id: photoId }, select: { imageUrl: true, thumbnailUrl: true } });
  if (!existing) redirect("/admin?view=gallery&error=Gallery+photo+not+found.");
  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) redirect("/admin?view=gallery&error=Choose+a+crop+before+saving.");
  let images: Awaited<ReturnType<typeof uploadGalleryImages>>;
  try { images = await uploadGalleryImages(file); }
  catch (error) { redirect(`/admin?view=gallery&error=${encodeURIComponent(error instanceof Error ? error.message : "Image upload failed.")}`); }
  try {
    await prisma.galleryPhoto.update({ where: { id: photoId }, data: images });
  } catch (error) {
    await Promise.all([deleteStoredImage(images.imageUrl), deleteStoredImage(images.thumbnailUrl)]);
    throw error;
  }
  await Promise.all([deleteStoredImage(existing.imageUrl), deleteStoredImage(existing.thumbnailUrl)]);
  await audit(actor.id, "CROP_GALLERY_PHOTO", "GalleryPhoto", photoId);
  updateTag("gallery");
  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/admin");
  redirect("/admin?view=gallery&saved=1");
}

export async function adminDelete(kind: "product" | "event" | "photo" | "subscriber" | "category" | "comment" | "user" | "invitation" | "blog" | "testimonial", id: string) {
  const safeKind = z.enum(["product", "event", "photo", "subscriber", "category", "comment", "user", "invitation", "blog", "testimonial"]).parse(kind);
  const actor = await requireAdmin(safeKind === "user");
  const mediaUrls: Array<string | null | undefined> = [];
  if (safeKind === "product") mediaUrls.push((await prisma.product.findUnique({ where: { id }, select: { logoUrl: true } }))?.logoUrl);
  if (safeKind === "event") mediaUrls.push((await prisma.event.findUnique({ where: { id }, select: { coverImageUrl: true } }))?.coverImageUrl);
  if (safeKind === "photo") {
    const photo = await prisma.galleryPhoto.findUnique({ where: { id }, select: { imageUrl: true, thumbnailUrl: true } });
    mediaUrls.push(photo?.imageUrl, photo?.thumbnailUrl);
  }
  if (safeKind === "blog") mediaUrls.push((await prisma.blogPost.findUnique({ where: { id }, select: { coverImageUrl: true } }))?.coverImageUrl);
  if (safeKind === "testimonial") mediaUrls.push((await prisma.testimonial.findUnique({ where: { id }, select: { photoUrl: true } }))?.photoUrl);
  if (safeKind === "product") await prisma.product.delete({ where: { id } });
  if (safeKind === "event") await prisma.event.delete({ where: { id } });
  if (safeKind === "photo") await prisma.galleryPhoto.delete({ where: { id } });
  if (safeKind === "subscriber") await prisma.newsletterSubscriber.delete({ where: { id } });
  if (safeKind === "category") await prisma.category.delete({ where: { id } });
  if (safeKind === "comment") await prisma.productComment.delete({ where: { id } });
  if (safeKind === "invitation") await prisma.coFounderInvite.delete({ where: { id } });
  if (safeKind === "blog") await prisma.blogPost.delete({ where: { id } });
  if (safeKind === "testimonial") await prisma.testimonial.delete({ where: { id } });
  if (safeKind === "user") {
    const target = await prisma.user.findUnique({ where: { id }, select: {
      id: true, email: true, isSuperAdmin: true, profilePicture: true, products: { select: { logoUrl: true } },
    } });
    if (!target || target.id === actor.id || target.isSuperAdmin) throw new Error("This account cannot be deleted.");
    mediaUrls.push(target.profilePicture, ...target.products.map((product) => product.logoUrl));
    await prisma.$transaction([
      prisma.coFounderInvite.updateMany({ where: { acceptedUserId: id }, data: { acceptedUserId: null, status: "REVOKED" } }),
      prisma.user.delete({ where: { id } }),
    ]);
  }
  await Promise.all(mediaUrls.map((url) => deleteStoredImage(url)));
  await audit(actor.id, `DELETE_${safeKind.toUpperCase()}`, safeKind, id);
  if (["product", "comment", "user"].includes(safeKind)) updateTag("products");
  if (safeKind === "user") updateTag("founders");
  if (safeKind === "event") updateTag("events");
  if (safeKind === "photo") updateTag("gallery");
  if (safeKind === "blog") updateTag("blogs");
  if (safeKind === "testimonial") updateTag("testimonials");
  if (safeKind === "category") updateTag("categories");
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
    lumaCalendarUrl: z.string().trim().min(1).max(500),
    contactEmail: optionalEmail,
  }).parse({
    applyFormUrl: String(formData.get("applyFormUrl") || "").trim(),
    instagramUrl: String(formData.get("instagramUrl") || "").trim(),
    linkedinUrl: String(formData.get("linkedinUrl") || "").trim(),
    lumaCalendarUrl: String(formData.get("lumaCalendarUrl") || "").trim(),
    contactEmail: String(formData.get("contactEmail") || "").trim().toLowerCase(),
  });
  const lumaCalendarUrl = normalizeLumaUrl(settings.lumaCalendarUrl);
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, });
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: {
      applyFormUrl: settings.applyFormUrl || null,
      instagramUrl: settings.instagramUrl || null,
      linkedinUrl: settings.linkedinUrl || null,
      lumaCalendarUrl,
      contactEmail: settings.contactEmail || null,
    },
  });
  await audit(actor.id, "UPDATE_SETTINGS", "SiteSettings", "1");
  updateTag("settings");
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

const whatsappImportSchema = z.object({
  groupName: z.string().trim().min(2).max(120),
  dateOrder: z.enum(["DMY", "MDY"]),
});

export async function adminImportWhatsAppExport(formData: FormData) {
  const actor = await requireAdmin();
  const parsed = whatsappImportSchema.safeParse({
    groupName: formData.get("groupName"),
    dateOrder: formData.get("dateOrder"),
  });
  if (!parsed.success) redirect(`/admin?view=member-activity&error=${encodeURIComponent(parsed.error.issues[0]?.message || "Check the import details.")}`);
  const file = formData.get("chatExport");
  if (!(file instanceof File) || !file.size) redirect("/admin?view=member-activity&error=Choose+a+WhatsApp+text+export.");
  if (file.size > 8 * 1024 * 1024) redirect("/admin?view=member-activity&error=Keep+the+export+under+8+MB.");
  const text = await file.text();
  if (text.includes("\0")) redirect("/admin?view=member-activity&error=Upload+the+TXT+file+from+the+WhatsApp+export.");

  const groupKey = `import:${slugify(parsed.data.groupName) || "whatsapp-group"}`;
  const result = parseWhatsAppExport(text, groupKey, parsed.data.dateOrder);
  if (!result.messages.length) {
    redirect("/admin?view=member-activity&error=No+messages+were+recognized.+Check+the+date+order+and+upload+the+chat+TXT+file.");
  }

  const imported = await prisma.$transaction(async (tx) => {
    const group = await tx.whatsAppGroup.upsert({
      where: { externalId: groupKey },
      create: { externalId: groupKey, name: parsed.data.groupName },
      update: { name: parsed.data.groupName },
    });
    const latestMessageAt = result.messages.reduce((latest, message) => message.sentAt > latest ? message.sentAt : latest, result.messages[0].sentAt);
    const members = new Map<string, { id: string }>();
    for (const message of result.messages) {
      if (members.has(message.senderExternalId)) continue;
      const member = await tx.whatsAppMember.upsert({
        where: { externalId: message.senderExternalId },
        create: {
          externalId: message.senderExternalId,
          displayName: message.senderLabel,
          phone: message.phone,
          firstSeenAt: message.sentAt,
          lastSeenAt: message.sentAt,
        },
        update: {
          displayName: message.senderLabel,
          phone: message.phone,
          lastSeenAt: latestMessageAt,
        },
        select: { id: true },
      });
      members.set(message.senderExternalId, member);
    }
    const batch = await tx.whatsAppImportBatch.create({
      data: { groupId: group.id, fileName: file.name.slice(0, 240) || null },
    });
    let importedMessages = 0;
    for (let offset = 0; offset < result.messages.length; offset += 750) {
      const chunk = result.messages.slice(offset, offset + 750);
      const created = await tx.whatsAppMessage.createMany({
        data: chunk.map((message) => ({
          externalId: message.externalId,
          groupId: group.id,
          authorId: members.get(message.senderExternalId)!.id,
          importBatchId: batch.id,
          sentAt: message.sentAt,
          kind: message.kind,
          source: "IMPORT" as const,
        })),
        skipDuplicates: true,
      });
      importedMessages += created.count;
    }
    await tx.whatsAppGroup.update({ where: { id: group.id }, data: { lastMessageAt: latestMessageAt } });
    await tx.whatsAppImportBatch.update({
      where: { id: batch.id },
      data: { importedMessages, skippedMessages: result.messages.length - importedMessages },
    });
    return { batchId: batch.id, importedMessages, skippedMessages: result.messages.length - importedMessages };
  });
  await audit(actor.id, "IMPORT_WHATSAPP_ACTIVITY", "WhatsAppImportBatch", imported.batchId, imported);
  revalidatePath("/admin");
  redirect(`/admin?view=member-activity&imported=${imported.importedMessages}&skipped=${imported.skippedMessages}`);
}

export async function adminLinkWhatsAppMember(memberId: string, formData: FormData) {
  const actor = await requireAdmin();
  const linkedUserId = String(formData.get("linkedUserId") || "").trim() || null;
  const member = await prisma.whatsAppMember.findUnique({ where: { id: memberId }, select: { id: true, linkedUserId: true } });
  if (!member) throw new Error("WhatsApp member not found.");
  if (linkedUserId && !await prisma.user.findUnique({ where: { id: linkedUserId }, select: { id: true } })) throw new Error("Portal member not found.");
  await prisma.whatsAppMember.update({ where: { id: member.id }, data: { linkedUserId } });
  await audit(actor.id, "LINK_WHATSAPP_MEMBER", "WhatsAppMember", member.id, { previousUserId: member.linkedUserId, linkedUserId });
  revalidatePath("/admin");
}

export async function adminDeleteWhatsAppImport(batchId: string) {
  const actor = await requireAdmin();
  const batch = await prisma.whatsAppImportBatch.findUnique({ where: { id: batchId }, select: { id: true, fileName: true } });
  if (!batch) return;
  const deleted = await prisma.$transaction(async (tx) => {
    const messages = await tx.whatsAppMessage.deleteMany({ where: { importBatchId: batch.id, source: "IMPORT" } });
    await tx.whatsAppImportBatch.delete({ where: { id: batch.id } });
    return messages.count;
  });
  await audit(actor.id, "DELETE_WHATSAPP_IMPORT", "WhatsAppImportBatch", batch.id, { fileName: batch.fileName, deletedMessages: deleted });
  revalidatePath("/admin");
}

export async function unsubscribeNewsletter(token: string) {
  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  if (subscriber) await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { active: false } });
  redirect("/newsletter/unsubscribed");
}
