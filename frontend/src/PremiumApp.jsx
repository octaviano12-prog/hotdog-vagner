import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BarChart3,
  Activity,
  ArrowRight,
  Bike,
  Building2,
  CalendarDays,
  ChefHat,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  Home,
  History,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPin,
  Mail,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Users,
  Volume2,
  WalletCards,
  XCircle
} from 'lucide-react';
import { api, clearToken, formatMoney, getToken, setToken } from './api.js';
import { productMedia, productMediaPosition } from './product-media.js';

const statusLabels = {
  novo: 'Novo',
  preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  concluido: 'Concluido',
  cancelado: 'Cancelado'
};

const statusFlow = ['novo', 'preparo', 'saiu_entrega', 'concluido', 'cancelado'];

const statusMeta = {
  novo: { title: 'Novo', action: 'Preparar', next: 'preparo', icon: Bell },
  preparo: { title: 'Em preparo', action: 'Saiu para entrega', next: 'saiu_entrega', icon: Store },
  saiu_entrega: { title: 'Saiu para entrega', action: 'Concluir', next: 'concluido', icon: Truck },
  concluido: { title: 'Concluido', action: 'Pago', next: 'concluido', icon: CheckCircle },
  cancelado: { title: 'Cancelado', action: 'Cancelado', next: 'cancelado', icon: XCircle }
};

const paymentLabels = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartao',
  fiado: 'Fiado'
};

const adminTabs = [
  ['dashboard', 'Dashboard', Home],
  ['orders', 'Pedidos', ShoppingBag],
  ['new-order', 'Pedido no balcao', Store],
  ['products', 'Produtos', Package],
  ['finance', 'Financeiro', DollarSign],
  ['customers', 'Clientes', Users],
  ['settings', 'Configuracoes', Settings]
];

function makeWhatsAppMessage(settings, payload, total, order) {
  const lines = [
    `Novo pedido - ${settings?.business_name || 'Hotdog Prensado'}`,
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

function PremiumHeader({ route, navigate, settings }) {
  return (
    <header className="premium-header">
      <button className="brand-block" onClick={() => navigate('menu')}>
        <span className="brand-icon"><Flame size={24} /></span>
        <span>
          <small>Pedidos online</small>
          <strong>{settings?.business_name || 'Hotdog Prensado'}</strong>
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
    <article className="product-card">
      <div className="product-image"><span>{productEmoji(product.product_type)}</span></div>
      <div className="product-content">
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

        <button className="btn-primary" onClick={() => onAdd(product, selectedExtras)}>Adicionar ao pedido</button>
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
    if (cart.length === 0) return setMessage('Adicione pelo menos um item ao pedido.');

    const payload = {
      customer,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      notes,
      items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity, extras: item.extras.map((extra) => extra.id), notes: '' }))
    };

    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/api/orders', payload);
      const whatsappPayload = { ...payload, items: cart.map((item) => ({ ...item, extraNames: item.extras.map((extra) => extra.name) })) };
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
      <div className="cart-title"><ShoppingCart size={22} /><h2>Resumo do pedido</h2></div>
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
    api.get('/api/public/menu').then(setMenu).catch(() => setMenu({ categories: [], products: [] })).finally(() => setLoading(false));
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
          <div className="hero-status-card"><strong>Fila inteligente</strong><small>novo → preparo → entrega → concluido</small></div>
        </div>
      </section>

      <section className="service-strip">
        <div><ChefHat size={22} /><strong>Cardapio digital</strong><span>Produtos, adicionais, bebidas e sucos.</span></div>
        <div><ShoppingCart size={22} /><strong>Pedido automatizado</strong><span>Salva no banco e aparece no admin.</span></div>
        <div><WalletCards size={22} /><strong>Gestao financeira</strong><span>Caixa, despesas, vendas e relatorios.</span></div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="featured-menu">
          <div className="section-title"><span className="eyebrow">Mais pedidos</span><h2>Destaques da casa</h2></div>
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

      <section id="cardapio" className="premium-layout layout">
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
              <div className="category-heading"><h3>{category.name}</h3><p>{category.description}</p></div>
              <div className="product-grid">
                {category.products.map((product) => <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} />)}
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="admin-login-showcase">
        <div className="login-showcase-badge"><span>🌭</span><div><strong>Hotdog Prensado</strong><small>Central de operações</small></div></div>
        <img className="login-hotdog-art" src="/images/admin-login-hotdog.svg" alt="Hotdog Prensado" />
        <div className="login-showcase-copy">
          <span className="login-eyebrow"><Activity size={15} /> Gestão em tempo real</span>
          <h1>Seu delivery<br /><em>sob controle.</em></h1>
          <p>Acompanhe pedidos, produção, entregas e resultados em um painel feito para a rotina do negócio.</p>
        </div>
        <div className="login-showcase-metrics">
          <article><ShoppingBag size={20} /><div><strong>Pedidos organizados</strong><small>Da entrada até a entrega</small></div></article>
          <article><WalletCards size={20} /><div><strong>Financeiro integrado</strong><small>Caixa e resultados do dia</small></div></article>
          <article><ShieldCheck size={20} /><div><strong>Acesso protegido</strong><small>Área exclusiva do gestor</small></div></article>
        </div>
        <div className="login-operation-status"><i /> Sistema operacional <span>•</span> Pronto para receber pedidos</div>
      </section>
      <section className="login-card premium-login">
        <div className="login-card-icon"><ShieldCheck size={26} /></div>
        <span className="hero-pill"><ShieldCheck size={16} /> Área segura</span>
        <h2>Bem-vindo de volta</h2>
        <p className="muted">Entre com os dados do administrador para acessar o painel.</p>
        <form onSubmit={submit}>
          <label><span>E-mail</span><div className="login-input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@hotdog.com" autoComplete="username" required /></div></label>
          <label><span>Senha</span><div className="login-input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" autoComplete="current-password" required /><button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <button className="btn-primary login-submit" disabled={loading}>{loading ? 'Entrando...' : <><span>Entrar no painel</span><ArrowRight size={19} /></>}</button>
        </form>
        {message && <p className="notice error">{message}</p>}
        <div className="login-security-note"><LockKeyhole size={15} /><span>Conexão segura e acesso restrito ao administrador.</span></div>
        <a href="/" className="login-back-link">← Voltar para o cardápio</a>
      </section>
    </main>
  );
}

function AdminSidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">🌭</div>
        <div className="sidebar-brand-copy"><strong>Hotdog Prensado</strong><span>Pedidos Online</span></div>
      </div>
      <nav className="sidebar-nav">
        {adminTabs.map(([key, label, Icon]) => (
          <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={20} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-shortcuts">
        <button type="button" onClick={() => {
          const shortcut = document.querySelector('.delivery-dock,[data-delivery-open]');
          if (shortcut) shortcut.click();
          else setActiveTab('orders');
        }}><Bike size={19} /> Entregas</button>
        <button type="button" onClick={() => { window.location.href = '/cozinha'; }}><ChefHat size={19} /> Modo cozinha</button>
      </div>
      <div className="sidebar-user">
        <div className="avatar">AD</div>
        <div><strong>Administrador</strong><small>admin@hotdog.com</small></div>
      </div>
    </aside>
  );
}

function AdminCounterToolbar({ onRefresh }) {
  const [sound, setSound] = useState(true);
  return (
    <section className="admin-counter-toolbar" aria-label="Ferramentas do balcão">
      <label className="counter-search"><Search size={19} /><input placeholder="Buscar por cliente, telefone, código ou item" /></label>
      <select aria-label="Filtrar por status" defaultValue=""><option value="">Todos os status</option><option value="novo">Novos</option><option value="preparo">Em preparo</option><option value="saiu_entrega">Em entrega</option><option value="concluido">Concluídos</option></select>
      <select aria-label="Filtrar por pagamento" defaultValue=""><option value="">Todos pagamentos</option><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="fiado">Fiado</option></select>
      <button type="button" className={sound ? 'sound-on' : ''} onClick={() => setSound((current) => !current)}><Volume2 size={18} /> Som {sound ? 'ligado' : 'desligado'}</button>
      <button type="button" onClick={() => window.print()}><Printer size={18} /> Imprimir pedidos</button>
      <button type="button" className="counter-refresh" onClick={onRefresh}><RefreshCw size={18} /> Atualizar</button>
    </section>
  );
}

function adminProductImage(product = {}) {
  return productMedia(product);
}

function MetricCard({ icon, label, value, accent = 'gold', footer }) {
  return (
    <article className={`metric-card ${accent}`}>
      <span className="metric-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {footer && <em>{footer}</em>}
      </div>
    </article>
  );
}

function OrderKanban({ orders, onMove, onCancel, setActiveTab }) {
  const grouped = statusFlow.reduce((acc, status) => ({ ...acc, [status]: orders.filter((order) => order.status === status) }), {});

  return (
    <section className="kanban-shell">
      <div className="section-toolbar">
        <div><h3>Pedidos do dia</h3><span>{orders.length} pedidos</span></div>
        <div className="toolbar-actions"><Search size={18} /><select><option>Filtrar pedidos</option></select></div>
      </div>
      <div className="kanban-board">
        {statusFlow.map((status) => {
          const meta = statusMeta[status];
          const Icon = meta.icon;
          return (
            <div className={`kanban-column ${status}`} key={status}>
              <div className="kanban-title"><span>{meta.title}</span><b>{grouped[status]?.length || 0}</b></div>
              <div className="kanban-cards">
                {(grouped[status] || []).map((order) => (
                  <article className="kanban-card" key={order.id}>
                    <div className="order-head">
                      <strong>{order.public_code || `#${order.id}`}</strong>
                      <small>{order.created_at ? new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                    </div>
                    <h4>{order.customer_name}</h4>
                    <div className="order-items">
                      {order.items?.filter((item) => item.item_type === 'produto').slice(0, 4).map((item) => <span key={item.id}>{item.quantity}x {item.name}</span>)}
                    </div>
                    <small>Pagamento</small>
                    <p>{paymentLabels[order.payment_method] || order.payment_method} • {order.payment_status === 'pago' ? 'Pago' : 'Pendente'}</p>
                    <strong className="order-price">{formatMoney(order.total)}</strong>
                    <div className="kanban-actions">
                      {status !== 'concluido' && status !== 'cancelado' && <button onClick={() => onMove(order.id, meta.next)}><Icon size={15} /> {meta.action}</button>}
                      {status !== 'cancelado' && <button className="danger-link" onClick={() => onCancel(order.id)}>Cancelar</button>}
                    </div>
                  </article>
                ))}
                {(grouped[status] || []).length === 0 && <div className="empty-column">Nenhum pedido nesta etapa</div>}
              </div>
              <button className="add-order-link" onClick={() => setActiveTab('new-order')}>+ Novo pedido</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopProducts({ orders, dashboard }) {
  const ranking = useMemo(() => {
    if (dashboard?.top_products?.length) return dashboard.top_products.map((item) => [item.name, Number(item.quantity || 0)]);
    const map = new Map();
    orders.forEach((order) => {
      order.items?.filter((item) => item.item_type === 'produto').forEach((item) => {
        map.set(item.name, (map.get(item.name) || 0) + Number(item.quantity || 0));
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders, dashboard]);
  const max = Math.max(1, ...ranking.map(([, qty]) => qty));

  return (
    <section className="side-panel">
      <div className="panel-title"><h3>🔥 Produtos mais vendidos hoje</h3><select><option>Hoje</option></select></div>
      <div className="ranking-list">
        {ranking.map(([name, qty], index) => (
          <div className="ranking-row" key={name}>
            <span>{index + 1}</span>
            <div><strong>{name}</strong><i style={{ width: `${(qty / max) * 100}%` }} /></div>
            <b>{qty}x</b>
          </div>
        ))}
        {ranking.length === 0 && <p className="muted">Ainda nao ha vendas hoje.</p>}
      </div>
      <a className="report-link">Ver relatorio completo →</a>
    </section>
  );
}

function DashboardTab({ orders, summary, dashboard, onMove, onCancel, setActiveTab }) {
  const todayOrders = Number(summary?.orders_today || orders.length || 0);
  const ticket = todayOrders ? Number(summary?.gross_today || 0) / todayOrders : 0;
  const inPrep = orders.filter((order) => order.status === 'preparo').length;

  return (
    <>
      <section className="alert-strip">
        <div><Bell size={20} /><strong>{inPrep} pedido em preparo</strong><span>Acompanhe a coluna Em preparo</span></div>
        <div><ShoppingBag size={20} /><strong>Novo pedido recebido!</strong><span>Painel atualizado automaticamente</span></div>
        <div><CheckCircle size={20} /><strong>Dica do dia</strong><span>Mantenha o tempo medio abaixo de 25 min</span></div>
      </section>
      <section className="metric-grid">
        <MetricCard icon="💰" label="Faturamento hoje" value={formatMoney(summary?.gross_today)} footer="▲ 12% vs ontem" />
        <MetricCard icon="💳" label="Recebido hoje" value={formatMoney(summary?.paid_today)} accent="green" footer="— 0% vs ontem" />
        <MetricCard icon="⏱" label="Pendente" value={formatMoney(summary?.pending_today)} accent="orange" footer="— 0% vs ontem" />
        <MetricCard icon="📈" label="Liquido hoje" value={formatMoney(summary?.net_today)} footer="▲ 12% vs ontem" />
        <MetricCard icon="📋" label="Pedidos do dia" value={todayOrders} accent="red" footer="▲ 2 vs ontem" />
        <MetricCard icon="📊" label="Ticket medio" value={formatMoney(ticket)} accent="purple" footer="▲ 10% vs ontem" />
      </section>
      <section className="admin-dashboard-grid">
        <OrderKanban orders={orders} onMove={onMove} onCancel={onCancel} setActiveTab={setActiveTab} />
        <div className="right-stack">
          <TopProducts orders={orders} dashboard={dashboard} />
          <section className="side-panel quick-summary">
            <h3>Resumo rapido</h3>
            <div><span>⏱ Tempo medio preparo</span><strong>18 min</strong></div>
            <div><span>⭐ Avaliacao media</span><strong>4,8</strong></div>
            <div><span>👥 Clientes atendidos</span><strong>{todayOrders}</strong></div>
            <div><span>📈 Taxa de conclusao</span><strong>100%</strong></div>
          </section>
        </div>
      </section>
    </>
  );
}

function SettingsReference({ settings, setSettings, report, saveSettings, setTab, onReload }) {
  return (
    <section className="admin-settings-reference">
      <form onSubmit={saveSettings} className="settings-reference-form">
        <div className="settings-title"><Settings size={23} /><h2>Configurações do negócio</h2></div>
        <fieldset><legend><Building2 size={19} /> 1. Informações da loja</legend><div className="settings-grid two"><label>Nome do negócio<input value={settings.business_name || ''} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} /></label><label>Telefone<input value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label><label>WhatsApp<input value={settings.whatsapp || ''} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label><label>Endereço<input value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label></div></fieldset>
        <fieldset><legend><DollarSign size={19} /> 2. Financeiro e PIX</legend><div className="settings-grid three"><label>Chave PIX<input value={settings.pix_key || ''} onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })} /></label><label>Taxa de entrega base (R$)<input type="number" step="0.01" value={settings.delivery_fee || 0} onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })} /></label><label>Pedido mínimo (R$)<input type="number" step="0.01" value={settings.minimum_order || 0} onChange={(e) => setSettings({ ...settings, minimum_order: e.target.value })} /></label></div></fieldset>
        <fieldset><legend><Bike size={19} /> 3. Entrega</legend><div className="settings-grid delivery-settings"><label>Previsão de entrega (minutos)<input type="number" min="5" value={settings.estimated_delivery_minutes || 35} onChange={(e) => setSettings({ ...settings, estimated_delivery_minutes: e.target.value })} /></label><label>Áreas/bairros de entrega<textarea value={settings.delivery_area_text || ''} onChange={(e) => setSettings({ ...settings, delivery_area_text: e.target.value })} /><small>Separe cada área ou bairro por vírgula.</small></label></div></fieldset>
        <fieldset><legend><KeyRound size={19} /> 4. Operação</legend><div className="settings-grid two"><label>Status da loja<select value={Number(settings.is_open ?? 1)} onChange={(e) => setSettings({ ...settings, is_open: e.target.value })}><option value="1">Aberto</option><option value="0">Fechado</option></select></label><label>Automação<select value={Number(settings.allow_whatsapp_redirect ?? 1)} onChange={(e) => setSettings({ ...settings, allow_whatsapp_redirect: e.target.value })}><option value="1">Abrir WhatsApp após pedido</option><option value="0">Não abrir WhatsApp</option></select></label></div></fieldset>
        <div className="settings-actions"><button className="btn-primary"><Save size={19} /> Salvar configurações</button><button type="button" className="btn-secondary" onClick={onReload}><XCircle size={18} /> Cancelar alterações</button><button type="button" className="btn-secondary restore" onClick={() => setSettings({ ...settings, business_name: 'Hotdog Prensado', phone: '(18) 99195-9898', whatsapp: '5518991959898', delivery_fee: 2, minimum_order: 0, estimated_delivery_minutes: 35, is_open: 1, allow_whatsapp_redirect: 1 })}><RotateCcw size={18} /> Restaurar padrão</button></div>
      </form>
      <aside className="settings-reference-side">
        <section><h3><BarChart3 size={20} /> Resumo rápido</h3><div className="settings-summary"><span>Vendas<strong>{formatMoney(report?.summary?.gross)}</strong></span><span>Recebido<strong>{formatMoney(report?.summary?.paid)}</strong></span><span>Despesas<strong>{formatMoney(report?.summary?.expenses)}</strong></span><span>Líquido<strong>{formatMoney(report?.summary?.net)}</strong></span></div></section>
        <section><h3>Status da loja</h3><div className="store-status-card"><i /><div><strong>{Number(settings.is_open ?? 1) === 1 ? 'Loja aberta' : 'Loja fechada'}</strong><small>{Number(settings.is_open ?? 1) === 1 ? 'Recebendo pedidos normalmente' : 'Pedidos temporariamente pausados'}</small></div><Store size={35} /></div></section>
        <section><h3>Atalhos rápidos</h3><div className="settings-shortcuts"><button type="button" onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}><ShoppingBag size={23} />Cardápio</button><button type="button"><Printer size={23} />Imprimir pedidos</button><button type="button" onClick={() => setTab('new-order')}><Store size={23} />Pedidos no balcão</button><button type="button" onClick={() => setTab('orders')}><ShoppingBag size={23} />Ver pedidos</button></div></section>
        <section className="settings-tip"><strong>💡 Dica</strong><p>Mantenha suas informações sempre atualizadas para uma melhor experiência dos clientes.</p></section>
      </aside>
    </section>
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
  const [productForm, setProductForm] = useState({ category_id: '', name: '', description: '', image_url: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
  const [manualCustomer, setManualCustomer] = useState({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
  const [manualOrder, setManualOrder] = useState({ delivery_type: 'entrega', payment_method: 'dinheiro', payment_status: 'pendente', order_source: 'balcao', notes: '', items: [{ product_id: '', quantity: 1, extras: [] }] });
  const [manualStep, setManualStep] = useState(1);
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

  useEffect(() => {
    const referenceMode = ['new-order', 'products', 'finance', 'customers', 'settings'].includes(tab);
    document.body.classList.toggle('admin-counter-mode', referenceMode);
    document.body.classList.toggle('admin-products-mode', tab === 'products');
    document.body.classList.toggle('admin-finance-mode', tab === 'finance');
    document.body.classList.toggle('admin-customers-mode', tab === 'customers');
    document.body.classList.toggle('admin-settings-mode', tab === 'settings');
    return () => document.body.classList.remove('admin-counter-mode', 'admin-products-mode', 'admin-finance-mode', 'admin-customers-mode', 'admin-settings-mode');
  }, [tab]);

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
    setProductForm({ category_id: '', name: '', description: '', image_url: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
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
    await api.admin.post('/api/admin/orders', { ...manualOrder, customer: manualCustomer, items: manualOrder.items.filter((item) => item.product_id).map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity || 1), extras: (item.extras || []).map(Number), notes: '' })) });
    setManualCustomer({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
    setManualOrder({ delivery_type: 'entrega', payment_method: 'dinheiro', payment_status: 'pendente', order_source: 'balcao', notes: '', items: [{ product_id: '', quantity: 1, extras: [] }] });
    setManualStep(1);
    setMessage('Pedido criado no painel.');
    await loadAdmin();
  }

  function updateManualItem(index, field, value) {
    setManualOrder((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  function toggleManualExtra(index, extraId) {
    setManualOrder((current) => ({ ...current, items: current.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const extras = item.extras || [];
      return { ...item, extras: extras.includes(extraId) ? extras.filter((id) => id !== extraId) : [...extras, extraId] };
    }) }));
  }

  const renderContent = () => {
    if (tab === 'dashboard') {
      return <DashboardTab orders={orders} summary={summary} dashboard={dashboard} onMove={updateStatus} onCancel={(id) => updateStatus(id, 'cancelado', 'cancelado')} setActiveTab={setTab} />;
    }

    if (tab === 'orders') {
      return <section className="admin-dashboard-grid"><OrderKanban orders={orders} onMove={updateStatus} onCancel={(id) => updateStatus(id, 'cancelado', 'cancelado')} setActiveTab={setTab} /><TopProducts orders={orders} dashboard={dashboard} /></section>;
    }

    if (tab === 'new-order') {
      const snacks = activeProducts.filter((product) => product.product_type === 'hotdog');
      const drinks = activeProducts.filter((product) => ['bebida', 'suco'].includes(product.product_type));
      const manualExtras = products.filter((product) => product.product_type === 'adicional' && Number(product.is_active) === 1);
      const snackItem = manualOrder.items[0] || { product_id: '', quantity: 1, extras: [] };
      const drinkItem = manualOrder.items[1] || { product_id: '', quantity: 1, extras: [] };
      const manualSubtotal = manualOrder.items.reduce((total, item) => {
        const product = products.find((entry) => Number(entry.id) === Number(item.product_id));
        const extrasTotal = (item.extras || []).reduce((sum, id) => sum + Number(products.find((entry) => Number(entry.id) === Number(id))?.price || 0), 0);
        return total + (Number(product?.price || 0) + extrasTotal) * Number(item.quantity || 1);
      }, 0);
      const manualDelivery = manualOrder.delivery_type === 'entrega' ? Number(settings?.delivery_fee || 0) : 0;
      return (
        <section className="panel big-form-panel counter-order-panel unified-counter-order">
          <div className="panel-title"><div><h3><Store size={21} /> Pedido manual / balcão</h3><p>Venda presencial, WhatsApp ou telefone</p></div><strong>Etapa {manualStep} de 4</strong></div>
          <div className="counter-stepper">{['Lanche', 'Adicionais', 'Bebida', 'Finalizar'].map((label, index) => <button type="button" key={label} className={manualStep === index + 1 ? 'active' : manualStep > index + 1 ? 'done' : ''} onClick={() => setManualStep(index + 1)}><b>{index + 1}</b><span>{label}</span></button>)}</div>
          <form onSubmit={createManualOrder} className={`stack-form manual-step-${manualStep}`}>
            <section className="counter-step counter-step-1"><header><span>1</span><div><h4>Cliente e lanche</h4><p>Informe o cliente e escolha o prensado principal.</p></div></header>
            <div className="form-grid counter-customer-grid">
              <label className="counter-field"><span><Users size={17} /> Nome do cliente</span><input placeholder="Digite o nome do cliente" value={manualCustomer.name} onChange={(e) => setManualCustomer({ ...manualCustomer, name: e.target.value })} required /></label>
              <label className="counter-field"><span><Phone size={17} /> Telefone</span><input placeholder="(00) 00000-0000" value={manualCustomer.phone} onChange={(e) => setManualCustomer({ ...manualCustomer, phone: e.target.value })} required /></label>
              <label className="counter-field"><span><MapPin size={17} /> Endereço</span><input placeholder="Rua, número, complemento" value={manualCustomer.address} onChange={(e) => setManualCustomer({ ...manualCustomer, address: e.target.value })} /></label>
              <label className="counter-field"><span><Home size={17} /> Bairro</span><input placeholder="Digite o bairro" value={manualCustomer.neighborhood} onChange={(e) => setManualCustomer({ ...manualCustomer, neighborhood: e.target.value })} /></label>
            </div>
            <div className="form-grid counter-product-grid"><label className="counter-field"><span><Package size={17} /> Lanche</span><select value={snackItem.product_id} onChange={(e) => updateManualItem(0, 'product_id', e.target.value)} required><option value="">Selecione o lanche</option>{snacks.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatMoney(product.price)}</option>)}</select></label><div className="counter-field counter-quantity"><span>Quantidade</span><div><button type="button" aria-label="Diminuir quantidade" onClick={() => updateManualItem(0, 'quantity', Math.max(1, Number(snackItem.quantity || 1) - 1))}><Minus size={17} /></button><b>{snackItem.quantity}</b><button type="button" aria-label="Aumentar quantidade" onClick={() => updateManualItem(0, 'quantity', Number(snackItem.quantity || 1) + 1)}><Plus size={17} /></button></div></div></div></section>
            <section className="counter-step counter-step-2"><header><span>2</span><div><h4>Personalize o lanche</h4><p>Selecione os adicionais; os valores entram no resumo.</p></div></header><div className="manual-extra-grid">{manualExtras.map((extra) => <button type="button" key={extra.id} className={(snackItem.extras || []).includes(extra.id) ? 'active' : ''} onClick={() => toggleManualExtra(0, extra.id)}><Plus size={17} /><span>{extra.name}</span><b>{formatMoney(extra.price)}</b></button>)}</div></section>
            <section className="counter-step counter-step-3"><header><span>3</span><div><h4>Quer uma bebida?</h4><p>Adicione uma bebida ou avance sem escolher.</p></div></header><div className="form-grid counter-product-grid"><label className="counter-field"><span><ShoppingBag size={17} /> Bebida</span><select value={drinkItem.product_id || ''} onChange={(e) => setManualOrder((current) => ({ ...current, items: e.target.value ? [current.items[0], { product_id: e.target.value, quantity: 1, extras: [] }] : [current.items[0]] }))}><option value="">Sem bebida</option>{drinks.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatMoney(product.price)}</option>)}</select></label>{drinkItem.product_id && <div className="counter-field counter-quantity"><span>Quantidade</span><div><button type="button" aria-label="Diminuir bebida" onClick={() => updateManualItem(1, 'quantity', Math.max(1, Number(drinkItem.quantity || 1) - 1))}><Minus size={17} /></button><b>{drinkItem.quantity}</b><button type="button" aria-label="Aumentar bebida" onClick={() => updateManualItem(1, 'quantity', Number(drinkItem.quantity || 1) + 1)}><Plus size={17} /></button></div></div>}</div></section>
            <section className="counter-step counter-step-4"><header><span>4</span><div><h4>Revise e finalize</h4><p>Confira entrega, pagamento e total antes de criar.</p></div></header><div className="form-grid counter-options-grid">
              <label className="counter-field"><span><Truck size={17} /> Entrega</span><select value={manualOrder.delivery_type} onChange={(e) => setManualOrder({ ...manualOrder, delivery_type: e.target.value })}><option value="entrega">Entrega</option><option value="retirada">Retirada</option></select></label>
              <label className="counter-field"><span><DollarSign size={17} /> Pagamento</span><select value={manualOrder.payment_method} onChange={(e) => setManualOrder({ ...manualOrder, payment_method: e.target.value })}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="fiado">Fiado</option></select></label>
              <label className="counter-field"><span><Clock size={17} /> Status</span><select value={manualOrder.payment_status} onChange={(e) => setManualOrder({ ...manualOrder, payment_status: e.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label>
              <label className="counter-field"><span><Store size={17} /> Origem</span><select value={manualOrder.order_source} onChange={(e) => setManualOrder({ ...manualOrder, order_source: e.target.value })}><option value="balcao">Balcão</option><option value="admin">Admin</option><option value="whatsapp">WhatsApp</option></select></label>
            </div>
            <label className="counter-field counter-notes"><span><Plus size={17} /> Observações</span><textarea placeholder="Informações adicionais sobre o pedido (opcional)" value={manualOrder.notes} onChange={(e) => setManualOrder({ ...manualOrder, notes: e.target.value })} /></label>
            <aside className="manual-order-summary"><div><span>Subtotal</span><b>{formatMoney(manualSubtotal)}</b></div><div><span>Entrega</span><b>{formatMoney(manualDelivery)}</b></div><strong><span>Total</span><b>{formatMoney(manualSubtotal + manualDelivery)}</b></strong></aside></section>
            <footer className="counter-navigation">{manualStep > 1 && <button type="button" className="btn-secondary" onClick={() => setManualStep((step) => step - 1)}>Voltar</button>}{manualStep < 4 ? <button type="button" className="btn-primary" onClick={() => setManualStep((step) => step + 1)}>Continuar</button> : <button className="btn-primary"><ShoppingBag size={20} /> Criar pedido</button>}</footer>
          </form>
        </section>
      );
    }

    if (tab === 'products') {
      return (
        <section className="admin-products-reference">
          <div className="panel product-create-panel">
            <div className="panel-title"><h3><Package size={22} /> Novo produto</h3></div>
            <form onSubmit={saveProduct} className="product-reference-form">
              <label><span>Categoria</span><div className="product-input"><Package size={18} /><select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} required><option value="">Selecione a categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div></label>
              <label><span>Nome do produto</span><div className="product-input"><ShoppingBag size={18} /><input placeholder="Digite o nome do produto" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></div></label>
              <label><span>Descrição</span><div className="product-input product-description"><Menu size={18} /><textarea placeholder="Digite a descrição do produto" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></div></label>
              <label><span>Foto do produto</span><div className="product-input"><Package size={18} /><input placeholder="https://... ou /images/produto.jpg" value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} /></div></label>
              <label><span>Preço</span><div className="product-input"><DollarSign size={18} /><input placeholder="R$ 0,00" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /></div></label>
              <label><span>Tipo</span><div className="product-input"><Sparkles size={18} /><select value={productForm.product_type} onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}><option value="hotdog">Hot dog</option><option value="suco">Suco</option><option value="bebida">Bebida</option><option value="adicional">Adicional</option></select></div></label>
              <button className="btn-primary"><CheckCircle size={20} /> Salvar produto</button>
            </form>
          </div>
          <div className="panel product-list-panel">
            <div className="panel-title"><h3>Produtos cadastrados</h3><span>{products.length} itens</span></div>
            <div className="reference-product-list">{products.map((product) => <article className="reference-product-row" key={product.id}><div className={`reference-product-thumb ${productMediaPosition(product)}`}><img src={adminProductImage(product)} alt="" /></div><div><strong>{product.name}</strong><small>{product.category_name} • {product.product_type}</small></div><div className="reference-product-price"><strong>{formatMoney(product.price)}</strong><span className={product.is_active ? 'active' : 'inactive'}>{product.is_active ? 'Ativo' : 'Inativo'}</span></div></article>)}{!products.length && <p className="reference-empty">Nenhum produto cadastrado.</p>}</div>
          </div>
        </section>
      );
    }

    if (tab === 'finance') {
      const entries = Number(cash?.totals?.entradas || summary?.paid_today || 0);
      const exits = Number(cash?.totals?.saidas || summary?.expenses_today || 0);
      const balance = Number(cash?.totals?.saldo || 0);
      const net = Number(summary?.net_today || entries - exits);
      return (
        <section className="admin-finance-reference">
          <div className="finance-reference-metrics">
            <article className="balance"><span><WalletCards size={28} /></span><div><small>Saldo em caixa</small><strong>{formatMoney(balance)}</strong><em>Atualizado agora</em></div></article>
            <article className="entries"><span><RefreshCw size={28} /></span><div><small>Entradas hoje</small><strong>{formatMoney(entries)}</strong><em>Recebimentos confirmados</em></div></article>
            <article className="exits"><span><LogOut size={28} /></span><div><small>Saídas hoje</small><strong>{formatMoney(exits)}</strong><em>Despesas e retiradas</em></div></article>
            <article className="net"><span><DollarSign size={28} /></span><div><small>Lucro líquido</small><strong>{formatMoney(net)}</strong><em>Resultado estimado</em></div></article>
          </div>
          <div className="finance-reference-grid">
            <section className="panel finance-cash-panel">
              <div className="panel-title"><h3><WalletCards size={20} /> Caixa</h3></div>
              {cash?.register ? (
                <form onSubmit={closeCash} className="finance-open-form"><label>Valor contado no fechamento<div><span>R$</span><input type="number" step="0.01" value={closeValue} onChange={(e) => setCloseValue(e.target.value)} /></div></label><button className="btn-primary"><WalletCards size={19} /> Fechar caixa</button></form>
              ) : (
                <form onSubmit={openCash} className="finance-open-form"><label>Valor atual de abertura<div><span>R$</span><input type="number" step="0.01" value={openValue} onChange={(e) => setOpenValue(e.target.value)} /></div></label><button className="btn-primary"><WalletCards size={19} /> Abrir caixa</button></form>
              )}
              <div className="finance-divider" />
              <div className="panel-title movement-title"><h3><RefreshCw size={20} /> Registrar movimento</h3></div>
              <form onSubmit={saveMovement} className="finance-movement-form">
                <label>Tipo de movimento<select value={movement.movement_type} onChange={(e) => setMovement({ ...movement, movement_type: e.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
                <label>Descrição<input placeholder="Ex.: Venda balcão, suprimento..." value={movement.description} onChange={(e) => setMovement({ ...movement, description: e.target.value })} required /></label>
                <label className="movement-value">Valor<div><span>R$</span><input placeholder="0,00" type="number" step="0.01" value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} required /></div></label>
                <button className="btn-secondary"><Plus size={18} /> Registrar movimento</button>
              </form>
            </section>
            <div className="finance-reference-side">
              <section className="panel finance-expense-panel"><div className="panel-title"><h3><WalletCards size={20} /> Nova despesa</h3></div><form onSubmit={saveExpense} className="finance-expense-form"><label>Descrição<input placeholder="Ex.: Compra de ingredientes" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required /></label><label>Valor<div><span>R$</span><input placeholder="0,00" type="number" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} required /></div></label><label>Categoria<input placeholder="Geral" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} /></label><button className="btn-primary"><Plus size={18} /> Cadastrar saída</button></form></section>
              <section className="panel finance-movements-panel"><div className="panel-title"><h3><Clock size={20} /> Últimas movimentações</h3><span>{cash.movements?.length || 0} itens</span></div><div className="finance-movement-list">{(cash.movements || []).slice(0, 6).map((item) => <article key={item.id}><span className={item.movement_type === 'saida' ? 'out' : 'in'}>{item.movement_type === 'saida' ? '↑' : '↓'}</span><div><strong>{item.description}</strong><small>{item.movement_type === 'saida' ? 'Saída' : 'Entrada'}</small></div><b className={item.movement_type === 'saida' ? 'out' : 'in'}>{item.movement_type === 'saida' ? '- ' : ''}{formatMoney(item.amount)}</b></article>)}{!(cash.movements || []).length && <p className="reference-empty">Nenhuma movimentação registrada.</p>}</div></section>
            </div>
          </div>
        </section>
      );
    }

    if (tab === 'customers') {
      const totalOrders = customers.reduce((total, customer) => total + Number(customer.orders_count || 0), 0);
      const totalSpent = customers.reduce((total, customer) => total + Number(customer.total_spent || 0), 0);
      return (
        <section className="admin-customers-reference">
          <div className="customers-reference-head">
            <div className="customers-title"><span><Users size={28} /></span><h2>Clientes</h2></div>
            <div className="customers-metrics">
              <article><Users size={25} /><div><strong>{customers.length} cadastrados</strong><small>Clientes ativos</small></div></article>
              <article><ShoppingBag size={25} /><div><strong>{totalOrders} pedidos no total</strong><small>Pedidos realizados</small></div></article>
              <article><DollarSign size={25} /><div><small>Faturamento acumulado</small><strong>{formatMoney(totalSpent)}</strong></div></article>
            </div>
          </div>
          <div className="customers-reference-list">
            {customers.map((customer, index) => {
              const initials = String(customer.name || 'Cliente').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
              return <article className="customer-reference-card" key={customer.id}>
                <div className={`customer-avatar avatar-${index % 3}`}>{initials}<i /></div>
                <div className="customer-identity"><strong>{customer.name}</strong><span><Phone size={16} />{customer.phone || 'Telefone não informado'}</span><span><MapPin size={16} />{customer.address || 'Endereço não informado'}</span></div>
                <span className="customer-active"><i /> Ativo</span>
                <div className="customer-stat"><small><ShoppingBag size={16} /> Pedidos</small><strong>{Number(customer.orders_count || 0)}</strong><span>{Number(customer.orders_count || 0) === 1 ? 'pedido' : 'pedidos'}</span></div>
                <div className="customer-stat"><small><DollarSign size={16} /> Total gasto</small><strong>{formatMoney(customer.total_spent || 0)}</strong><span>valor total</span></div>
                <div className="customer-stat"><small><CalendarDays size={16} /> Último pedido</small><strong>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('pt-BR') : '—'}</strong><span>{customer.last_order_at ? 'registrado' : 'sem registro'}</span></div>
                <div className="customer-actions"><button type="button"><History size={16} /> Ver histórico</button><div><button type="button"><Settings size={16} /> Editar</button><button type="button" className="primary" onClick={() => setTab('new-order')}><Plus size={16} /> Novo pedido</button></div></div>
              </article>;
            })}
            {!customers.length && <p className="reference-empty">Nenhum cliente cadastrado.</p>}
          </div>
          <footer className="customers-reference-footer">Mostrando {customers.length ? `1 a ${customers.length}` : '0'} de {customers.length} clientes <span><button type="button">‹</button><b>1</b><button type="button">›</button></span></footer>
        </section>
      );
    }

    if (tab === 'settings' && settings) {
      return <SettingsReference settings={settings} setSettings={setSettings} report={report} saveSettings={saveSettings} setTab={setTab} onReload={loadAdmin} />;
    }

    if (tab === 'settings-legacy' && settings) {
      return (
        <section className="admin-dashboard-grid products-view">
          <div className="panel"><div className="panel-title"><h3>Configuracoes do negocio</h3></div><form onSubmit={saveSettings} className="stack-form"><input value={settings.business_name || ''} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} placeholder="Nome do negocio" /><input value={settings.phone || ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="Telefone" /><input value={settings.whatsapp || ''} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} placeholder="WhatsApp com DDI" /><input value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="Endereco" /><input type="number" step="0.01" value={settings.delivery_fee || 0} onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })} placeholder="Taxa entrega" /><input type="number" step="0.01" value={settings.minimum_order || 0} onChange={(e) => setSettings({ ...settings, minimum_order: e.target.value })} placeholder="Pedido minimo" /><input value={settings.pix_key || ''} onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })} placeholder="Chave PIX" /><input type="number" value={settings.estimated_delivery_minutes || 35} onChange={(e) => setSettings({ ...settings, estimated_delivery_minutes: e.target.value })} placeholder="Previsao em minutos" /><textarea value={settings.delivery_area_text || ''} onChange={(e) => setSettings({ ...settings, delivery_area_text: e.target.value })} placeholder="Areas/bairros de entrega" /><select value={Number(settings.is_open ?? 1)} onChange={(e) => setSettings({ ...settings, is_open: e.target.value })}><option value="1">Aberto</option><option value="0">Fechado</option></select><select value={Number(settings.allow_whatsapp_redirect ?? 1)} onChange={(e) => setSettings({ ...settings, allow_whatsapp_redirect: e.target.value })}><option value="1">Abrir WhatsApp apos pedido</option><option value="0">Nao abrir WhatsApp</option></select><button className="btn-primary">Salvar configuracoes</button></form></div>
          <div className="panel"><div className="panel-title"><h3>Relatorio de hoje</h3></div><div className="mini-list"><span>Vendas <strong>{formatMoney(report?.summary?.gross)}</strong></span><span>Recebido <strong>{formatMoney(report?.summary?.paid)}</strong></span><span>Despesas <strong>{formatMoney(report?.summary?.expenses)}</strong></span><span>Liquido <strong>{formatMoney(report?.summary?.net)}</strong></span></div></div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="admin-desktop-shell">
      <AdminSidebar activeTab={tab} setActiveTab={setTab} />
      <main className={`admin-workspace ${['new-order', 'products', 'finance', 'customers', 'settings'].includes(tab) ? 'counter-workspace' : ''}`}>
        <header className="admin-topbar">
          <div className="admin-title-block">
            <button className="hamburger"><Menu size={28} /></button>
            <div><h1>Hotdog Prensado</h1><span>Pedidos Online</span></div>
          </div>
          <div className="admin-top-actions">
            <button className={Number(settings?.is_open ?? 1) === 1 ? 'store-open' : 'store-closed'}><span />{Number(settings?.is_open ?? 1) === 1 ? 'Loja aberta' : 'Loja fechada'}</button>
            <button className="outline-gold" onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}><ShoppingBag size={16} /> Cardapio</button>
            <button className="btn-secondary" onClick={loadAdmin}><RefreshCw size={16} /> Atualizar</button>
            <button className="danger-button" onClick={() => { clearToken(); window.location.reload(); }}><LogOut size={16} /> Sair</button>
          </div>
        </header>

        {tab === 'orders' && <AdminCounterToolbar onRefresh={loadAdmin} />}
        {message && <p className="notice admin-message">{message}</p>}
        {renderContent()}
        <footer className="admin-footer">© 2026 Hotdog Prensado • Painel Premium de Pedidos e Gestao</footer>
      </main>
    </div>
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

  if (route === 'admin' && logged) return <AdminPremium />;

  return (
    <div className="premium-shell">
      <PremiumHeader route={route} navigate={navigate} settings={settings} />
      {route === 'admin'
        ? <PremiumLogin onLogin={() => setAuthTick((value) => value + 1)} />
        : <PremiumHome settings={settings} navigate={navigate} />}
    </div>
  );
}
