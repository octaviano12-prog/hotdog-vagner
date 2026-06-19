import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle,
  DollarSign,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Users,
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

function makeWhatsAppMessage(settings, payload, total) {
  const lines = [
    `Ola, quero fazer um pedido no ${settings?.business_name || 'Hotdog Prensado'}:`,
    '',
    ...payload.items.map((item, index) => {
      const extras = item.extraNames?.length ? ` | Adicionais: ${item.extraNames.join(', ')}` : '';
      return `${index + 1}. ${item.quantity}x ${item.name}${extras}`;
    }),
    '',
    `Cliente: ${payload.customer.name}`,
    `Telefone: ${payload.customer.phone}`,
    `Entrega: ${payload.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}`,
    payload.delivery_type === 'entrega' ? `Endereco: ${payload.customer.address}` : '',
    payload.customer.reference ? `Referencia: ${payload.customer.reference}` : '',
    `Pagamento: ${paymentLabels[payload.payment_method]}`,
    payload.notes ? `Observacoes: ${payload.notes}` : '',
    `Total aproximado: ${formatMoney(total)}`
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
}

function Header({ view, setView, settings }) {
  function go(nextView) {
    setView(nextView);
    window.history.pushState({}, '', nextView === 'admin' ? '/admin' : '/');
  }

  return (
    <header className="premium-header public-header">
      <button className="brand-block" onClick={() => go('menu')}>
        <span className="brand-icon">🌭</span>
        <span>
          <small>Pedidos online</small>
          <strong>{settings?.business_name || 'Hotdog Prensado'}</strong>
        </span>
      </button>
      <nav className="premium-nav">
        <button className={view === 'menu' ? 'active' : ''} onClick={() => go('menu')}>Cardapio</button>
        <button className={view === 'admin' ? 'active admin-link' : 'admin-link'} onClick={() => go('admin')}>Painel Admin</button>
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
      <div className="product-image">{product.product_type === 'suco' ? '🥤' : product.product_type === 'bebida' ? '🥫' : product.product_type === 'adicional' ? '➕' : '🌭'}</div>
      <div className="product-content">
        <div className="product-title-row">
          <div>
            <small>{product.category_name || product.product_type}</small>
            <h3>{product.name}</h3>
          </div>
          <strong>{formatMoney(product.price)}</strong>
        </div>
        <p>{product.description}</p>
        {product.product_type === 'hotdog' && extras.length > 0 && (
          <div className="extras">
            <small>Adicionais</small>
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
        <button className="btn-primary" onClick={() => onAdd(product, selectedExtras)}>Adicionar</button>
      </div>
    </article>
  );
}

function Cart({ cart, setCart, settings }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', reference: '' });
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
      const whatsapp = settings?.whatsapp || '5518991959898';
      const url = `https://wa.me/${whatsapp}?text=${makeWhatsAppMessage(settings, whatsappPayload, response.order.total)}`;
      setMessage(`Pedido #${response.order.id} criado com sucesso.`);
      setCart([]);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="cart-panel premium-cart">
      <div className="cart-title"><ShoppingCart size={22} /> <h2>Meu pedido</h2></div>
      {cart.length === 0 ? <p className="muted">Seu carrinho esta vazio.</p> : (
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
            <input placeholder="Ponto de referencia" value={customer.reference} onChange={(e) => setCustomer({ ...customer, reference: e.target.value })} />
          </>
        )}
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao">Cartao</option>
          <option value="fiado">Fiado</option>
        </select>
        <textarea placeholder="Observacoes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Finalizar pedido'}</button>
        {message && <p className="notice">{message}</p>}
      </form>
    </aside>
  );
}

function MenuPage({ settings }) {
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

  function addToCart(product, extraIds = []) {
    const selectedExtras = extras.filter((extra) => extraIds.includes(extra.id));
    const key = `${product.id}-${selectedExtras.map((extra) => extra.id).sort().join('-')}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, key, quantity: 1, extras: selectedExtras }];
    });
  }

  return (
    <main className="layout premium-layout">
      <section className="menu-section">
        <div className="hero premium-hero compact-hero">
          <div className="hero-copy">
            <span className="hero-pill">🔥 Hot dog prensado</span>
            <h1>Peça seu hot dog sem perder tempo.</h1>
            <p>Escolha o lanche, adicione extras, informe entrega e acompanhe tudo pelo painel administrativo.</p>
          </div>
          <div className="hero-showcase">
            <div className="hotdog-visual"><span className="bread top" /><span className="filling cheese" /><span className="filling sausage" /><span className="filling salad" /><span className="bread bottom" /></div>
          </div>
        </div>
        {loading && <p className="muted">Carregando cardapio...</p>}
        {menu.categories.map((category) => (
          <section className="category" key={category.id}>
            <div className="section-title">
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
            <div className="product-grid">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} />
              ))}
            </div>
          </section>
        ))}
      </section>
      <Cart cart={cart} setCart={setCart} settings={settings} />
    </main>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@hotdog.com');
  const [password, setPassword] = useState('123456');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try {
      const response = await api.post('/api/auth/login', { email, password });
      setToken(response.token);
      onLogin(response.user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="admin-login-page premium-shell">
      <section className="login-card premium-login">
        <span className="hero-pill">Painel Premium</span>
        <h2>Acesso administrativo</h2>
        <p className="muted">Controle pedidos, produtos, clientes e financeiro em uma tela moderna.</p>
        <form onSubmit={submit}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" />
          <button className="btn-primary">Entrar</button>
        </form>
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="login-benefits">
        <div><strong>Pedidos em tempo real</strong><span>Kanban por etapa: novo, preparo, entrega, concluido e cancelado.</span></div>
        <div><strong>Gestao financeira</strong><span>Faturamento, recebido, pendente, despesas e liquido do dia.</span></div>
        <div><strong>Cardapio administravel</strong><span>Produtos, adicionais, sucos e bebidas controlados pelo painel.</span></div>
      </section>
    </main>
  );
}

function AdminSidebar({ activeTab, setActiveTab, user }) {
  const items = [
    ['dashboard', 'Dashboard', Home],
    ['pedidos', 'Pedidos', ShoppingBag],
    ['balcao', 'Pedido no balcao', Store],
    ['produtos', 'Produtos', Package],
    ['financeiro', 'Financeiro', DollarSign],
    ['clientes', 'Clientes', Users],
    ['configuracoes', 'Configuracoes', Settings]
  ];

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-logo">🌭</div>
      <nav className="sidebar-nav">
        {items.map(([id, label, Icon]) => (
          <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={20} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">AD</div>
        <div>
          <strong>{user?.name || 'Administrador'}</strong>
          <small>{user?.email || 'admin@hotdog.com'}</small>
        </div>
      </div>
    </aside>
  );
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
                      <strong>#{order.id}</strong>
                      <small>{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
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
              <button className="add-order-link" onClick={() => setActiveTab('balcao')}>+ Novo pedido</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopProducts({ orders }) {
  const ranking = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      order.items?.filter((item) => item.item_type === 'produto').forEach((item) => {
        map.set(item.name, (map.get(item.name) || 0) + Number(item.quantity || 0));
      });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);
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

function DashboardTab({ orders, summary, onMove, onCancel, setActiveTab }) {
  const todayOrders = Number(summary?.orders_today || orders.length || 0);
  const ticket = todayOrders ? Number(summary?.gross_today || 0) / todayOrders : 0;
  const inPrep = orders.filter((order) => order.status === 'preparo').length;

  return (
    <>
      <section className="alert-strip">
        <div><Bell size={20} /><strong>{inPrep} pedido em preparo</strong><span>Acompanhe a coluna Em preparo</span></div>
        <div><ShoppingBag size={20} /><strong>Novo pedido recebido!</strong><span>Painel atualizado em tempo real</span></div>
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
          <TopProducts orders={orders} />
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

function OrdersTab({ orders, onMove, onCancel, setActiveTab }) {
  return <OrderKanban orders={orders} onMove={onMove} onCancel={onCancel} setActiveTab={setActiveTab} />;
}

function ManualOrderTab({ products, onCreated }) {
  const saleProducts = products.filter((product) => product.is_active && product.product_type !== 'adicional');
  const [customer, setCustomer] = useState({ name: 'Cliente balcão', phone: '00000000000', address: '', reference: '' });
  const [productId, setProductId] = useState('');
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [message, setMessage] = useState('');

  function addItem() {
    const product = saleProducts.find((item) => String(item.id) === String(productId));
    if (!product) return;
    setItems((current) => [...current, { ...product, quantity: 1 }]);
    setProductId('');
  }

  async function save(event) {
    event.preventDefault();
    if (!items.length) return setMessage('Adicione pelo menos um produto.');
    try {
      await api.post('/api/orders', {
        customer,
        delivery_type: 'retirada',
        payment_method: paymentMethod,
        notes: 'Pedido criado no painel administrativo',
        items: items.map((item) => ({ product_id: item.id, quantity: item.quantity, extras: [], notes: '' }))
      });
      setItems([]);
      setMessage('Pedido de balcão criado com sucesso.');
      onCreated();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="panel big-form-panel">
      <div className="panel-title"><h3>Pedido no balcão</h3><span>Venda rapida presencial ou WhatsApp</span></div>
      <form onSubmit={save} className="stack-form">
        <div className="form-grid">
          <input placeholder="Nome do cliente" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          <input placeholder="Telefone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
        </div>
        <div className="form-grid">
          <select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Selecionar produto</option>{saleProducts.map((product) => <option value={product.id} key={product.id}>{product.name} - {formatMoney(product.price)}</option>)}</select>
          <button type="button" className="btn-secondary" onClick={addItem}><Plus size={16} /> Adicionar item</button>
        </div>
        <div className="mini-list">{items.map((item, index) => <span key={`${item.id}-${index}`}>{item.name}<strong>{formatMoney(item.price)}</strong></span>)}</div>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="cartao">Cartao</option><option value="fiado">Fiado</option></select>
        <button className="btn-primary">Criar pedido</button>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}

function ProductsTab({ products, categories, productForm, setProductForm, onSave }) {
  return (
    <section className="admin-dashboard-grid products-view">
      <div className="panel wide-panel">
        <div className="panel-title"><h3>Produtos cadastrados</h3><span>{products.length} itens</span></div>
        <div className="product-table">
          {products.map((product) => <div className="product-row" key={product.id}><div><strong>{product.name}</strong><small>{product.category_name} • {product.product_type}</small></div><strong>{formatMoney(product.price)}</strong><span className={product.is_active ? 'badge concluido' : 'badge cancelado'}>{product.is_active ? 'Ativo' : 'Inativo'}</span></div>)}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title"><h3><Plus size={18} /> Novo produto</h3></div>
        <form onSubmit={onSave} className="stack-form">
          <select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} required><option value="">Categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
          <input placeholder="Nome do produto" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
          <textarea placeholder="Descricao" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
          <input placeholder="Preco" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
          <select value={productForm.product_type} onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}><option value="hotdog">Hot dog</option><option value="suco">Suco</option><option value="bebida">Bebida</option><option value="adicional">Adicional</option></select>
          <button className="btn-primary">Salvar produto</button>
        </form>
      </div>
    </section>
  );
}

function FinanceTab({ summary, expense, setExpense, onSaveExpense, expenses }) {
  return (
    <section className="admin-dashboard-grid products-view">
      <div className="panel wide-panel">
        <div className="panel-title"><h3>Fluxo de caixa</h3><span>Resumo financeiro do dia</span></div>
        <section className="metric-grid compact">
          <MetricCard icon="💰" label="Faturamento" value={formatMoney(summary?.gross_today)} />
          <MetricCard icon="💳" label="Recebido" value={formatMoney(summary?.paid_today)} accent="green" />
          <MetricCard icon="⏱" label="Pendente" value={formatMoney(summary?.pending_today)} accent="orange" />
          <MetricCard icon="📉" label="Despesas" value={formatMoney(summary?.expenses_today)} accent="red" />
        </section>
        <div className="mini-list">{expenses.map((item) => <span key={item.id}>{item.description}<strong>{formatMoney(item.amount)}</strong></span>)}</div>
      </div>
      <div className="panel">
        <div className="panel-title"><h3><WalletCards size={18} /> Nova despesa</h3></div>
        <form onSubmit={onSaveExpense} className="stack-form">
          <input placeholder="Descricao" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required />
          <input placeholder="Valor" type="number" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} required />
          <input placeholder="Categoria" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} />
          <button className="btn-primary">Cadastrar saida</button>
        </form>
      </div>
    </section>
  );
}

function CustomersTab({ orders }) {
  const customers = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      if (!map.has(order.customer_phone)) map.set(order.customer_phone, { name: order.customer_name, phone: order.customer_phone, address: order.customer_address, total: 0, orders: 0 });
      const current = map.get(order.customer_phone);
      current.total += Number(order.total || 0);
      current.orders += 1;
    });
    return [...map.values()];
  }, [orders]);

  return (
    <section className="panel wide-panel">
      <div className="panel-title"><h3>Clientes atendidos</h3><span>{customers.length} clientes</span></div>
      <div className="product-table">
        {customers.map((customer) => <div className="product-row" key={customer.phone}><div><strong>{customer.name}</strong><small>{customer.phone} • {customer.address || 'Sem endereco'}</small></div><strong>{formatMoney(customer.total)}</strong><span>{customer.orders} pedidos</span></div>)}
      </div>
    </section>
  );
}

function SettingsTab({ settingsForm, setSettingsForm, onSaveSettings }) {
  return (
    <section className="panel big-form-panel">
      <div className="panel-title"><h3>Configuracoes do negocio</h3><span>Dados usados no site e pedidos</span></div>
      <form className="stack-form" onSubmit={onSaveSettings}>
        <div className="form-grid"><input placeholder="Nome do negocio" value={settingsForm.business_name || ''} onChange={(e) => setSettingsForm({ ...settingsForm, business_name: e.target.value })} /><input placeholder="Telefone" value={settingsForm.phone || ''} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} /></div>
        <div className="form-grid"><input placeholder="WhatsApp" value={settingsForm.whatsapp || ''} onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })} /><input placeholder="Taxa entrega" type="number" step="0.01" value={settingsForm.delivery_fee || 0} onChange={(e) => setSettingsForm({ ...settingsForm, delivery_fee: e.target.value })} /></div>
        <input placeholder="Endereco" value={settingsForm.address || ''} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} />
        <label className="switch-line"><input type="checkbox" checked={Boolean(settingsForm.is_open)} onChange={(e) => setSettingsForm({ ...settingsForm, is_open: e.target.checked })} /> Loja aberta</label>
        <button className="btn-primary">Salvar configuracoes</button>
      </form>
    </section>
  );
}

function AdminPage() {
  const [logged, setLogged] = useState(Boolean(getToken()));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settingsForm, setSettingsForm] = useState({});
  const [expense, setExpense] = useState({ description: '', amount: '', category: 'Geral' });
  const [productForm, setProductForm] = useState({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
  const [message, setMessage] = useState('');

  async function loadAdmin() {
    try {
      const [orderData, productData, categoryData, summaryData, expenseData, settingsData] = await Promise.all([
        api.admin.get('/api/admin/orders'),
        api.admin.get('/api/admin/products'),
        api.admin.get('/api/admin/categories'),
        api.admin.get('/api/admin/finance/summary'),
        api.admin.get('/api/admin/finance/expenses'),
        api.admin.get('/api/admin/settings')
      ]);
      setOrders(orderData);
      setProducts(productData);
      setCategories(categoryData);
      setSummary(summaryData);
      setExpenses(expenseData);
      setSettingsForm(settingsData || {});
      setMessage('');
    } catch (error) {
      setMessage(error.message);
      if (error.message.toLowerCase().includes('sessao') || error.message.toLowerCase().includes('login')) {
        clearToken();
        setLogged(false);
      }
    }
  }

  useEffect(() => {
    if (logged) loadAdmin();
  }, [logged]);

  async function updateStatus(orderId, status) {
    await api.admin.patch(`/api/admin/orders/${orderId}/status`, { status, payment_status: status === 'concluido' ? 'pago' : undefined });
    loadAdmin();
  }

  async function cancelOrder(orderId) {
    await api.admin.patch(`/api/admin/orders/${orderId}/status`, { status: 'cancelado', payment_status: 'cancelado' });
    loadAdmin();
  }

  async function saveExpense(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/expenses', { ...expense, amount: Number(expense.amount) });
    setExpense({ description: '', amount: '', category: 'Geral' });
    loadAdmin();
  }

  async function saveProduct(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/products', {
      ...productForm,
      category_id: Number(productForm.category_id),
      price: Number(productForm.price),
      sort_order: Number(productForm.sort_order || 0),
      is_active: true
    });
    setProductForm({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
    loadAdmin();
  }

  async function saveSettings(event) {
    event.preventDefault();
    await api.admin.put('/api/admin/settings', { ...settingsForm, delivery_fee: Number(settingsForm.delivery_fee || 0), is_open: Boolean(settingsForm.is_open) });
    setMessage('Configuracoes salvas com sucesso.');
    loadAdmin();
  }

  if (!logged) return <Login onLogin={(loggedUser) => { setUser(loggedUser); setLogged(true); }} />;

  const renderTab = () => {
    if (activeTab === 'dashboard') return <DashboardTab orders={orders} summary={summary} onMove={updateStatus} onCancel={cancelOrder} setActiveTab={setActiveTab} />;
    if (activeTab === 'pedidos') return <OrdersTab orders={orders} onMove={updateStatus} onCancel={cancelOrder} setActiveTab={setActiveTab} />;
    if (activeTab === 'balcao') return <ManualOrderTab products={products} onCreated={loadAdmin} />;
    if (activeTab === 'produtos') return <ProductsTab products={products} categories={categories} productForm={productForm} setProductForm={setProductForm} onSave={saveProduct} />;
    if (activeTab === 'financeiro') return <FinanceTab summary={summary} expense={expense} setExpense={setExpense} onSaveExpense={saveExpense} expenses={expenses} />;
    if (activeTab === 'clientes') return <CustomersTab orders={orders} />;
    return <SettingsTab settingsForm={settingsForm} setSettingsForm={setSettingsForm} onSaveSettings={saveSettings} />;
  };

  return (
    <div className="admin-desktop-shell">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      <main className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-title-block">
            <button className="hamburger"><Menu size={22} /></button>
            <div><h1>Hotdog Prensado</h1><span>Pedidos Online</span></div>
          </div>
          <div className="admin-top-actions">
            <button className="store-open"><span /> Loja aberta</button>
            <button className="outline-gold" onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}><ShoppingBag size={16} /> Cardapio</button>
            <button className="btn-secondary" onClick={loadAdmin}><RefreshCw size={16} /> Atualizar</button>
            <button className="danger-button" onClick={() => { clearToken(); setLogged(false); }}><LogOut size={16} /> Sair</button>
          </div>
        </header>
        {message && <p className="notice admin-message">{message}</p>}
        {renderTab()}
        <footer className="admin-footer">© 2026 Hotdog Prensado • Painel premium de pedidos e gestao financeira.</footer>
      </main>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState(window.location.pathname.includes('admin') ? 'admin' : 'menu');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/api/public/settings').then(setSettings).catch(() => setSettings(null));
  }, []);

  if (view === 'admin') return <AdminPage />;

  return (
    <div className="premium-shell">
      <Header view={view} setView={setView} settings={settings} />
      <MenuPage settings={settings} />
    </div>
  );
}
