export class ApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError('Could not reach the server. Is it running?');
  }
  if (res.status === 204) {
    await res.text(); // no content, but drain the (empty) body so the browser doesn't log the request as aborted
    return null;
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // Didn't get JSON somehow gracefully panic
  }
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, { status: res.status, errors: body?.errors });
  }
  return body;
}

export const api = {
  listEffects: async () => (await request('/api/effects')).effects,
  // FormData holding name, icon (File), description, max_potency, max_stack, related_effects (repeated)
  createEffect: async (formData) => (await request('/api/effects', { method: 'POST', body: formData })).effect,
  deleteEffect: async (id) => request(`/api/effects/${id}`, { method: 'DELETE' }),
};
