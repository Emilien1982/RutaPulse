// SqlDb on node:sqlite, to test the real SQL in Jest (ADR 0019, section 2).
/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import type { SqlDb, SqlValue } from '../sqlDb';

export type NodeSqlDb = SqlDb & { close: () => void };

export function createNodeSqlDb(path = ':memory:'): NodeSqlDb {
  const database = new DatabaseSync(path);
  // One transaction at a time, as the exclusive transactions of expo-sqlite.
  let tail: Promise<unknown> = Promise.resolve();

  const runner = {
    exec: async (sql: string) => {
      database.exec(sql);
    },
    run: async (sql: string, params: SqlValue[] = []) => {
      const result = database.prepare(sql).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    all: async <T>(sql: string, params: SqlValue[] = []) =>
      database
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })) as T[],
    first: async <T>(sql: string, params: SqlValue[] = []) => {
      const row = database.prepare(sql).get(...params);
      return row ? ({ ...row } as T) : null;
    },
  };

  const transaction: SqlDb['transaction'] = (task) => {
    const run = tail.then(async () => {
      database.exec('BEGIN EXCLUSIVE');
      try {
        await task(runner);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    });
    tail = run.catch(() => undefined);
    return run;
  };

  return { ...runner, transaction, close: () => database.close() };
}
