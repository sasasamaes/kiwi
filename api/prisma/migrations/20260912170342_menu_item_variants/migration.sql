-- Modifier groups (tamaño, color, extras) per menu item + chosen-variant
-- snapshot on order items. Purely additive: new tables + nullable column.

-- CreateTable menu_item_variant_groups
CREATE TABLE "menu_item_variant_groups" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_variant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable menu_item_variant_options
CREATE TABLE "menu_item_variant_options" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_item_variant_options_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey variant group -> menu item (cascade: deleting an item
-- removes its modifier setup)
ALTER TABLE "menu_item_variant_groups" ADD CONSTRAINT "menu_item_variant_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey variant option -> group (cascade)
ALTER TABLE "menu_item_variant_options" ADD CONSTRAINT "menu_item_variant_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_item_variant_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Snapshot of chosen variants on historical order lines
ALTER TABLE "order_items" ADD COLUMN "selected_variants" JSONB;
