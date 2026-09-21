-- Historial mensual de escenarios del reporte Real vs Proyección:
-- un snapshot de proyección fijado por el admin al cierre de cada mes,
-- para comparar contra lo que realmente pasó después.
CREATE TABLE "scenario_snapshots" (
  "id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "orders_per_day" INTEGER NOT NULL,
  "expected_trip" DOUBLE PRECISION NOT NULL,
  "commission_pct" DOUBLE PRECISION NOT NULL,
  "operations" JSONB NOT NULL,
  "projected_commission" DOUBLE PRECISION NOT NULL,
  "projected_net" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scenario_snapshots_pkey" PRIMARY KEY ("id")
);

-- Un snapshot por mes: re-fijar reemplaza el anterior.
CREATE UNIQUE INDEX "scenario_snapshots_month_key" ON "scenario_snapshots"("month");
