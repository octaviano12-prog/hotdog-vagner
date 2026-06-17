import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'online', app: 'HotDog Vagner API' });
});

app.get('/api/products', (req, res) => {
  res.json([
    { id: 1, name: 'Hot Dog Simples', price: 18 },
    { id: 2, name: 'Hot Dog Especial', price: 22 },
    { id: 3, name: 'Hot Dog Completo', price: 28 }
  ]);
});

app.listen(port, () => {
  console.log('API HotDog Vagner rodando na porta ' + port);
});
