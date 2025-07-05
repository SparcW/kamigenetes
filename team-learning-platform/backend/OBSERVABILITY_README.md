# OpenTelemetry統合 README

## 概要
このBackendはOpenTelemetryを使用して包括的なオブザーバビリティを提供します。

## 機能
- **分散トレーシング**: リクエストフロー追跡
- **カスタムメトリクス**: ビジネス指標収集
- **構造化ログ**: JSON形式ログ出力
- **個人情報保護**: 自動PII除去
- **ヘルスチェック**: 監視用エンドポイント

## エンドポイント
- `GET /health` - ヘルスチェック
- `GET /metrics` - Prometheusメトリクス
- `GET /ready` - レディネスチェック

## 環境変数
```bash
# OpenTelemetry
OTEL_SERVICE_NAME=team-learning-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_RESOURCE_ATTRIBUTES=service.name=team-learning-backend,service.version=1.0.0

# ログ
LOG_LEVEL=info
ELASTICSEARCH_URL=http://elasticsearch:9200
```

## 使用方法
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# オブザーバビリティ付きで起動
docker-compose -f docker-compose.yml -f docker-compose.observability.yml --profile development up
```

## カスタムメトリクス
- `http_requests_total` - HTTPリクエスト数
- `active_users_total` - アクティブユーザー数
- `learning_progress_total` - 学習進捗イベント
- `quiz_attempts_total` - クイズ試行回数
- `database_queries_total` - DB クエリ数

### API別メトリクス
#### Progress API
- `progress_updates_total` - 進捗更新回数
- `progress_response_time_seconds` - 進捗API応答時間
- `reading_time_minutes` - 読書時間分布
- `favorites_total` - お気に入り追加回数

#### Auth API
- `login_attempts_total` - ログイン試行回数
- `session_duration_seconds` - セッション継続時間分布

#### Exam API
- `exam_starts_total` - 試験開始回数
- `exam_completions_total` - 試験完了回数
- `exam_scores` - 試験スコア分布
- `exam_duration_seconds` - 試験所要時間

#### Analytics API
- `analytics_leaderboard_requests_total` - リーダーボード要求回数
- `analytics_statistics_requests_total` - 統計データ要求回数
- `analytics_team_performance_analysis_total` - チーム分析回数
- `analytics_response_time_seconds` - Analytics API応答時間

#### Users API
- `users_list_requests_total` - ユーザー一覧要求回数
- `users_creation_total` - ユーザー作成回数
- `users_update_total` - ユーザー更新回数
- `users_password_change_total` - パスワード変更回数
- `users_response_time_seconds` - Users API応答時間

#### Document API
- `document_views_total` - ドキュメント閲覧回数
- `document_search_total` - ドキュメント検索回数
- `document_response_time_seconds` - Document API応答時間

## 構造化ログ
すべてのログは以下の形式で出力されます：
```json
{
  "timestamp": "2025-07-03T10:00:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "service": "team-learning-backend",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "userId": "hash123",
  "method": "GET",
  "route": "/api/users",
  "statusCode": 200,
  "duration": 0.123
}
```

## 次のステップ
1. 依存関係のインストール: `npm install`
2. 環境変数の設定
3. オブザーバビリティスタック起動
4. 動作確認

## メトリクス実装方法

### 1. 新しいメトリクスの追加
新しいAPIエンドポイントにメトリクスを追加するには：

1. `src/lib/metrics.ts` でメトリクスを定義：
```typescript
// 新しいAPI用メトリクス
export const newApiRequestsCounter = new Counter({
  name: 'new_api_requests_total',
  help: 'Total number of new API requests',
  labelNames: ['endpoint', 'method', 'status']
});

export const newApiResponseTime = new Histogram({
  name: 'new_api_response_time_seconds',
  help: 'New API response time in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
});
```

2. APIルートファイルでメトリクスをインポート：
```typescript
import { newApiRequestsCounter, newApiResponseTime } from '../lib/metrics';
```

3. エンドポイントでメトリクスを記録：
```typescript
router.get('/endpoint', async (req, res) => {
  const endTimer = newApiResponseTime.startTimer({ endpoint: 'endpoint', method: 'GET' });
  
  try {
    // ビジネスロジック
    
    // 成功時のメトリクス
    newApiRequestsCounter.inc({ endpoint: 'endpoint', method: 'GET', status: 'success' });
    
    res.json({ success: true });
    endTimer();
  } catch (error) {
    // エラー時のメトリクス
    newApiRequestsCounter.inc({ endpoint: 'endpoint', method: 'GET', status: 'error' });
    
    res.status(500).json({ error: 'Internal server error' });
    endTimer();
  }
});
```

### 2. メトリクステストの実行

#### 正常系テスト（10回実行）
```bash
# Progress API
for i in {1..10}; do
  curl -s "http://localhost:3001/api/progress/user/test-user" > /dev/null
  echo "Progress API test $i completed"
done

# Auth API
for i in {1..10}; do
  curl -s -X POST "http://localhost:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' > /dev/null
  echo "Auth API test $i completed"
done

# Exam API
for i in {1..10}; do
  curl -s "http://localhost:3001/api/exam/available" > /dev/null
  echo "Exam API test $i completed"
done

# Analytics API
for i in {1..10}; do
  curl -s "http://localhost:3001/api/analytics/leaderboard/global" > /dev/null
  echo "Analytics API test $i completed"
done

# Users API
for i in {1..10}; do
  curl -s "http://localhost:3001/api/users?page=1&limit=10" > /dev/null
  echo "Users API test $i completed"
done
```

#### 異常系テスト（10回実行）
```bash
# 無効なエンドポイント
for i in {1..10}; do
  curl -s "http://localhost:3001/api/invalid/endpoint" > /dev/null
  echo "Invalid endpoint test $i completed"
done

# 無効なパラメータ
for i in {1..10}; do
  curl -s "http://localhost:3001/api/progress/user/" > /dev/null
  echo "Invalid parameter test $i completed"
done

# 無効なJSONデータ
for i in {1..10}; do
  curl -s -X POST "http://localhost:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"invalid":"json"}' > /dev/null
  echo "Invalid JSON test $i completed"
done
```

### 3. Grafanaダッシュボードの作成

#### ダッシュボード作成手順：
1. Grafanaにアクセス: `http://localhost:3100`
2. 左メニューから「+」→「Dashboard」を選択
3. 「Add new panel」をクリック
4. Prometheusデータソースを選択
5. クエリを入力（例：`rate(new_api_requests_total[5m])`）
6. パネルタイトルと説明を追加
7. 「Apply」をクリック

#### 推奨パネル構成：
- **要求率パネル**: `rate(api_requests_total[5m])`
- **エラー率パネル**: `rate(api_errors_total[5m])`
- **応答時間パネル**: `histogram_quantile(0.95, rate(api_response_time_seconds_bucket[5m]))`
- **アクティビティ分布パネル**: `sum by (status) (api_requests_total)`

#### ダッシュボードのエクスポート：
1. ダッシュボードの「Share」→「Export」を選択
2. 「Export for sharing externally」をチェック
3. 「Save to file」でJSONファイルをダウンロード
4. `/observability/grafana/dashboards/team-learning/` に保存

#### ダッシュボードのインポート：
```bash
# Pythonを使用してJSONファイルを正しいフォーマットで作成
python3 -c "
import json
with open('your-dashboard.json', 'r') as f:
    dashboard = json.load(f)
wrapper = {
    'dashboard': dashboard,
    'overwrite': True,
    'folderId': 0
}
with open('/tmp/dashboard-wrapped.json', 'w') as f:
    json.dump(wrapper, f, indent=2)
"

# Grafana APIを使用してダッシュボードをインポート
curl -X POST -H "Content-Type: application/json" \
  -d @/tmp/dashboard-wrapped.json \
  "http://admin:admin@localhost:3100/api/dashboards/db"
```

#### 既存ダッシュボードの一括インポート：
```bash
# Analytics APIダッシュボード
python3 -c "
import json
with open('observability/grafana/dashboards/team-learning/analytics-api-dashboard.json', 'r') as f:
    dashboard = json.load(f)
wrapper = {'dashboard': dashboard, 'overwrite': True, 'folderId': 0}
with open('/tmp/analytics-wrapped.json', 'w') as f:
    json.dump(wrapper, f, indent=2)
"
curl -X POST -H "Content-Type: application/json" \
  -d @/tmp/analytics-wrapped.json \
  "http://admin:admin@localhost:3100/api/dashboards/db"

# Users APIダッシュボード
python3 -c "
import json
with open('observability/grafana/dashboards/team-learning/users-api-dashboard.json', 'r') as f:
    dashboard = json.load(f)
wrapper = {'dashboard': dashboard, 'overwrite': True, 'folderId': 0}
with open('/tmp/users-wrapped.json', 'w') as f:
    json.dump(wrapper, f, indent=2)
"
curl -X POST -H "Content-Type: application/json" \
  -d @/tmp/users-wrapped.json \
  "http://admin:admin@localhost:3100/api/dashboards/db"
```

### 4. メトリクス確認コマンド

```bash
# 全メトリクス確認
curl -s http://localhost:3001/metrics

# 特定のメトリクス確認
curl -s http://localhost:3001/metrics | grep "api_requests_total"

# メトリクス値の確認
curl -s http://localhost:3001/metrics | grep -E "api_requests_total{.*} [0-9]+"
```

## 利用可能なGrafanaダッシュボード

### ダッシュボード一覧
1. **Team Learning Platform - Application Overview**
   - URL: `http://localhost:3100/d/team-learning-overview/`
   - 説明: アプリケーション全体の概要と主要メトリクス

2. **Team Learning - Analytics API Dashboard**
   - URL: `http://localhost:3100/d/analytics-api-dashboard/`
   - 説明: Analytics API専用のメトリクス監視

3. **Team Learning - Users API Dashboard**
   - URL: `http://localhost:3100/d/users-api-dashboard/`
   - 説明: Users API専用のメトリクス監視

4. **Team Learning Platform** (フォルダー)
   - URL: `http://localhost:3100/dashboards/f/deqzhpm42lreoc/`
   - 説明: 全ダッシュボードのフォルダー

### アクセス方法
- **Grafana管理画面**: `http://localhost:3100`
- **ユーザー名**: `admin`
- **パスワード**: `admin`

### ダッシュボード確認コマンド
```bash
# 全ダッシュボードの一覧取得
curl -s "http://admin:admin@localhost:3100/api/search?query=Team%20Learning"

# 特定のダッシュボードの詳細取得
curl -s "http://admin:admin@localhost:3100/api/dashboards/uid/analytics-api-dashboard"

# ダッシュボードの削除
curl -X DELETE "http://admin:admin@localhost:3100/api/dashboards/uid/analytics-api-dashboard"
```

## トラブルシューティング

### よくある問題と解決方法

1. **メトリクスが表示されない**
   ```bash
   # Prometheusが正常に動作しているか確認
   curl -s http://localhost:9090/api/v1/targets
   
   # バックエンドがメトリクスを出力しているか確認
   curl -s http://localhost:3001/metrics | head -20
   ```

2. **ダッシュボードが表示されない**
   ```bash
   # Grafanaのデータソース設定を確認
   curl -s "http://admin:admin@localhost:3100/api/datasources"
   
   # ダッシュボードが正常にインポートされているか確認
   curl -s "http://admin:admin@localhost:3100/api/search"
   ```

3. **メトリクス値が増加しない**
   ```bash
   # APIにテストリクエストを送信
   curl -s "http://localhost:3001/api/documents/categories"
   
   # メトリクスの値を確認
   curl -s http://localhost:3001/metrics | grep -E "team_learning_http_requests_total{.*} [0-9]+"
   ```
