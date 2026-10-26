ALTER TABLE "Testimonial" ADD COLUMN "company" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Testimonial" ALTER COLUMN "company" DROP DEFAULT;

INSERT INTO "Testimonial" ("id", "quote", "name", "role", "company", "photoUrl", "sortOrder", "active", "createdAt", "updatedAt") VALUES
  ('preview-testimonial-indra-paudel', 'The best part is being able to bring a messy founder problem to the room and leave with three practical next steps. The conversations feel honest, generous, and grounded in the work.', 'Aarav Shrestha', 'Founder', 'Northstar Labs', '/demo/testimonial-aarav.jpg', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preview-testimonial-hyperce-clicks-cloud', 'It is rare to find a founder community where people share what did not work as openly as what did. That kind of trust makes every introduction and piece of feedback more useful.', 'Maya Karki', 'Co-founder & CEO', 'Morrow Studio', '/demo/testimonial-maya.jpg', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preview-testimonial-nisha-thapa', 'Building from Nepal can feel like solving everything alone. This room reminds me that ambitious people are close by, willing to challenge an idea and help turn it into progress.', 'Nisha Thapa', 'Product Lead', 'Fieldnote', '/demo/testimonial-nisha.jpg', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
