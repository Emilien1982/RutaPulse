// routes.db on expo-sqlite: one connection for the whole app, opened at the
// first need and migrated (ADR 0019, sections 1 and 2).

import * as SQLite from 'expo-sqlite';

import {
  MIGRATIONS,
  migrate,
  RoutesTooNewError,
} from '@/core/routes/migrations';
import type { SqlDb, SqlRunner, SqlValue } from '@/core/routes/sqlDb';

const DB_NAME = 'routes.db';

type Connection = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync'
>;

function toRunner(connection: Connection): SqlRunner {
  return {
    exec: (sql) => connection.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      const result = await connection.runAsync(sql, params);
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    },
    all: (sql, params: SqlValue[] = []) => connection.getAllAsync(sql, params),
    first: (sql, params: SqlValue[] = []) =>
      connection.getFirstAsync(sql, params),
  };
}

export function toSqlDb(database: SQLite.SQLiteDatabase): SqlDb {
  return {
    ...toRunner(database),
    transaction: (task) =>
      database.withExclusiveTransactionAsync((txn) => task(toRunner(txn))),
  };
}

let opening: Promise<SqlDb> | null = null;

/**
 * The database, ready to write. Rejects with `RoutesTooNewError` when it was
 * written by a newer app (nothing is written then; the refusal is kept, the
 * database is not opened again). Any other failed opening is
 * tried again at the next call.
 */
export function getRoutesDb(): Promise<SqlDb> {
  opening ??= (async () => {
    const database = await SQLite.openDatabaseAsync(DB_NAME);
    try {
      const db = toSqlDb(database);
      const { status } = await migrate(db, MIGRATIONS);
      if (status === 'tooNew') throw new RoutesTooNewError();
      return db;
    } catch (error) {
      // A refused or failed opening must not leave the connection open.
      await database.closeAsync().catch(() => undefined);
      throw error;
    }
  })();
  opening.catch((error) => {
    if (!(error instanceof RoutesTooNewError)) opening = null;
  });
  return opening;
}
