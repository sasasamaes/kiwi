-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_proof_at" TIMESTAMP(3),
ADD COLUMN     "delivery_proof_photo_url" TEXT,
ADD COLUMN     "pickup_proof_at" TIMESTAMP(3),
ADD COLUMN     "pickup_proof_photo_url" TEXT;
