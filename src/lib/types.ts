export type FounderSummary = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  linkedinUrl: string | null;
  instagramHandle: string | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  logoUrl: string | null;
  category: { name: string; slug: string };
  builtInNepal: boolean;
  founder: FounderSummary;
  coFounders: FounderSummary[];
  featured?: boolean;
  upvoteCount: number;
  commentCount: number;
};

export type ProductCommentSummary = {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
};

export type ProductEngagement = {
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  comments: ProductCommentSummary[];
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  venue: string;
  description: string;
  coverImageUrl: string | null;
  lumaUrl: string;
  priceNpr: number | null;
};

export type GalleryItem = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
};

export type TestimonialSummary = {
  id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  photoUrl: string | null;
};
