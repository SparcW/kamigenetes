# Lab 4: Webアプリケーション層のデプロイ

## 概要

このラボでは、Node.js Webアプリケーションをデプロイし、外部からのアクセスを可能にします。AWS ECS + ALBとの違いを理解しながら、Ingress、Service、そして3層アーキテクチャの完全な接続について実践します。

## 学習目標

このラボを完了すると、以下ができるようになります：

- [ ] フロントエンドアプリケーションをDeploymentでデプロイする
- [ ] 外部アクセス用のServiceを設定する
- [ ] データベースとキャッシュとの接続を確立する
- [ ] ローリングアップデートを実行する
- [ ] ポートフォワードでローカルアクセスを設定する
- [ ] 3層アプリケーション全体の動作を確認する

## AWS ECS + ALBとの比較

| 機能 | AWS ECS + ALB | Kubernetes |
|------|--------------|------------|
| **外部公開** | ALB + ターゲットグループ | Service + Ingress |
| **負荷分散** | ALB | Service |
| **ヘルスチェック** | ALBヘルスチェック | Readiness/Liveness Probe |
| **SSL終端** | ALB/ACM | Ingress/TLS Secret |
| **パスルーティング** | ALBリスナールール | Ingress rules |
| **アプリ更新** | ECSサービス更新 | Rolling Update |
| **接続確認** | ALB DNS名 | Port-forward/NodePort |

## 前提条件

- [Lab 1: ネームスペースとリソース管理](../lab-01-namespace/README.md)が完了していること
- [Lab 2: データベース層のデプロイ](../lab-02-database/README.md)が完了していること  
- [Lab 3: キャッシュ層のデプロイ](../lab-03-cache/README.md)が完了していること
- `sample-app` ネームスペースと関連リソースが作成済みであること
- アプリケーションのDockerイメージがビルド済みであること

## 手順

### ステップ 1: アプリケーションイメージの準備

```bash
# 現在のディレクトリから移動
cd ../app

# Dockerイメージの確認
docker images | grep k8s-sample-app

# イメージが存在しない場合はビルド
if [ $? -ne 0 ]; then
  echo "Building Docker image..."
  docker build -t k8s-sample-app:latest .
fi

# Minikube使用時はdockerデーモンを切り替え
if command -v minikube &> /dev/null; then
  eval $(minikube docker-env)
  docker build -t k8s-sample-app:latest .
fi

# イメージの確認
docker images | grep k8s-sample-app
```

### ステップ 2: アプリケーションソースコードの確認

アプリケーションが3層アーキテクチャを正しく実装していることを確認します：

```bash
# アプリケーションコードの確認
cat server.js

# パッケージ依存関係の確認
cat package.json

# Dockerfileの確認
cat Dockerfile
```

**server.js の主要機能:**
- PostgreSQLデータベース接続
- Redis キャッシュ連携
- ヘルスチェックエンドポイント
- 環境変数からの設定読み込み

### ステップ 3: WebアプリケーションのDeployment作成

```bash
# アプリケーションディレクトリに戻る
cd ../kubernetes/web

# WebアプリケーションDeploymentファイルの確認
cat web-deployment.yaml
```

**web-deployment.yaml の内容:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
  namespace: sample-app
  labels:
    app: sample-app
    component: web
    tier: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sample-app
      component: web
  template:
    metadata:
      labels:
        app: sample-app
        component: web
        tier: frontend
    spec:
      containers:
      - name: web-app
        image: k8s-sample-app:latest
        imagePullPolicy: Never  # ローカルイメージ使用
        ports:
        - containerPort: 3000
        env:
        # ConfigMapから設定を読み込み
        - name: APP_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: APP_NAME
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_PORT
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_HOST
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_PORT
        # Secretから機密情報を読み込み
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USERNAME
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

Deploymentを作成します：

```bash
# WebアプリケーションDeploymentの作成
kubectl apply -f web-deployment.yaml

# デプロイ状況の確認
kubectl get deployments -n sample-app -l component=web

# Pod作成状況の監視
kubectl get pods -n sample-app -l component=web -w &
WATCH_PID=$!

# Pod起動完了まで待機
kubectl wait --for=condition=ready pod -l component=web -n sample-app --timeout=300s

# 監視停止
kill $WATCH_PID 2>/dev/null || true

# Pod詳細状態の確認
kubectl describe pods -n sample-app -l component=web
```

### ステップ 4: WebアプリケーションのService作成

```bash
# WebサービスファイルConfirmation
cat web-service.yaml
```

**web-service.yaml の内容:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: sample-app
  labels:
    app: sample-app
    component: web
    tier: frontend
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 3000
    nodePort: 30080  # 30000-32767の範囲で指定
    protocol: TCP
    name: http
  selector:
    app: sample-app
    component: web
```

Serviceを作成します：

```bash
# WebサービスPodの作成
kubectl apply -f web-service.yaml

# サービス状態の確認
kubectl get services -n sample-app -l component=web

# サービス詳細の確認
kubectl describe service web-service -n sample-app

# エンドポイントの確認
kubectl get endpoints web-service -n sample-app
```

### ステップ 5: アプリケーション接続テスト

#### 方法1: ポートフォワードでのローカルアクセス

```bash
# ポートフォワードの開始
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!

echo "Application is accessible at: http://localhost:8080"

# ヘルスチェックテスト
curl http://localhost:8080/health

# Ready状態チェック
curl http://localhost:8080/ready

# メインページアクセス
curl http://localhost:8080/

# ポートフォワード停止
kill $PORT_FORWARD_PID 2>/dev/null || true
```

#### 方法2: Minikube Service（Minikube使用時）

```bash
# Minikube環境でのサービスアクセス
if command -v minikube &> /dev/null; then
  echo "Opening application in browser..."
  minikube service web-service -n sample-app --url
  
  # ブラウザで自動オープン
  minikube service web-service -n sample-app
fi
```

#### 方法3: NodePort直接アクセス

```bash
# ノードIPの確認
kubectl get nodes -o wide

# NodePortでのアクセステスト（クラスター内から）
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "Application accessible at: http://$NODE_IP:30080"

# curlでテスト
curl http://$NODE_IP:30080/health
```

### ステップ 6: 3層アプリケーション統合テスト

全ての層（Web、Cache、Database）が正しく連携していることを確認します：

```bash
# データベース接続テスト
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!

# API経由でのデータベース接続確認
curl -X GET http://localhost:8080/api/users

# 新しいユーザー作成テスト
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'

# 作成されたユーザー確認
curl -X GET http://localhost:8080/api/users

# キャッシュテスト
curl -X GET http://localhost:8080/api/cache/test
curl -X POST http://localhost:8080/api/cache/test \
  -H "Content-Type: application/json" \
  -d '{"value": "cached data"}'
curl -X GET http://localhost:8080/api/cache/test

# ポートフォワード停止
kill $PORT_FORWARD_PID 2>/dev/null || true
```

### ステップ 7: アプリケーションログの確認

```bash
# Webアプリケーションのログ確認
kubectl logs -n sample-app -l component=web --tail=50

# リアルタイムログ監視
kubectl logs -n sample-app -l component=web -f &
LOG_PID=$!

# テストリクエストの送信
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!

# 複数のリクエストでログ生成
for i in {1..5}; do
  curl http://localhost:8080/api/users
  sleep 1
done

# ログ監視停止
kill $LOG_PID 2>/dev/null || true
kill $PORT_FORWARD_PID 2>/dev/null || true
```

### ステップ 8: ローリングアップデートの実行

```bash
# 現在のDeployment状態確認
kubectl get deployment web-deployment -n sample-app

# イメージタグの更新（新バージョンをシミュレート）
kubectl set image deployment/web-deployment -n sample-app web-app=k8s-sample-app:v2

# ローリングアップデートの状況監視
kubectl rollout status deployment/web-deployment -n sample-app

# アップデート履歴の確認
kubectl rollout history deployment/web-deployment -n sample-app

# ロールバック（元のバージョンに戻す）
kubectl rollout undo deployment/web-deployment -n sample-app

# ロールバック状況の確認
kubectl rollout status deployment/web-deployment -n sample-app
```

**AWS ECS管理者向け解説**:
- ECSのサービス更新に相当
- ゼロダウンタイムでの更新が可能
- 問題発生時の自動ロールバック機能

### ステップ 9: スケーリングとパフォーマンステスト

```bash
# 現在のレプリカ数確認
kubectl get deployment web-deployment -n sample-app

# スケールアウト（5レプリカに増加）
kubectl scale deployment web-deployment -n sample-app --replicas=5

# スケーリング完了まで待機
kubectl wait --for=condition=ready pod -l component=web -n sample-app --timeout=300s

# 負荷分散の確認
kubectl get pods -n sample-app -l component=web -o wide

# 簡単な負荷テスト
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!

echo "Running load test..."
for i in {1..20}; do
  curl -s http://localhost:8080/health > /dev/null &
done
wait

echo "Load test completed"
kill $PORT_FORWARD_PID 2>/dev/null || true

# 元のレプリカ数に戻す
kubectl scale deployment web-deployment -n sample-app --replicas=3
```

## 運用監視とメンテナンス

### アプリケーション監視

```bash
# Pod状態の連続監視
watch kubectl get pods -n sample-app -l component=web

# リソース使用量監視
kubectl top pods -n sample-app -l component=web

# アプリケーションメトリクス確認
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!

curl http://localhost:8080/metrics  # アプリがメトリクスエンドポイントを提供する場合
curl http://localhost:8080/health
curl http://localhost:8080/ready

kill $PORT_FORWARD_PID 2>/dev/null || true
```

### デバッグとトラブルシューティング

```bash
# 特定Podへの直接接続
WEB_POD=$(kubectl get pods -n sample-app -l component=web -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n sample-app -it $WEB_POD -- /bin/sh

# Pod内での確認:
# ps aux
# netstat -tlnp
# env | grep -E "(DB|REDIS)"
# curl localhost:3000/health
# exit

# 環境変数の確認
kubectl exec -n sample-app $WEB_POD -- env | sort

# ファイルシステムの確認
kubectl exec -n sample-app $WEB_POD -- ls -la /app
```

## 動作確認チェックリスト

以下のすべてが正常に動作することを確認してください：

```bash
# 1. Deploymentの状態確認
echo "=== Web Application Deployment ==="
kubectl get deployment web-deployment -n sample-app

# 2. Pod状態確認
echo "=== Web Application Pods ==="
kubectl get pods -n sample-app -l component=web

# 3. Service状態確認
echo "=== Web Application Service ==="
kubectl get service web-service -n sample-app

# 4. アプリケーション接続確認
echo "=== Application Health Check ==="
kubectl port-forward -n sample-app service/web-service 8080:80 &
PORT_FORWARD_PID=$!
sleep 3

curl -s http://localhost:8080/health
curl -s http://localhost:8080/ready

# 5. データベース連携確認
echo "=== Database Integration Test ==="
curl -s http://localhost:8080/api/users

# 6. キャッシュ連携確認
echo "=== Cache Integration Test ==="
curl -s http://localhost:8080/api/cache/test

kill $PORT_FORWARD_PID 2>/dev/null || true

# 7. 全体アーキテクチャ確認
echo "=== Full Architecture Overview ==="
kubectl get all -n sample-app
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Podが起動しない（ImagePullBackOff）

```bash
# Pod状態の詳細確認
kubectl describe pod -n sample-app -l component=web

# イメージの存在確認
docker images | grep k8s-sample-app

# Minikube使用時のイメージビルド再実行
eval $(minikube docker-env)
cd ../../../hands-on-labs/sample-app/app
docker build -t k8s-sample-app:latest .
```

#### 2. アプリケーションが外部からアクセスできない

```bash
# Service設定の確認
kubectl get service web-service -n sample-app -o yaml

# ポートフォワードでの接続テスト
kubectl port-forward -n sample-app service/web-service 8080:80

# NodePortの設定確認
kubectl get service web-service -n sample-app
```

#### 3. データベース/キャッシュに接続できない

```bash
# 環境変数の確認
kubectl exec -n sample-app $WEB_POD -- env | grep -E "(DB|REDIS)"

# DNS解決確認
kubectl exec -n sample-app $WEB_POD -- nslookup postgres-service
kubectl exec -n sample-app $WEB_POD -- nslookup redis-service

# ネットワーク接続テスト
kubectl exec -n sample-app $WEB_POD -- nc -zv postgres-service 5432
kubectl exec -n sample-app $WEB_POD -- nc -zv redis-service 6379
```

## 学習ポイント

### AWS ECS + ALBとKubernetesの比較

1. **外部公開の方法**
   - ECS + ALB: ALBでHTTP/HTTPSトラフィックをルーティング
   - K8s: Service/Ingress/Gateway APIで柔軟な公開

2. **ヘルスチェック**
   - ECS: ALBヘルスチェック
   - K8s: Liveness/Readiness Probe

3. **スケーリング**
   - ECS: サービス更新でタスク数変更
   - K8s: kubectl scaleまたはHPA

4. **アプリケーション更新**
   - ECS: サービス更新でローリングアップデート
   - K8s: Deployment更新で自動ローリングアップデート

## 次のステップ

このラボで学習した内容：
- ✅ WebアプリケーションのDeployment
- ✅ 外部アクセス用のService設定
- ✅ 3層アーキテクチャの統合
- ✅ ローリングアップデートの実行
- ✅ スケーリングとパフォーマンステスト

次は[Lab 5: 運用操作の実践](../lab-05-operations/README.md)で、監視、ログ管理、バックアップなどの本格的な運用について学習します。

## 関連ドキュメント

- [Deployments詳細ガイド](../../../docs/tutorials/deployments/README.md)
- [Services とネットワーキング](../../../docs/tutorials/services/README.md)
- [Ingress とゲートウェイ](../../../docs/tutorials/ingress/README.md)
- [アプリケーション更新戦略](../../../docs/tutorials/rolling-updates/README.md)
