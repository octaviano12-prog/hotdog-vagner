const requireLoginState = {
  booted: false,
  promptOpen: false
};

function isPublicPage() {
  return !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas');
}

function customerToken() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customerProfile() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function isLogged() {
  return Boolean(customerToken() && customerProfile());
}

function openAccount() {
  document.querySelector('.customer-account-float')?.click();
  closeLoginPrompt();
}

function closeLoginPrompt() {
  requireLoginState.promptOpen = false;
  document.querySelector('.require-login-overlay')?.remove();
}

function showToast(message) {
  let toast = document.querySelector('.require-login-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'require-login-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function showLoginPrompt() {
  if (requireLoginState.promptOpen) return;
  requireLoginState.promptOpen = true;
  let overlay = document.querySelector('.require-login-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'require-login-overlay';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeLoginPrompt();
    });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<section class="require-login-card"><button type="button" class="require-login-close">×</button><span>Cadastro obrigatório</span><h2>Entre ou cadastre para finalizar</h2><p>Para fazer pedido no Hot Dog do Vagner, o cliente precisa ter cadastro. Assim o endereço fica salvo, o histórico aparece na conta e o acompanhamento fica mais seguro.</p><div class="require-login-benefits"><article>✅ Pedido com seus dados salvos</article><article>🚚 Endereço preenchido automaticamente</article><article>⭐ Fidelidade e pedir novamente</article></div><button type="button" data-open-account>Entrar / cadastrar agora</button></section>`;
  overlay.querySelector('.require-login-close').addEventListener('click', closeLoginPrompt);
  overlay.querySelector('[data-open-account]').addEventListener('click', openAccount);
}

function ensureCheckoutLockCard() {
  const form = document.querySelector('.checkout-form');
  if (!form) return;
  let card = document.querySelector('.checkout-login-rule-card');
  const logged = isLogged();
  const customer = customerProfile();
  if (!card) {
    card = document.createElement('div');
    card.className = 'checkout-login-rule-card';
    form.insertAdjacentElement('afterbegin', card);
  }
  card.classList.toggle('logged', logged);
  card.innerHTML = logged
    ? `<strong>✅ Pedido liberado</strong><p>Voce esta comprando como <b>${customer?.name || 'cliente cadastrado'}</b>.</p>`
    : '<strong>🔒 Cadastro obrigatório</strong><p>Entre ou cadastre-se para liberar o botão de finalizar pedido.</p><button type="button" data-login-now>Entrar / cadastrar</button>';
  card.querySelector('[data-login-now]')?.addEventListener('click', openAccount);
}

function updateSendButton() {
  const button = document.querySelector('.checkout-form .send-order');
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  if (!isLogged()) {
    button.textContent = 'Entrar para finalizar pedido';
    button.classList.add('require-login-button');
  } else {
    button.textContent = button.dataset.originalText || 'Enviar pedido';
    button.classList.remove('require-login-button');
  }
}

function installSubmitGuard() {
  const form = document.querySelector('.checkout-form');
  if (!form || form.dataset.requireLoginReady) return;
  form.dataset.requireLoginReady = '1';
  form.addEventListener('submit', (event) => {
    if (!isLogged()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('Para finalizar o pedido, entre ou cadastre-se primeiro.');
      showLoginPrompt();
    }
  }, true);
}

function installFetchGuard() {
  if (window.__hotdogRequireLoginFetch) return;
  window.__hotdogRequireLoginFetch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || 'GET').toUpperCase();
    if (url.includes('/api/orders') && method === 'POST') {
      if (!isLogged()) {
        showToast('Cadastro obrigatório para fazer pedido.');
        showLoginPrompt();
        return new Response(JSON.stringify({ message: 'Faça login ou cadastre-se para finalizar o pedido.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      init = {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${customerToken()}`
        }
      };
    }
    return originalFetch(input, init);
  };
}

function bootRequireLogin() {
  if (requireLoginState.booted || !isPublicPage()) return;
  requireLoginState.booted = true;
  installFetchGuard();
  setInterval(() => {
    ensureCheckoutLockCard();
    updateSendButton();
    installSubmitGuard();
  }, 900);
  window.addEventListener('storage', () => {
    ensureCheckoutLockCard();
    updateSendButton();
  });
}

bootRequireLogin();
