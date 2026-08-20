CREATE TYPE "public"."note_category" AS ENUM('INBOX', 'TECHNOLOGY', 'AI_DATA', 'PRODUCT_BUSINESS', 'LEARNING_RESEARCH', 'WORK', 'LIFE', 'OTHER');--> statement-breakpoint
ALTER TABLE "search_notes" ADD COLUMN "category" "note_category" DEFAULT 'INBOX' NOT NULL;--> statement-breakpoint
CREATE INDEX "search_notes_owner_category_idx" ON "search_notes" USING btree ("owner_id", "category");--> statement-breakpoint
CREATE INDEX "search_notes_owner_favorite_idx" ON "search_notes" USING btree ("owner_id", "is_favorite");
