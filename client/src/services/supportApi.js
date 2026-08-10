import httpClient from './httpClient';

export const createSupportTicket = async (ticketData) => {
  return httpClient.request('/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData)
  });
};

export const fetchMySupportTickets = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return httpClient.request(`/support${query ? `?${query}` : ''}`);
};

export const fetchSupportTicketDetails = async (ticketId) => {
  return httpClient.request(`/support/${ticketId}`);
};

export const replyToSupportTicket = async (ticketId, message) => {
  return httpClient.request(`/support/${ticketId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
};

export const deleteSupportTicket = async (ticketId) => {
  return httpClient.request(`/support/${ticketId}`, {
    method: 'DELETE'
  });
};
