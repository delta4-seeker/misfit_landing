import { PrismaClient } from "@prisma/client";

import { directDatabaseUrl } from "../src/lib/database-url";

const prisma = new PrismaClient({ datasourceUrl: directDatabaseUrl() });

const categories = ["SaaS", "AI / ML", "Fintech", "Edtech", "Healthtech", "E-commerce", "Dev Tools", "Other"];

const previewFounders = {
  "manish-modi": {
    email: "preview+khalti@misfitfoundersclub.com",
    name: "Manish Modi",
    profilePicture: "/demo/production/people/founders/manish-modi.jpg",
    linkedinUrl: "https://www.linkedin.com/in/manishmodinp",
  },
  "amit-agrawal": {
    email: "preview+khalti-amit-agrawal@misfitfoundersclub.com",
    name: "Amit Agrawal",
    profilePicture: "/demo/production/people/founders/amit-agrawal.jpg",
    linkedinUrl: "https://www.linkedin.com/in/amitagrhere",
  },
  "arvind-sah": {
    email: "preview+khalti-arvind-sah@misfitfoundersclub.com",
    name: "Arvind Sah",
    profilePicture: "/demo/production/people/founders/arvind-sah.jpg",
    linkedinUrl: null,
  },
  "dhruba-adhikari": {
    email: "preview+khalti-dhruba-adhikari@misfitfoundersclub.com",
    name: "Dhruba Adhikari",
    profilePicture: "/demo/production/people/founders/dhruba-adhikari.jpg",
    linkedinUrl: null,
  },
  "manohar-adhikari": {
    email: "preview+foodmandu@misfitfoundersclub.com",
    name: "Manohar Adhikari",
    profilePicture: "/demo/production/people/founders/manohar-adhikari.jpg",
    linkedinUrl: "https://www.linkedin.com/in/manohar-adhikari-241b1b36",
  },
  "shankar-uprety": {
    email: "preview+hamro-patro@misfitfoundersclub.com",
    name: "Shankar Uprety",
    profilePicture: "/demo/production/people/founders/shankar-uprety.png",
    linkedinUrl: "https://www.linkedin.com/in/shankaruprety",
  },
  "biswas-dhakal": {
    email: "preview+esewa@misfitfoundersclub.com",
    name: "Biswas Dhakal",
    profilePicture: "/demo/production/people/founders/biswas-dhakal.png",
    linkedinUrl: null,
  },
  "asgar-ali": {
    email: "preview+esewa-asgar-ali@misfitfoundersclub.com",
    name: "Asgar Ali",
    profilePicture: "/demo/production/people/founders/asgar-ali.jpg",
    linkedinUrl: "https://www.linkedin.com/in/asgaralishah",
  },
  "shailendra-raj-giri": {
    email: "preview+merojob@misfitfoundersclub.com",
    name: "Shailendra Raj Giri",
    profilePicture: "/demo/production/people/founders/shailendra-raj-giri.jpg",
    linkedinUrl: "https://www.linkedin.com/in/shgiri",
  },
} as const;

const previewProducts = [
  {
    slug: "khalti",
    name: "Khalti",
    founderKeys: ["manish-modi", "amit-agrawal", "arvind-sah", "dhruba-adhikari"],
    category: "fintech",
    tagline: "A mobile wallet and payment gateway for Nepal.",
    description: "Khalti brings digital payments, bills, bookings, transfers, and merchant services into one connected experience.",
    websiteUrl: "https://khalti.com/",
    logoUrl: "/demo/production/products/khalti.png",
  },
  {
    slug: "foodmandu",
    name: "Foodmandu",
    founderKeys: ["manohar-adhikari"],
    category: "e-commerce",
    tagline: "Food and essentials delivered across Nepal.",
    description: "Foodmandu connects customers with restaurants, groceries, and everyday essentials across major Nepali cities.",
    websiteUrl: "https://foodmandu.com/",
    logoUrl: "/demo/production/products/foodmandu.png",
  },
  {
    slug: "hamro-patro",
    name: "Hamro Patro",
    founderKeys: ["shankar-uprety"],
    category: "other",
    tagline: "The digital companion for Nepalis worldwide.",
    description: "Hamro Patro combines the Nepali calendar, news, radio, forex, date tools, notes, and more in one platform.",
    websiteUrl: "https://www.hamropatro.com/",
    logoUrl: "/demo/production/products/hamro-patro.png",
  },
  {
    slug: "esewa",
    name: "eSewa",
    founderKeys: ["biswas-dhakal", "asgar-ali"],
    category: "fintech",
    tagline: "Everyday digital payments in one wallet.",
    description: "eSewa helps people pay bills, top up, transfer funds, book travel, and pay merchants across Nepal.",
    websiteUrl: "https://esewa.com.np/",
    logoUrl: "/demo/production/products/esewa.png",
  },
  {
    slug: "merojob",
    name: "Merojob",
    founderKeys: ["shailendra-raj-giri"],
    category: "saas",
    tagline: "Jobs, talent, and recruitment for Nepal.",
    description: "Merojob connects jobseekers and employers with job discovery, candidate profiles, applications, and recruitment tools.",
    websiteUrl: "https://merojob.com/",
    logoUrl: "/demo/production/products/merojob.svg",
  },
  {
    slug: "fonepay",
    name: "Fonepay",
    founderKeys: ["biswas-dhakal", "asgar-ali"],
    category: "fintech",
    tagline: "Nepal’s interoperable digital payment network.",
    description: "Fonepay connects banks, wallets, customers, and merchants for instant QR, transfer, bill, and checkout payments.",
    websiteUrl: "https://fonepay.com/",
    logoUrl: "/demo/production/products/fonepay.png",
  },
] as const;

const previewEvents = [
  {
    slug: "pytorch-community-nepal",
    title: "PyTorch Community Nepal",
    startsAt: new Date("2026-10-25T20:15:00+05:45"),
    venue: "Online · Google Meet",
    description: "A technical session on accelerating LLM inference with speculative decoding at the edge.",
    coverImageUrl: "/demo/production/events/pytorch-community-nepal.jpg",
    lumaUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfb08vVfE9nCgranjCipAZT2DlBKz7y03x2wUmFy4XIho8nwg/viewform",
  },
  {
    slug: "frogtoberfest-2026-demo-day",
    title: "Frogtoberfest 2026 Demo Day",
    startsAt: new Date("2026-10-30T17:00:00+05:45"),
    venue: "Leapfrog Technology · Kathmandu",
    description: "Nepal-based teams demo open-source, AI-powered products built to solve meaningful problems.",
    coverImageUrl: "/demo/production/events/frogtoberfest.jpg",
    lumaUrl: "https://frogtoberfest.lftechnology.com/",
  },
  {
    slug: "hacking-for-youth-employment-in-digital-nepal",
    title: "Hacking for Youth Employment in Digital Nepal",
    startsAt: new Date("2026-11-22T09:00:00+05:45"),
    venue: "King’s College · Kathmandu",
    description: "Women innovators from all seven provinces build technology that expands youth employment opportunities.",
    coverImageUrl: "/demo/production/events/shequal-hackathon.jpg",
    lumaUrl: "https://www.eventkarobar.com/events/hacking-for-youth-employment-in-digital-nepal",
  },
] as const;

const previewGallery = [
  ["build-night", "/demo/production/gallery/build-night.jpg", "Production preview · Build night"],
  ["working-session", "/demo/production/gallery/working-session.jpg", "Production preview · Working session"],
  ["founder-dinner", "/demo/production/gallery/founder-dinner.jpg", "Production preview · Founder dinner"],
  ["feedback-circle", "/demo/production/gallery/feedback-circle.jpg", "Production preview · Feedback circle"],
  ["community-space", "/demo/production/gallery/community-space.jpg", "Production preview · Community space"],
] as const;

const adversarialUsers = [
  {
    key: "complete",
    email: "test+complete@misfitfoundersclub.com",
    name: "TEST · Aarav “Edge” श्रेष्ठ",
    phone: "+977 980-000-0000",
    linkedinUrl: "https://www.linkedin.com/in/test-founder-edge",
    instagramHandle: "test_founder.edge",
    profilePicture: "/demo/production/people/founders/manish-modi.jpg",
    profileCompleted: true,
    status: "ACTIVE" as const,
  },
  {
    key: "placeholder",
    email: "test+placeholder@misfitfoundersclub.com",
    name: "TEST · Founder Without A Photo",
    phone: null,
    linkedinUrl: null,
    instagramHandle: null,
    profilePicture: null,
    profileCompleted: false,
    status: "ACTIVE" as const,
  },
  {
    key: "long-name",
    email: "test+long-name@misfitfoundersclub.com",
    name: "TEST · A Founder With An Intentionally Long Display Name",
    phone: "+977 981-111-1111",
    linkedinUrl: "https://www.linkedin.com/in/test-long-name-founder",
    instagramHandle: "test_long_name_founder",
    profilePicture: "/demo/production/people/founders/amit-agrawal.jpg",
    profileCompleted: true,
    status: "ACTIVE" as const,
  },
  {
    key: "suspended",
    email: "test+suspended@misfitfoundersclub.com",
    name: "TEST · Suspended Member",
    phone: "+977 982-222-2222",
    linkedinUrl: "https://www.linkedin.com/in/test-suspended-founder",
    instagramHandle: "test_suspended_founder",
    profilePicture: "/demo/production/people/founders/arvind-sah.jpg",
    profileCompleted: true,
    status: "SUSPENDED" as const,
  },
  {
    key: "banned",
    email: "test+banned@misfitfoundersclub.com",
    name: "TEST · Banned Member",
    phone: "+977 983-333-3333",
    linkedinUrl: "https://www.linkedin.com/in/test-banned-founder",
    instagramHandle: "test_banned_founder",
    profilePicture: "/demo/production/people/founders/dhruba-adhikari.jpg",
    profileCompleted: true,
    status: "BANNED" as const,
  },
] as const;

function relativeDate(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function seedAdversarialData(categoryBySlug: Map<string, { id: string }>, adminId: string) {
  const userRows = await Promise.all(adversarialUsers.map(async (entry) => {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        email: entry.email,
        name: entry.name,
        fullName: entry.name,
        phone: entry.phone,
        linkedinUrl: entry.linkedinUrl,
        instagramHandle: entry.instagramHandle,
        profilePicture: entry.profilePicture,
        profileCompleted: entry.profileCompleted,
        status: entry.status,
      },
      update: {
        name: entry.name,
        fullName: entry.name,
        phone: entry.phone,
        linkedinUrl: entry.linkedinUrl,
        instagramHandle: entry.instagramHandle,
        profilePicture: entry.profilePicture,
        profileCompleted: entry.profileCompleted,
        status: entry.status,
      },
    });
    return [entry.key, user] as const;
  }));
  const users = new Map(userRows);
  const complete = users.get("complete")!;
  const placeholder = users.get("placeholder")!;
  const longName = users.get("long-name")!;
  const banned = users.get("banned")!;
  const other = categoryBySlug.get("other")!;
  const saas = categoryBySlug.get("saas")!;
  const ai = categoryBySlug.get("ai-ml")!;

  const live = await prisma.product.upsert({
    where: { slug: "test-adversarial-live" },
    create: {
      ownerId: complete.id,
      categoryId: other.id,
      name: "TEST · Unicode, Empty Logo & Many Founders — उत्पादन प्रयोगशाला",
      slug: "test-adversarial-live",
      companyName: "TEST · Edge Case Labs (Nepal) Pvt. Ltd.",
      websiteUrl: "https://example.com/products/adversarial-live?source=club&case=unicode",
      linkedinUrl: "https://www.linkedin.com/company/example",
      instagramHandle: "test.edge_case",
      founderType: "Co-founded",
      tagline: "A production-like listing with Unicode, a long title, no logo, and multiple founder profiles.",
      description: "This intentionally demanding listing checks placeholder artwork, long copy, Unicode नेपाली text, ampersands, punctuation, co-founder layouts, comments, upvotes, and responsive card truncation without relying on fake lorem ipsum.",
      logoUrl: null,
      foundedMonth: 2,
      foundedYear: 2026,
      builtInNepal: true,
      exclusive: true,
      featured: true,
      featuredOrder: 90,
      status: "LIVE",
      coFounders: { connect: [{ id: placeholder.id }, { id: longName.id }] },
    },
    update: {
      ownerId: complete.id,
      categoryId: other.id,
      name: "TEST · Unicode, Empty Logo & Many Founders — उत्पादन प्रयोगशाला",
      companyName: "TEST · Edge Case Labs (Nepal) Pvt. Ltd.",
      websiteUrl: "https://example.com/products/adversarial-live?source=club&case=unicode",
      tagline: "A production-like listing with Unicode, a long title, no logo, and multiple founder profiles.",
      description: "This intentionally demanding listing checks placeholder artwork, long copy, Unicode नेपाली text, ampersands, punctuation, co-founder layouts, comments, upvotes, and responsive card truncation without relying on fake lorem ipsum.",
      logoUrl: null,
      builtInNepal: true,
      exclusive: true,
      featured: true,
      featuredOrder: 90,
      status: "LIVE",
      coFounders: { set: [{ id: placeholder.id }, { id: longName.id }] },
    },
  });

  await prisma.product.upsert({
    where: { slug: "test-draft-minimum-fields" },
    create: {
      ownerId: placeholder.id,
      categoryId: saas.id,
      name: "TEST · Draft With Minimum Fields",
      slug: "test-draft-minimum-fields",
      websiteUrl: "https://example.com/draft",
      tagline: "Minimum valid content.",
      description: "A draft record used to verify admin visibility and public filtering.",
      status: "DRAFT",
      builtInNepal: false,
    },
    update: { ownerId: placeholder.id, categoryId: saas.id, status: "DRAFT", builtInNepal: false },
  });

  await prisma.product.upsert({
    where: { slug: "test-hidden-boundary-copy" },
    create: {
      ownerId: banned.id,
      categoryId: ai.id,
      name: "TEST · Hidden Product",
      slug: "test-hidden-boundary-copy",
      websiteUrl: "https://example.com/hidden",
      tagline: "This listing must never appear publicly.",
      description: "A hidden product owned by a banned account verifies both listing and owner access filters.",
      logoUrl: "/demo/production/products/hamro-patro.png",
      status: "HIDDEN",
    },
    update: { ownerId: banned.id, categoryId: ai.id, status: "HIDDEN" },
  });

  for (const userId of [complete.id, placeholder.id, longName.id]) {
    await prisma.productVote.upsert({
      where: { productId_userId: { productId: live.id, userId } },
      create: { productId: live.id, userId },
      update: {},
    });
  }

  const comments = [
    ["test-comment-unicode", complete.id, "Looks useful — नेपाली founders can read this too 🚀\nSecond line checks preserved whitespace."],
    ["test-comment-html", placeholder.id, "Markup must render as text, never execute: <script>alert(\"escaped\")</script> & <strong>safe</strong>."],
    ["test-comment-boundary", longName.id, ("Exactly five hundred characters are accepted here. " + "0123456789 · ".repeat(50)).slice(0, 500)],
  ] as const;
  for (const [id, authorId, body] of comments) {
    await prisma.productComment.upsert({
      where: { id },
      create: { id, productId: live.id, authorId, body },
      update: { productId: live.id, authorId, body },
    });
  }

  const invitations = [
    { email: "test+invite-pending@misfitfoundersclub.com", status: "PENDING" as const, expiresAt: relativeDate(7, 12), acceptedUserId: null },
    { email: longName.email!, status: "ACCEPTED" as const, expiresAt: relativeDate(30, 12), acceptedUserId: longName.id },
    { email: "test+invite-revoked@misfitfoundersclub.com", status: "REVOKED" as const, expiresAt: relativeDate(7, 12), acceptedUserId: null },
    { email: "test+invite-expired@misfitfoundersclub.com", status: "EXPIRED" as const, expiresAt: relativeDate(-7, 12), acceptedUserId: null },
  ];
  for (const invite of invitations) {
    await prisma.coFounderInvite.upsert({
      where: { productId_email: { productId: live.id, email: invite.email } },
      create: { productId: live.id, ...invite },
      update: invite,
    });
  }

  const testEvents = [
    {
      slug: "test-paid-nearly-full-event",
      title: "TEST · Paid founder dinner with a deliberately long event title",
      startsAt: relativeDate(5, 18),
      venue: "The longest plausible venue label · Floor 12 · Lalitpur, Nepal",
      description: "A nearly full paid event that verifies prices, capacity, long copy, and the external registration flow.",
      coverImageUrl: "/demo/production/events/frogtoberfest.jpg",
      lumaUrl: "https://lu.ma/example-paid-event",
      capacity: 1,
      priceNpr: 1499.99,
    },
    {
      slug: "test-free-online-no-image",
      title: "TEST · Free online event without artwork",
      startsAt: relativeDate(14, 9),
      venue: "Online",
      description: "No cover image and no price exercise the intentional event artwork fallback.",
      coverImageUrl: null,
      lumaUrl: "https://lu.ma/example-free-event",
      capacity: null,
      priceNpr: null,
    },
    {
      slug: "test-past-zero-capacity",
      title: "TEST · Past event with zero capacity",
      startsAt: relativeDate(-30, 8),
      venue: "Kathmandu",
      description: "A past event verifies archive grouping and the zero-capacity boundary.",
      coverImageUrl: "/demo/production/events/pytorch-community-nepal.jpg",
      lumaUrl: "https://lu.ma/example-past-event",
      capacity: 0,
      priceNpr: 0,
    },
  ];
  for (const event of testEvents) {
    await prisma.event.upsert({ where: { slug: event.slug }, create: event, update: event });
  }

  const testGallery = [
    { id: "test-gallery-no-caption", imageUrl: "/demo/production/gallery/community-space.jpg", caption: null },
    { id: "test-gallery-long-caption", imageUrl: "/demo/production/gallery/feedback-circle.jpg", caption: "TEST · A deliberately long gallery caption with नेपाली Unicode, punctuation — and <markup-like text> to verify wrapping, escaping, and the complete 180-character boundary without breaking the layout.".slice(0, 180) },
    { id: "test-gallery-portrait-fallback", imageUrl: "/demo/production/people/prashant-soni.webp", caption: "TEST · Portrait image crop" },
  ];
  for (const photo of testGallery) {
    await prisma.galleryPhoto.upsert({
      where: { id: photo.id },
      create: { ...photo, uploaderId: adminId },
      update: { imageUrl: photo.imageUrl, caption: photo.caption, uploaderId: adminId },
    });
  }

  for (const subscriber of [
    { email: "test+newsletter-active@misfitfoundersclub.com", active: true },
    { email: "test+newsletter-unsubscribed@misfitfoundersclub.com", active: false },
  ]) {
    await prisma.newsletterSubscriber.upsert({ where: { email: subscriber.email }, create: subscriber, update: { active: subscriber.active } });
  }
}

async function main() {
  const categoryRows = await Promise.all(categories.map((name, index) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return prisma.category.upsert({
      where: { slug },
      create: { name, slug, sortOrder: index },
      update: { name, sortOrder: index },
    });
  }));
  const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category]));

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "9165prashant@gmail.com").toLowerCase();
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Prashant Soni", fullName: "Prashant Soni", isAdmin: true, isSuperAdmin: true },
    update: { isAdmin: true, isSuperAdmin: true },
  });

  await prisma.product.deleteMany({
    where: {
      slug: {
        in: ["lekhai", "fieldnote", "hisaab", "pathshala-os", "saathi-health", "ship-nepal", "relay", "bare-minimum", "one-specific-tool"],
      },
    },
  });

  const founderRows = await Promise.all(Object.entries(previewFounders).map(async ([key, founder]) => {
    const user = await prisma.user.upsert({
      where: { email: founder.email },
      create: {
        email: founder.email,
        name: founder.name,
        fullName: founder.name,
        profilePicture: founder.profilePicture,
        linkedinUrl: founder.linkedinUrl,
        profileCompleted: true,
      },
      update: {
        name: founder.name,
        fullName: founder.name,
        profilePicture: founder.profilePicture,
        linkedinUrl: founder.linkedinUrl,
        profileCompleted: true,
      },
    });
    return [key, user] as const;
  }));
  const founderByKey = new Map(founderRows);

  for (const [index, product] of previewProducts.entries()) {
    const productFounders = product.founderKeys.map((key) => founderByKey.get(key));
    if (productFounders.some((founder) => !founder)) throw new Error(`Missing founder for ${product.slug}`);
    const [owner, ...coFounders] = productFounders;
    if (!owner) throw new Error(`Missing primary founder for ${product.slug}`);
    const category = categoryBySlug.get(product.category);
    if (!category) throw new Error(`Missing category: ${product.category}`);
    await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        ownerId: owner.id,
        categoryId: category.id,
        slug: product.slug,
        name: product.name,
        companyName: product.name,
        websiteUrl: product.websiteUrl,
        tagline: product.tagline,
        description: product.description,
        logoUrl: product.logoUrl,
        builtInNepal: true,
        exclusive: index < 4,
        featured: index < 4,
        featuredOrder: index,
        status: "LIVE",
        coFounders: { connect: coFounders.map((founder) => ({ id: founder!.id })) },
      },
      update: {
        ownerId: owner.id,
        categoryId: category.id,
        name: product.name,
        companyName: product.name,
        websiteUrl: product.websiteUrl,
        tagline: product.tagline,
        description: product.description,
        logoUrl: product.logoUrl,
        builtInNepal: true,
        exclusive: index < 4,
        featured: index < 4,
        featuredOrder: index,
        status: "LIVE",
        coFounders: { set: coFounders.map((founder) => ({ id: founder!.id })) },
      },
    });
  }


  await prisma.user.deleteMany({
    where: {
      email: "preview+fonepay@misfitfoundersclub.com",
      products: { none: {} },
      coFoundedProducts: { none: {} },
    },
  });

  await prisma.event.deleteMany({ where: { slug: "founders-uncomfortable-truths" } });
  for (const event of previewEvents) {
    await prisma.event.upsert({
      where: { slug: event.slug },
      create: event,
      update: event,
    });
  }

  await prisma.galleryPhoto.deleteMany({ where: { id: { startsWith: "seed-gallery-" } } });
  for (const [id, imageUrl, caption] of previewGallery) {
    await prisma.galleryPhoto.upsert({
      where: { id: `preview-gallery-${id}` },
      create: { id: `preview-gallery-${id}`, imageUrl, caption, uploaderId: admin.id },
      update: { imageUrl, caption },
    });
  }

  await seedAdversarialData(categoryBySlug, admin.id);

  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log(`Seed complete. Admin access will be granted to ${adminEmail} after Google login.`);
}

main().finally(() => prisma.$disconnect());
