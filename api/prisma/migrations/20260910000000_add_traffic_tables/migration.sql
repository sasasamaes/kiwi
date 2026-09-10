-- CreateTable traffic_history
CREATE TABLE "traffic_history" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zone" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "speed_factor" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_history_zone_timestamp_idx" ON "traffic_history"("zone", "timestamp");

-- CreateTable traffic_alerts
CREATE TABLE "traffic_alerts" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "radius_km" DOUBLE PRECISION,
    "expires_at" TIMESTAMP(3),
    "alternative_description" TEXT,
    "alternative_time_saved" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_alerts_alert_id_key" ON "traffic_alerts"("alert_id");

-- CreateTable traffic_alert_notifications
CREATE TABLE "traffic_alert_notifications" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_alert_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_alert_notifications_driver_id_alert_id_key" ON "traffic_alert_notifications"("driver_id", "alert_id");
