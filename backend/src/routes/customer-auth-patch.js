const baseExpress = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function signCustomer(customer) {
  return jwt.sign(
    { id: customer.id, name: customer.name, phone: customer.phone, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

async function columnExists(tableName, columnName) {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await columnExists(tableName, columnName)) return;
  await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

let customerColumnsReady = false;
async function ensureCustomerColumns() {
  if (customerColumnsReady) return;
  await ensureColumn('customers', 'password_hash', 'VARCHAR(255) NULL');
  await ensureColumn('customers', 'neighborhood', "VARCHAR(120) DEFAULT ''");
  await ensureColumn('customers', 'email', "VARCHAR(160) DEFAULT ''");
  customerColumnsReady = true;
}

function sanitizeCustomer(customer = {}) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email || '',
    address: customer.address || '',
    neighborhood: customer.neighborhood || '',
    reference: customer.reference || ''
  };
}

function customerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Cliente nao autenticado.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(401).json({ message: 'Token de cliente invalido.' });
    req.customer = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Sessao expirada. Entre novamente.' });
  }
}

async function loadCustomer(customerId) {
  await ensureCustomerColumns();
  const rows = await query('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId]);
  return rows[0] || null;
}

async function registerCustomer(req, res) {
  await ensureCustomerColumns();
  const data = req.body || {};
  const name = String(data.name || '').trim();
  const phone = onlyDigits(data.phone || '');
  const password = String(data.password || '');
  const email = String(data.email || '').trim();
  const address = String(data.address || '').trim();
  const neighborhood = String(data.neighborhood || '').trim();
  const reference = String(data.reference || '').trim();

  if (name.length < 2) return res.status(400).json({ message: 'Informe o nome do cliente.' });
  if (phone.length < 8) return res.status(400).json({ message: 'Informe um WhatsApp valido.' });
  if (password.length < 4) return res.status(400).json({ message: 'A senha precisa ter pelo menos 4 caracteres.' });

  const existing = await query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [phone]);
  const passwordHash = await bcrypt.hash(password, 10);
  let customer = existing[0];

  if (customer?.password_hash) {
    return res.status(409).json({ message: 'Este WhatsApp ja possui cadastro. Entre com sua senha.' });
  }

  if (customer) {
    await query(
      'UPDATE customers SET name = ?, email = ?, address = ?, neighborhood = ?, reference = ?, password_hash = ? WHERE id = ?',
      [name, email, address, neighborhood, reference, passwordHash, customer.id]
    );
  } else {
    const result = await query(
      'INSERT INTO customers (name, phone, email, address, neighborhood, reference, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, phone, email, address, neighborhood, reference, passwordHash]
    );
    customer = { id: result.insertId };
  }

  customer = await loadCustomer(customer.id);
  return res.status(201).json({ token: signCustomer(customer), customer: sanitizeCustomer(customer) });
}

async function loginCustomer(req, res) {
  await ensureCustomerColumns();
  const phone = onlyDigits(req.body?.phone || '');
  const password = String(req.body?.password || '');
  if (phone.length < 8 || password.length < 1) return res.status(400).json({ message: 'Informe WhatsApp e senha.' });

  const rows = await query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [phone]);
  const customer = rows[0];
  if (!customer?.password_hash) return res.status(401).json({ message: 'Cadastro nao encontrado para este WhatsApp.' });

  const valid = await bcrypt.compare(password, customer.password_hash);
  if (!valid) return res.status(401).json({ message: 'WhatsApp ou senha invalido.' });

  return res.json({ token: signCustomer(customer), customer: sanitizeCustomer(customer) });
}

async function getProfile(req, res) {
  const customer = await loadCustomer(req.customer.id);
  if (!customer) return res.status(404).json({ message: 'Cliente nao encontrado.' });
  return res.json({ customer: sanitizeCustomer(customer) });
}

async function updateProfile(req, res) {
  await ensureCustomerColumns();
  const current = await loadCustomer(req.customer.id);
  if (!current) return res.status(404).json({ message: 'Cliente nao encontrado.' });

  const data = req.body || {};
  const name = String(data.name ?? current.name).trim();
  const email = String(data.email ?? current.email ?? '').trim();
  const address = String(data.address ?? current.address ?? '').trim();
  const neighborhood = String(data.neighborhood ?? current.neighborhood ?? '').trim();
  const reference = String(data.reference ?? current.reference ?? '').trim();

  if (name.length < 2) return res.status(400).json({ message: 'Informe o nome do cliente.' });

  await query(
    'UPDATE customers SET name = ?, email = ?, address = ?, neighborhood = ?, reference = ? WHERE id = ?',
    [name, email, address, neighborhood, reference, current.id]
  );

  const customer = await loadCustomer(current.id);
  return res.json({ message: 'Cadastro atualizado.', customer: sanitizeCustomer(customer) });
}

async function getCustomerOrders(req, res) {
  const orders = await query(
    `SELECT * FROM orders
     WHERE customer_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.customer.id]
  );

  if (orders.length === 0) return res.json([]);
  const ids = orders.map((order) => order.id);
  const placeholders = ids.map(() => '?').join(',');
  const items = await query(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`, ids);
  return res.json(orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) })));
}

function registerCustomerRoutes(app) {
  app.post('/api/customer/register', (req, res, next) => Promise.resolve(registerCustomer(req, res)).catch(next));
  app.post('/api/customer/login', (req, res, next) => Promise.resolve(loginCustomer(req, res)).catch(next));
  app.get('/api/customer/profile', customerAuth, (req, res, next) => Promise.resolve(getProfile(req, res)).catch(next));
  app.put('/api/customer/profile', customerAuth, (req, res, next) => Promise.resolve(updateProfile(req, res)).catch(next));
  app.get('/api/customer/orders', customerAuth, (req, res, next) => Promise.resolve(getCustomerOrders(req, res)).catch(next));
}

function wrappedExpress(...args) {
  const app = baseExpress(...args);
  let registered = false;

  function ensureCustomerRoutes() {
    if (registered) return;
    registerCustomerRoutes(app);
    registered = true;
  }

  const originalUse = app.use.bind(app);
  app.use = function patchedUse(...useArgs) {
    const isStaticMiddleware = useArgs.some((arg) => typeof arg === 'function' && ['serveStatic', 'staticMiddleware'].includes(arg.name));
    if (isStaticMiddleware) ensureCustomerRoutes();
    return originalUse(...useArgs);
  };

  const originalGet = app.get.bind(app);
  app.get = function patchedGet(route, ...handlers) {
    if (route === '*' || route === '/api/health') ensureCustomerRoutes();
    return originalGet(route, ...handlers);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function patchedListen(...listenArgs) {
    ensureCustomerRoutes();
    return originalListen(...listenArgs);
  };

  return app;
}

Object.setPrototypeOf(wrappedExpress, baseExpress);
Object.assign(wrappedExpress, baseExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
