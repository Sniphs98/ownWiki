CREATE TABLE "page_redirect" (
	"path" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_redirect" ADD CONSTRAINT "page_redirect_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;