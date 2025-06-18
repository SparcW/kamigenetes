# 🚀 実践演習: サンプルアプリケーションのデプロイ

## 演習の目標
このハンズオン演習では、Kubernetesクラスターに3層アーキテクチャのWebアプリケーションをデプロイします。AWS ECS管理者の視点で、各ステップでECSとの違いを理解しながら進めます。

## 📋 前提条件
- Minikube または Kubernetesクラスターが利用可能
- kubectl コマンドが使用可能
- Docker が利用可能

## 🏗️ 演習の流れ

### ステップ 1: 環境準備
```powershell
# Minikubeの起動（ローカル環境の場合）
minikube start

# kubectl の動作確認
kubectl cluster-info

# 現在のコンテキスト確認
kubectl config current-context
```

**AWS ECSとの違い:**
- ECS: AWSコンソールまたはAWS CLIでクラスター作成
- K8s: kubectl でローカルまたはクラウドのクラスターに接続

### ステップ 2: Dockerイメージのビルド
```powershell
# アプリケーションディレクトリに移動
cd hands-on/sample-app/app

# Dockerイメージのビルド
docker build -t k8s-sample-app:latest .

# イメージの確認
docker images | Select-String "k8s-sample-app"

# Minikube使用時: Minikubeのdockerデーモンを使用
# minikube docker-env | Invoke-Expression
# docker build -t k8s-sample-app:latest .
```

**AWS ECSとの違い:**
- ECS: ECRにプッシュが必要
- K8s: ローカルまたはレジストリからプル

### ステップ 3: ネームスペースの作成
```powershell
cd ../kubernetes

# ネームスペースの適用
kubectl apply -f namespace.yaml

# 作成されたネームスペースの確認
kubectl get namespaces

# 作成されたリソースクォータの確認
kubectl get resourcequota -n sample-app
```

**AWS ECSとの違い:**
- ECS: クラスター内で論理分離はタグベース
- K8s: ネームスペースで明確に分離

### ステップ 4: ConfigMapとSecretの適用
```powershell
# ConfigMap（設定情報）の適用
kubectl apply -f configmap.yaml

# Secret（機密情報）の適用
kubectl apply -f secrets.yaml

# 作成確認
kubectl get configmaps -n sample-app
kubectl get secrets -n sample-app

# ConfigMapの内容確認
kubectl describe configmap app-config -n sample-app
```

**AWS ECSとの違い:**
- ECS: タスク定義内の環境変数、Parameter Store、Secrets Manager
- K8s: ConfigMapとSecretでコンテナから分離

### ステップ 5: データベース（PostgreSQL）のデプロイ
```powershell
cd postgres

# 永続化ボリュームクレームの作成
kubectl apply -f postgres-pvc.yaml

# PostgreSQLデプロイメントの作成
kubectl apply -f postgres-deployment.yaml

# PostgreSQLサービスの作成
kubectl apply -f postgres-service.yaml

# デプロイ状況の確認
kubectl get all -n sample-app -l component=postgres

# Pod の詳細確認
kubectl describe pod -n sample-app -l component=postgres
```

**AWS ECSとの違い:**
- ECS: RDSまたはEBSアタッチ、タスク定義でボリューム設定
- K8s: PVC、Deployment、Serviceの組み合わせ

### ステップ 6: Redis（キャッシュ）のデプロイ
```powershell
cd ../redis

# Redisデプロイメントとサービスの作成
kubectl apply -f redis-deployment.yaml
kubectl apply -f redis-service.yaml

# デプロイ状況の確認
kubectl get all -n sample-app -l component=redis

# Redisログの確認
kubectl logs -n sample-app -l component=redis
```

**AWS ECSとの違い:**
- ECS: ElastiCacheまたはタスク内Redis、サービスディスカバリ
- K8s: Service経由の内部通信

### ステップ 7: Webアプリケーションのデプロイ
```powershell
cd ../web

# Webアプリケーションデプロイメントの作成
kubectl apply -f web-deployment.yaml

# Webサービスとイングレスの作成
kubectl apply -f web-service.yaml

# すべてのリソースの確認
kubectl get all -n sample-app

# Pod の状態詳細確認
kubectl describe pods -n sample-app -l component=web
```

**AWS ECSとの違い:**
- ECS: ALB、ターゲットグループ、タスク定義のポートマッピング
- K8s: Service、Ingress、Deploymentの組み合わせ

### ステップ 8: 動作確認とテスト
```powershell
# すべてのポッドが Ready状態か確認
kubectl get pods -n sample-app

# サービスの確認
kubectl get services -n sample-app

# アプリケーションへのアクセス確認
# Method 1: Port forward
kubectl port-forward -n sample-app service/web-service 8080:80

# ブラウザで http://localhost:8080 にアクセス

# Method 2: Minikube service (Minikube使用時)
# minikube service web-service -n sample-app

# ログの確認
kubectl logs -n sample-app -l component=web --tail=50

# データベース接続テスト
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT version();"
```

### ステップ 9: 運用操作の練習

#### スケーリング（ECSのサービス更新に相当）
```powershell
# Webアプリケーションのレプリカ数を増加
kubectl scale deployment web-deployment -n sample-app --replicas=5

# スケーリング状況の確認
kubectl get pods -n sample-app -l component=web

# 元に戻す
kubectl scale deployment web-deployment -n sample-app --replicas=3
```

#### ローリングアップデート（ECSのサービス更新に相当）
```powershell
# イメージタグの更新をシミュレート
kubectl set image deployment/web-deployment -n sample-app web-app=k8s-sample-app:v2 --record

# ローリングアップデートの状況確認
kubectl rollout status deployment/web-deployment -n sample-app

# ロールバック
kubectl rollout undo deployment/web-deployment -n sample-app

# ロールアウト履歴の確認
kubectl rollout history deployment/web-deployment -n sample-app
```

#### リソース監視（ECSのCloudWatchに相当）
```powershell
# リソース使用量の確認
kubectl top pods -n sample-app

# イベントの確認
kubectl get events -n sample-app --sort-by='.lastTimestamp'

# 特定Podの詳細確認
kubectl describe pod -n sample-app [Pod名]
```

### ステップ 10: クリーンアップ
```powershell
# ネームスペース全体の削除（すべてのリソースが削除される）
kubectl delete namespace sample-app

# 削除確認
kubectl get all -n sample-app
```

## 🎯 学習ポイント比較表

| 操作 | AWS ECS | Kubernetes |
|------|---------|------------|
| **アプリケーション起動** | ECSサービス作成 | Deployment作成 |
| **ネットワーク設定** | ALB + ターゲットグループ | Service + Ingress |
| **スケーリング** | サービス更新 | kubectl scale |
| **アップデート** | サービス更新 | kubectl rollout |
| **設定管理** | タスク定義環境変数 | ConfigMap |
| **機密情報** | Secrets Manager | Secret |
| **ボリューム** | EBS/EFS設定 | PVC + PV |
| **ヘルスチェック** | タスク定義内設定 | Probe設定 |
| **ログ確認** | CloudWatch Logs | kubectl logs |
| **監視** | CloudWatch | kubectl top/metrics |

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. Podが起動しない
```powershell
# Pod状態の詳細確認
kubectl describe pod [Pod名] -n sample-app

# イベントの確認
kubectl get events -n sample-app --field-selector involvedObject.name=[Pod名]

# ログの確認
kubectl logs [Pod名] -n sample-app
```

#### 2. サービスに接続できない
```powershell
# サービスエンドポイントの確認
kubectl get endpoints -n sample-app

# ポートフォワードで直接接続テスト
kubectl port-forward -n sample-app pod/[Pod名] 8080:3000
```

#### 3. データベース接続エラー
```powershell
# PostgreSQL Podへの接続確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- pg_isready

# ネットワーク接続テスト
kubectl exec -n sample-app -it deployment/web-deployment -- nslookup postgres-service
```

## 📚 次のステップ
1. **Helm チャートの作成** - パッケージ管理の学習
2. **モニタリング設定** - Prometheus + Grafana
3. **CI/CD パイプライン** - GitOps の実装
4. **セキュリティ強化** - NetworkPolicy、RBAC
5. **本番環境デプロイ** - AWS EKS への移行

この演習により、AWS ECS管理者がKubernetesの基本的な操作と概念を体験できます。各ステップでECSとの違いを意識しながら、実践的にKubernetesを学習できる構成になっています。
