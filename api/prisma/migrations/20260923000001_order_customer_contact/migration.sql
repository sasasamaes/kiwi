-- Contacto del comprador en pedidos (flujo invitado del link público).
ALTER TABLE "orders" ADD COLUMN "customer_name" TEXT, ADD COLUMN "customer_phone" TEXT;
