import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { demoCategories, demoEvents, demoFounders, demoGallery, demoProducts } from "@/lib/demo";
import { databaseIsConfigured } from "@/lib/database-url";
import { prisma } from "@/lib/prisma";
import type { EventSummary, FounderSummary, GalleryItem, ProductEngagement, ProductSummary } from "@/lib/types";
import { displayName, founderSlug, profileImage } from "@/lib/utils";

const databaseConfigured = databaseIsConfigured();

async function withFallback<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  noStore();
  if (!databaseConfigured) return fallback;
  try {
    return await query();
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    console.warn("Database unavailable; rendering demo content.", error);
    return fallback;
  }
}

type ProductWithRelations = Awaited<ReturnType<typeof loadProductsFromDatabase>>[number];

async function loadProductsFromDatabase(category?: string, featuredOnly = false) {
  return prisma.product.findMany({
    where: {
      status: "LIVE",
      owner: { status: "ACTIVE" },
      ...(featuredOnly ? { featured: true, exclusive: true } : {}),
      ...(category ? { category: { slug: category } } : {}),
    },
    include: {
      category: true,
      owner: true,
      coFounders: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
      _count: { select: { votes: true, comments: true } },
    },
    orderBy: featuredOnly
      ? [{ featuredOrder: "asc" }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }],
    ...(featuredOnly ? { take: 4 } : {}),
  });
}

function mapFounder(user: ProductWithRelations["owner"]): FounderSummary {
  const name = displayName(user);
  return {
    id: user.id,
    slug: founderSlug(name, user.id),
    name,
    image: profileImage(user),
    linkedinUrl: user.linkedinUrl,
    instagramHandle: user.instagramHandle,
  };
}

function mapProduct(product: ProductWithRelations): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    websiteUrl: product.websiteUrl,
    logoUrl: product.logoUrl,
    category: { name: product.category.name, slug: product.category.slug },
    builtInNepal: product.builtInNepal,
    featured: product.featured,
    upvoteCount: product._count.votes,
    commentCount: product._count.comments,
    founder: mapFounder(product.owner),
    coFounders: product.coFounders.map(mapFounder),
  };
}

export async function getCategories() {
  return withFallback(
    () => prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    demoCategories,
  );
}

export async function getProducts(category?: string) {
  const fallback = category
    ? demoProducts.filter((product) => product.category.slug === category)
    : demoProducts;
  return withFallback(async () => (await loadProductsFromDatabase(category)).map(mapProduct), fallback);
}

export async function getFeaturedProducts() {
  return withFallback(
    async () => (await loadProductsFromDatabase(undefined, true)).map(mapProduct),
    demoProducts.filter((product) => product.featured).slice(0, 4),
  );
}

export async function getProduct(slug: string) {
  const fallback = demoProducts.find((product) => product.slug === slug) ?? null;
  return withFallback(async () => {
    const product = await prisma.product.findFirst({
      where: { slug, status: "LIVE", owner: { status: "ACTIVE" } },
      include: {
        category: true,
        owner: true,
        coFounders: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
        _count: { select: { votes: true, comments: true } },
      },
    });
    return product ? mapProduct(product) : null;
  }, fallback);
}

export async function getProductEngagement(productId: string, viewerId?: string): Promise<ProductEngagement> {
  return withFallback(async () => {
    const [upvoteCount, viewerVote, comments] = await Promise.all([
      prisma.productVote.count({ where: { productId } }),
      viewerId
        ? prisma.productVote.findUnique({ where: { productId_userId: { productId, userId: viewerId } }, select: { userId: true } })
        : Promise.resolve(null),
      prisma.productComment.findMany({
        where: { productId },
        include: { author: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      upvoteCount,
      viewerHasUpvoted: Boolean(viewerVote),
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: {
          id: comment.author.id,
          name: displayName(comment.author),
          image: profileImage(comment.author),
        },
      })),
    };
  }, { upvoteCount: 0, viewerHasUpvoted: false, comments: [] });
}

function mapEvent(event: {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  venue: string;
  description: string;
  coverImageUrl: string | null;
  lumaUrl: string;
  priceNpr: { toNumber(): number } | number | null;
}): EventSummary {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    venue: event.venue,
    description: event.description,
    coverImageUrl: event.coverImageUrl,
    lumaUrl: event.lumaUrl,
    priceNpr: typeof event.priceNpr === "number" ? event.priceNpr : event.priceNpr?.toNumber() ?? null,
  };
}

export async function getEvents() {
  return withFallback(
    async () => (await prisma.event.findMany({ orderBy: { startsAt: "asc" } })).map(mapEvent),
    demoEvents,
  );
}

export async function getNextEvent() {
  const fallback = demoEvents.find((event) => event.startsAt > new Date()) ?? null;
  return withFallback(async () => {
    const event = await prisma.event.findFirst({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    return event ? mapEvent(event) : null;
  }, fallback);
}

export async function getGallery(limit?: number) {
  return withFallback(async () => {
    const photos = await prisma.galleryPhoto.findMany({
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
    });
    return photos.map<GalleryItem>((photo) => ({
      id: photo.id,
      imageUrl: photo.imageUrl,
      thumbnailUrl: photo.thumbnailUrl,
      caption: photo.caption,
    }));
  }, limit ? demoGallery.slice(0, limit) : demoGallery);
}

export async function getFounder(slug: string) {
  const demo = demoFounders.find((founder) => founder.slug === slug);
  return withFallback(async () => {
    const idSuffix = slug.split("-").at(-1) || "";
    const user = await prisma.user.findFirst({
      where: { id: { endsWith: idSuffix }, status: "ACTIVE" },
      include: {
        products: {
          where: { status: "LIVE" },
          include: { category: true, owner: true, coFounders: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }, _count: { select: { votes: true, comments: true } } },
        },
        coFoundedProducts: {
          where: { status: "LIVE" },
          include: { category: true, owner: true, coFounders: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }, _count: { select: { votes: true, comments: true } } },
        },
      },
    });
    if (!user) return null;
    const name = displayName(user);
    if (founderSlug(name, user.id) !== slug) return null;
    const founder: FounderSummary = {
      id: user.id,
      slug: founderSlug(name, user.id),
      name,
      image: profileImage(user),
      linkedinUrl: user.linkedinUrl,
      instagramHandle: user.instagramHandle,
    };
    const products = [...user.products, ...user.coFoundedProducts]
      .filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index)
      .map(mapProduct);
    return { founder, products };
  }, demo ? { founder: demo, products: demoProducts.filter((product) => product.founder.id === demo.id || product.coFounders.some((coFounder) => coFounder.id === demo.id)) } : null);
}

export async function getSiteSettings() {
  return withFallback(
    () => prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    { id: 1, applyFormUrl: null, instagramUrl: null, linkedinUrl: null, contactEmail: null, galleryMaxUploadMb: 8, updatedAt: new Date() },
  );
}
