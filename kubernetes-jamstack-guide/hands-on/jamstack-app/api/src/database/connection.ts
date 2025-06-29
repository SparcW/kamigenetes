import { Client } from 'pg';

// PostgreSQLデータベースへの接続を管理するクラス
class Database {
  private client: Client;

  constructor() {
    this.client = new Client({
      user: 'postgres', // データベースユーザー名
      host: 'my-postgres.default.svc.cluster.local', // PostgreSQLサービスのホスト名
      database: 'postgres', // データベース名
      password: 'mysecretpassword', // データベースパスワード
      port: 5432, // PostgreSQLのポート番号
    });
  }

  // データベースに接続するメソッド
  async connect() {
    try {
      await this.client.connect();
      console.log('データベースに接続しました');
    } catch (error) {
      console.error('データベース接続エラー:', error);
    }
  }

  // データベースから切断するメソッド
  async disconnect() {
    await this.client.end();
    console.log('データベースから切断しました');
  }

  // クエリを実行するメソッド
  async query(queryText: string, params?: any[]) {
    try {
      const res = await this.client.query(queryText, params);
      return res;
    } catch (error) {
      console.error('クエリエラー:', error);
      throw error;
    }
  }
}

// データベースインスタンスをエクスポート
const db = new Database();
export default db;