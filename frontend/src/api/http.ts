export function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
