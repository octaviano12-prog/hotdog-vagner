const commandState = { booted: false };

function isAdminPage() { return window.location.pathname.includes('admin'); }
function token() { return localStorage.getItem('hotdog_token') || ''; }
function closeCommand() { document.querySelector('.command-overlay')?.remove(); }

const modules = [
  { title: 'Dashboard', icon: '📊', text: 'Voltar para o painel principal', action: () => { window.location.href = '/admin'; } },
  { title: 'Pedidos', icon: '🧾', text: 'Kanban e operação dos pedidos', action: () => clickText('Pedidos') },
  { title: 'Cozinha', icon: '🍳', text: 'Tela para produção/TV', action: () => { window.location.href = '/cozinha'; } },
  { title: 'Entregas', icon: '🛵', text: 'Central do entregador', action: () => { window.location.href = '/entregas'; } },
  { title: 'Clientes VIP', icon: '👥', text: 'Clientes, favoritos e pendências', action: () => document.querySelector('.clientes-vip-dock')?.click() },
  { title: 'Campanhas', icon: '📣', text: 'Mensagens prontas para WhatsApp', action: () => document.querySelector('.campaign-dock')?.click() },
  { title: 'Pós-venda', icon: '⭐', text: 'Avaliação após entrega', action: () => document.querySelector('.post-sale-dock')?.click() },
  { title: 'Cardápio', icon: '🌭', text: 'Ranking de produtos', action: () => document.querySelector('.menu-rank-dock')?.click() },
  { title: 'Disponibilidade', icon: '✅', text: 'Pausar itens esgotados', action: () => document.querySelector('.availability-dock')?.click() },
  { title: 'Financeiro', icon: '💰', text: 'Caixa, relatórios e CSV', action: () => document.querySelector('[data-report-print]')?.click() },
  { title: 'Metas', icon: '🎯', text: 'Meta diária de vendas', action: () => document.querySelector('.daily-goals-dock')?.click() }
];

function clickText(label) {
  const btn = [...document.querySelectorAll('button, a')].find((el) => (el.textContent || '').toLowerCase().includes(label.toLowerCase()));
  btn?.click();
}

function compactEnabled() {
  return localStorage.getItem('hotdog_admin_compact') === '1';
}

function applyCompact() {
  document.body.classList.toggle('admin-compact-docks', compactEnabled());
}

function toggleCompact() {
  localStorage.setItem('hotdog_admin_compact', compactEnabled() ? '0' : '1');
  applyCompact();
  renderCommand();
}

function renderCommand() {
  let overlay = document.querySelector('.command-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'command-overlay';
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeCommand(); });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<section class="command-panel"><button class="command-close" type="button">×</button><header><span>Central administrativa</span><h2>Menu profissional</h2><p>Todas as funções do delivery organizadas em um só lugar.</p></header><div class="command-tools"><button data-compact type="button">${compactEnabled() ? 'Mostrar botões flutuantes' : 'Modo compacto'}</button><button data-refresh type="button">Atualizar tela</button></div><div class="command-grid">${modules.map((mod, index) => `<button type="button" data-module="${index}"><span>${mod.icon}</span><strong>${mod.title}</strong><small>${mod.text}</small></button>`).join('')}</div></section>`;
  overlay.querySelector('.command-close').addEventListener('click', closeCommand);
  overlay.querySelector('[data-compact]').addEventListener('click', toggleCompact);
  overlay.querySelector('[data-refresh]').addEventListener('click', () => window.location.reload());
  overlay.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => {
    const mod = modules[Number(button.dataset.module)];
    closeCommand();
    setTimeout(() => mod.action(), 120);
  }));
}

function ensureCommandDock() {
  if (!isAdminPage() || !token() || document.querySelector('.command-dock')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command-dock';
  button.innerHTML = '<span>☰</span><strong>Menu Admin</strong>';
  button.addEventListener('click', renderCommand);
  document.body.appendChild(button);
  applyCompact();
}

function bootCommandCenter() {
  if (commandState.booted) return;
  commandState.booted = true;
  setInterval(ensureCommandDock, 1300);
  setTimeout(applyCompact, 600);
}

bootCommandCenter();

if (window.location.pathname.includes('admin')) {
  import('./admin-product-availability.css');
  import('./admin-product-availability.js');
}
