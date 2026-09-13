import { Injectable, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as http from 'node:http';

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

export interface SocketTransportReport {
  status: 'ok' | 'error';
  checkedAt: string;
  adapter: 'installed' | 'missing';
  /** The engine.io open-packet handshake succeeded against this server. */
  handshake: 'ok' | 'not_mounted' | 'unreachable';
  detail?: string;
}

/** Sentinel error for the adapter check — caught by callers to shape the report. */
class AdapterMissingError extends Error {
  constructor(readonly packageName: string) {
    super(`WebSocket adapter not installed: ${packageName}`);
    this.name = 'AdapterMissingError';
  }
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

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
   * Socket transport health — catches the "REST boots, WS never mounts" failure
   * mode (e.g. a missing @nestjs/platform-socket.io peer adapter) at deploy
   * time instead of via user-facing console spam. Two checks:
   *  1. The adapter package is resolvable from the running process.
   *  2. A real engine.io polling handshake against this same HTTP server
   *     returns an OPEN packet (`0{...}`), i.e. socket.io is actually mounted.
   */
  async getSocketTransportReport(): Promise<SocketTransportReport> {
    const checkedAt = new Date().toISOString();
    const adapter = this.resolveSocketAdapter();
    if (adapter === 'missing') {
      return {
        status: 'error',
        checkedAt,
        adapter: 'missing',
        handshake: 'not_mounted',
        detail:
          'NestJS gateway registered but @nestjs/platform-socket.io is not installed — the socket.io server never mounts and every client handshake 404s.',
      };
    }

    try {
      const openPacket = await this.probeEngineIoHandshake();
      const handshake = openPacket ? 'ok' : 'not_mounted';
      return {
        status: handshake === 'ok' ? 'ok' : 'error',
        checkedAt,
        adapter: 'installed',
        handshake,
        ...(handshake === 'ok'
          ? {}
          : {
              detail:
                'HTTP answered but not with an engine.io OPEN packet — the socket.io server is not mounted (express served its own 404).',
            }),
      };
    } catch (error: any) {
      return {
        status: 'error',
        checkedAt,
        adapter: 'installed',
        handshake: 'unreachable',
        detail: `Self-handshake failed: ${error?.message ?? 'unknown error'}`,
      };
    }
  }

  /**
   * Resolvable adapter => 'installed'. Separated for testability: tests stub
   * this to simulate a broken deployment without uninstalling packages.
   */
  /* istanbul ignore next — trivial */
  protected resolveSocketAdapter(): 'installed' | 'missing' {
    try {
      require.resolve('@nestjs/platform-socket.io');
      return 'installed';
    } catch {
      return 'missing';
    }
  }

  /**
   * Minimal engine.io polling handshake against our own HTTP server.
   * Resolves the raw body when the server answers 200; rejects on
   * connection errors. A mounted socket.io answers `0{"sid":...}`.
   */
  private probeEngineIoHandshake(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const { port, host } = this.getHttpServerAddress();
      const req = http.get(
        {
          host,
          port,
          path: '/socket.io/?EIO=4&transport=polling',
          timeout: 4000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve(res.statusCode === 200 ? Buffer.concat(chunks).toString('utf8') : null),
          );
        },
      );
      req.on('timeout', () => {
        req.destroy(new Error('handshake timed out after 4s'));
      });
      req.on('error', reject);
    });
  }

  /**
   * Port/hostname the HTTP adapter is actually listening on (never assume
   * process.env.PORT — probes must target the real bound socket).
   */
  private getHttpServerAddress(): { port: number; host: string } {
    try {
      const server = this.httpAdapterHost?.httpAdapter?.getHttpServer?.();
      const addr = server?.address?.();
      if (addr && typeof addr === 'object' && addr.port) {
        return { port: addr.port, host: addr.address === '::' ? '127.0.0.1' : addr.address };
      }
    } catch {
      // fall through to default
    }
    return { port: parseInt(process.env.PORT ?? '3000', 10), host: '127.0.0.1' };
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
