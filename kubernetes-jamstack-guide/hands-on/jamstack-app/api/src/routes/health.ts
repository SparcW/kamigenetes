import { Hono } from 'hono';

// ヘルスチェック用のAPIエンドポイントを定義する
const app = new Hono();

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

export default app;