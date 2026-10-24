export type ProfileDetails = {
  fullName?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  instagramHandle?: string | null;
  profilePicture?: string | null;
  image?: string | null;
};

const completionFields = [
  ["fullName", "full name"],
  ["phone", "phone number"],
  ["linkedinUrl", "LinkedIn URL"],
  ["instagramHandle", "Instagram handle"],
] as const;

export function profileCompletion(profile: ProfileDetails) {
  const missing: string[] = completionFields
    .filter(([field]) => !profile[field]?.trim())
    .map(([, label]) => label);

  if (!(profile.profilePicture || profile.image)?.trim()) missing.push("profile picture");

  return { complete: missing.length === 0, missing };
}

export function incompleteProfileMessage(missing: string[]) {
  if (!missing.length) return "Complete your profile before listing a product.";
  return `Complete your profile before listing a product. Missing: ${missing.join(", ")}.`;
}
