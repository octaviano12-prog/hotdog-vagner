const goalsState = {
  booted: false,
  orders: [],
  goalValue: Number(localStorage.getItem('hotdog_goal_value') || 300),
  goalOrders: Number(localStorage.getItem('hotdog_goal_orders') || 20)
};

function isAdminPage() { return window.location.pathname.includes('admin'); }
function token() { return localStorage.getItem('hotdog_token') || ''; }
function brl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function closeGoals() { document.querySelector('.daily-goals-overlay')?.remove(); }

async function adminGet(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Nao foi possivel carregar metas.');
  return data;
}

function isToday(order) {
  return String(order.created_at || '').slice(0, 10) === todayKey();
}

async function loadGoals() {
  const orders = await adminGet('/api/admin/orders');
  goalsState.orders = orders.filter(isToday).filter((order) => order.status !== 'cancelado');
}

function stats() {
  const gross = goalsState.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paid = goalsState.orders.filter((order) => order.payment_status === 'pago').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = goalsState.orders.filter((order) => order.payment_status === 'pendente').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orderCount = goalsState.orders.length;
  const ticket = orderCount ? gross / orderCount : 0;
  const valuePercent = goalsState.goalValue ? Math.min(100, Math.round((gross / goalsState.goalValue) * 100)) : 0;
  const orderPercent = goalsState.goalOrders ? Math.min(100, Math.round((orderCount / goalsState.goalOrders) * 100)) : 0;
  const remainValue = Math.max(0, goalsState.goalValue - gross);
  const remainOrders = Math.max(0, goalsState.goalOrders - orderCount);
  return { gross, paid, pending, orderCount, ticket, valuePercent, orderPercent, remainValue, remainOrders };
}

function saveGoals() {
  const value = Number(document.querySelector('[data-goal-value]')?.value || 0);
  const orders = Number(document.querySelector('[data-goal-orders]')?.value || 0);
  goalsState.goalValue = value;
  goalsState.goalOrders = orders;
  localStorage.setItem('hotdog_goal_value', String(value));
  localStorage.setItem('hotdog_goal_orders', String(orders));
  renderGoals('Metas salvas.');
}

async function copyGoals() {
  const s = stats();
  const text = [
    `Metas do dia - Hot Dog do Vagner (${new Date().toLocaleDateString('pt-BR')})`,
    `Faturamento: ${brl(s.gross)} de ${brl(goalsState.goalValue)} (${s.valuePercent}%)`,
    `Pedidos: ${s.orderCount} de ${goalsState.goalOrders} (${s.orderPercent}%)`,
    `Recebido: ${brl(s.paid)}`,
    `Pendente: ${brl(s.pending)}`,
    `Ticket medio: ${brl(s.ticket)}`,
    `Falta para meta: ${brl(s.remainValue)} e ${s.remainOrders} pedido(s)`
  ].join('\n');
  await navigator.clipboard.writeText(text);
  renderGoals('Resumo copiado.');
}

function renderGoals(message = '') {
  let overlay = document.querySelector('.daily-goals-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'daily-goals-overlay';
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeGoals(); });
    document.body.appendChild(overlay);
  }
  const s = stats();
  overlay.innerHTML = `<section class="daily-goals-panel"><button class="daily-goals-close" type="button">×</button><header><span>Gestao diaria</span><h2>Metas do dia</h2><p>Acompanhe faturamento, pedidos, recebidos e o que falta para bater a meta.</p></header><div class="daily-goals-form"><label>Meta R$<input data-goal-value type="number" value="${goalsState.goalValue}" /></label><label>Meta pedidos<input data-goal-orders type="number" value="${goalsState.goalOrders}" /></label><button data-save type="button">Salvar metas</button><button data-copy type="button">Copiar resumo</button><button data-refresh type="button">Atualizar</button></div><div class="daily-goals-metrics"><article><span>Faturamento</span><strong>${brl(s.gross)}</strong></article><article><span>Pedidos</span><strong>${s.orderCount}</strong></article><article><span>Recebido</span><strong>${brl(s.paid)}</strong></article><article><span>Pendente</span><strong>${brl(s.pending)}</strong></article></div><div class="daily-goal-box"><strong>Meta de faturamento</strong><div><i style="width:${s.valuePercent}%"></i></div><p>${s.valuePercent}% atingido • faltam ${brl(s.remainValue)}</p></div><div class="daily-goal-box"><strong>Meta de pedidos</strong><div><i style="width:${s.orderPercent}%"></i></div><p>${s.orderPercent}% atingido • faltam ${s.remainOrders} pedido(s)</p></div><div class="daily-goals-tip">Ticket médio de hoje: <b>${brl(s.ticket)}</b>. ${s.remainValue > 0 && s.ticket > 0 ? `Para bater a meta, precisa de aproximadamente ${Math.ceil(s.remainValue / s.ticket)} pedido(s) no ticket atual.` : 'Meta de faturamento batida ou aguardando pedidos.'}</div><p class="daily-goals-message">${message}</p></section>`;
  overlay.querySelector('.daily-goals-close').addEventListener('click', closeGoals);
  overlay.querySelector('[data-save]').addEventListener('click', saveGoals);
  overlay.querySelector('[data-copy]').addEventListener('click', copyGoals);
  overlay.querySelector('[data-refresh]').addEventListener('click', async () => { renderGoals('Atualizando...'); await loadGoals(); renderGoals(); });
}

function ensureGoalsDock() {
  if (!isAdminPage() || !token() || document.querySelector('.daily-goals-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'daily-goals-dock';
  button.innerHTML = '<span>🎯</span><strong>Metas</strong>';
  button.addEventListener('click', async () => { renderGoals('Carregando metas...'); try { await loadGoals(); renderGoals(); } catch (error) { renderGoals(error.message); } });
  document.body.appendChild(button);
}

function bootDailyGoals() {
  if (goalsState.booted) return;
  goalsState.booted = true;
  setInterval(ensureGoalsDock, 1400);
}

bootDailyGoals();

if (window.location.pathname.includes('admin')) {
  import('./admin-command-center.css');
  import('./admin-command-center.js');
}
