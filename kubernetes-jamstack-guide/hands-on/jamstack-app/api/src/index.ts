import { Hono } from 'hono';
import { connectToDatabase } from './database/connection';

const app = new Hono();

// データベース接続の初期化
const db = connectToDatabase();

// ヘルスチェック用のエンドポイント
app.get('/health', (c) => {
  return c.json({ status: 'OK' });
});

// データ取得用のエンドポイント
app.get('/api/data', async (c) => {
  const result = await db.query('SELECT * FROM my_table');
  return c.json(result.rows);
});

// データ挿入用のエンドポイント
app.post('/api/data', async (c) => {
  const { name } = await c.req.json();
  await db.query('INSERT INTO my_table(name) VALUES($1)', [name]);
  return c.text('データが挿入されました');
});

// アプリケーションのポートを指定してリッスン
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`APIがポート${PORT}で起動しました`);
});