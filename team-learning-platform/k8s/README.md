# Kubernetes オブザーバビリティ設定
# 本番環境用の設定ファイル

## 構成要素
- **Tempo Operator**: 分散トレーシング管理
- **Prometheus Operator**: メトリクス監視
- **Fluentd**: ログ収集
- **Grafana**: 可視化ダッシュボード
- **Elasticsearch**: ログ検索・保存

## デプロイメント順序
1. Operator のインストール
2. Persistent Volume の設定
3. 各種設定ファイルのデプロイ
4. アプリケーションのデプロイ
5. ダッシュボードの設定

## 使用方法
```bash
# 名前空間作成
kubectl create namespace observability

# Operator インストール
kubectl apply -f k8s/operators/

# 設定ファイルデプロイ
kubectl apply -f k8s/observability/

# 確認
kubectl get pods -n observability
```

## 次のステップ
1. Helm Chart 作成
2. Operator 設定ファイル作成
3. 永続ボリューム設定
4. RBAC 設定
5. Service Monitor 設定
