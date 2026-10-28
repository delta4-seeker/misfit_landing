import "server-only";

import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { pageBounds } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { EventSummary, FounderSummary, GalleryItem, ProductEngagement, ProductSummary, TestimonialSummary } from "@/lib/types";
import { displayName, founderSlug, profileImage } from "@/lib/utils";

async function fromDatabase<T>(key: string[], tags: string[], query: () => Promise<T>, revalidate = 300): Promise<T> {
  return unstable_cache(query, key, { tags, revalidate })();
}

type ProductWithRelations = Awaited<ReturnType<typeof loadProductsFromDatabase>>[number];

const productInclude = {
  category: true,
  owner: true,
  coFounders: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
  _count: { select: { votes: true, comments: true } },
} satisfies Prisma.ProductInclude;

function liveProductWhere(category?: string): Prisma.ProductWhereInput {
  return {
    status: "LIVE",
    owner: { status: "ACTIVE" },
    ...(category ? { category: { slug: category } } : {}),
  };
}

async function loadProductsFromDatabase(category?: string, pagination?: { skip: number; take: number }, ids?: string[]) {
  return prisma.product.findMany({
    where: {
      ...liveProductWhere(category),
      ...(ids ? { id: { in: ids } } : {}),
    },
    include: productInclude,
    orderBy: [{ createdAt: "desc" }],
    ...(pagination || {}),
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
    featured: product.featured,
    upvoteCount: product._count.votes,
    commentCount: product._count.comments,
    founder: mapFounder(product.owner),
    coFounders: product.coFounders.map(mapFounder),
  };
}

export async function getCategories() {
  return fromDatabase(["categories"], ["categories"], () => prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
}

export async function getProducts(category?: string) {
  return fromDatabase(["products", category || "all"], ["products"], async () => (await loadProductsFromDatabase(category)).map(mapProduct));
}

export async function getProductsPage(category: string | undefined, requestedPage: number, pageSize = 6) {
  return fromDatabase(["products-page", category || "all", String(requestedPage), String(pageSize)], ["products"], async () => {
    const totalCount = await prisma.product.count({ where: liveProductWhere(category) });
    const bounds = pageBounds(totalCount, requestedPage, pageSize);
    const products = await loadProductsFromDatabase(category, { skip: bounds.skip, take: pageSize });
    return { products: products.map(mapProduct), totalCount, page: bounds.page, totalPages: bounds.totalPages };
  });
}

export async function getHomepageProducts() {
  return fromDatabase(["homepage-products-unique"], ["products"], async () => {
    const picked = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT product.id
      FROM "Product" AS product
      INNER JOIN "User" AS owner ON owner.id = product."ownerId"
      WHERE product.status = ${"LIVE"}::"ListingStatus"
        AND owner.status = ${"ACTIVE"}::"UserStatus"
      ORDER BY random()
      LIMIT 10
    `;
    if (!picked.length) return [];

    const products = await loadProductsFromDatabase(undefined, undefined, picked.map(({ id }) => id));
    const byId = new Map(products.map((product) => [product.id, product]));
    return picked.flatMap(({ id }) => {
      const product = byId.get(id);
      return product ? [mapProduct(product)] : [];
    });
  }, 60);
}

export async function getProduct(slug: string) {
  return fromDatabase(["product", slug], ["products"], async () => {
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
  });
}

export async function getProductEngagement(productId: string, viewerId?: string): Promise<ProductEngagement> {
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
  return fromDatabase(["events"], ["events"], async () => (await prisma.event.findMany({ orderBy: { startsAt: "asc" } })).map(mapEvent));
}

export async function getEventsPage(requestedPage: number, pageSize = 4) {
  return fromDatabase(["events-page", String(requestedPage), String(pageSize)], ["events"], async () => {
    const now = new Date();
    const [upcomingCount, pastCount] = await Promise.all([
      prisma.event.count({ where: { startsAt: { gte: now } } }),
      prisma.event.count({ where: { startsAt: { lt: now } } }),
    ]);
    const bounds = pageBounds(upcomingCount + pastCount, requestedPage, pageSize);
    const upcomingTake = Math.min(pageSize, Math.max(0, upcomingCount - bounds.skip));
    const upcoming = upcomingTake ? await prisma.event.findMany({
      where: { startsAt: { gte: now } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: bounds.skip,
      take: upcomingTake,
    }) : [];
    const pastTake = pageSize - upcoming.length;
    const past = pastTake ? await prisma.event.findMany({
      where: { startsAt: { lt: now } },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      skip: Math.max(0, bounds.skip - upcomingCount),
      take: pastTake,
    }) : [];
    return { upcoming: upcoming.map(mapEvent), past: past.map(mapEvent), upcomingCount, page: bounds.page, totalPages: bounds.totalPages };
  });
}

export async function getNextEvent() {
  return fromDatabase(["next-event"], ["events"], async () => {
    const event = await prisma.event.findFirst({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    return event ? mapEvent(event) : null;
  });
}

export async function getGallery(limit?: number) {
  return fromDatabase(["gallery", String(limit ?? "all")], ["gallery"], async () => {
    const photos = await prisma.galleryPhoto.findMany({
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
    });
    return photos.map<GalleryItem>((photo) => ({
      id: photo.id,
      imageUrl: photo.imageUrl,
      thumbnailUrl: photo.thumbnailUrl,
    }));
  });
}

export async function getGalleryPage(requestedPage: number, pageSize = 6) {
  return fromDatabase(["gallery-page", String(requestedPage), String(pageSize)], ["gallery"], async () => {
    const totalCount = await prisma.galleryPhoto.count();
    const bounds = pageBounds(totalCount, requestedPage, pageSize);
    const photos = await prisma.galleryPhoto.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: bounds.skip,
      take: pageSize,
    });
    return {
      photos: photos.map<GalleryItem>((photo) => ({ id: photo.id, imageUrl: photo.imageUrl, thumbnailUrl: photo.thumbnailUrl })),
      page: bounds.page,
      totalPages: bounds.totalPages,
    };
  });
}

export async function getTestimonials(): Promise<TestimonialSummary[]> {
  return fromDatabase(["testimonials"], ["testimonials"],
    () => prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, quote: true, name: true, role: true, company: true, photoUrl: true },
    }),
  );
}

export async function getFounder(slug: string) {
  return fromDatabase(["founder", slug], ["products", "founders"], async () => {
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
  });
}

export async function getSiteSettings() {
  return fromDatabase(["site-settings"], ["settings"], () => prisma.siteSettings.findUnique({ where: { id: 1 } }));
}
