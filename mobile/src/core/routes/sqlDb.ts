// What core/ needs from a SQLite database. expo-sqlite implements it on the
// phone (shared-data/routes/routesDb.ts), node:sqlite in the tests
// (testing/nodeSqlDb.ts). Same idea as ZoneOps (ADR 0019, section 3).

export type SqlValue = string | number | null;

export type SqlRunResult = { lastInsertRowId: number; changes: number };

export type SqlRunner = {
  /** Runs one or several statements, without parameters. */
  exec: (sql: string) => Promise<void>;
  run: (sql: string, params?: SqlValue[]) => Promise<SqlRunResult>;
  all: <T>(sql: string, params?: SqlValue[]) => Promise<T[]>;
  first: <T>(sql: string, params?: SqlValue[]) => Promise<T | null>;
};

export type SqlDb = SqlRunner & {
  /**
   * Runs `task` in an exclusive transaction: committed when it resolves,
   * rolled back when it rejects (the error is thrown again).
   */
  transaction: (task: (tx: SqlRunner) => Promise<void>) => Promise<void>;
};
