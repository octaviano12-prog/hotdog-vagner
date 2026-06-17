import { useEffect, useMemo, useState } from 'react';
import { Bike, ChefHat, Clock, Flame, LogOut, Phone, Plus, ShieldCheck, ShoppingCart, Sparkles, Trash2, WalletCards } from 'lucide-react';
import { api, clearToken, formatMoney, getToken, setToken } from './api.js';

const statusLabels = {
  novo: 'Novo',
  preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  concluido: 'Concluido',
  cancelado: 'Cancelado'
};

const paymentLabels = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartao',
  fiado: 'Fiado'
};

const tabs = [
  ['dashboard', 'Dashboard'],
  ['orders', 'Pedidos'],
  ['new-order', 'Pedido no balcao'],
  ['products', 'Produtos'],
  ['finance', 'Financeiro'],
  ['customers', 'Clientes'],
  ['settings', 'Configuracoes']
];

function makeWhatsAppMessage(settings, payload, total, order) {
  const lines = [
    `Novo pedido - ${settings?.business_name || 'Hot Dog do Vagner'}`,
    order?.public_code ? `Codigo: ${order.public_code}` : order?.id ? `Pedido: #${order.id}` : '',
    '',
    ...payload.items.map((item, index) => {
      const extras = item.extraNames?.length ? ` | Adicionais: ${item.extraNames.join(', ')}` : '';
      return `${index + 1}. ${item.quantity}x ${item.name}${extras}`;
    }),
    '',
    `Cliente: ${payload.customer.name}`,
    `Telefone: ${payload.customer.phone}`,
    `Entrega: ${payload.delivery_type === 'entrega' ? 'Entrega' : 'Retirada no balcao'}`,
    payload.delivery_type === 'entrega' ? `Endereco: ${payload.customer.address}` : '',
    payload.customer.neighborhood ? `Bairro: ${payload.customer.neighborhood}` : '',
    payload.customer.reference ? `Referencia: ${payload.customer.reference}` : '',
    `Pagamento: ${paymentLabels[payload.payment_method] || payload.payment_method}`,
    payload.notes ? `Observacoes: ${payload.notes}` : '',
    `Total: ${formatMoney(total)}`
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
}

function productEmoji(type) {
  if (type === 'suco') return '🍊';
  if (type === 'bebida') return '🥤';
  if (type === 'adicional') return '🧀';
  return '🌭';
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{statusLabels[status] || status}</span>;
}

function PremiumHeader({ route, navigate, settings }) {
  return (
    <header className="premium-header">
      <button className="brand-block" onClick={() => navigate('menu')}>
        <span className="brand-icon"><Flame size={24} /></span>
        <span>
          <small>Pedidos online</small>
          <strong>{settings?.business_name || 'Hot Dog do Vagner'}</strong>
        </span>
      </button>

      <nav className="premium-nav">
        <button className={route === 'menu' ? 'active' : ''} onClick={() => navigate('menu')}>Cardapio</button>
        <button className={route === 'admin' ? 'active admin-link' : 'admin-link'} onClick={() => navigate('admin')}>
          <ShieldCheck size={16} /> Painel Admin
        </button>
      </nav>
    </header>
  );
}

function ProductCard({ product, extras, onAdd }) {
  const [selectedExtras, setSelectedExtras] = useState([]);

  function toggleExtra(id) {
    setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <article className="premium-product">
      <div className="premium-product-image">
        <span>{productEmoji(product.product_type)}</span>
      </div>
      <div className="premium-product-content">
        <div className="product-title-row">
          <div>
            <small>{product.product_type || 'produto'}</small>
            <h3>{product.name}</h3>
          </div>
          <strong>{formatMoney(product.price)}</strong>
        </div>
        <p>{product.description}</p>

        {product.product_type === 'hotdog' && extras.length > 0 && (
          <div className="extras">
            <small>Personalize seu lanche</small>
            <div className="extra-grid">
              {extras.map((extra) => (
                <label key={extra.id}>
                  <input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                  {extra.name} +{formatMoney(extra.price)}
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={() => onAdd(product, selectedExtras)}>
          Adicionar ao pedido
        </button>
      </div>
    </article>
  );
}

function PremiumCart({ cart, setCart, settings }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const deliveryFee = deliveryType === 'entrega' ? Number(settings?.delivery_fee || 0) : 0;
  const total = subtotal + deliveryFee;

  function removeItem(key) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  function updateQty(key, quantity) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  async function sendOrder(event) {
    event.preventDefault();
    if (cart.length === 0) {
      setMessage('Adicione pelo menos um item ao pedido.');
      return;
    }

    const payload = {
      customer,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      notes,
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        extras: item.extras.map((extra) => extra.id),
        notes: ''
      }))
    };

    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/api/orders', payload);
      const whatsappPayload = {
        ...payload,
        items: cart.map((item) => ({
          ...item,
          extraNames: item.extras.map((extra) => extra.name)
        }))
      };
      setMessage(`Pedido ${response.order.public_code || `#${response.order.id}`} enviado para o painel.`);
      setCart([]);
      setCustomer({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
      setNotes('');

      const canOpenWhatsApp = settings?.allow_whatsapp_redirect !== 0 && settings?.allow_whatsapp_redirect !== false;
      if (canOpenWhatsApp) {
        const whatsapp = settings?.whatsapp || '5518991959898';
        const url = `https://wa.me/${whatsapp}?text=${makeWhatsAppMessage(settings, whatsappPayload, response.order.total, response.order)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="premium-cart">
      <div className="cart-title">
        <ShoppingCart size={22} />
        <h2>Resumo do pedido</h2>
      </div>

      {cart.length === 0 ? <p className="muted">Escolha os itens do cardapio para montar o pedido.</p> : (
        <div className="cart-items">
          {cart.map((item) => (
            <div className="cart-item" key={item.key}>
              <div>
                <strong>{item.name}</strong>
                {item.extras.length > 0 && <small>+ {item.extras.map((extra) => extra.name).join(', ')}</small>}
              </div>
              <div className="qty">
                <button onClick={() => updateQty(item.key, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
              </div>
              <button className="icon-btn" onClick={() => removeItem(item.key)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="totals">
        <span>Subtotal</span><strong>{formatMoney(subtotal)}</strong>
        <span>Entrega</span><strong>{formatMoney(deliveryFee)}</strong>
        <span>Total</span><strong>{formatMoney(total)}</strong>
      </div>

      <form className="checkout" onSubmit={sendOrder}>
        <input placeholder="Nome do cliente" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
        <input placeholder="WhatsApp" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} required />
        <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
          <option value="entrega">Entrega</option>
          <option value="retirada">Retirada no balcao</option>
        </select>
        {deliveryType === 'entrega' && (
          <>
            <input placeholder="Endereco de entrega" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} required />
            <input placeholder="Bairro" value={customer.neighborhood} onChange={(e) => setCustomer({ ...customer, neighborhood: e.target.value })} />
            <input placeholder="Ponto de referencia" value={customer.reference} onChange={(e) => setCustomer({ ...customer, reference: e.target.value })} />
          </>
        )}
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao">Cartao</option>
          <option value="fiado">Fiado</option>
        </select>
        <textarea placeholder="Observacoes do pedido" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Enviar pedido'}</button>
        {message && <p className="notice">{message}</p>}
      </form>
    </aside>
  );
}

function PremiumHome({ settings, navigate }) {
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/public/menu')
      .then(setMenu)
      .catch(() => setMenu({ categories: [], products: [] }))
      .finally(() => setLoading(false));
  }, []);

  const extras = useMemo(() => menu.products.filter((product) => product.product_type === 'adicional'), [menu.products]);
  const featuredProducts = useMemo(() => menu.products.filter((product) => product.product_type !== 'adicional').slice(0, 3), [menu.products]);

  function addToCart(product, extraIds = []) {
    const selectedExtras = extras.filter((extra) => extraIds.includes(extra.id));
    const key = `${product.id}-${selectedExtras.map((extra) => extra.id).sort().join('-')}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, key, quantity: 1, extras: selectedExtras }];
    });
  }

  function scrollToMenu() {
    document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="premium-home">
      <section className="premium-hero">
        <div className="hero-copy">
          <span className="hero-pill"><Sparkles size={16} /> Hot dog prensado premium</span>
          <h1>Pedido online rapido, bonito e integrado ao painel.</h1>
          <p>O cliente escolhe o lanche, monta os adicionais, envia o pedido e tudo cai automaticamente na gestao do negocio.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={scrollToMenu}>Fazer pedido agora</button>
            <button className="btn-glass" onClick={() => navigate('admin')}><ShieldCheck size={16} /> Entrar no painel</button>
          </div>
          <div className="hero-metrics">
            <span><Clock size={18} /> Previsao: {settings?.estimated_delivery_minutes || 35} min</span>
            <span><Bike size={18} /> Entrega: {formatMoney(settings?.delivery_fee || 0)}</span>
            <span><Phone size={18} /> WhatsApp: {settings?.phone || settings?.whatsapp || '(18) 99195-9898'}</span>
          </div>
        </div>

        <div className="hero-showcase">
          <div className="hotdog-visual">
            <span className="bread top"></span>
            <span className="filling cheese"></span>
            <span className="filling sausage"></span>
            <span className="filling salad"></span>
            <span className="bread bottom"></span>
          </div>
          <div className="hero-status-card">
            <strong>Fila inteligente</strong>
            <small>novo → preparo → entrega → concluido</small>
          </div>
        </div>
      </section>

      <section className="service-strip">
        <div><ChefHat size={22} /><strong>Cardapio digital</strong><span>Produtos, adicionais, bebidas e sucos.</span></div>
        <div><ShoppingCart size={22} /><strong>Pedido automatizado</strong><span>Salva no banco e aparece no admin.</span></div>
        <div><WalletCards size={22} /><strong>Gestao financeira</strong><span>Caixa, despesas, vendas e relatorios.</span></div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="featured-menu">
          <div className="section-title">
            <span className="eyebrow">Mais pedidos</span>
            <h2>Destaques da casa</h2>
          </div>
          <div className="featured-grid">
            {featuredProducts.map((product) => (
              <button key={product.id} className="featured-card" onClick={() => addToCart(product, [])}>
                <span>{productEmoji(product.product_type)}</span>
                <strong>{product.name}</strong>
                <small>{formatMoney(product.price)}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="cardapio" className="premium-layout">
        <div className="menu-section">
          <div className="section-title">
            <span className="eyebrow">Monte seu pedido</span>
            <h2>Cardapio completo</h2>
            <p>Escolha os itens, adicione extras e finalize sem perder nenhuma informacao do cliente.</p>
          </div>

          {loading && <p className="muted">Carregando cardapio...</p>}
          {!loading && menu.categories.length === 0 && <p className="notice">Nenhum produto ativo encontrado no cardapio.</p>}

          {menu.categories.map((category) => (
            <section className="category" key={category.id}>
              <div className="category-heading">
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </div>
              <div className="product-grid">
                {category.products.map((product) => (
                  <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <PremiumCart cart={cart} setCart={setCart} settings={settings} />
      </section>
    </main>
  );
}

function PremiumLogin({ onLogin }) {
  const [email, setEmail] = useState('admin@hotdog.com');
  const [password, setPassword] = useState('123456');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      setToken(response.token);
      onLogin(response.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="login-card premium-login">
        <span className="hero-pill"><ShieldCheck size={16} /> Acesso do gestor</span>
        <h2>Painel administrativo premium</h2>
        <p className="muted">Controle pedidos, produtos, caixa, despesas, clientes e configuracoes do delivery.</p>
        <form onSubmit={submit}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" />
          <button className="btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no painel'}</button>
        </form>
        {message && <p className="notice error">{message}</p>}
      </section>

      <section className="login-benefits">
        <div><strong>Pedidos em tempo real</strong><span>Acompanhe a fila por status.</span></div>
        <div><strong>Caixa completo</strong><span>Abra, feche e registre movimentos.</span></div>
        <div><strong>Relatorios</strong><span>Veja vendas, pendencias e liquido do dia.</span></div>
      </section>
    </main>
  );
}

function AdminPremium() {
  const [tab, setTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cash, setCash] = useState({ register: null, totals: null, movements: [] });
  const [settings, setSettings] = useState(null);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  const [expense, setExpense] = useState({ description: '', amount: '', category: 'Geral', payment_method: 'dinheiro' });
  const [movement, setMovement] = useState({ movement_type: 'entrada', description: '', amount: '', payment_method: 'dinheiro' });
  const [openValue, setOpenValue] = useState('0');
  const [closeValue, setCloseValue] = useState('0');
  const [productForm, setProductForm] = useState({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
  const [manualCustomer, setManualCustomer] = useState({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
  const [manualOrder, setManualOrder] = useState({ delivery_type: 'entrega', payment_method: 'dinheiro', payment_status: 'pendente', order_source: 'balcao', notes: '', items: [{ product_id: '', quantity: 1, extras: [] }] });
  const activeProducts = useMemo(() => products.filter((p) => Number(p.is_active) === 1 && p.product_type !== 'adicional'), [products]);

  async function loadAdmin() {
    try {
      const [orderData, productData, categoryData, summaryData, dashboardData, settingsData, expenseData, cashData, customerData, reportData] = await Promise.all([
        api.admin.get('/api/admin/orders'),
        api.admin.get('/api/admin/products'),
        api.admin.get('/api/admin/categories'),
        api.admin.get('/api/admin/finance/summary'),
        api.admin.get('/api/admin/dashboard'),
        api.admin.get('/api/admin/settings'),
        api.admin.get('/api/admin/finance/expenses'),
        api.admin.get('/api/admin/finance/cash/current'),
        api.admin.get('/api/admin/customers'),
        api.admin.get('/api/admin/reports/sales')
      ]);
      setOrders(orderData);
      setProducts(productData);
      setCategories(categoryData);
      setSummary(summaryData);
      setDashboard(dashboardData);
      setSettings(settingsData);
      setExpenses(expenseData);
      setCash(cashData);
      setCustomers(customerData);
      setReport(reportData);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadAdmin();
    const timer = setInterval(loadAdmin, 15000);
    return () => clearInterval(timer);
  }, []);

  async function updateStatus(orderId, status, payment_status) {
    await api.admin.patch(`/api/admin/orders/${orderId}/status-flow`, { status, payment_status });
    await loadAdmin();
  }

  async function updatePayment(orderId, payment_status) {
    await api.admin.patch(`/api/admin/orders/${orderId}/payment-flow`, { payment_status });
    await loadAdmin();
  }

  async function saveProduct(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/products', { ...productForm, category_id: Number(productForm.category_id), price: Number(productForm.price), sort_order: Number(productForm.sort_order || 0), is_active: true });
    setProductForm({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
    await loadAdmin();
  }

  async function saveExpense(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/expenses', { ...expense, amount: Number(expense.amount) });
    setExpense({ description: '', amount: '', category: 'Geral', payment_method: 'dinheiro' });
    await loadAdmin();
  }

  async function saveMovement(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/cash/movements', { ...movement, amount: Number(movement.amount) });
    setMovement({ movement_type: 'entrada', description: '', amount: '', payment_method: 'dinheiro' });
    await loadAdmin();
  }

  async function openCash(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/cash/open', { opening_amount: Number(openValue || 0) });
    await loadAdmin();
  }

  async function closeCash(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/cash/close', { closing_amount: Number(closeValue || 0) });
    await loadAdmin();
  }

  async function saveSettings(event) {
    event.preventDefault();
    await api.admin.put('/api/admin/settings/premium', {
      ...settings,
      delivery_fee: Number(settings.delivery_fee || 0),
      minimum_order: Number(settings.minimum_order || 0),
      estimated_delivery_minutes: Number(settings.estimated_delivery_minutes || 35),
      is_open: Boolean(Number(settings.is_open ?? 1)),
      allow_whatsapp_redirect: Boolean(Number(settings.allow_whatsapp_redirect ?? 1))
    });
    setMessage('Configuracoes salvas.');
    await loadAdmin();
  }

  async function createManualOrder(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/orders', { ...manualOrder, customer: manualCustomer, items: manualOrder.items.map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity || 1), extras: [], notes: '' })) });
    setManualCustomer({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
    setManualOrder({ delivery_type: 'entrega', payment_method: 'dinheiro', payment_status: 'pendente', order_source: 'balcao', notes: '', items: [{ product_id: '', quantity: 1, extras: [] }] });
    setMessage('Pedido criado no painel.');
    await loadAdmin();
  }

  function updateManualItem(index, field, value) {
    setManualOrder((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  return (
    <main className="admin-page">
      <div className="admin-header premium-admin-title">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h2>Central de operacao do delivery</h2>
        </div>
        <div className="admin-actions">
          <button className="btn-secondary" onClick={loadAdmin}>Atualizar</button>
          <button className="btn-secondary" onClick={() => { clearToken(); window.location.reload(); }}><LogOut size={16} /> Sair</button>
        </div>
      </div>

      <div className="admin-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
      {message && <p className="notice">{message}</p>}

      {tab === 'dashboard' && (
        <>
          <section className="cards">
            <Metric label="Faturamento hoje" value={formatMoney(summary?.gross_today)} />
            <Metric label="Recebido hoje" value={formatMoney(summary?.paid_today)} />
            <Metric label="Pendente" value={formatMoney(summary?.pending_today)} />
            <Metric label="Liquido hoje" value={formatMoney(summary?.net_today)} />
          </section>
          <section className="admin-grid">
            <div className="panel">
              <div className="panel-title"><h3>Fila de pedidos</h3></div>
              <div className="status-grid">{Object.keys(statusLabels).map((status) => <div className="status-box" key={status}><StatusBadge status={status} /><strong>{dashboard?.status_counts?.find((item) => item.status === status)?.total || 0}</strong></div>)}</div>
            </div>
            <div className="panel">
              <div className="panel-title"><h3>Produtos mais vendidos hoje</h3></div>
              <div className="mini-list">
                {dashboard?.top_products?.map((item) => <span key={item.name}>{item.name} <strong>{item.quantity}x</strong></span>)}
                {(!dashboard?.top_products || dashboard.top_products.length === 0) && <p className="muted">Ainda nao houve vendas hoje.</p>}
              </div>
            </div>
          </section>
        </>
      )}

      {tab === 'orders' && (
        <section className="panel wide-panel">
          <div className="panel-title"><h3>Pedidos em tempo real</h3><button className="btn-secondary" onClick={loadAdmin}>Atualizar</button></div>
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-head">
                  <div>
                    <strong>{order.public_code || `#${order.id}`} - {order.customer_name}</strong>
                    <small>{order.customer_phone} | {order.delivery_type} | {paymentLabels[order.payment_method] || order.payment_method} | {order.payment_status}</small>
                    <small>{order.customer_address} {order.customer_neighborhood ? `- ${order.customer_neighborhood}` : ''}</small>
                    {order.notes && <small>Obs.: {order.notes}</small>}
                  </div>
                  <div className="order-total"><StatusBadge status={order.status} /><strong>{formatMoney(order.total)}</strong></div>
                </div>
                <div className="order-items">{order.items?.map((item) => <span key={item.id}>{item.quantity}x {item.name}</span>)}</div>
                <div className="order-actions">
                  <button onClick={() => updateStatus(order.id, 'preparo')}>Aceitar/preparar</button>
                  <button onClick={() => updateStatus(order.id, 'saiu_entrega')}>Saiu entrega</button>
                  <button onClick={() => updateStatus(order.id, 'concluido', 'pago')}>Concluir e pagar</button>
                  <button onClick={() => updatePayment(order.id, 'pago')}>Marcar pago</button>
                  <button onClick={() => updateStatus(order.id, 'cancelado', 'cancelado')}>Cancelar</button>
                </div>
              </article>
            ))}
            {orders.length === 0 && <p className="muted">Nenhum pedido encontrado.</p>}
          </div>
        </section>
      )}

      {tab === 'new-order' && (
        <section className="panel">
          <div className="panel-title"><h3><Plus size={18} /> Pedido manual / balcao</h3></div>
          <form onSubmit={createManualOrder} className="stack-form">
            <div className="form-grid">
              <input placeholder="Nome do cliente" value={manualCustomer.name} onChange={(e) => setManualCustomer({ ...manualCustomer, name: e.target.value })} required />
              <input placeholder="Telefone" value={manualCustomer.phone} onChange={(e) => setManualCustomer({ ...manualCustomer, phone: e.target.value })} required />
              <input placeholder="Endereco" value={manualCustomer.address} onChange={(e) => setManualCustomer({ ...manualCustomer, address: e.target.value })} />
              <input placeholder="Bairro" value={manualCustomer.neighborhood} onChange={(e) => setManualCustomer({ ...manualCustomer, neighborhood: e.target.value })} />
            </div>
            {manualOrder.items.map((item, index) => <div className="form-grid" key={index}><select value={item.product_id} onChange={(e) => updateManualItem(index, 'product_id', e.target.value)} required><option value="">Produto</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatMoney(product.price)}</option>)}</select><input type="number" min="1" value={item.quantity} onChange={(e) => updateManualItem(index, 'quantity', e.target.value)} /></div>)}
            <button type="button" className="btn-secondary" onClick={() => setManualOrder((current) => ({ ...current, items: [...current.items, { product_id: '', quantity: 1, extras: [] }] }))}>Adicionar item</button>
            <div className="form-grid"><select value={manualOrder.delivery_type} onChange={(e) => setManualOrder({ ...manualOrder, delivery_type: e.target.value })}><option value="entrega">Entrega</option><option value="retirada">Retirada</option></select><select value={manualOrder.payment_method} onChange={(e) => setManualOrder({ ...manualOrder, payment_method: e.target.value })}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartao</option><option value="fiado">Fiado</option></select><select value={manualOrder.payment_status} onChange={(e) => setManualOrder({ ...manualOrder, payment_status: e.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago</option></select><select value={manualOrder.order_source} onChange={(e) => setManualOrder({ ...manualOrder, order_source: e.target.value })}><option value="balcao">Balcao</option><option value="admin">Admin</option><option value="whatsapp">WhatsApp</option></select></div>
            <textarea placeholder="Observacoes" value={manualOrder.notes} onChange={(e) => setManualOrder({ ...manualOrder, notes: e.target.value })} />
            <button className="btn-primary">Criar pedido</button>
          </form>
        </section>
      )}

      {tab === 'products' && (
        <section className="admin-grid">
          <div className="panel">
            <div className="panel-title"><h3><Plus size={18} /> Novo produto</h3></div>
            <form onSubmit={saveProduct} className="stack-form">
              <select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} required><option value="">Categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
              <input placeholder="Nome do produto" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              <textarea placeholder="Descricao" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              <input placeholder="Preco" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
              <select value={productForm.product_type} onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}><option value="hotdog">Hot dog</option><option value="suco">Suco</option><option value="bebida">Bebida</option><option value="adicional">Adicional</option></select>
              <button className="btn-primary">Salvar produto</button>
            </form>
          </div>
          <div className="panel">
            <div className="panel-title"><h3>Produtos cadastrados</h3></div>
            <div className="product-table">{products.map((product) => <div className="product-row" key={product.id}><div><strong>{product.name}</strong><small>{product.category_name} | {product.product_type}</small></div><strong>{formatMoney(product.price)}</strong><span>{product.is_active ? 'Ativo' : 'Inativo'}</span></div>)}</div>
          </div>
        </section>
      )}

      {tab === 'finance' && (
        <section className="admin-grid">
          <div className="panel"><div className="panel-title"><h3>Caixa</h3></div>{cash?.register ? <><p className="notice">Caixa aberto. Saldo previsto: <strong>{formatMoney(cash.totals?.saldo)}</strong></p><div className="cards compact"><Metric label="Entradas" value={formatMoney(cash.totals?.entradas)} /><Metric label="Saidas" value={formatMoney(cash.totals?.saidas)} /></div><form onSubmit={closeCash} className="stack-form"><input type="number" step="0.01" value={closeValue} onChange={(e) => setCloseValue(e.target.value)} placeholder="Valor contado no fechamento" /><button className="btn-primary">Fechar caixa</button></form></> : <form onSubmit={openCash} className="stack-form"><input type="number" step="0.01" value={openValue} onChange={(e) => setOpenValue(e.target.value)} placeholder="Troco inicial" /><button className="btn-primary">Abrir caixa</button></form>}<hr /><form onSubmit={saveMovement} className="stack-form"><select value={movement.movement_type} onChange={(e) => setMovement({ ...movement, movement_type: e.target.value })}><option value="entrada">Entrada</option><option value="saida">Saida</option></select><input placeholder="Descricao" value={movement.description} onChange={(e) => setMovement({ ...movement, description: e.target.value })} required /><input placeholder="Valor" type="number" step="0.01" value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} required /><button className="btn-secondary">Registrar movimento</button></form></div>
          <div className="panel"><div className="panel-title"><h3><WalletCards size={18} /> Nova despesa</h3></div><form onSubmit={saveExpense} className="stack-form"><input placeholder="Descricao" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required /><input placeholder="Valor" type="number" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} required /><input placeholder="Categoria" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} /><button className="btn-primary">Cadastrar saida</button></form><div className="mini-list">{expenses.slice(0, 8).map((item) => <span key={item.id}>{item.description} <strong>{formatMoney(item.amount)}</strong></span>)}</div></div>
        </section>
      )}

      {tab === 'customers' && <section className="panel"><div className="panel-title"><h3>Clientes</h3></div><div className="product-table">{customers.map((customer) => <div className="product-row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.phone} | {customer.address}</small></div><span>{customer.orders_count} pedidos</span><strong>{formatMoney(customer.total_spent)}</strong></div>)}</div></section>}

      {tab === 'settings' && settings && (
        <section className="admin-grid">
          <div className="panel"><div className="panel-title"><h3>Configuracoes do negocio</h3></div><form onSubmit={saveSettings} className="stack-form"><input value={settings.business_name || ''} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} placeholder="Nome do negocio" /><input value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="Telefone" /><input value={settings.whatsapp || ''} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} placeholder="WhatsApp com DDI" /><input value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="Endereco" /><input type="number" step="0.01" value={settings.delivery_fee || 0} onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })} placeholder="Taxa entrega" /><input type="number" step="0.01" value={settings.minimum_order || 0} onChange={(e) => setSettings({ ...settings, minimum_order: e.target.value })} placeholder="Pedido minimo" /><input value={settings.pix_key || ''} onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })} placeholder="Chave PIX" /><input type="number" value={settings.estimated_delivery_minutes || 35} onChange={(e) => setSettings({ ...settings, estimated_delivery_minutes: e.target.value })} placeholder="Previsao em minutos" /><textarea value={settings.delivery_area_text || ''} onChange={(e) => setSettings({ ...settings, delivery_area_text: e.target.value })} placeholder="Areas/bairros de entrega" /><select value={Number(settings.is_open ?? 1)} onChange={(e) => setSettings({ ...settings, is_open: e.target.value })}><option value="1">Aberto</option><option value="0">Fechado</option></select><select value={Number(settings.allow_whatsapp_redirect ?? 1)} onChange={(e) => setSettings({ ...settings, allow_whatsapp_redirect: e.target.value })}><option value="1">Abrir WhatsApp apos pedido</option><option value="0">Nao abrir WhatsApp</option></select><button className="btn-primary">Salvar configuracoes</button></form></div>
          <div className="panel"><div className="panel-title"><h3>Relatorio de hoje</h3></div><div className="mini-list"><span>Vendas <strong>{formatMoney(report?.summary?.gross)}</strong></span><span>Recebido <strong>{formatMoney(report?.summary?.paid)}</strong></span><span>Despesas <strong>{formatMoney(report?.summary?.expenses)}</strong></span><span>Liquido <strong>{formatMoney(report?.summary?.net)}</strong></span></div></div>
        </section>
      )}
    </main>
  );
}

export default function PremiumApp() {
  const [route, setRoute] = useState(window.location.pathname.includes('admin') ? 'admin' : 'menu');
  const [authTick, setAuthTick] = useState(0);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/api/public/settings').then(setSettings).catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    function onPopState() {
      setRoute(window.location.pathname.includes('admin') ? 'admin' : 'menu');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(nextRoute) {
    const path = nextRoute === 'admin' ? '/admin' : '/';
    window.history.pushState({}, '', path);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const logged = Boolean(getToken()) || authTick > 0;

  return (
    <div className="premium-shell">
      <PremiumHeader route={route} navigate={navigate} settings={settings} />
      {route === 'admin'
        ? (logged ? <AdminPremium /> : <PremiumLogin onLogin={() => setAuthTick((value) => value + 1)} />)
        : <PremiumHome settings={settings} navigate={navigate} />}
    </div>
  );
}
