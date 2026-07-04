/**
 * contestApi.js
 *
 * Client for contest endpoints that the dashboard needs. Currently exposes the
 * student's real, DB-backed contest rating history.
 */

import { httpClient } from './httpClient';

const { request, buildHeaders } = httpClient;

/**
 * Fetch the current student's contest rating history.
 *
 * @returns {Promise<{
 *   current: number|null,
 *   max: number|null,
 *   unrated: boolean,
 *   history: Array<{
 *     contestName: string,
 *     date: string,
 *     rank: number,
 *     participants: number,
 *     oldRating: number,
 *     newRating: number,
 *     delta: number
 *   }>
 * }>}
 */
export function getMyRating() {
  return request('/contests/rating/me', { headers: buildHeaders() });
}

export default { getMyRating };
