ALTER TABLE "page_link" ADD COLUMN "target_page_id" text;--> statement-breakpoint
ALTER TABLE "page_link" ADD CONSTRAINT "page_link_target_page_id_page_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."page"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_link_target_page_id_idx" ON "page_link" USING btree ("target_page_id");