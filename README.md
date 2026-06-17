# Hot Dog do Vagner

Site estatico profissional para cardapio digital, pedidos, acompanhamento de producao, gestao de produtos e controle financeiro.

## Arquivos

- `index.html`: estrutura principal do app.
- `styles.css`: visual responsivo.
- `app.js`: cardapio, carrinho, pedidos, financeiro, backup e gestao.

## Como implantar na Hostinger

1. Envie `index.html`, `styles.css` e `app.js` para a pasta `public_html`.
2. Abra o dominio e confira se o cardapio aparece.
3. Entre em `Gestao` com o PIN inicial `1234`.
4. Ajuste nome, WhatsApp, taxa de entrega, Pix, meta diaria e novo PIN.

O sistema salva pedidos, produtos, despesas e configuracoes no navegador usando `localStorage`. Para guardar uma copia, use `Financeiro > Backup`.

Para painel compartilhado entre varios aparelhos, login seguro e banco de dados central, a proxima etapa e transformar esta base em um sistema com backend.
