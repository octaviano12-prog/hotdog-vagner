const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { dbHealth, query, transaction } = require('./config/db');
const { initDatabase } = require('./config/migrate');
const { authRequired, adminRequired } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

process.on('unhandledRejection', (error) => {
  console.error('[process:unhandledRejection]', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process:uncaughtException]', error);
});

const corsOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

function wrapAsyncHandlers(expressApp) {
  ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
    const original = expressApp[method].bind(expressApp);
    expressApp[method] = (route, ...handlers) => original(
      route,
      ...handlers.map((handler) => {
        if (typeof handler !== 'function' || handler.constructor.name !== 'AsyncFunction') return handler;
        return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
      })
    );
  });
}

wrapAsyncHandlers(app);

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function signUser(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function ensureAdminUser(email, name, password) {
  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, 'admin']
  );
  console.log(`[setup] Usuario admin criado: ${email}`);
}

async function ensureDefaults() {
  const name = process.env.ADMIN_NAME || 'Administrador';
  const email = process.env.ADMIN_EMAIL || 'admin@hotdog.com';
  const password = process.env.ADMIN_PASSWORD || '123456';

  await ensureAdminUser(email, name, password);

  if (email !== 'admin@hotdog.com') {
    await ensureAdminUser('admin@hotdog.com', name, password);
  }

  const settings = await query('SELECT COUNT(*) AS total FROM settings');
  if (Number(settings[0]?.total || 0) === 0) {
    await query(
      'INSERT INTO settings (business_name, phone, whatsapp, address, delivery_fee, is_open) VALUES (?, ?, ?, ?, ?, ?)',
      [
        'Hot Dog do Vagner',
        '(18) 99195-9898',
        process.env.WHATSAPP_NUMBER || '5518991959898',
        '',
        money(process.env.DEFAULT_DELIVERY_FEE || 2),
        1
      ]
    );
  }
}

app.get('/api/health', async (_req, res) => {
  const ok = await dbHealth();
  return res.json({ ok, service: 'hotdog-vagner-api', database: ok ? 'online' : 'offline' });
});

app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Dados de login invalidos.' });

  const users = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [parsed.data.email]);
  const user = users[0];
  if (!user) return res.status(401).json({ message: 'E-mail ou senha invalidos.' });

  const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'E-mail ou senha invalidos.' });

  return res.json({
    token: signUser(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get('/api/public/settings', async (_req, res) => {
  const rows = await query('SELECT * FROM settings ORDER BY id ASC LIMIT 1');
  return res.json(rows[0] || null);
});

app.get('/api/public/menu', async (_req, res) => {
  const categories = await query('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC');
  const products = await query(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
  );

  const itemsByCategory = categories.map((category) => ({
    ...category,
    products: products.filter((product) => product.category_id === category.id)
  }));

  return res.json({ categories: itemsByCategory, products });
});

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    address: z.string().optional().default(''),
    reference: z.string().optional().default('')
  }),
  delivery_type: z.enum(['entrega', 'retirada']).default('entrega'),
  payment_method: z.enum(['dinheiro', 'pix', 'cartao', 'fiado']).default('dinheiro'),
  change_for: z.number().optional().nullable(),
  notes: z.string().optional().default(''),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().int().positive().default(1),
      notes: z.string().optional().default(''),
      extras: z.array(z.number().int().positive()).optional().default([])
    })
  ).min(1)
});

app.post('/api/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Pedido invalido.', errors: parsed.error.flatten() });

  const data = parsed.data;
  const productIds = [...new Set(data.items.flatMap((item) => [item.product_id, ...item.extras]))];
  const placeholders = productIds.map(() => '?').join(',');
  const products = await query(`SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`, productIds);
  const productMap = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0;
  for (const item of data.items) {
    const product = productMap.get(item.product_id);
    if (!product) return res.status(400).json({ message: 'Produto indisponivel no cardapio.' });
    subtotal += money(product.price) * item.quantity;

    for (const extraId of item.extras) {
      const extra = productMap.get(extraId);
      if (!extra) return res.status(400).json({ message: 'Adicional indisponivel no cardapio.' });
      subtotal += money(extra.price) * item.quantity;
    }
  }

  const settings = await query('SELECT delivery_fee FROM settings ORDER BY id ASC LIMIT 1');
  const deliveryFee = data.delivery_type === 'entrega' ? money(settings[0]?.delivery_fee || 0) : 0;
  const total = money(subtotal + deliveryFee);

  const order = await transaction(async (connection) => {
    const [existingCustomers] = await connection.execute('SELECT id FROM customers WHERE phone = ? LIMIT 1', [data.customer.phone]);
    let customerId = existingCustomers[0]?.id;

    if (customerId) {
      await connection.execute(
        'UPDATE customers SET name = ?, address = ?, reference = ? WHERE id = ?',
        [data.customer.name, data.customer.address, data.customer.reference, customerId]
      );
    } else {
      const [customerResult] = await connection.execute(
        'INSERT INTO customers (name, phone, address, reference) VALUES (?, ?, ?, ?)',
        [data.customer.name, data.customer.phone, data.customer.address, data.customer.reference]
      );
      customerId = customerResult.insertId;
    }

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (customer_id, status, payment_status, payment_method, delivery_type, subtotal, delivery_fee, total, change_for, notes)
       VALUES (?, 'novo', 'pendente', ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, data.payment_method, data.delivery_type, money(subtotal), deliveryFee, total, data.change_for || null, data.notes]
    );

    const orderId = orderResult.insertId;

    for (const item of data.items) {
      const product = productMap.get(item.product_id);
      const [itemResult] = await connection.execute(
        `INSERT INTO order_items (order_id, product_id, parent_item_id, item_type, name, quantity, unit_price, total_price, notes)
         VALUES (?, ?, NULL, 'produto', ?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, item.quantity, money(product.price), money(product.price * item.quantity), item.notes]
      );

      for (const extraId of item.extras) {
        const extra = productMap.get(extraId);
        await connection.execute(
          `INSERT INTO order_items (order_id, product_id, parent_item_id, item_type, name, quantity, unit_price, total_price, notes)
           VALUES (?, ?, ?, 'adicional', ?, ?, ?, ?, '')`,
          [orderId, extra.id, itemResult.insertId, extra.name, item.quantity, money(extra.price), money(extra.price * item.quantity)]
        );
      }
    }

    return { id: orderId, total };
  });

  return res.status(201).json({ message: 'Pedido criado com sucesso.', order });
});

app.get('/api/admin/orders', authRequired, adminRequired, async (req, res) => {
  const status = req.query.status;
  const params = [];
  let where = 'WHERE 1 = 1';
  if (status) {
    where += ' AND o.status = ?';
    params.push(status);
  }

  const orders = await query(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.reference AS customer_reference
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 100`,
    params
  );

  if (orders.length === 0) return res.json([]);
  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const items = await query(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`, orderIds);
  return res.json(orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) })));
});

app.patch('/api/admin/orders/:id/status', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({
    status: z.enum(['novo', 'preparo', 'saiu_entrega', 'concluido', 'cancelado']),
    payment_status: z.enum(['pendente', 'pago', 'cancelado']).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Status invalido.' });

  const paymentStatus = parsed.data.payment_status || (parsed.data.status === 'cancelado' ? 'cancelado' : undefined);
  if (paymentStatus) {
    await query('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?', [parsed.data.status, paymentStatus, req.params.id]);
  } else {
    await query('UPDATE orders SET status = ? WHERE id = ?', [parsed.data.status, req.params.id]);
  }
  return res.json({ message: 'Pedido atualizado.' });
});

app.patch('/api/admin/orders/:id/payment', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({ payment_status: z.enum(['pendente', 'pago', 'cancelado']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Pagamento invalido.' });
  await query('UPDATE orders SET payment_status = ? WHERE id = ?', [parsed.data.payment_status, req.params.id]);
  return res.json({ message: 'Pagamento atualizado.' });
});

app.get('/api/admin/products', authRequired, adminRequired, async (_req, res) => {
  const products = await query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC`
  );
  return res.json(products);
});

app.post('/api/admin/products', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({
    category_id: z.number().int().positive(),
    name: z.string().min(2),
    description: z.string().optional().default(''),
    price: z.number().nonnegative(),
    product_type: z.enum(['hotdog', 'bebida', 'suco', 'adicional']).default('hotdog'),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().default(0)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Produto invalido.', errors: parsed.error.flatten() });

  const slug = parsed.data.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const result = await query(
    `INSERT INTO products (category_id, name, slug, description, price, product_type, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [parsed.data.category_id, parsed.data.name, `${slug}-${Date.now()}`, parsed.data.description, money(parsed.data.price), parsed.data.product_type, parsed.data.is_active ? 1 : 0, parsed.data.sort_order]
  );
  return res.status(201).json({ message: 'Produto criado.', id: result.insertId });
});

app.put('/api/admin/products/:id', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({
    category_id: z.number().int().positive(),
    name: z.string().min(2),
    description: z.string().optional().default(''),
    price: z.number().nonnegative(),
    product_type: z.enum(['hotdog', 'bebida', 'suco', 'adicional']),
    is_active: z.boolean(),
    sort_order: z.number().int().default(0)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Produto invalido.', errors: parsed.error.flatten() });

  await query(
    `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, product_type = ?, is_active = ?, sort_order = ? WHERE id = ?`,
    [parsed.data.category_id, parsed.data.name, parsed.data.description, money(parsed.data.price), parsed.data.product_type, parsed.data.is_active ? 1 : 0, parsed.data.sort_order, req.params.id]
  );
  return res.json({ message: 'Produto atualizado.' });
});

app.delete('/api/admin/products/:id', authRequired, adminRequired, async (req, res) => {
  await query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  return res.json({ message: 'Produto desativado.' });
});

app.get('/api/admin/categories', authRequired, adminRequired, async (_req, res) => {
  const categories = await query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
  return res.json(categories);
});

app.get('/api/admin/finance/summary', authRequired, adminRequired, async (_req, res) => {
  const [orderSummary] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS gross_today,
       COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND payment_status = 'pago' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS paid_today,
       COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND payment_status = 'pendente' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS pending_today,
       COUNT(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'cancelado' THEN 1 END) AS orders_today
     FROM orders`
  );

  const [expenseSummary] = await query(
    `SELECT COALESCE(SUM(amount), 0) AS expenses_today
     FROM expenses
     WHERE DATE(expense_date) = CURDATE()`
  );

  return res.json({
    ...orderSummary,
    expenses_today: expenseSummary.expenses_today,
    net_today: money(orderSummary.paid_today - expenseSummary.expenses_today)
  });
});

app.get('/api/admin/finance/expenses', authRequired, adminRequired, async (_req, res) => {
  const expenses = await query('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 100');
  return res.json(expenses);
});

app.post('/api/admin/finance/expenses', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({
    description: z.string().min(2),
    amount: z.number().positive(),
    category: z.string().optional().default('Geral'),
    expense_date: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Despesa invalida.' });

  const result = await query(
    'INSERT INTO expenses (description, amount, category, expense_date) VALUES (?, ?, ?, COALESCE(?, CURDATE()))',
    [parsed.data.description, money(parsed.data.amount), parsed.data.category, parsed.data.expense_date || null]
  );
  return res.status(201).json({ message: 'Despesa cadastrada.', id: result.insertId });
});

app.get('/api/admin/settings', authRequired, adminRequired, async (_req, res) => {
  const rows = await query('SELECT * FROM settings ORDER BY id ASC LIMIT 1');
  return res.json(rows[0] || null);
});

app.put('/api/admin/settings', authRequired, adminRequired, async (req, res) => {
  const schema = z.object({
    business_name: z.string().min(2),
    phone: z.string().optional().default(''),
    whatsapp: z.string().optional().default(''),
    address: z.string().optional().default(''),
    delivery_fee: z.number().nonnegative(),
    is_open: z.boolean().default(true)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Configuracao invalida.' });

  await query(
    `UPDATE settings SET business_name = ?, phone = ?, whatsapp = ?, address = ?, delivery_fee = ?, is_open = ? WHERE id = (SELECT id FROM (SELECT id FROM settings ORDER BY id ASC LIMIT 1) AS s)`,
    [parsed.data.business_name, parsed.data.phone, parsed.data.whatsapp, parsed.data.address, money(parsed.data.delivery_fee), parsed.data.is_open ? 1 : 0]
  );
  return res.json({ message: 'Configuracoes atualizadas.' });
});

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('[api:error]', error);
  const databaseCodes = new Set([
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ER_NO_SUCH_TABLE',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST'
  ]);

  if (databaseCodes.has(error?.code)) {
    return res.status(503).json({
      message: 'Banco de dados indisponivel. Confira as variaveis DB_HOST, DB_USER, DB_PASSWORD e DB_NAME na Hostinger.',
      code: error.code
    });
  }

  return res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(PORT, async () => {
  console.log(`Hot Dog do Vagner API rodando na porta ${PORT}`);
  try {
    await initDatabase();
    await ensureDefaults();
    console.log('[setup] Banco de dados verificado com sucesso.');
  } catch (error) {
    console.error('[setup] Falha ao preparar banco de dados:', error);
  }
});
