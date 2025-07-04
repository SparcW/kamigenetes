# チーム学習プラットフォーム - 開発記録メモリ

## プロジェクト概要

**目的**: AWS ECS管理者向けKubernetes学習プラットフォーム  
**アプローチ**: チームベース学習、観測可能性統合、段階的移行支援

## アーキテクチャ決定記録

### フロントエンド技術スタック
- **フレームワーク**: React 18 + TypeScript
- **ビルドツール**: Vite
- **スタイリング**: CSS Modules (基本実装済み)
- **ルーティング**: React Router v6 
- **状態管理**: 初期はuseState/useContext、後にRedux Toolkit検討
- **開発サーバー**: localhost:3000 (Vite dev server)

### バックエンド技術スタック
- **ランタイム**: Node.js + TypeScript
- **フレームワーク**: Express.js
- **認証**: Passport.js (Local Strategy, Session based)
- **セッション管理**: express-session + connect-redis
- **API設計**: RESTful API
- **開発サーバー**: localhost:5000

### データベース・キャッシュ
- **メインDB**: PostgreSQL 15
- **キャッシュ・セッション**: Redis 7
- **ORM**: Prisma (検討中) または生SQL
- **接続**: localhost:5432 (PostgreSQL), localhost:6379 (Redis)

### 観測可能性スタック (完全実装済み)
- **メトリクス**: Prometheus + Grafana
- **ログ**: Filebeat → Elasticsearch → Kibana
- **トレーシング**: OpenTelemetry + Tempo
- **統合ダッシュボード**: Grafana (http://localhost:3001)

### Docker構成
- **開発環境**: docker-compose.yml (フルスタック統合)
- **観測可能性**: docker-compose.observability.yml
- **フロントエンド**: Dockerfile.dev (Vite), Dockerfile (nginx本番)
- **バックエンド**: Dockerfile.dev (ts-node), Dockerfile (本番)

## API仕様・エンドポイント設計

### 認証関連 (`/api/auth`)
- `POST /login` - ユーザーログイン
- `POST /logout` - ログアウト  
- `POST /register` - ユーザー登録
- `GET /me` - 現在のユーザー情報取得

### ユーザー管理 (`/api/users`)
- `GET /` - ユーザー一覧取得
- `GET /:id` - ユーザー詳細取得
- `PUT /:id` - ユーザー情報更新
- `DELETE /:id` - ユーザー削除

### チーム管理 (`/api/teams`)
- `GET /` - チーム一覧取得
- `POST /` - チーム作成
- `GET /:id` - チーム詳細取得
- `PUT /:id` - チーム情報更新
- `POST /:id/members` - メンバー追加

### 進捗管理 (`/api/progress`)
- `GET /user/:userId` - ユーザー進捗取得
- `POST /` - 進捗記録
- `PUT /:id` - 進捗更新

### 試験・習熟度 (`/api/assessments`)
- `GET /` - 試験一覧取得
- `POST /` - 試験作成
- `GET /:id` - 試験詳細取得
- `POST /:id/submit` - 試験回答提出

### 分析・リーダーボード (`/api/analytics`)
- `GET /leaderboard` - リーダーボード取得
- `GET /team/:teamId/stats` - チーム統計
- `GET /user/:userId/analytics` - ユーザー分析

## データベーススキーマ設計

### Users テーブル
```sql
users (
  id: UUID PRIMARY KEY,
  email: VARCHAR UNIQUE NOT NULL,
  username: VARCHAR UNIQUE NOT NULL,
  password_hash: VARCHAR NOT NULL,
  role: ENUM('admin', 'instructor', 'learner'),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
)
```

### Teams テーブル
```sql
teams (
  id: UUID PRIMARY KEY,
  name: VARCHAR NOT NULL,
  description: TEXT,
  instructor_id: UUID REFERENCES users(id),
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
)
```

### Progress テーブル
```sql
progress (
  id: UUID PRIMARY KEY,
  user_id: UUID REFERENCES users(id),
  course_section: VARCHAR NOT NULL,
  completion_status: ENUM('not_started', 'in_progress', 'completed'),
  score: INTEGER,
  completed_at: TIMESTAMP,
  created_at: TIMESTAMP
)
```

## TypeScript型定義

### User型
```typescript
interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'instructor' | 'learner';
  createdAt: Date;
  updatedAt: Date;
}
```

### Session拡張
```typescript
// src/types/express.d.ts
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: User;
  }
}
```

### Express Request拡張
```typescript
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      username: string;
      role: string;
    }
  }
}
```

## 既知の技術課題

### 解決済み (2025-07-04更新)
- ✅ Docker Compose統合環境構築
- ✅ 観測可能性スタック (Filebeat + ELK + Tempo + Prometheus)
- ✅ フロントエンド基本構造 (React + Vite)
- ✅ バックエンド基本構造 (Express + TypeScript)
- ✅ **フルスタック環境完全稼働** (PostgreSQL + Redis + 全サービス)
- ✅ **APIサーバー正常動作確認** (/health, /api エンドポイント)
- ✅ **観測可能性フルスタック** (11サービス統合稼働)

### 現在の課題 (要修正)
- 🔄 認証APIルート (`/api/auth`) の登録修正
- 🔄 TypeScript型定義エラーの完全解消
- 🔄 フロントエンド ↔ バックエンドAPI統合テスト
- 🔄 Kubernetes試験機能の実装

### 次期実装予定
- 📋 Kubernetes YAML変換
- 📋 AWS ECS比較ドキュメント
- 📋 本格的な試験問題データベース

## 開発環境起動手順

### フルスタック起動
```bash
cd /mnt/c/dev/k8s/team-learning-platform
docker-compose up -d
docker-compose -f docker-compose.observability.yml up -d
```

### 個別起動
```bash
# フロントエンド (開発モード)
cd frontend && npm run dev

# バックエンド (開発モード)  
cd backend && npm run dev

# 観測可能性スタック
docker-compose -f docker-compose.observability.yml up -d
```

### アクセスURL (最新版)
- **フロントエンド**: http://localhost:3000 (React App - 稼働中)
- **バックエンドAPI**: http://localhost:3001 (Express API - 稼働中)  
- **ドキュメント**: http://localhost:3002 (Markdown Server - 稼働中)
- **Grafana**: http://localhost:3100 (admin/admin - 稼働中)
- **Kibana**: http://localhost:5601 (ログ分析 - 稼働中)
- **Prometheus**: http://localhost:9090 (メトリクス - 稼働中)
- **PostgreSQL**: localhost:5432 (データベース - 稼働中)
- **Redis**: localhost:6379 (セッション・キャッシュ - 稼働中)

## Git管理状況

### 現在のブランチ
- `main`: 安定版、PR統合済み
- `feature/backend-api-integration`: 現在の作業ブランチ

### 重要なコミット
- `feat: Docker Composeによるフルスタック環境構築完了` (2025-07-04 02:18:47 JST)
- `feat: バックエンドAPI修正とフロントエンド統合準備` (2025-07-04 03:02:18 JST)

## 最新状況・動作確認済み項目 (2025-07-04)

### ✅ 完全稼働中のサービス
1. **PostgreSQL** (5432) - `Up (healthy)` - データベース
2. **Redis** (6379) - `Up (healthy)` - セッション・キャッシュ  
3. **バックエンドAPI** (3001) - `Up` - `/health`, `/api` エンドポイント稼働
4. **フロントエンド** (3000) - `Up` - Reactアプリケーション稼働
5. **ドキュメント** (3002) - `Up` - Markdownドキュメント配信
6. **Elasticsearch** (9200) - `Up` - ログストレージ
7. **Kibana** (5601) - `Up` - ログ分析UI
8. **Prometheus** (9090) - `Up` - メトリクス収集
9. **Grafana** (3100) - `Up` - 統合ダッシュボード
10. **Tempo** (3200) - `Up` - 分散トレーシング
11. **OpenTelemetry Collector** (4319) - `Up` - 観測可能性データ収集

### 🧪 実行済み動作テスト
- `curl http://localhost:3001/health` → **200 OK** (APIヘルスチェック)
- `curl http://localhost:3001/api` → **200 OK** (API基本情報)
- `curl -s -I http://localhost:3000` → **200 OK** (フロントエンド)
- Docker Compose完全統合 → **11サービス稼働中**

### 🔄 次のアクション項目
1. 認証APIルート (`/api/auth`) の登録修正
2. フロントエンド ↔ バックエンドAPI統合テスト  
3. Kubernetes試験機能の実装

### 📈 明日の作業予定 (Observability強化・改善)
1. **メトリクス収集の最適化**
   - カスタムメトリクス追加 (API応答時間、エラー率、ユーザー活動)
   - Prometheus監視ルールの設定
   - アラート設定の実装

2. **ログ分析の改善**
   - 構造化ログの導入 (JSON形式)
   - Kibanaダッシュボードの充実
   - ログレベルの最適化

3. **分散トレーシングの活用**
   - OpenTelemetryの本格活用
   - APIリクエストの追跡強化
   - パフォーマンス問題の特定

4. **ダッシュボードの改善**
   - Grafanaダッシュボードの統合
   - リアルタイム監視の強化
   - SLI/SLOの設定

5. **観測可能性の統合テスト**
   - 本番環境を想定した負荷テスト
   - 障害シナリオテスト
   - 監視システムの有効性確認

---

**最終更新**: 2025-07-04  
**作成者**: AI Assistant + User  
**用途**: 開発途中復帰・仕様確認・技術決定記録
