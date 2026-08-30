/** Client fetch that bypasses the browser HTTP cache and sends the session cookie. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
  });
}
