const postSaleState = {
  booted: false,
  orders: [],
  filter: 'avaliar',
  loadedAt: 0,
  sent: JSON.parse(localStorage.getItem('hotdog_post_sale_sent') || '{}')
};

function isAdminPage() {
  return window.location.pathname.includes('admin');
}

function token() {
  return localStorage.getItem('hotdog_token') || '';
}

function digits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function daysSince(value) {
  if (!value) return 999;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function orderCode(order) {
  return order.public_code || `#${order.id}`;
}

function firstName(order) {
  return String(order.customer_name || 'cliente').trim().split(' ')[0];
}

function orderItems(order) {
  return (order.items || [])
    .filter((item) => item.item_type === 'produto')
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(', ');
}

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar pos-venda.');
  return data;
}

async function loadPostSale(force = false) {
  if (!token()) return;
  if (!force && Date.now() - postSaleState.loadedAt < 10000 && postSaleState.orders.length) return;
  const orders = await adminGet('/api/admin/orders');
  postSaleState.orders = orders
    .filter((order) => order.status === 'concluido')
    .sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0));
  postSaleState.loadedAt = Date.now();
}

function messageFor(order, type = 'avaliar') {
  const name = firstName(order);
  if (type === 'obrigado') {
    return `Oi ${name}, aqui e do Hotdog Prensado. Passando para agradecer pelo seu pedido ${orderCode(order)}. Ficamos felizes em atender voce. Volte sempre!`;
  }
  if (type === 'voltar') {
    return `Oi ${name}, tudo bem? Aqui e do Hotdog Prensado. Ja deu vontade de repetir aquele hot dog? Posso te mandar o cardapio ou separar um combo pra voce.`;
  }
  return `Oi ${name}, tudo bem? Aqui e do Hotdog Prensado. Como foi seu pedido ${orderCode(order)}? Sua opiniao ajuda muito a gente melhorar. Se puder, manda uma nota de 0 a 10 ou um comentario rapidinho. Obrigado!`;
}

function whatsappLink(order, type) {
  const phone = digits(order.customer_phone || '');
  if (!phone) return '';
  const number = phone.startsWith('55') ? phone : `55${phone}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(messageFor(order, type))}`;
}

function markSent(orderId) {
  postSaleState.sent[orderId] = new Date().toISOString();
  localStorage.setItem('hotdog_post_sale_sent', JSON.stringify(postSaleState.sent));
  renderPostSalePanel('Marcado como enviado.');
}

function visibleOrders() {
  const type = postSaleState.filter;
  return postSaleState.orders.filter((order) => {
    const sent = Boolean(postSaleState.sent[order.id]);
    const age = daysSince(order.completed_at || order.created_at);
    if (type === 'avaliar') return !sent && age <= 7;
    if (type === 'enviados') return sent;
    if (type === 'voltar') return age >= 7;
    return true;
  });
}

function csvValue(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportPostSaleCsv(list) {
  const rows = [
    ['Codigo', 'Cliente', 'Telefone', 'Data', 'Total', 'Itens', 'Mensagem', 'Enviado'],
    ...list.map((order) => [
      orderCode(order),
      order.customer_name,
      order.customer_phone,
      order.completed_at || order.created_at,
      order.total,
      orderItems(order),
      messageFor(order, postSaleState.filter === 'voltar' ? 'voltar' : 'avaliar'),
      postSaleState.sent[order.id] || ''
    ])
  ];
  const csv = rows.map((row) => row.map(csvValue).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pos-venda-hotdog-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyPostSaleList(list) {
  const text = [
    'Pos-venda - Hotdog Prensado',
    '',
    ...list.slice(0, 20).map((order, index) => `${index + 1}. ${order.customer_name} - ${order.customer_phone || 'sem telefone'} - ${messageFor(order, postSaleState.filter === 'voltar' ? 'voltar' : 'avaliar')}`)
  ].join('\n');
  await navigator.clipboard.writeText(text);
  renderPostSalePanel('Lista de pos-venda copiada.');
}

function closePostSalePanel() {
  document.querySelector('.post-sale-overlay')?.remove();
}

function renderPostSalePanel(message = '') {
  let overlay = document.querySelector('.post-sale-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'post-sale-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closePostSalePanel();
    });
    document.body.appendChild(overlay);
  }

  const list = visibleOrders();
  const sentCount = postSaleState.orders.filter((order) => postSaleState.sent[order.id]).length;
  const totalValue = list.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const avgTicket = list.length ? totalValue / list.length : 0;

  overlay.innerHTML = `
    <section class="post-sale-panel">
      <button class="post-sale-close" type="button">×</button>
      <header>
        <span>Relacionamento</span>
        <h2>Pós-venda e avaliações</h2>
        <p>Chame clientes depois da entrega, peça avaliação e mantenha o relacionamento ativo.</p>
      </header>
      <div class="post-sale-controls">
        <label>Lista
          <select data-post-filter>
            <option value="avaliar" ${postSaleState.filter === 'avaliar' ? 'selected' : ''}>Aguardando avaliação</option>
            <option value="voltar" ${postSaleState.filter === 'voltar' ? 'selected' : ''}>Chamar para voltar</option>
            <option value="enviados" ${postSaleState.filter === 'enviados' ? 'selected' : ''}>Já enviados</option>
            <option value="todos" ${postSaleState.filter === 'todos' ? 'selected' : ''}>Todos concluídos</option>
          </select>
        </label>
        <button data-post-refresh type="button">Atualizar</button>
        <button data-post-copy type="button">Copiar lista</button>
        <button data-post-export type="button">Exportar CSV</button>
      </div>
      <div class="post-sale-metrics">
        <article><span>Pedidos na lista</span><strong>${list.length}</strong></article>
        <article><span>Enviados</span><strong>${sentCount}</strong></article>
        <article><span>Total da lista</span><strong>${money(totalValue)}</strong></article>
        <article><span>Ticket médio</span><strong>${money(avgTicket)}</strong></article>
      </div>
      <p class="post-sale-message">${message}</p>
      <div class="post-sale-list">
        ${list.length ? list.map((order) => {
          const type = postSaleState.filter === 'voltar' ? 'voltar' : 'avaliar';
          const whats = whatsappLink(order, type);
          return `<article>
            <div class="post-sale-head"><div><strong>${order.customer_name || 'Cliente'}</strong><span>${orderCode(order)} • ${daysSince(order.completed_at || order.created_at)} dia(s)</span></div><b>${money(order.total)}</b></div>
            <p>${messageFor(order, type)}</p>
            <div class="post-sale-items">${orderItems(order) || 'Itens nao informados'}</div>
            <footer>${whats ? `<a href="${whats}" target="_blank" rel="noreferrer">Enviar WhatsApp</a>` : ''}<button data-mark-sent="${order.id}" type="button">Marcar enviado</button>${postSaleState.sent[order.id] ? `<em>Enviado em ${new Date(postSaleState.sent[order.id]).toLocaleDateString('pt-BR')}</em>` : '<em>Pendente</em>'}</footer>
          </article>`;
        }).join('') : '<div class="post-sale-empty">Nenhum pedido nesta lista.</div>'}
      </div>
    </section>`;

  overlay.querySelector('.post-sale-close').addEventListener('click', closePostSalePanel);
  overlay.querySelector('[data-post-filter]').addEventListener('change', (event) => {
    postSaleState.filter = event.target.value;
    renderPostSalePanel();
  });
  overlay.querySelector('[data-post-refresh]').addEventListener('click', async () => {
    renderPostSalePanel('Atualizando...');
    await loadPostSale(true);
    renderPostSalePanel();
  });
  overlay.querySelector('[data-post-copy]').addEventListener('click', () => copyPostSaleList(visibleOrders()));
  overlay.querySelector('[data-post-export]').addEventListener('click', () => exportPostSaleCsv(visibleOrders()));
  overlay.querySelectorAll('[data-mark-sent]').forEach((button) => button.addEventListener('click', () => markSent(button.dataset.markSent)));
}

function ensurePostSaleDock() {
  if (!isAdminPage() || !token() || document.querySelector('.post-sale-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'post-sale-dock';
  button.innerHTML = '<span>⭐</span><strong>Pós-venda</strong>';
  button.addEventListener('click', async () => {
    renderPostSalePanel('Carregando pos-venda...');
    try {
      await loadPostSale(true);
      renderPostSalePanel();
    } catch (error) {
      renderPostSalePanel(error.message);
    }
  });
  document.body.appendChild(button);
}

function bootPostSale() {
  if (postSaleState.booted) return;
  postSaleState.booted = true;
  setInterval(() => {
    if (!isAdminPage()) return;
    ensurePostSaleDock();
  }, 1400);
}

bootPostSale();

if (window.location.pathname.includes('admin')) {
  import('./admin-menu-ranking.css');
  import('./admin-menu-ranking.js');
}
