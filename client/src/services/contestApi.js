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
 *   current: number,
 *   max: number,
 *   rankTitle: string,
 *   maxRankTitle: string,
 *   unrated: boolean,
 *   history: Array<{
 *     contestName: string,
 *     date: string,
 *     rank: number,
 *     participants: number,
 *     oldRating: number,
 *     newRating: number,
 *     rankTitle: string,
 *     delta: number
 *   }>
 * }>}
 */
export function getMyRating() {
  return request('/contests/rating/me', { headers: buildHeaders() });
}

/**
 * Submit a single answer live during a running contest. Graded immediately:
 * correct answers award points (and lock the question), wrong answers apply a
 * penalty. Returns { correct, solved, livePoints, pointsDelta }.
 */
export function submitAnswer(contestId, questionId, selectedIndex) {
  return request(`/contests/${contestId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, selectedIndex })
  });
}

/**
 * Fetch the global leaderboard ranked by points or rating.
 * @param {'points'|'rating'} by
 */
export function getGlobalLeaderboard(by = 'points', limit = 50) {
  const params = new URLSearchParams({ by, limit: String(limit) });
  return request(`/contests/leaderboard?${params.toString()}`, { headers: buildHeaders() });
}

export default { getMyRating, submitAnswer, getGlobalLeaderboard };
