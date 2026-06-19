const { z } = require('zod');
const { query, transaction } = require('../config/db');
const { authRequired, adminRequired } = require('../middleware/auth');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function todaySql() {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(req) {
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  const today = todaySql();
  const monthStart = `${today.slice(0, 8)}01`;
  const from = valid.test(String(req.query.from || '')) ? req.query.from : monthStart;
  const to = valid.test(String(req.query.to || '')) ? req.query.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

async function getSettings() {
  const rows = await query('SELECT * FROM settings ORDER BY id ASC LIMIT 1');
  return rows[0] || null;
}

async function getOpenCashRegister(connection) {
  if (connection) {
    const [rows] = await connection.execute("SELECT * FROM cash_registers WHERE status = 'aberto' ORDER BY opened_at DESC, id DESC LIMIT 1");
    return rows[0] || null;
  }
  const rows = await query("SELECT * FROM cash_registers WHERE status = 'aberto' ORDER BY opened_at DESC, id DESC LIMIT 1");
  return rows[0] || null;
}

async function registerPaymentMovement(orderId, connection = null) {
  const exec = connection
    ? (sql, params = []) => connection.execute(sql, params).then(([rows]) => rows)
    : (sql, params = []) => query(sql, params);

  const orders = await exec(
    `SELECT o.*, c.name AS customer_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ? LIMIT 1`,
    [orderId]
  );
  const order = orders[0];
  if (!order || order.payment_status !== 'pago' || order.status === 'cancelado') return;

  const existing = await exec("SELECT id FROM cash_movements WHERE order_id = ? AND movement_type = 'entrada' LIMIT 1", [orderId]);
  if (existing.length > 0) return;

  const open = await getOpenCashRegister(connection);
  const publicCode = order.public_code || `HD${String(order.id).padStart(4, '0')}`;
  await exec(
    `INSERT INTO cash_movements (cash_register_id, order_id, movement_type, description, amount, payment_method, notes)
     VALUES (?, ?, 'entrada', ?, ?, ?, ?)`,
    [open?.id || null, order.id, `Pedido ${publicCode} - ${order.customer_name}`, money(order.total), order.payment_method, 'Entrada automatica do pedido pago.']
  );
}

const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    address: z.string().optional().default(''),
    reference: z.string().optional().default(''),
    neighborhood: z.string().optional().default('')
  }),
  delivery_type: z.enum(['entrega', 'retirada']).default('entrega'),
  payment_method: z.enum(['dinheiro', 'pix', 'cartao', 'fiado']).default('dinheiro'),
  payment_status: z.enum(['pendente', 'pago', 'cancelado']).optional().default('pendente'),
  order_source: z.enum(['site', 'admin', 'whatsapp', 'balcao']).optional().default('admin'),
  notes: z.string().optional().default(''),
  items: z.array(z.object({ product_id: z.number().int().positive(), quantity: z.number().int().positive().default(1), extras: z.array(z.number().int().positive()).optional().default([]), notes: z.string().optional().default('') })).min(1)
});

async function createAdminOrder(data) {
  const productIds = [...new Set(data.items.flatMap((item) => [item.product_id, ...item.extras]))];
  const placeholders = productIds.map(() => '?').join(',');
  const products = await query(`SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1`, productIds);
  const productMap = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0;
  for (const item of data.items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      const error = new Error('Produto indisponivel no cardapio.');
      error.statusCode = 400;
      throw error;
    }
    subtotal += money(product.price) * item.quantity;
    for (const extraId of item.extras) {
      const extra = productMap.get(extraId);
      if (!extra) {
        const error = new Error('Adicional indisponivel no cardapio.');
        error.statusCode = 400;
        throw error;
      }
      subtotal += money(extra.price) * item.quantity;
    }
  }

  const settings = await getSettings();
  const deliveryFee = data.delivery_type === 'entrega' ? money(settings?.delivery_fee || 0) : 0;
  const total = money(subtotal + deliveryFee);

  return transaction(async (connection) => {
    const [existingCustomers] = await connection.execute('SELECT id FROM customers WHERE phone = ? LIMIT 1', [data.customer.phone]);
    let customerId = existingCustomers[0]?.id;
    if (customerId) {
      await connection.execute('UPDATE customers SET name = ?, address = ?, reference = ? WHERE id = ?', [data.customer.name, data.customer.address, data.customer.reference, customerId]);
    } else {
      const [customerResult] = await connection.execute('INSERT INTO customers (name, phone, address, reference) VALUES (?, ?, ?, ?)', [data.customer.name, data.customer.phone, data.customer.address, data.customer.reference]);
      customerId = customerResult.insertId;
    }

    const estimatedMinutes = Number(settings?.estimated_delivery_minutes || 35);
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (customer_id, status, payment_status, payment_method, delivery_type, subtotal, delivery_fee, total, notes, order_source, delivery_neighborhood, estimated_minutes, paid_at)
       VALUES (?, 'novo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${data.payment_status === 'pago' ? 'CURRENT_TIMESTAMP' : 'NULL'})`,
      [customerId, data.payment_status, data.payment_method, data.delivery_type, money(subtotal), deliveryFee, total, data.notes, data.order_source, data.customer.neighborhood || '', estimatedMinutes]
    );

    const orderId = orderResult.insertId;
    const publicCode = `HD${String(orderId).padStart(4, '0')}`;
    await connection.execute('UPDATE orders SET public_code = ? WHERE id = ?', [publicCode, orderId]);

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

    if (data.payment_status === 'pago') await registerPaymentMovement(orderId, connection);
    return { id: orderId, public_code: publicCode, total, estimated_minutes: estimatedMinutes };
  });
}

function registerPremiumRoutes(app) {
  app.get('/api/admin/dashboard', authRequired, adminRequired, async (_req, res) => {
    const [summary] = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS gross_today,
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND payment_status = 'pago' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS paid_today,
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND payment_status = 'pendente' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS pending_today,
         COUNT(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'cancelado' THEN 1 END) AS orders_today,
         COALESCE(AVG(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'cancelado' THEN total END), 0) AS average_ticket_today
       FROM orders`
    );
    const [expenseSummary] = await query('SELECT COALESCE(SUM(amount), 0) AS expenses_today FROM expenses WHERE DATE(expense_date) = CURDATE()');
    const statusCounts = await query('SELECT status, COUNT(*) AS total FROM orders WHERE DATE(created_at) = CURDATE() GROUP BY status');
    const topProducts = await query(
      `SELECT name, SUM(quantity) AS quantity, COALESCE(SUM(total_price), 0) AS total
       FROM order_items
       WHERE item_type = 'produto' AND DATE(created_at) = CURDATE()
       GROUP BY name
       ORDER BY quantity DESC
       LIMIT 5`
    );
    return res.json({ ...summary, expenses_today: expenseSummary.expenses_today, net_today: money(summary.paid_today - expenseSummary.expenses_today), status_counts: statusCounts, top_products: topProducts });
  });

  app.post('/api/admin/orders', authRequired, adminRequired, async (req, res) => {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Pedido invalido.', errors: parsed.error.flatten() });
    const order = await createAdminOrder(parsed.data);
    return res.status(201).json({ message: 'Pedido criado no painel.', order });
  });

  app.patch('/api/admin/orders/:id/status-flow', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ status: z.enum(['novo', 'preparo', 'saiu_entrega', 'concluido', 'cancelado']), payment_status: z.enum(['pendente', 'pago', 'cancelado']).optional(), cancellation_reason: z.string().optional().default('') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Status invalido.' });
    const paymentStatus = parsed.data.payment_status || (parsed.data.status === 'cancelado' ? 'cancelado' : null);
    await query(
      `UPDATE orders SET status = ?, payment_status = COALESCE(?, payment_status),
       accepted_at = CASE WHEN ? IN ('preparo', 'saiu_entrega', 'concluido') AND accepted_at IS NULL THEN CURRENT_TIMESTAMP ELSE accepted_at END,
       dispatched_at = CASE WHEN ? IN ('saiu_entrega', 'concluido') AND dispatched_at IS NULL THEN CURRENT_TIMESTAMP ELSE dispatched_at END,
       completed_at = CASE WHEN ? = 'concluido' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
       canceled_at = CASE WHEN ? = 'cancelado' AND canceled_at IS NULL THEN CURRENT_TIMESTAMP ELSE canceled_at END,
       paid_at = CASE WHEN ? = 'pago' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END,
       cancellation_reason = CASE WHEN ? = 'cancelado' THEN ? ELSE cancellation_reason END
       WHERE id = ?`,
      [parsed.data.status, paymentStatus, parsed.data.status, parsed.data.status, parsed.data.status, parsed.data.status, paymentStatus, parsed.data.status, parsed.data.cancellation_reason || '', req.params.id]
    );
    if (paymentStatus === 'pago') await registerPaymentMovement(req.params.id);
    return res.json({ message: 'Pedido atualizado.' });
  });

  app.patch('/api/admin/orders/:id/payment-flow', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ payment_status: z.enum(['pendente', 'pago', 'cancelado']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Pagamento invalido.' });
    await query("UPDATE orders SET payment_status = ?, paid_at = CASE WHEN ? = 'pago' AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = ?", [parsed.data.payment_status, parsed.data.payment_status, req.params.id]);
    if (parsed.data.payment_status === 'pago') await registerPaymentMovement(req.params.id);
    return res.json({ message: 'Pagamento atualizado.' });
  });

  app.get('/api/admin/customers', authRequired, adminRequired, async (req, res) => {
    const search = req.query.search;
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE c.name LIKE ? OR c.phone LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    const customers = await query(
      `SELECT c.*, COUNT(o.id) AS orders_count,
              COALESCE(SUM(CASE WHEN o.status <> 'cancelado' THEN o.total ELSE 0 END), 0) AS total_spent,
              MAX(o.created_at) AS last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY last_order_at DESC, c.updated_at DESC
       LIMIT 150`,
      params
    );
    return res.json(customers);
  });

  app.get('/api/admin/finance/cash/current', authRequired, adminRequired, async (_req, res) => {
    const register = await getOpenCashRegister();
    if (!register) return res.json({ register: null, totals: null, movements: [] });
    const movements = await query("SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at DESC, id DESC LIMIT 200", [register.id]);
    const [totals] = await query(
      `SELECT COALESCE(SUM(CASE WHEN movement_type = 'entrada' THEN amount ELSE 0 END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN movement_type = 'saida' THEN amount ELSE 0 END), 0) AS saidas
       FROM cash_movements WHERE cash_register_id = ? AND status = 'ativo'`,
      [register.id]
    );
    return res.json({ register, totals: { ...totals, saldo: money(register.opening_amount + totals.entradas - totals.saidas) }, movements });
  });

  app.post('/api/admin/finance/cash/open', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ opening_amount: z.number().nonnegative().default(0), opening_notes: z.string().optional().default('') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Valor de abertura invalido.' });
    const open = await getOpenCashRegister();
    if (open) return res.status(400).json({ message: 'Ja existe um caixa aberto.' });
    const result = await query('INSERT INTO cash_registers (opened_by, opening_amount, opening_notes) VALUES (?, ?, ?)', [req.user?.id || null, money(parsed.data.opening_amount), parsed.data.opening_notes]);
    return res.status(201).json({ message: 'Caixa aberto.', id: result.insertId });
  });

  app.post('/api/admin/finance/cash/close', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ closing_amount: z.number().nonnegative(), closing_notes: z.string().optional().default('') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Valor de fechamento invalido.' });
    const open = await getOpenCashRegister();
    if (!open) return res.status(400).json({ message: 'Nao existe caixa aberto.' });
    const [totals] = await query(
      `SELECT COALESCE(SUM(CASE WHEN movement_type = 'entrada' AND status = 'ativo' THEN amount ELSE 0 END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN movement_type = 'saida' AND status = 'ativo' THEN amount ELSE 0 END), 0) AS saidas
       FROM cash_movements WHERE cash_register_id = ?`, [open.id]
    );
    const expected = money(open.opening_amount + totals.entradas - totals.saidas);
    const counted = money(parsed.data.closing_amount);
    const difference = money(counted - expected);
    await query(
      "UPDATE cash_registers SET status = 'fechado', closed_by = ?, closing_amount = ?, expected_closing_amount = ?, difference_amount = ?, closing_notes = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.user?.id || null, counted, expected, difference, parsed.data.closing_notes, open.id]
    );
    return res.json({ message: 'Caixa fechado e conferido.', expected_closing_amount: expected, difference_amount: difference });
  });

  app.post('/api/admin/finance/cash/movements', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ movement_type: z.enum(['entrada', 'saida']), description: z.string().min(2), amount: z.number().positive(), payment_method: z.enum(['dinheiro', 'pix', 'cartao', 'fiado']).optional().default('dinheiro'), category: z.string().optional().default('Geral'), notes: z.string().optional().default('') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Movimento invalido.' });
    const open = await getOpenCashRegister();
    if (!open) return res.status(400).json({ message: 'Abra o caixa antes de registrar movimentos manuais.' });
    const result = await query(
      `INSERT INTO cash_movements (cash_register_id, movement_type, description, amount, payment_method, notes, category, source_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      [open.id, parsed.data.movement_type, parsed.data.description, money(parsed.data.amount), parsed.data.payment_method, parsed.data.notes, parsed.data.category, req.user?.id || null]
    );
    return res.status(201).json({ message: 'Movimento registrado.', id: result.insertId });
  });

  app.get('/api/admin/finance/overview', authRequired, adminRequired, async (req, res) => {
    const { from, to } = dateRange(req);
    const [orders] = await query(
      `SELECT COUNT(CASE WHEN status <> 'cancelado' THEN 1 END) AS orders_count,
              COALESCE(SUM(CASE WHEN status <> 'cancelado' THEN total ELSE 0 END), 0) AS gross,
              COALESCE(SUM(CASE WHEN payment_status = 'pago' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS paid,
              COALESCE(SUM(CASE WHEN payment_status = 'pendente' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS pending
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ?`, [from, to]
    );
    const [expenseTotals] = await query('SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses WHERE is_active = 1 AND expense_date BETWEEN ? AND ?', [from, to]);
    const [manualTotals] = await query(
      `SELECT COALESCE(SUM(CASE WHEN movement_type = 'entrada' THEN amount ELSE 0 END), 0) AS manual_entries,
              COALESCE(SUM(CASE WHEN movement_type = 'saida' AND source_type <> 'expense' THEN amount ELSE 0 END), 0) AS withdrawals
       FROM cash_movements WHERE status = 'ativo' AND order_id IS NULL AND DATE(created_at) BETWEEN ? AND ?`, [from, to]
    );
    const payment_methods = await query(
      `SELECT payment_method, COALESCE(SUM(total), 0) AS total, COUNT(*) AS quantity
       FROM orders WHERE payment_status = 'pago' AND status <> 'cancelado' AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY payment_method ORDER BY total DESC`, [from, to]
    );
    const daily = await query(
      `SELECT DATE(created_at) AS day,
              COALESCE(SUM(CASE WHEN status <> 'cancelado' THEN total ELSE 0 END), 0) AS gross,
              COALESCE(SUM(CASE WHEN payment_status = 'pago' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS paid,
              COUNT(CASE WHEN status <> 'cancelado' THEN 1 END) AS orders_count
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY day DESC`, [from, to]
    );
    const net = money(orders.paid + manualTotals.manual_entries - expenseTotals.expenses - manualTotals.withdrawals);
    return res.json({ from, to, summary: { ...orders, ...expenseTotals, ...manualTotals, net }, payment_methods, daily });
  });

  app.get('/api/admin/finance/cash/history', authRequired, adminRequired, async (req, res) => {
    const { from, to } = dateRange(req);
    const rows = await query(
      `SELECT cr.*,
              opener.name AS opened_by_name, closer.name AS closed_by_name,
              COALESCE(SUM(CASE WHEN cm.movement_type = 'entrada' AND cm.status = 'ativo' THEN cm.amount ELSE 0 END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN cm.movement_type = 'saida' AND cm.status = 'ativo' THEN cm.amount ELSE 0 END), 0) AS saidas,
              COUNT(CASE WHEN cm.status = 'ativo' THEN 1 END) AS movement_count
       FROM cash_registers cr
       LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
       LEFT JOIN users opener ON opener.id = cr.opened_by
       LEFT JOIN users closer ON closer.id = cr.closed_by
       WHERE DATE(cr.opened_at) BETWEEN ? AND ?
       GROUP BY cr.id ORDER BY cr.opened_at DESC, cr.id DESC LIMIT 180`, [from, to]
    );
    return res.json(rows.map((row) => ({ ...row, expected_amount: money(row.opening_amount + row.entradas - row.saidas), difference_amount: row.difference_amount == null && row.closing_amount != null ? money(row.closing_amount - (row.opening_amount + row.entradas - row.saidas)) : row.difference_amount })));
  });

  app.get('/api/admin/finance/ledger', authRequired, adminRequired, async (req, res) => {
    const { from, to } = dateRange(req);
    const allowedTypes = new Set(['entrada', 'saida']);
    const allowedMethods = new Set(['dinheiro', 'pix', 'cartao', 'fiado']);
    const params = [from, to];
    let filters = '';
    if (allowedTypes.has(req.query.type)) { filters += ' AND cm.movement_type = ?'; params.push(req.query.type); }
    if (allowedMethods.has(req.query.payment_method)) { filters += ' AND cm.payment_method = ?'; params.push(req.query.payment_method); }
    const rows = await query(
      `SELECT cm.*, cr.status AS cash_status, cr.opened_at AS cash_opened_at, u.name AS created_by_name
       FROM cash_movements cm
       LEFT JOIN cash_registers cr ON cr.id = cm.cash_register_id
       LEFT JOIN users u ON u.id = cm.created_by
       WHERE DATE(cm.created_at) BETWEEN ? AND ? ${filters}
       ORDER BY cm.created_at DESC, cm.id DESC LIMIT 600`, params
    );
    return res.json(rows);
  });

  app.post('/api/admin/finance/movements/:id/reverse', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({ reason: z.string().min(3).max(255) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Informe o motivo do estorno.' });
    const rows = await query('SELECT * FROM cash_movements WHERE id = ? LIMIT 1', [req.params.id]);
    const movement = rows[0];
    if (!movement) return res.status(404).json({ message: 'Movimento nao encontrado.' });
    if (movement.order_id) return res.status(400).json({ message: 'Recebimentos de pedidos devem ser corrigidos no proprio pedido.' });
    if (movement.status === 'estornado') return res.status(400).json({ message: 'Movimento ja estornado.' });
    await transaction(async (connection) => {
      await connection.execute("UPDATE cash_movements SET status = 'estornado', reversed_at = CURRENT_TIMESTAMP, reversal_reason = ? WHERE id = ?", [parsed.data.reason, movement.id]);
      if (movement.source_type === 'expense') await connection.execute('UPDATE expenses SET is_active = 0 WHERE cash_movement_id = ?', [movement.id]);
    });
    return res.json({ message: 'Movimento estornado com rastreabilidade.' });
  });

  app.get('/api/admin/reports/sales', authRequired, adminRequired, async (req, res) => {
    const from = req.query.from || todaySql();
    const to = req.query.to || todaySql();
    const [summary] = await query(
      `SELECT COUNT(*) AS orders_count,
              COALESCE(SUM(CASE WHEN status <> 'cancelado' THEN total ELSE 0 END), 0) AS gross,
              COALESCE(SUM(CASE WHEN payment_status = 'pago' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS paid,
              COALESCE(SUM(CASE WHEN payment_status = 'pendente' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS pending,
              COALESCE(AVG(CASE WHEN status <> 'cancelado' THEN total END), 0) AS average_ticket
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ?`,
      [from, to]
    );
    const topProducts = await query(
      `SELECT oi.name, SUM(oi.quantity) AS quantity, COALESCE(SUM(oi.total_price), 0) AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.item_type = 'produto' AND o.status <> 'cancelado' AND DATE(o.created_at) BETWEEN ? AND ?
       GROUP BY oi.name ORDER BY quantity DESC LIMIT 10`,
      [from, to]
    );
    const [expenses] = await query('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE DATE(expense_date) BETWEEN ? AND ?', [from, to]);
    return res.json({ from, to, summary: { ...summary, expenses: expenses.total || 0, net: money(summary.paid - (expenses.total || 0)) }, top_products: topProducts });
  });

  app.put('/api/admin/settings/premium', authRequired, adminRequired, async (req, res) => {
    const schema = z.object({
      business_name: z.string().min(2), phone: z.string().optional().default(''), whatsapp: z.string().optional().default(''), address: z.string().optional().default(''),
      delivery_fee: z.number().nonnegative(), is_open: z.boolean().default(true), pix_key: z.string().optional().default(''), minimum_order: z.number().nonnegative().default(0),
      estimated_delivery_minutes: z.number().int().positive().default(35), delivery_area_text: z.string().optional().default(''), allow_whatsapp_redirect: z.boolean().default(true)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Configuracao invalida.', errors: parsed.error.flatten() });
    await query(
      `UPDATE settings SET business_name = ?, phone = ?, whatsapp = ?, address = ?, delivery_fee = ?, is_open = ?, pix_key = ?, minimum_order = ?, estimated_delivery_minutes = ?, delivery_area_text = ?, allow_whatsapp_redirect = ?
       WHERE id = (SELECT id FROM (SELECT id FROM settings ORDER BY id ASC LIMIT 1) AS s)`,
      [parsed.data.business_name, parsed.data.phone, parsed.data.whatsapp, parsed.data.address, money(parsed.data.delivery_fee), parsed.data.is_open ? 1 : 0, parsed.data.pix_key, money(parsed.data.minimum_order), parsed.data.estimated_delivery_minutes, parsed.data.delivery_area_text, parsed.data.allow_whatsapp_redirect ? 1 : 0]
    );
    return res.json({ message: 'Configuracoes atualizadas.' });
  });
}

module.exports = { registerPremiumRoutes };
