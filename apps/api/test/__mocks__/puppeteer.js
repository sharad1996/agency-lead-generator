const mockPage = {
  setContent: jest.fn().mockResolvedValue(undefined),
  pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

module.exports = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
  __mockPage: mockPage,
  __mockBrowser: mockBrowser,
};
