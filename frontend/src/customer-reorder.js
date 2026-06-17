const reorderState = {
  booted: false,
  orders: [],
  lastLoad: 0
};

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function isTrackingPage() {
  return window.location.pathname.includes('acompanhar') || window.location.pathname.includes('pedido-status');
}

function token() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customer() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase().replace(/^#/, '');
}

function showReorderToast(message) {
  let toast = document.querySelector('.reorder-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'reorder-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

async function customerRequest(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar os pedidos.');
  return data;
}

async function loadOrders(force = false) {
  if (!token()) return [];
  if (!force && Date.now() - reorderState.lastLoad < 5000 && reorderState.orders.length) return reorderState.orders;
  const orders = await customerRequest('/api/customer/orders');
  reorderState.orders = orders;
  reorderState.lastLoad = Date.now();
  return orders;
}

function findOrderByCode(orders, code) {
  const normalized = normalizeCode(code);
  return orders.find((order) => normalizeCode(order.public_code || order.id) === normalized || String(order.id) === normalized.replace(/\D/g, ''));
}

function buildItems(order) {
  const items = order.items || [];
  return items
    .filter((item) => item.item_type === 'produto')
    .map((item) => {
      if (!item.product_id) return null;
      const extras = items
        .filter((extra) => extra.item_type === 'adicional' && extra.parent_item_id === item.id && extra.product_id)
        .map((extra) => Number(extra.product_id));
      return {
        product_id: Number(item.product_id),
        quantity: Number(item.quantity || 1),
        notes: item.notes || '',
        extras
      };
    })
    .filter(Boolean);
}

async function repeatOrder(code) {
  const profile = customer();
  if (!profile || !token()) throw new Error('Entre na sua conta para repetir pedido.');

  const orders = await loadOrders(true);
  const order = findOrderByCode(orders, code);
  if (!order) throw new Error('Pedido nao encontrado no seu historico.');
  if (order.status === 'cancelado') throw new Error('Nao e possivel repetir pedido cancelado.');

  const items = buildItems(order);
  if (!items.length) throw new Error('Este pedido nao possui produtos ativos para repetir.');

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: {
        name: profile.name,
        phone: profile.phone,
        address: profile.address || '',
        reference: profile.reference || ''
      },
      delivery_type: order.delivery_type || 'entrega',
      payment_method: order.payment_method || 'dinheiro',
      notes: `Pedido repetido de ${order.public_code || `#${order.id}`}`,
      items
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel repetir o pedido.');
  return data.order;
}

function enhanceOrderCards() {
  if (!token()) return;
  document.querySelectorAll('.account-orders article').forEach((article) => {
    if (article.querySelector('.reorder-button')) return;
    const code = article.querySelector('strong')?.textContent?.trim();
    const footer = article.querySelector('footer') || article;
    if (!code || !footer) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reorder-button';
    button.textContent = 'Pedir novamente';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Enviando...';
      try {
        const newOrder = await repeatOrder(code);
        showReorderToast(`Pedido ${newOrder.public_code || newOrder.id} criado com sucesso.`);
        const phone = customer()?.phone || '';
        setTimeout(() => {
          window.location.href = `/acompanhar?codigo=${newOrder.public_code || newOrder.id}&phone=${encodeURIComponent(phone)}`;
        }, 900);
      } catch (error) {
        showReorderToast(error.message);
        button.disabled = false;
        button.textContent = 'Pedir novamente';
      }
    });
    footer.appendChild(button);
  });
}

export function bootCustomerReorder() {
  if (reorderState.booted) return;
  reorderState.booted = true;
  setInterval(() => {
    if (isAdminPage() || isTrackingPage()) return;
    enhanceOrderCards();
  }, 1200);
}
