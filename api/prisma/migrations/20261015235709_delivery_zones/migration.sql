-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(10,8),
    "price" DECIMAL(10,2) NOT NULL,
    "geometry" JSONB,
    "reference_only" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_zones_active_idx" ON "delivery_zones"("active");
