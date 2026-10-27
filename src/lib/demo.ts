import type { EventSummary, FounderSummary, GalleryItem, ProductSummary, TestimonialSummary } from "@/lib/types";

export const demoCategories = [
  { id: "saas", name: "SaaS", slug: "saas" },
  { id: "ai-ml", name: "AI / ML", slug: "ai-ml" },
  { id: "fintech", name: "Fintech", slug: "fintech" },
  { id: "edtech", name: "Edtech", slug: "edtech" },
  { id: "healthtech", name: "Healthtech", slug: "healthtech" },
  { id: "ecommerce", name: "E-commerce", slug: "e-commerce" },
  { id: "devtools", name: "Dev Tools", slug: "dev-tools" },
  { id: "other", name: "Other", slug: "other" },
];

export const demoFounders: FounderSummary[] = [
  { key: "manish-modi", name: "Manish Modi", image: "/demo/production/people/founders/manish-modi.jpg", linkedinUrl: "https://www.linkedin.com/in/manishmodinp" },
  { key: "amit-agrawal", name: "Amit Agrawal", image: "/demo/production/people/founders/amit-agrawal.jpg", linkedinUrl: "https://www.linkedin.com/in/amitagrhere" },
  { key: "arvind-sah", name: "Arvind Sah", image: "/demo/production/people/founders/arvind-sah.jpg", linkedinUrl: null },
  { key: "dhruba-adhikari", name: "Dhruba Adhikari", image: "/demo/production/people/founders/dhruba-adhikari.jpg", linkedinUrl: null },
  { key: "manohar-adhikari", name: "Manohar Adhikari", image: "/demo/production/people/founders/manohar-adhikari.jpg", linkedinUrl: "https://www.linkedin.com/in/manohar-adhikari-241b1b36" },
  { key: "shankar-uprety", name: "Shankar Uprety", image: "/demo/production/people/founders/shankar-uprety.png", linkedinUrl: "https://www.linkedin.com/in/shankaruprety" },
  { key: "biswas-dhakal", name: "Biswas Dhakal", image: "/demo/production/people/founders/biswas-dhakal.png", linkedinUrl: null },
  { key: "asgar-ali", name: "Asgar Ali", image: "/demo/production/people/founders/asgar-ali.jpg", linkedinUrl: "https://www.linkedin.com/in/asgaralishah" },
  { key: "shailendra-raj-giri", name: "Shailendra Raj Giri", image: "/demo/production/people/founders/shailendra-raj-giri.jpg", linkedinUrl: "https://www.linkedin.com/in/shgiri" },
].map(({ key, ...founder }) => ({
  id: `preview-founder-${key}`,
  slug: `${key}-preview`,
  ...founder,
  instagramHandle: null,
}));

const demoFounderByKey = new Map(demoFounders.map((founder) => [founder.slug.replace(/-preview$/, ""), founder]));

const productData = [
  {
    slug: "khalti",
    name: "Khalti",
    founderKeys: ["manish-modi", "amit-agrawal", "arvind-sah", "dhruba-adhikari"],
    tagline: "A mobile wallet and payment gateway for Nepal.",
    description: "Khalti brings digital payments, bills, bookings, transfers, and merchant services into one connected experience.",
    websiteUrl: "https://khalti.com/",
    logoUrl: "/demo/production/products/khalti.png",
    category: { name: "Fintech", slug: "fintech" },
  },
  {
    slug: "foodmandu",
    name: "Foodmandu",
    founderKeys: ["manohar-adhikari"],
    tagline: "Food and essentials delivered across Nepal.",
    description: "Foodmandu connects customers with restaurants, groceries, and everyday essentials across major Nepali cities.",
    websiteUrl: "https://foodmandu.com/",
    logoUrl: "/demo/production/products/foodmandu.png",
    category: { name: "E-commerce", slug: "e-commerce" },
  },
  {
    slug: "hamro-patro",
    name: "Hamro Patro",
    founderKeys: ["shankar-uprety"],
    tagline: "The digital companion for Nepalis worldwide.",
    description: "Hamro Patro combines the Nepali calendar, news, radio, forex, date tools, notes, and more in one platform.",
    websiteUrl: "https://www.hamropatro.com/",
    logoUrl: "/demo/production/products/hamro-patro.png",
    category: { name: "Other", slug: "other" },
  },
  {
    slug: "esewa",
    name: "eSewa",
    founderKeys: ["biswas-dhakal", "asgar-ali"],
    tagline: "Everyday digital payments in one wallet.",
    description: "eSewa helps people pay bills, top up, transfer funds, book travel, and pay merchants across Nepal.",
    websiteUrl: "https://esewa.com.np/",
    logoUrl: "/demo/production/products/esewa.png",
    category: { name: "Fintech", slug: "fintech" },
  },
  {
    slug: "merojob",
    name: "Merojob",
    founderKeys: ["shailendra-raj-giri"],
    tagline: "Jobs, talent, and recruitment for Nepal.",
    description: "Merojob connects jobseekers and employers with job discovery, candidate profiles, applications, and recruitment tools.",
    websiteUrl: "https://merojob.com/",
    logoUrl: "/demo/production/products/merojob.svg",
    category: { name: "SaaS", slug: "saas" },
  },
  {
    slug: "fonepay",
    name: "Fonepay",
    founderKeys: ["biswas-dhakal", "asgar-ali"],
    tagline: "Nepal’s interoperable digital payment network.",
    description: "Fonepay connects banks, wallets, customers, and merchants for instant QR, transfer, bill, and checkout payments.",
    websiteUrl: "https://fonepay.com/",
    logoUrl: "/demo/production/products/fonepay.png",
    category: { name: "Fintech", slug: "fintech" },
  },
] as const;

export const demoProducts: ProductSummary[] = productData.map((product, index) => ({
  id: `preview-product-${product.slug}`,
  slug: product.slug,
  name: product.name,
  tagline: product.tagline,
  description: product.description,
  websiteUrl: product.websiteUrl,
  logoUrl: product.logoUrl,
  category: product.category,
  founder: demoFounderByKey.get(product.founderKeys[0])!,
  coFounders: product.founderKeys.slice(1).map((key) => demoFounderByKey.get(key)!),
  featured: index < 4,
  upvoteCount: 0,
  commentCount: 0,
}));

export const demoEvents: EventSummary[] = [
  {
    id: "preview-event-pytorch-nepal",
    slug: "pytorch-community-nepal",
    title: "PyTorch Community Nepal",
    startsAt: new Date("2026-10-25T20:15:00+05:45"),
    venue: "Online · Google Meet",
    description: "A technical session on accelerating LLM inference with speculative decoding at the edge.",
    coverImageUrl: "/demo/production/events/pytorch-community-nepal.jpg",
    lumaUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfb08vVfE9nCgranjCipAZT2DlBKz7y03x2wUmFy4XIho8nwg/viewform",
    priceNpr: null,
  },
  {
    id: "preview-event-frogtoberfest",
    slug: "frogtoberfest-2026-demo-day",
    title: "Frogtoberfest 2026 Demo Day",
    startsAt: new Date("2026-10-30T17:00:00+05:45"),
    venue: "Leapfrog Technology · Kathmandu",
    description: "Nepal-based teams demo open-source, AI-powered products built to solve meaningful problems.",
    coverImageUrl: "/demo/production/events/frogtoberfest.jpg",
    lumaUrl: "https://frogtoberfest.lftechnology.com/",
    priceNpr: null,
  },
  {
    id: "preview-event-shequal",
    slug: "hacking-for-youth-employment-in-digital-nepal",
    title: "Hacking for Youth Employment in Digital Nepal",
    startsAt: new Date("2026-11-22T09:00:00+05:45"),
    venue: "King’s College · Kathmandu",
    description: "Women innovators from all seven provinces build technology that expands youth employment opportunities.",
    coverImageUrl: "/demo/production/events/shequal-hackathon.jpg",
    lumaUrl: "https://www.eventkarobar.com/events/hacking-for-youth-employment-in-digital-nepal",
    priceNpr: null,
  },
];

export const demoGallery: GalleryItem[] = [
  ["build-night", "/demo/production/gallery/build-night.jpg"],
  ["working-session", "/demo/production/gallery/working-session.jpg"],
  ["founder-dinner", "/demo/production/gallery/founder-dinner.jpg"],
  ["feedback-circle", "/demo/production/gallery/feedback-circle.jpg"],
  ["community-space", "/demo/production/gallery/community-space.jpg"],
].map(([id, imageUrl]) => ({
  id: `preview-photo-${id}`,
  imageUrl,
  thumbnailUrl: null,
}));

export const demoTestimonials: (TestimonialSummary & { sortOrder: number; active: boolean })[] = [
  {
    id: "preview-testimonial-indra-paudel",
    quote: "The best part is being able to bring a messy founder problem to the room and leave with three practical next steps. The conversations feel honest, generous, and grounded in the work.",
    name: "Aarav Shrestha",
    role: "Founder",
    company: "Northstar Labs",
    photoUrl: "/demo/testimonial-aarav.jpg",
    sortOrder: 1,
    active: true,
  },
  {
    id: "preview-testimonial-hyperce-clicks-cloud",
    quote: "It is rare to find a founder community where people share what did not work as openly as what did. That kind of trust makes every introduction and piece of feedback more useful.",
    name: "Maya Karki",
    role: "Co-founder & CEO",
    company: "Morrow Studio",
    photoUrl: "/demo/testimonial-maya.jpg",
    sortOrder: 2,
    active: true,
  },
  {
    id: "preview-testimonial-nisha-thapa",
    quote: "Building from Nepal can feel like solving everything alone. This room reminds me that ambitious people are close by, willing to challenge an idea and help turn it into progress.",
    name: "Nisha Thapa",
    role: "Product Lead",
    company: "Fieldnote",
    photoUrl: "/demo/testimonial-nisha.jpg",
    sortOrder: 3,
    active: true,
  },
];
