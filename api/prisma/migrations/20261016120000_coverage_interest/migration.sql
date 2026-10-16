-- CreateTable
CREATE TABLE "coverage_interests" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT NOT NULL,
    "zone" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "source" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coverage_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coverage_interests_city_notified_created_at_idx" ON "coverage_interests"("city", "notified", "created_at");

-- CreateIndex
CREATE INDEX "coverage_interests_email_city_idx" ON "coverage_interests"("email", "city");
