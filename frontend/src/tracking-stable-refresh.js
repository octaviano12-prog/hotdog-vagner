function isTrackingPage() {
  return window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status');
}

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function statusLabel(status = '') {
  const labels = {
    novo: 'Pedido recebido',
    preparo: 'Em preparação',
    saiu_entrega: 'Saiu para entrega',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };
  return labels[status] || 'Pedido recebido';
}

function hasVisibleResult() {
  const result = document.querySelector('.tracking-result');
  return Boolean(result && !result.hidden && result.textContent.trim());
}

async function refreshTrackingWithoutBlink(form) {
  const message = document.querySelector('.tracking-message');
  const result = document.querySelector('.tracking-result');
  const formData = new FormData(form);
  const code = normalizeCode(formData.get('code'));
  const phone = normalizePhone(formData.get('phone'));
  if (!code || !phone || !result) return;

  result.hidden = false;
  result.classList.add('tracking-refreshing');
  if (message) message.textContent = 'Atualizando status...';

  try {
    const response = await fetch(`/api/public/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Não foi possível atualizar o pedido.');

    const order = data.order;
    const status = result.querySelector('.tracking-status');
    if (status) {
      status.className = `tracking-status ${order.status}`;
      status.textContent = statusLabel(order.status);
    }

    const codeTitle = result.querySelector('.tracking-result-head h2');
    if (codeTitle && order.public_code) codeTitle.textContent = order.public_code;

    const url = new URL(window.location.href);
    url.searchParams.set('codigo', order.public_code || code);
    url.searchParams.set('phone', phone);
    window.history.replaceState({}, '', url);

    if (message) message.textContent = 'Status atualizado.';
    setTimeout(() => {
      if (message?.textContent === 'Status atualizado.') message.textContent = '';
    }, 1200);
  } catch (error) {
    if (message) message.textContent = error.message;
  } finally {
    result.classList.remove('tracking-refreshing');
  }
}

function installStableTrackingRefresh() {
  if (!isTrackingPage() || window.__hotdogStableTrackingRefresh) return;
  window.__hotdogStableTrackingRefresh = true;

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('.tracking-form');
    if (!form || !hasVisibleResult()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    refreshTrackingWithoutBlink(form);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-track-submit]');
    const form = button?.closest?.('.tracking-form');
    if (!button || !form || !hasVisibleResult()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    refreshTrackingWithoutBlink(form);
  }, true);
}

installStableTrackingRefresh();
