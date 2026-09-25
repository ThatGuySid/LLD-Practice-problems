import { getLearnerId } from './learner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Learner-Id': getLearnerId(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed with ${response.status}`);
  return payload;
}

export const api = {
  getProblems: () => request('/problems'),
  getAttempts: () => request(`/attempts?learnerId=${encodeURIComponent(getLearnerId())}`),
  getAttempt: (id) => request(`/attempts/${id}`),
  createAttempt: (problemId) => request('/attempts', { method: 'POST', body: JSON.stringify({ problemId }) }),
  saveDraft: (id, data) => request(`/attempts/${id}/draft`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAttempt: (id, data) => request(`/submissions/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  rerunEvaluation: (id) => request(`/submissions/${id}/rerun`, { method: 'POST' }),
};

export { API_BASE };
