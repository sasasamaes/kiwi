-- CreateEnum
CREATE TYPE "DebtExpenseKind" AS ENUM ('mantenimiento', 'seguro', 'gasolina', 'repuesto', 'marchamo', 'otro');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('active', 'finished', 'cancelled');

-- CreateTable
CREATE TABLE "debt_participants" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_expenses" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "kind" "DebtExpenseKind" NOT NULL DEFAULT 'otro',
    "driver_id" TEXT,
    "note" TEXT,
    "spent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT,
    "driver_id" TEXT NOT NULL,
    "weekly_price" DECIMAL(10,2) NOT NULL,
    "deposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" "RentalStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_payments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_participants_debt_idx" ON "debt_participants"("debt_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_participants_debt_driver_uk" ON "debt_participants"("debt_id", "driver_id");

-- CreateIndex
CREATE INDEX "debt_expenses_debt_spent_idx" ON "debt_expenses"("debt_id", "spent_at");

-- CreateIndex
CREATE INDEX "rental_contracts_driver_status_idx" ON "rental_contracts"("driver_id", "status");

-- CreateIndex
CREATE INDEX "rental_payments_contract_paid_idx" ON "rental_payments"("contract_id", "paid_at");

-- AddForeignKey
ALTER TABLE "debt_participants" ADD CONSTRAINT "debt_participants_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_participants" ADD CONSTRAINT "debt_participants_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_expenses" ADD CONSTRAINT "debt_expenses_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_expenses" ADD CONSTRAINT "debt_expenses_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "rental_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
