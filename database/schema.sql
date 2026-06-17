-- Banco de dados sugerido: hotdog_vagner
-- No Hostinger, crie o banco pelo painel e importe este arquivo no phpMyAdmin.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_name VARCHAR(160) NOT NULL DEFAULT 'Hot Dog do Vagner',
  phone VARCHAR(30) DEFAULT '',
  whatsapp VARCHAR(30) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  product_type ENUM('hotdog', 'bebida', 'suco', 'adicional') NOT NULL DEFAULT 'hotdog',
  image_url VARCHAR(500) DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(40) NOT NULL UNIQUE,
  address VARCHAR(255) DEFAULT '',
  reference VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  status ENUM('novo', 'preparo', 'saiu_entrega', 'concluido', 'cancelado') NOT NULL DEFAULT 'novo',
  payment_status ENUM('pendente', 'pago', 'cancelado') NOT NULL DEFAULT 'pendente',
  payment_method ENUM('dinheiro', 'pix', 'cartao', 'fiado') NOT NULL DEFAULT 'dinheiro',
  delivery_type ENUM('entrega', 'retirada') NOT NULL DEFAULT 'entrega',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  change_for DECIMAL(10,2) NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  parent_item_id INT NULL,
  item_type ENUM('produto', 'adicional') NOT NULL DEFAULT 'produto',
  name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_parent FOREIGN KEY (parent_item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Geral',
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_registers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opened_by INT NULL,
  closed_by INT NULL,
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  closing_amount DECIMAL(10,2) NULL,
  status ENUM('aberto', 'fechado') NOT NULL DEFAULT 'aberto',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  CONSTRAINT fk_cash_opened_by FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cash_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cash_register_id INT NULL,
  movement_type ENUM('entrada', 'saida') NOT NULL,
  description VARCHAR(180) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('dinheiro', 'pix', 'cartao', 'fiado') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cash_movements_register FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (id, business_name, phone, whatsapp, delivery_fee, is_open)
VALUES (1, 'Hot Dog do Vagner', '(18) 99195-9898', '5518991959898', 2.00, 1);

INSERT IGNORE INTO categories (id, name, slug, description, sort_order) VALUES
(1, 'Hot Dog Prensado', 'hot-dog-prensado', 'Lanches prensados da casa', 1),
(2, 'Sucos Naturais', 'sucos-naturais', 'Sucos preparados na hora', 2),
(3, 'Bebidas', 'bebidas', 'Refrigerantes e bebidas geladas', 3),
(4, 'Adicionais', 'adicionais', 'Itens extras para montar o pedido', 4);

INSERT IGNORE INTO products (category_id, name, slug, description, price, product_type, sort_order) VALUES
(1, 'Hot Dog Simples', 'hot-dog-simples', 'Pao prensado, salsicha, molho da casa, batata palha, ketchup, maionese, mostarda, alface e vinagrete.', 18.00, 'hotdog', 1),
(1, 'Hot Dog Tradicional', 'hot-dog-tradicional', 'Pao prensado, 1 salsicha, alface, molho da casa, batata palha, ketchup, maionese, mostarda, milho e vinagrete.', 20.00, 'hotdog', 2),
(1, 'Hot Dog Especial', 'hot-dog-especial', 'Pao prensado, 1 salsicha, bacon, molho da casa, batata palha, ketchup, maionese, mostarda, milho, alface, vinagrete e queijo.', 22.00, 'hotdog', 3),
(1, 'Hot Dog Completo', 'hot-dog-completo', 'Pao prensado, 2 salsichas, molho especial da casa, queijo, bacon, calabresa, batata palha, ketchup, maionese, catupiry, alface, mostarda, milho, pure e vinagrete.', 28.00, 'hotdog', 4),
(2, 'Suco Natural 500 ml', 'suco-natural-500ml', 'Sabores: laranja, morango, maracuja, abacaxi com hortela, abacaxi, acerola, uva e limao.', 8.00, 'suco', 1),
(2, 'Jarra de Suco 1 Litro', 'jarra-suco-1-litro', 'Jarra de suco natural preparada na hora.', 15.00, 'suco', 2),
(3, 'Refrigerante lata 350 ml', 'refrigerante-lata-350ml', 'Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva.', 6.00, 'bebida', 1),
(3, 'Refrigerante 600 ml', 'refrigerante-600ml', 'Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva.', 8.00, 'bebida', 2),
(3, 'Refrigerante 1 Litro', 'refrigerante-1-litro', 'Refrigerante 1 litro.', 10.00, 'bebida', 3),
(3, 'Refrigerante 2 Litros', 'refrigerante-2-litros', 'Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva.', 14.00, 'bebida', 4),
(4, 'Catupiry', 'adicional-catupiry', 'Adicional para o lanche.', 2.00, 'adicional', 1),
(4, 'Cheddar', 'adicional-cheddar', 'Adicional para o lanche.', 2.00, 'adicional', 2),
(4, 'Queijo', 'adicional-queijo', 'Adicional para o lanche.', 2.00, 'adicional', 3),
(4, 'Salsicha', 'adicional-salsicha', 'Adicional para o lanche.', 2.00, 'adicional', 4),
(4, 'Carne moida', 'adicional-carne-moida', 'Adicional para o lanche.', 2.00, 'adicional', 5),
(4, 'Frango', 'adicional-frango', 'Adicional para o lanche.', 2.00, 'adicional', 6),
(4, 'Bacon', 'adicional-bacon', 'Adicional para o lanche.', 2.00, 'adicional', 7),
(4, 'Calabresa', 'adicional-calabresa', 'Adicional para o lanche.', 2.00, 'adicional', 8);
