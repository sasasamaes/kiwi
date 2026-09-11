-- AlterTable
ALTER TABLE "orders" ADD COLUMN "weight_kg" DECIMAL(8,2);

-- Menú: los items ligados a pedidos dejan de ser obligatorios
-- (los productos escritos a mano en el wizard se guardan con menu_item_id NULL)
ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;
