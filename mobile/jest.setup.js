/* global jest */
// The native module does not exist under Jest.
jest.mock('@modules/valhalla-route', () => ({
  __esModule: true,
  ERR_ENGINE_NOT_OPEN: 'ERR_ENGINE_NOT_OPEN',
  ERR_ZONE_UNREADABLE: 'ERR_ZONE_UNREADABLE',
  ERR_ENGINE: 'ERR_ENGINE',
  default: {
    open: jest.fn(),
    route: jest.fn(),
    height: jest.fn(),
    traceAttributes: jest.fn(),
    traceRoute: jest.fn(),
    close: jest.fn(),
  },
}));

// The brightness of the screen (ADR 0021, section 8): no screen under Jest.
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.5)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
  restoreSystemBrightnessAsync: jest.fn(() => Promise.resolve()),
}));

// TanStack Query keeps one timer per query (`gcTime`: 5 minutes, 30 for the
// legs and the infos). A live timer keeps Jest alive long after the last test
// ("A worker process has failed to exit gracefully"). Its timers are made
// not to hold the process.
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  const unref = (timer) => {
    if (timer && typeof timer.unref === 'function') timer.unref();
    return timer;
  };
  actual.timeoutManager.setTimeoutProvider({
    setTimeout: (callback, delay) => unref(setTimeout(callback, delay)),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (callback, delay) => unref(setInterval(callback, delay)),
    clearInterval: (id) => clearInterval(id),
  });
  return actual;
});
