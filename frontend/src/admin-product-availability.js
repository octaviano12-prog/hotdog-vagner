const availabilityState = {
  booted: false,
  products: [],
  filter: 'todos',
  search: ''
};

function isAdminPage() { return window.location.pathname.includes('admin'); }
function token() { return localStorage.getItem('hotdog_token') || ''; }
function brl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
function txt(value = '') { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function closeAvailability() { document.querySelector('.availability-overlay')?.remove(); }

async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Erro ao atualizar disponibilidade.');
  return data;
}

async function loadProducts() {
  availabilityState.products = await adminRequest('/api/admin/products');
}

function productPayload(product, active) {
  return {
    category_id: Number(product.category_id),
    name: product.name,
    description: product.description || '',
    price: Number(product.price || 0),
    product_type: product.product_type || 'hotdog',
    is_active: Boolean(active),
    sort_order: Number(product.sort_order || 0)
  };
}

async function setProductActive(id, active) {
  const product = availabilityState.products.find((item) => Number(item.id) === Number(id));
  if (!product) return;
  await adminRequest(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(productPayload(product, active)) });
  await loadProducts();
  renderAvailability(active ? 'Produto ativado no cardapio.' : 'Produto pausado no cardapio.');
}

async function bulkByType(type, active) {
  const selected = visibleProducts().filter((product) => type === 'todos' || product.product_type === type);
  for (const product of selected) {
    await adminRequest(`/api/admin/products/${product.id}`, { method: 'PUT', body: JSON.stringify(productPayload(product, active)) });
  }
  await loadProducts();
  renderAvailability(active ? 'Itens ativados.' : 'Itens pausados.');
}

function visibleProducts() {
  const q = txt(availabilityState.search);
  return availabilityState.products.filter((product) => {
    const byFilter = availabilityState.filter === 'todos'
      || (availabilityState.filter === 'ativos' && Number(product.is_active) === 1)
      || (availabilityState.filter === 'pausados' && Number(product.is_active) !== 1)
      || product.product_type === availabilityState.filter;
    const bySearch = !q || txt(`${product.name} ${product.description} ${product.category_name} ${product.product_type}`).includes(q);
    return byFilter && bySearch;
  });
}

function stats() {
  const total = availabilityState.products.length;
  const active = availabilityState.products.filter((product) => Number(product.is_active) === 1).length;
  const paused = total - active;
  const hotdogs = availabilityState.products.filter((product) => product.product_type === 'hotdog' && Number(product.is_active) === 1).length;
  return { total, active, paused, hotdogs };
}

function card(product) {
  const active = Number(product.is_active) === 1;
  return `<article class="availability-card ${active ? 'active' : 'paused'}"><div><span>${product.category_name || product.product_type || 'Produto'}</span><strong>${product.name}</strong><small>${product.description || 'Sem descricao'}</small></div><b>${brl(product.price)}</b><em>${active ? 'Disponivel' : 'Pausado'}</em><button type="button" data-toggle-product="${product.id}" data-active="${active ? '0' : '1'}">${active ? 'Pausar' : 'Ativar'}</button></article>`;
}

function renderAvailability(message = '') {
  let overlay = document.querySelector('.availability-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'availability-overlay';
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeAvailability(); });
    document.body.appendChild(overlay);
  }
  const list = visibleProducts();
  const s = stats();
  overlay.innerHTML = `<section class="availability-panel"><button class="availability-close" type="button">×</button><header><span>Operacao do cardapio</span><h2>Disponibilidade</h2><p>Pause produtos esgotados e ative novamente quando voltar ao estoque. Produto pausado some do cardapio publico.</p></header><div class="availability-actions"><label>Buscar<input data-search value="${availabilityState.search}" placeholder="Produto, categoria ou tipo" /></label><select data-filter><option value="todos" ${availabilityState.filter === 'todos' ? 'selected' : ''}>Todos</option><option value="ativos" ${availabilityState.filter === 'ativos' ? 'selected' : ''}>Disponiveis</option><option value="pausados" ${availabilityState.filter === 'pausados' ? 'selected' : ''}>Pausados</option><option value="hotdog" ${availabilityState.filter === 'hotdog' ? 'selected' : ''}>Hot dog</option><option value="bebida" ${availabilityState.filter === 'bebida' ? 'selected' : ''}>Bebidas</option><option value="suco" ${availabilityState.filter === 'suco' ? 'selected' : ''}>Sucos</option><option value="adicional" ${availabilityState.filter === 'adicional' ? 'selected' : ''}>Adicionais</option></select><button data-refresh type="button">Atualizar</button></div><div class="availability-metrics"><article><span>Total</span><strong>${s.total}</strong></article><article><span>Disponiveis</span><strong>${s.active}</strong></article><article><span>Pausados</span><strong>${s.paused}</strong></article><article><span>Hot dogs ativos</span><strong>${s.hotdogs}</strong></article></div><div class="availability-bulk"><button data-bulk-pause type="button">Pausar visiveis</button><button data-bulk-active type="button">Ativar visiveis</button></div><p class="availability-message">${message}</p><div class="availability-list">${list.length ? list.map(card).join('') : '<div class="availability-empty">Nenhum produto encontrado.</div>'}</div></section>`;
  overlay.querySelector('.availability-close').addEventListener('click', closeAvailability);
  overlay.querySelector('[data-search]').addEventListener('input', (event) => { availabilityState.search = event.target.value; renderAvailability(); });
  overlay.querySelector('[data-filter]').addEventListener('change', (event) => { availabilityState.filter = event.target.value; renderAvailability(); });
  overlay.querySelector('[data-refresh]').addEventListener('click', async () => { renderAvailability('Atualizando...'); await loadProducts(); renderAvailability(); });
  overlay.querySelector('[data-bulk-pause]').addEventListener('click', () => bulkByType('todos', false));
  overlay.querySelector('[data-bulk-active]').addEventListener('click', () => bulkByType('todos', true));
  overlay.querySelectorAll('[data-toggle-product]').forEach((button) => button.addEventListener('click', () => setProductActive(button.dataset.toggleProduct, button.dataset.active === '1')));
}

function ensureAvailabilityDock() {
  if (!isAdminPage() || !token() || document.querySelector('.availability-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'availability-dock';
  button.innerHTML = '<span>✅</span><strong>Disponibilidade</strong>';
  button.addEventListener('click', async () => { renderAvailability('Carregando produtos...'); try { await loadProducts(); renderAvailability(); } catch (error) { renderAvailability(error.message); } });
  document.body.appendChild(button);
}

function bootAvailability() {
  if (availabilityState.booted) return;
  availabilityState.booted = true;
  setInterval(ensureAvailabilityDock, 1400);
}

bootAvailability();
