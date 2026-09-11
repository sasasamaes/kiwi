-- menuItem pasó a ser opcional en OrderItem; la acción por defecto de Prisma
-- para relaciones opcionales es ON DELETE SET NULL (init la creó como RESTRICT
-- cuando la relación era obligatoria). Sin esto, borrar un producto del menú
-- fallaría si algún pedido histórico lo referencia.
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_menu_item_id_fkey";

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
