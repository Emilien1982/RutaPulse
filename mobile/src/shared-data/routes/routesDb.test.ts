// The expo-sqlite connection: one opening, migration, refusal of a newer
// database, retry after a failure (ADR 0019, section 2).

import {
  createNodeSqlDb,
  type NodeSqlDb,
} from '@/core/routes/testing/nodeSqlDb';

const mockOpen = jest.fn();
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (name: string) => mockOpen(name),
}));

/** An expo-sqlite connection made on node:sqlite. */
function fakeConnection(node: NodeSqlDb) {
  const txnCalls: string[] = [];
  const txn = {
    execAsync: (sql: string) => {
      txnCalls.push(sql);
      return node.exec(sql);
    },
    runAsync: (sql: string, params: never) => node.run(sql, params),
    getAllAsync: (sql: string, params: never) => node.all(sql, params),
    getFirstAsync: (sql: string, params: never) => node.first(sql, params),
  };
  return {
    txnCalls,
    execAsync: (sql: string) => node.exec(sql),
    runAsync: (sql: string, params: never) => node.run(sql, params),
    getAllAsync: (sql: string, params: never) => node.all(sql, params),
    getFirstAsync: (sql: string, params: never) => node.first(sql, params),
    closeAsync: jest.fn(() => Promise.resolve()),
    withExclusiveTransactionAsync: jest.fn(
      (task: (t: typeof txn) => Promise<void>) =>
        node.transaction(async () => task(txn)),
    ),
  };
}

type Module = typeof import('./routesDb');
let routesDb: Module;
let RoutesTooNewError: typeof import('@/core/routes/migrations').RoutesTooNewError;

beforeEach(() => {
  mockOpen.mockReset();
  jest.isolateModules(() => {
    // A fresh module has no cached connection.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    routesDb = require('./routesDb');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RoutesTooNewError = require('@/core/routes/migrations').RoutesTooNewError;
  });
});

it('opens the database once for two calls, named routes.db, at version 1', async () => {
  const node = createNodeSqlDb();
  const connection = fakeConnection(node);
  mockOpen.mockResolvedValue(connection);

  const [a, b] = await Promise.all([
    routesDb.getRoutesDb(),
    routesDb.getRoutesDb(),
  ]);

  expect(a).toBe(b);
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockOpen).toHaveBeenCalledWith('routes.db');
  expect(
    (await node.first<{ user_version: number }>('PRAGMA user_version'))
      ?.user_version,
  ).toBe(1);
  await routesDb.getRoutesDb();
  expect(mockOpen).toHaveBeenCalledTimes(1);
});

it('rejects a newer database, closes it and does not open it again', async () => {
  const node = createNodeSqlDb();
  await node.exec('PRAGMA user_version = 99');
  const connection = fakeConnection(node);
  mockOpen.mockResolvedValue(connection);

  await expect(routesDb.getRoutesDb()).rejects.toBeInstanceOf(
    RoutesTooNewError,
  );
  await expect(routesDb.getRoutesDb()).rejects.toBeInstanceOf(
    RoutesTooNewError,
  );

  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(connection.closeAsync).toHaveBeenCalledTimes(1);
  expect(
    await node.all("SELECT name FROM sqlite_master WHERE type = 'table'"),
  ).toEqual([]);
});

it('tries again after a failed opening, and closes the failed connection', async () => {
  const broken = fakeConnection(createNodeSqlDb());
  broken.getFirstAsync = () => Promise.reject(new Error('disk full'));
  mockOpen.mockResolvedValueOnce(broken);
  await expect(routesDb.getRoutesDb()).rejects.toThrow('disk full');
  expect(broken.closeAsync).toHaveBeenCalledTimes(1);

  mockOpen.mockRejectedValueOnce(new Error('cannot open'));
  await expect(routesDb.getRoutesDb()).rejects.toThrow('cannot open');

  mockOpen.mockResolvedValueOnce(fakeConnection(createNodeSqlDb()));
  await expect(routesDb.getRoutesDb()).resolves.toBeDefined();
  expect(mockOpen).toHaveBeenCalledTimes(3);
});

it('runs a transaction with withExclusiveTransactionAsync, on txn', async () => {
  const node = createNodeSqlDb();
  const connection = fakeConnection(node);
  mockOpen.mockResolvedValue(connection);
  const db = await routesDb.getRoutesDb();
  connection.withExclusiveTransactionAsync.mockClear();
  connection.txnCalls.length = 0;

  await db.transaction(async (tx) => {
    await tx.exec('CREATE TABLE probe (a INTEGER)');
  });

  expect(connection.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(connection.txnCalls).toEqual(['CREATE TABLE probe (a INTEGER)']);

  await expect(
    db.transaction(async (tx) => {
      await tx.exec('DROP TABLE probe');
      throw new Error('stop');
    }),
  ).rejects.toThrow('stop');
  expect(
    await node.all("SELECT name FROM sqlite_master WHERE name = 'probe'"),
  ).toHaveLength(1);
});
