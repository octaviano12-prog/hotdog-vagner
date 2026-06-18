import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bike,
  ChefHat,
  CheckCircle,
  Clock,
  DollarSign,
  Flame,
  Home,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Package,
  Phone,
  Plus,
  Printer,
  RefreshCw,
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

function AdminSidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">🌭</div>
        <div className="sidebar-brand-copy"><strong>Hot Dog do Vagner</strong><span>Pedidos Online</span></div>
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
     …3179 tokens truncated…   await api.admin.post('/api/admin/orders', { ...manualOrder, customer: manualCustomer, items: manualOrder.items.map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity || 1), extras: [], notes: '' })) });
    setManualCustomer({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
    setManualOrder({ delivery_type: 'entrega', payment_method: 'dinheiro', payment_status: 'pendente', order_source: 'balcao', notes: '', items: [{ product_id: '', quantity: 1, extras: [] }] });
    setMessage('Pedido criado no painel.');
    await loadAdmin();
  }

  function updateManualItem(index, field, value) {
    setManualOrder((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  const renderContent = () => {
    if (tab === 'dashboard') {
      return <DashboardTab orders={orders} summary={summary} dashboard={dashboard} onMove={updateStatus} onCancel={(id) => updateStatus(id, 'cancelado', 'cancelado')} setActiveTab={setTab} />;
    }

    if (tab === 'orders') {
      return <section className="admin-dashboard-grid"><OrderKanban orders={orders} onMove={updateStatus} onCancel={(id) => updateStatus(id, 'cancelado', 'cancelado')} setActiveTab={setTab} /><TopProducts orders={orders} dashboard={dashboard} /></section>;
    }

    if (tab === 'new-order') {
      return (
        <section className="panel big-form-panel counter-order-panel">
          <div className="panel-title"><h3><Store size={21} /> Pedido manual / balcão</h3><span>Venda presencial, WhatsApp ou telefone</span></div>
          <form onSubmit={createManualOrder} className="stack-form">
            <div className="form-grid counter-customer-grid">
              <label className="counter-field"><span><Users size={17} /> Nome do cliente</span><input placeholder="Digite o nome do cliente" value={manualCustomer.name} onChange={(e) => setManualCustomer({ ...manualCustomer, name: e.target.value })} required /></label>
              <label className="counter-field"><span><Phone size={17} /> Telefone</span><input placeholder="(00) 00000-0000" value={manualCustomer.phone} onChange={(e) => setManualCustomer({ ...manualCustomer, phone: e.target.value })} required /></label>
              <label className="counter-field"><span><MapPin size={17} /> Endereço</span><input placeholder="Rua, número, complemento" value={manualCustomer.address} onChange={(e) => setManualCustomer({ ...manualCustomer, address: e.target.value })} /></label>
              <label className="counter-field"><span><Home size={17} /> Bairro</span><input placeholder="Digite o bairro" value={manualCustomer.neighborhood} onChange={(e) => setManualCustomer({ ...manualCustomer, neighborhood: e.target.value })} /></label>
            </div>
            {manualOrder.items.map((item, index) => (
              <div className="form-grid counter-product-grid" key={index}>
                <label className="counter-field"><span><Package size={17} /> Produto</span><select value={item.product_id} onChange={(e) => updateManualItem(index, 'product_id', e.target.value)} required>
                  <option value="">Selecione o produto</option>
                  {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatMoney(product.price)}</option>)}
                </select></label>
                <div className="counter-field counter-quantity"><span>Quantidade</span><div><button type="button" aria-label="Diminuir quantidade" onClick={() => updateManualItem(index, 'quantity', Math.max(1, Number(item.quantity || 1) - 1))}><Minus size={17} /></button><b>{item.quantity}</b><button type="button" aria-label="Aumentar quantidade" onClick={() => updateManualItem(index, 'quantity', Number(item.quantity || 1) + 1)}><Plus size={17} /></button></div></div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setManualOrder((current) => ({ ...current, items: [...current.items, { product_id: '', quantity: 1, extras: [] }] }))}>Adicionar item</button>
            <div className="form-grid counter-options-grid">
              <label className="counter-field"><span><Truck size={17} /> Entrega</span><select value={manualOrder.delivery_type} onChange={(e) => setManualOrder({ ...manualOrder, delivery_type: e.target.value })}><option value="entrega">Entrega</option><option value="retirada">Retirada</option></select></label>
              <label className="counter-field"><span><DollarSign size={17} /> Pagamento</span><select value={manualOrder.payment_method} onChange={(e) => setManualOrder({ ...manualOrder, payment_method: e.target.value })}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="fiado">Fiado</option></select></label>
              <label className="counter-field"><span><Clock size={17} /> Status</span><select value={manualOrder.payment_status} onChange={(e) => setManualOrder({ ...manualOrder, payment_status: e.target.value })}><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label>
              <label className="counter-field"><span><Store size={17} /> Origem</span><select value={manualOrder.order_source} onChange={(e) => setManualOrder({ ...manualOrder, order_source: e.target.value })}><option value="balcao">Balcão</option><option value="admin">Admin</option><option value="whatsapp">WhatsApp</option></select></label>
            </div>
            <label className="counter-field counter-notes"><span><Plus size={17} /> Observações</span><textarea placeholder="Informações adicionais sobre o pedido (opcional)" value={manualOrder.notes} onChange={(e) => setManualOrder({ ...manualOrder, notes: e.target.value })} /></label>
            <button className="btn-primary"><ShoppingBag size={20} /> Criar pedido</button>
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
              <label><span>Preço</span><div className="product-input"><DollarSign size={18} /><input placeholder="R$ 0,00" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /></div></label>
              <label><span>Tipo</span><div className="product-input"><Sparkles size={18} /><select value={productForm.product_type} onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}><option value="hotdog">Hot dog</option><option value="suco">Suco</option><option value="bebida">Bebida</option><option value="adicional">Adicional</option></select></div></label>
              <button className="btn-primary"><CheckCircle size={20} /> Salvar produto</button>
            </form>
          </div>
          <div className="panel product-list-panel">
            <div className="panel-title"><h3>Produtos cadastrados</h3><span>{products.length} itens</span></div>
            <div className="reference-product-list">{products.map((product) => <article className="reference-product-row" key={product.id}><img src={adminProductImage(product)} alt="" /><div><strong>{product.name}</strong><small>{product.category_name} • {product.product_type}</small></div><div className="reference-product-price"><strong>{formatMoney(product.price)}</strong><span className={product.is_active ? 'active' : 'inactive'}>{product.is_active ? 'Ativo' : 'Inativo'}</span></div></article>)}{!products.length && <p className="reference-empty">Nenhum produto cadastrado.</p>}</div>
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
      return <section className="panel big-form-panel"><div className="panel-title"><h3>Clientes</h3><span>{customers.length} cadastrados</span></div><div className="product-table">{customers.map((customer) => <div className="product-row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.phone} • {customer.address}</small></div><span>{customer.orders_count} pedidos</span><strong>{formatMoney(customer.total_spent)}</strong></div>)}</div></section>;
    }

    if (tab === 'settings' && settings) {
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
      <main className={`admin-workspace ${['new-order', 'products', 'finance'].includes(tab) ? 'counter-workspace' : ''}`}>
        <header className="admin-topbar">
          <div className="admin-title-block">
            <button className="hamburger"><Menu size={28} /></button>
            <div><h1>Hot Dog do Vagner</h1><span>Pedidos Online</span></div>
          </div>
          <div className="admin-top-actions">
            <button className={Number(settings?.is_open ?? 1) === 1 ? 'store-open' : 'store-closed'}><span />{Number(settings?.is_open ?? 1) === 1 ? 'Loja aberta' : 'Loja fechada'}</button>
            <button className="outline-gold" onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}><ShoppingBag size={16} /> Cardapio</button>
            <button className="btn-secondary" onClick={loadAdmin}><RefreshCw size={16} /> Atualizar</button>
            <button className="danger-button" onClick={() => { clearToken(); window.location.reload(); }}><LogOut size={16} /> Sair</button>
          </div>
        </header>

        {['new-order', 'products', 'finance'].includes(tab) && <AdminCounterToolbar onRefresh={loadAdmin} />}
        {message && <p className="notice admin-message">{message}</p>}
        {renderContent()}
        <footer className="admin-footer">© 2026 Hot Dog do Vagner • Painel Premium de Pedidos e Gestao</footer>
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

