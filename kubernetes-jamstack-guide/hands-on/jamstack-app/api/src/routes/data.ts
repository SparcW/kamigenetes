import { Hono } from 'hono';
import { Client } from 'pg';

// Honoアプリケーションのインスタンスを作成
const app = new Hono();

// PostgreSQLデータベースへの接続設定
const client = new Client({
  user: 'postgres',
  host: 'my-postgres.default.svc.cluster.local',
  database: 'postgres',
  password: 'mysecretpassword',
  port: 5432,
});

// データベースに接続
client.connect();

// データ取得用のGETエンドポイント
app.get('/api/data', async (c) => {
  try {
    const res = await client.query('SELECT * FROM my_table');
    return c.json(res.rows);
  } catch (error) {
    return c.text('データ取得中にエラーが発生しました', 500);
  }
});

// データ挿入用のPOSTエンドポイント
app.post('/api/data', async (c) => {
  const { name } = await c.req.json();
  try {
    await client.query('INSERT INTO my_table(name) VALUES($1)', [name]);
    return c.text('データが挿入されました');
  } catch (error) {
    return c.text('データ挿入中にエラーが発生しました', 500);
  }
});

// アプリケーションをエクスポート
export default app;