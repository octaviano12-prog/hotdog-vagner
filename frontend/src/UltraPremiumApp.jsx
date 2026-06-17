import { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  WalletCards,
  Zap
} from 'lucide-react';
import PremiumApp from './PremiumApp.jsx';
import { api, formatMoney } from './api.js';

const paymentLabels = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartao',
  fiado: 'Fiado'
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productKind(product = {}) {
  const name = normalizeText(`${product.name || ''} ${product.description || ''}`);
  if (product.product_type === 'hotdog') return 'hotdog';
  if (product.product_type === 'bebida') {
    if (name.includes('2 litro')) return 'bottle large';
    if (name.includes('1 litro')) return 'bottle';
    return 'can';
  }
  if (product.product_type === 'suco') {
    if (name.includes('jarra')) return 'juice pitcher';
    if (name.includes('detox')) return 'juice green';
    if (name.includes('vitamina')) return 'juice creamy';
    return 'juice';
  }
  if (name.includes('bacon')) return 'extra bacon';
  if (name.includes('calabresa')) return 'extra sausage';
  if (name.includes('salsicha')) return 'extra hotdog-extra';
  if (name.includes('carne')) return 'extra meat';
  if (name.includes('frango')) return 'extra chicken';
  if (name.includes('cheddar')) return 'extra cheddar';
  if (name.includes('catupiry')) return 'extra cream';
  return 'extra cheese';
}

function productBadge(product = {}) {
  if (product.product_type === 'hotdog') return 'Hot dog prensado';
  if (product.product_type === 'suco') return 'Suco natural';
  if (product.product_type === 'bebida') return 'Bebida gelada';
  return 'Adicional';
}

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

function FoodVisual({ product, hero = false }) {
  const kind = productKind(product);
  return (
    <div className={`food-visual ${kind} ${hero ? 'hero-food' : ''}`} aria-hidden="true">
      <span className="shine" />
      <span className="steam one" />
      <span className="steam two" />
      <span className="plate" />
      <span className="bread top" />
      <span className="bread bottom" />
      <span className="sausage" />
      <span className="mustard" />
      <span className="ketchup" />
      <span className="salad" />
      <span className="cup" />
      <span className="liquid" />
      <span className="ice a" />
      <span className="ice b" />
      <span className="fruit" />
      <span className="can-body" />
      <span className="can-top" />
      <span className="can-label" />
      <span className="bottle-body" />
      <span className="bottle-label" />
      <span className="extra-piece" />
    </div>
  );
}

function Header({ settings }) {
  return (
    <header className="ultra-header">
      <button className="ultra-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <span><Flame size={24} /></span>
        <div>
          <small>Pedidos online</small>
          <strong>{settings?.business_name || 'Hot Dog do Vagner'}</strong>
        </div>
      </button>
      <nav>
        <button onClick={() => document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth' })}><ShoppingCart size={16} /> Cardapio</button>
        <button className="admin" onClick={() => { window.history.pushState({}, '', '/admin'); window.location.reload(); }}><ShieldCheck size={16} /> Painel Admin</button>
      </nav>
    </header>
  );
}

function ProductCard({ product, extras, onAdd, featured = false }) {
  const [selectedExtras, setSelectedExtras] = useState([]);
  const allowedExtras = product.product_type === 'hotdog' ? extras : [];

  function toggleExtra(id) {
    setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submitAdd() {
    onAdd(product, selectedExtras);
    setSelectedExtras([]);
  }

  return (
    <article className={`ultra-product-card ${featured ? 'featured' : ''}`}>
      <div className="product-photo-wrap">
        {featured && <span className="most-ordered">Mais pedido</span>}
        <FoodVisual product={product} />
      </div>
      <div className="product-info">
        <small>{productBadge(product)}</small>
        <h3>{product.name}</h3>
        <strong className="product-price">{formatMoney(product.price)}</strong>
        <p>{product.description || 'Preparado com ingredientes selecionados.'}</p>

        {allowedExtras.length > 0 && (
          <div className="ultra-extras">
            <span>Adicionais inclusos na escolha</span>
            <div>
              {allowedExtras.slice(0, 5).map((extra) => (
                <label key={extra.id} className={selectedExtras.includes(extra.id) ? 'checked' : ''}>
                  <input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                  <b>{extra.name}</b>
                  <em>+ {formatMoney(extra.price)}</em>
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="ultra-add" onClick={submitAdd}>Adicionar ao pedido <span>+</span></button>
      </div>
    </article>
  );
}

function CartPanel({ cart, setCart, settings, pulse }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const deliveryFee = deliveryType === 'entrega' ? Number(settings?.delivery_fee || 0) : 0;
  const total = subtotal + deliveryFee;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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
    <aside id="pedido" className={`ultra-cart ${pulse ? 'pulse' : ''}`}>
      <div className="cart-head">
        <div>
          <span><ShoppingCart size={21} /></span>
          <h2>Seu pedido</h2>
        </div>
        <b>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</b>
      </div>

      {cart.length === 0 ? (
        <div className="empty-cart">
          <ShoppingCart size={54} />
          <strong>Monte seu pedido</strong>
          <p>Adicione lanches, bebidas, sucos e adicionais para ver o resumo aqui.</p>
        </div>
      ) : (
        <div className="cart-list">
          {cart.map((item) => (
            <div className="cart-line" key={item.key}>
              <div>
                <strong>{item.name}</strong>
                {item.extras.length > 0 && <small>+ {item.extras.map((extra) => extra.name).join(', ')}</small>}
                <em>{formatMoney(Number(item.price) + item.extras.reduce((sum, extra) => sum + Number(extra.price), 0))}</em>
              </div>
              <div className="cart-controls">
                <button type="button" onClick={() => updateQty(item.key, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
                <button type="button" className="remove" onClick={() => removeItem(item.key)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cart-total-box">
        <span>Subtotal <b>{formatMoney(subtotal)}</b></span>
        <span>Entrega <b>{formatMoney(deliveryFee)}</b></span>
        <strong>Total <b>{formatMoney(total)}</b></strong>
      </div>

      <form className="checkout-form" onSubmit={sendOrder}>
        <h3>Dados para entrega</h3>
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
        <button className="send-order" disabled={loading}>{loading ? 'Enviando...' : 'Enviar pedido'}</button>
        {message && <p className={`cart-message ${message.includes('enviado') ? 'success' : ''}`}>{message}</p>}
      </form>

      <div className="secure-note"><Lock size={16} /> Pedido salvo automaticamente no painel administrativo.</div>
    </aside>
  );
}

function MobileCartBar({ cart, settings }) {
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const total = subtotal + Number(settings?.delivery_fee || 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (!count) return null;

  return (
    <button className="mobile-cart-bar" onClick={() => document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth' })}>
      <span>{count} {count === 1 ? 'item' : 'itens'}</span>
      <strong>Ver pedido • {formatMoney(total)}</strong>
    </button>
  );
}

function PremiumLanding({ settings }) {
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartPulse, setCartPulse] = useState(false);

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
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 700);
  }

  return (
    <div className="ultra-page">
      <Header settings={settings} />

      <main>
        <section className="ultra-hero">
          <div className="hero-copy">
            <span className="hero-pill"><Sparkles size={15} /> Hot dog prensado premium</span>
            <h1>Seu hot dog prensado favorito, pedido em poucos cliques.</h1>
            <p>Monte o lanche, escolha adicionais, envie o pedido e acompanhe pelo WhatsApp. Tudo cai automaticamente no painel do negocio.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth' })}>Fazer pedido agora <ChevronRight size={18} /></button>
              <button className="hero-secondary" onClick={() => { window.history.pushState({}, '', '/admin'); window.location.reload(); }}><ShieldCheck size={17} /> Entrar no painel</button>
            </div>
            <div className="hero-metrics">
              <span><Clock size={19} /><b>Previsao</b><strong>{settings?.estimated_delivery_minutes || 35} min</strong></span>
              <span><Truck size={19} /><b>Entrega</b><strong>{formatMoney(settings?.delivery_fee || 0)}</strong></span>
              <span><MessageCircle size={19} /><b>WhatsApp</b><strong>{settings?.phone || settings?.whatsapp || '(18) 99195-9898'}</strong></span>
            </div>
          </div>
          <div className="hero-art">
            <FoodVisual product={{ product_type: 'hotdog', name: 'Hot Dog Especial' }} hero />
            <div className="smart-queue">
              <strong><Zap size={17} /> Fila inteligente</strong>
              <div><i /> <i /> <i /> <i /></div>
              <small>novo → preparo → entrega → concluido</small>
            </div>
          </div>
        </section>

        <section className="feature-row">
          <article><ShoppingCart size={25} /><div><strong>Cardapio digital</strong><span>Produtos, adicionais, bebidas e sucos.</span></div><ChevronRight size={18} /></article>
          <article><Zap size={25} /><div><strong>Pedido automatizado</strong><span>Sai do site e aparece no admin.</span></div><ChevronRight size={18} /></article>
          <article><WalletCards size={25} /><div><strong>Gestao financeira</strong><span>Caixa, despesas, vendas e relatorios.</span></div><ChevronRight size={18} /></article>
        </section>

        {featuredProducts.length > 0 && (
          <section className="ultra-section">
            <div className="section-heading"><span>Mais pedidos</span><h2>Destaques da casa</h2></div>
            <div className="highlight-grid">
              {featuredProducts.map((product, index) => (
                <button key={product.id} className="highlight-card" onClick={() => addToCart(product, [])}>
                  <FoodVisual product={product} />
                  <div>
                    <strong>{product.name}</strong>
                    <b>{formatMoney(product.price)}</b>
                    {index === 0 && <span><Star size={13} fill="currentColor" /> Mais vendido</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="cardapio" className="menu-zone">
          <div className="menu-main">
            <div className="section-heading big"><span>Monte seu pedido</span><h2>Cardapio completo</h2><p>Escolha os itens, adicione extras e finalize sem perder nenhuma informacao do cliente.</p></div>
            <div className="category-tabs">
              {menu.categories.map((category) => (
                <button key={category.id} onClick={() => document.getElementById(`categoria-${category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{category.name}</button>
              ))}
            </div>
            {loading && <p className="menu-message">Carregando cardapio...</p>}
            {!loading && menu.categories.length === 0 && <p className="menu-message">Nenhum produto ativo encontrado no cardapio.</p>}
            {menu.categories.map((category) => (
              <section id={`categoria-${category.id}`} className="menu-category" key={category.id}>
                <div className="category-title"><h3>{category.name}</h3><span>{category.description}</span></div>
                <div className="ultra-product-grid">
                  {category.products.map((product, index) => (
                    <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} featured={index === 0 && product.product_type === 'hotdog'} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <CartPanel cart={cart} setCart={setCart} settings={settings} pulse={cartPulse} />
        </section>

        <section className="trust-strip">
          <span><Lock size={18} /> Pedido seguro</span>
          <span><CreditCard size={18} /> Pagamento na entrega</span>
          <span><MessageCircle size={18} /> Atendimento via WhatsApp</span>
          <span><MapPin size={18} /> Entrega rapida</span>
          <span><Heart size={18} fill="currentColor" /> Feito com qualidade</span>
        </section>
      </main>

      <MobileCartBar cart={cart} settings={settings} />
    </div>
  );
}

export default function UltraPremiumApp() {
  const [settings, setSettings] = useState(null);
  const isAdminRoute = window.location.pathname.includes('admin');

  useEffect(() => {
    if (!isAdminRoute) {
      api.get('/api/public/settings').then(setSettings).catch(() => setSettings(null));
    }
  }, [isAdminRoute]);

  if (isAdminRoute) return <PremiumApp />;
  return <PremiumLanding settings={settings} />;
}
