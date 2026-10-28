ALTER TABLE "SiteSettings"
  ADD COLUMN "lumaCalendarUrl" TEXT NOT NULL DEFAULT 'https://luma.com/user/misfitfounders',
  ADD COLUMN "homepageLumaEventUrl" TEXT,
  ADD COLUMN "homepageLumaEventId" TEXT;
