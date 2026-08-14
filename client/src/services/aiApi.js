
export const aiApi = {
  send: sendMessage,
  sendBook: sendBookMessage,
  history: getHistory,
  bookHistory: getBookHistory,
  clear: clearHistory,
  clearBook: clearBookHistory,
  extract: extractQuestion
};

// Re-export `ApiError` so callers can `import { ApiError } from '../services/aiApi'`.
export { ApiError };

export default aiApi;
