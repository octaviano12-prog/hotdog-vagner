# Hot Dog do Vagner

Sistema de pedidos online e gestao financeira para o Hot Dog do Vagner.

## Tecnologias

- React + Vite no frontend
- Node.js + Express no backend
- MySQL no banco de dados
- Login administrativo com JWT
- Projeto preparado para Web App Node.js na Hostinger

## O que ja tem

- Cardapio online responsivo
- Carrinho de pedidos
- Finalizacao com dados do cliente
- Envio do pedido para WhatsApp
- Painel administrativo
- Controle de status dos pedidos
- Produtos e adicionais editaveis
- Resumo financeiro diario
- Cadastro de despesas

## Estrutura

```txt
hotdog-vagner/
├── backend/
├── frontend/
├── database/
├── .env.example
├── package.json
└── server.js
```

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
npm run install:all
```

2. Crie o banco MySQL e importe o arquivo:

```txt
database/schema.sql
```

3. Copie `.env.example` para `.env` e preencha os dados do banco.

4. Rode o projeto:

```bash
npm run dev
```

- Frontend local: `http://localhost:5173`
- API local: `http://localhost:3000/api/health`

## Publicacao na Hostinger

1. Criar o banco MySQL no painel da Hostinger.
2. Importar `database/schema.sql` pelo phpMyAdmin.
3. Criar o arquivo `.env` no servidor usando o modelo `.env.example`.
4. Rodar:

```bash
npm run install:all
npm run build
npm start
```

5. No Web App Node.js da Hostinger, usar:

```txt
Startup file: server.js
Node: 20 ou superior
```

## Proximas melhorias

- Tela de cozinha
- Impressao de pedido
- Abertura e fechamento de caixa
- Relatorio por periodo
- Produtos com fotos reais
- Taxa de entrega por bairro
- PIX com QR Code
- Permissoes para funcionarios
