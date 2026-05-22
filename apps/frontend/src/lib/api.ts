export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  if (options.headers) {
    const rawHeaders = options.headers as Record<string, string>;
    Object.assign(headers, rawHeaders);
  }

  const res = await fetch(url, { ...options, headers });

  // Optional: Auto redirect to login if 401 Unauthorized occurs
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  return res;
}
