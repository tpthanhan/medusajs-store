import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261025090757 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "variant_import_price" drop constraint if exists "variant_import_price_variant_id_unique";`);
    this.addSql(`create table if not exists "variant_import_price" ("id" text not null, "variant_id" text not null, "original_price" integer null, "import_shipping_price" integer null, "imported_total_price" integer not null, "is_total_overridden" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "variant_import_price_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_variant_import_price_deleted_at" ON "variant_import_price" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_import_price_variant_id_unique" ON "variant_import_price" ("variant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "variant_import_price" cascade;`);
  }

}
