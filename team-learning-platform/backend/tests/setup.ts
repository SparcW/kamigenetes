import dotenv from 'dotenv';
import { beforeAll, afterAll, jest } from '@jest/globals';

// テスト環境の環境変数を設定
dotenv.config({ path: '.env.test' });

// グローバルテストセットアップ
beforeAll(async () => {
  // テスト開始前の共通処理
  console.log('🧪 テストセットアップ開始');
});

afterAll(async () => {
  // テスト終了後の共通処理
  console.log('🧪 テストセットアップ終了');
});

// テストタイムアウト設定
jest.setTimeout(30000);