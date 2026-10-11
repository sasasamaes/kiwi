-- CreateTable
CREATE TABLE "merchant_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_follows_merchant_id_idx" ON "merchant_follows"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_follows_user_id_merchant_id_key" ON "merchant_follows"("user_id", "merchant_id");

-- AddForeignKey
ALTER TABLE "merchant_follows" ADD CONSTRAINT "merchant_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_follows" ADD CONSTRAINT "merchant_follows_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
