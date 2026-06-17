const API_BASE = import.meta.env.VITE_API_URL || '';

function extractErrorMessage(data, status) {
  if (typeof data === 'object' && data?.message) return data.message;

  const text = String(data || '').trim();
  if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
    if (status === 503) return 'Servidor temporariamente indisponivel. Aguarde alguns segundos e tente novamente.';
    return 'Servidor retornou uma pagina de erro. Verifique os logs de execucao na Hostinger.';
  }

  return text || 'Erro na comunicacao com o servidor.';
}

function normalizeResponse(path, data) {
  if (path === '/api/public/settings' && data && typeof data === 'object') {
    return {
      ...data,
      minimum_order_amount: data.minimum_order_amount ?? data.minimum_order ?? 0
    };
  }
  return data;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, response.status));
  }

  return normalizeResponse(path, data);
}

export function getToken() {
  return localStorage.getItem('hotdog_token');
}

export function setToken(token) {
  localStorage.setItem('hotdog_token', token);
}

export function clearToken() {
  localStorage.removeItem('hotdog_token');
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  admin: {
    get: (path) => request(path, { headers: { Authorization: `Bearer ${getToken()}` } }),
    post: (path, body) => request(path, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', headers: { Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
  }
};

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}
