const PATCHED_FLAG = '__hotdog_admin_fetch_fallback__';

function cloneOptions(options = {}) {
  const cloned = { ...options };
  if (options.headers instanceof Headers) {
    cloned.headers = new Headers(options.headers);
  } else if (Array.isArray(options.headers)) {
    cloned.headers = [...options.headers];
  } else if (options.headers && typeof options.headers === 'object') {
    cloned.headers = { ...options.headers };
  }
  return cloned;
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input || '');
}

function fallbackUrl(url) {
  if (url.includes('/api/admin/orders/') && url.includes('/status-flow')) {
    return url.replace('/status-flow', '/status');
  }
  if (url.includes('/api/admin/orders/') && url.includes('/payment-flow')) {
    return url.replace('/payment-flow', '/payment');
  }
  return null;
}

function makeInput(input, url) {
  if (input instanceof Request) {
    return new Request(url, input);
  }
  return url;
}

export function installAdminApiFallback() {
  if (window[PATCHED_FLAG]) return;
  window[PATCHED_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = requestUrl(input);
    const nextUrl = fallbackUrl(url);

    if (!nextUrl) {
      return originalFetch(input, options);
    }

    const firstResponse = await originalFetch(input, cloneOptions(options));
    if (firstResponse.ok) return firstResponse;

    const retryResponse = await originalFetch(makeInput(input, nextUrl), cloneOptions(options));
    if (retryResponse.ok) return retryResponse;

    return firstResponse;
  };
}
