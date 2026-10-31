CREATE TABLE "page_link" (
	"page_id" text NOT NULL,
	"target" text NOT NULL,
	CONSTRAINT "page_link_page_id_target_pk" PRIMARY KEY("page_id","target")
);
--> statement-breakpoint
ALTER TABLE "page_link" ADD CONSTRAINT "page_link_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_link_target_idx" ON "page_link" USING btree ("target");