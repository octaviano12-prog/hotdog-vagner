USE hotdog_vagner;

INSERT INTO categories (name) VALUES ('Hot Dog'), ('Bebidas'), ('Adicionais');

INSERT INTO products (category_id, name, description, price) VALUES (1, 'Hot Dog Simples', 'Pao prensado com salsicha e salada.', 18.00);
INSERT INTO products (category_id, name, description, price) VALUES (1, 'Hot Dog Especial', 'Pao prensado com bacon queijo e milho.', 22.00);
INSERT INTO products (category_id, name, description, price) VALUES (1, 'Hot Dog Completo', 'Duas salsichas com queijo bacon calabresa e pure.', 28.00);
INSERT INTO products (category_id, name, description, price) VALUES (2, 'Suco Natural 500 ml', 'Suco natural feito na hora.', 8.00);
INSERT INTO products (category_id, name, description, price) VALUES (3, 'Adicional', 'Adicional do cardapio.', 2.00);
