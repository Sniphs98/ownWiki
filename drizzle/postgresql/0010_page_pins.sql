CREATE TABLE "page_pin" (
	"user_id" text NOT NULL,
	"path" text NOT NULL,
	CONSTRAINT "page_pin_user_id_path_pk" PRIMARY KEY("user_id","path")
);
--> statement-breakpoint
ALTER TABLE "page_pin" ADD CONSTRAINT "page_pin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;