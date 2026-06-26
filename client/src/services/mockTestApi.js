import httpClient from './httpClient';

export async function createMockTestAttempt(payload) {
  return httpClient.request('/mock-tests/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
