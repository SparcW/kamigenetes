# オブザーバビリティスタック起動・確認手順

## 1. 基本設定の確認
```bash
# 現在のディレクトリ確認
pwd
# /mnt/c/dev/k8s/team-learning-platform にいることを確認

# 設定ファイルの確認
ls -la observability/
```

## 2. オブザーバビリティスタックの起動
```bash
# 基本アプリケーション + オブザーバビリティサービス起動
docker-compose -f docker-compose.yml -f docker-compose.observability.yml --profile development up -d

# または別々に起動
docker-compose up -d postgres redis
docker-compose -f docker-compose.observability.yml --profile development up -d
```

## 3. サービス状態の確認
```bash
# 起動中のサービス確認
docker-compose ps

# ログ確認
docker-compose logs -f tempo
docker-compose logs -f prometheus
docker-compose logs -f grafana
```

## 4. アクセス確認
- **Grafana**: http://localhost:3100 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Tempo**: http://localhost:3200
- **Elasticsearch**: http://localhost:9200
- **Kibana**: http://localhost:5601

## 5. 基本動作確認
```bash
# Prometheus メトリクス確認
curl http://localhost:9090/api/v1/targets

# Tempo 動作確認
curl http://localhost:3200/ready

# Elasticsearch 動作確認
curl http://localhost:9200/_cluster/health
```

## 6. Backend/Frontend 統合後の確認
```bash
# Backend メトリクス確認
curl http://localhost:3001/metrics

# トレース送信テスト
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test-service"}}]},"instrumentationLibrarySpans":[{"spans":[{"traceId":"12345678901234567890123456789012","spanId":"1234567890123456","name":"test-span","kind":"SPAN_KIND_INTERNAL","startTimeUnixNano":"1640995200000000000","endTimeUnixNano":"1640995201000000000"}]}]}]}'
```

## 7. 停止・クリーンアップ
```bash
# 停止
docker-compose -f docker-compose.yml -f docker-compose.observability.yml down

# ボリューム削除（注意：データが消えます）
docker-compose -f docker-compose.yml -f docker-compose.observability.yml down -v

# 個別サービス停止
docker-compose -f docker-compose.observability.yml --profile development down
```

## 8. トラブルシューティング
```bash
# ポート使用状況確認
netstat -tulpn | grep :3100
netstat -tulpn | grep :9090

# コンテナ詳細確認
docker inspect team-learning-grafana
docker inspect team-learning-tempo

# ネットワーク確認
docker network ls
docker network inspect team-learning-platform_team-learning-network
```
