CREATE TABLE "page_tag" (
	"page_id" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "page_tag_page_id_tag_pk" PRIMARY KEY("page_id","tag")
);
--> statement-breakpoint
ALTER TABLE "page_tag" ADD CONSTRAINT "page_tag_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_tag_tag_idx" ON "page_tag" USING btree ("tag");