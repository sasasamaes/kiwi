import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface DriftedTable {
  table: string;
  missingColumns: string[];
}

export interface DriftReport {
  status: 'ok' | 'drift';
  checkedAt: string;
  modelsChecked: number;
  driftedTables: DriftedTable[];
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Compare the columns the running Prisma Client expects (from the DMMF of
   * the deployed schema) against the columns that actually exist in the live
   * database. Catches column-level drift that a table probe (user.count)
   * cannot see — e.g. a new Prisma Client selecting `orders.weight_kg` while
   * the prod DB has not had the migration applied, which 500s every orders
   * query with P2022 "column does not exist".
   */
  async getDriftReport(): Promise<DriftReport> {
    const models = Prisma.dmmf.datamodel.models.filter((m) => m.dbName);
    const expected = new Map<string, Set<string>>(
      models.map((m) => [
        m.dbName as string,
        new Set(
          m.fields
            // scalar fields map to columns; relation fields do not have a
            // dbName and enums are not columns of this table
            .filter((f) => f.kind === 'scalar')
            .map((f) => (f.dbName as string) || f.name),
        ),
      ]),
    );

    const driftedTables: DriftedTable[] = [];

    for (const [table, columns] of expected) {
      const existing = await this.getExistingColumns(table);
      if (existing === null) {
        // Whole table missing
        driftedTables.push({ table, missingColumns: [...columns] });
        continue;
      }
      const missing = [...columns].filter((c) => !existing.has(c));
      if (missing.length > 0) {
        driftedTables.push({ table, missingColumns: missing });
      }
    }

    const status = driftedTables.length === 0 ? 'ok' : 'drift';
    if (status === 'drift') {
      this.logger.error(`Schema drift detected: ${JSON.stringify(driftedTables)}`);
    }

    return {
      status,
      checkedAt: new Date().toISOString(),
      modelsChecked: expected.size,
      driftedTables,
    };
  }

  /**
   * Column names that exist in the live DB for a table, or null when the
   * table itself does not exist.
   */
  private async getExistingColumns(table: string): Promise<Set<string> | null> {
    try {
      const rows: Array<{ column_name: string }> = await this.prisma
        .$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}`;
      return new Set(rows.map((r) => r.column_name));
    } catch (error: any) {
      // P2021: table does not exist — that is itself drift, not a crash
      if (error?.code === 'P2021') {
        return null;
      }
      throw error;
    }
  }
}
