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
    close: jest.fn(),
  },
}));
