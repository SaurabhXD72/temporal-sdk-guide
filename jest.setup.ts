// Global test setup
global.console = {
    ...console,
    // Suppress debug logs during tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
  