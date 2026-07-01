import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

export function getBookKnowledge(bookId) {
  return request(`/books/${bookId}/knowledge`, {
    headers: buildHeaders()
  });
}

export const bookApi = {
  getKnowledge: getBookKnowledge
};

export default bookApi;
