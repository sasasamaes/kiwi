-- Tope de opciones elegibles por grupo (ej. máximo 3 frutas). Null = sin tope.
ALTER TABLE "menu_item_variant_groups" ADD COLUMN "max_selections" INTEGER;
