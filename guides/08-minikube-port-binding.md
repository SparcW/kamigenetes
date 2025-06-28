# Minikubeで8080ポートをBindする方法

## 概要
Minikubeで8080ポートにサービスを公開する方法をいくつか紹介します。

## 方法1: kubectl port-forward（推奨・最も簡単）

### 基本的な使用方法
```bash
# サービスに対してポートフォワード
kubectl port-forward service/[サービス名] 8080:8080

# Podに対してポートフォワード
kubectl port-forward pod/[Pod名] 8080:80

# Deploymentに対してポートフォワード
kubectl port-forward deployment/[デプロイメント名] 8080:80
```

### 実例
```bash
# サービス作成
kubectl apply -f webapp-8080.yaml

# 8080ポートでアクセス可能にする
kubectl port-forward service/webapp-8080-service 8080:8080

# 別ターミナルでテスト
curl http://localhost:8080
```

### メリット・デメリット
**メリット:**
- 最も簡単で迅速
- ファイアウォール設定不要
- セキュアな接続

**デメリット:**
- 単一接続のみ
- プロセス終了で接続切断
- 開発・テスト用途のみ

## 方法2: LoadBalancer + minikube tunnel

### サービス設定例
```yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp-8080-service
spec:
  selector:
    app: webapp-8080
  ports:
  - name: http
    port: 8080        # 外部公開ポート
    targetPort: 80    # コンテナ内ポート
    protocol: TCP
  type: LoadBalancer
```

### 使用手順
```bash
# 1. サービスをデプロイ
kubectl apply -f service.yaml

# 2. minikube tunnelを起動（別ターミナル）
minikube tunnel

# 3. サービス状態確認
kubectl get services
# EXTERNAL-IP が 127.0.0.1 になることを確認

# 4. アクセステスト
curl http://127.0.0.1:8080
```

### メリット・デメリット
**メリット:**
- 本番環境に近い構成
- 複数接続対応
- ブラウザから直接アクセス可能

**デメリット:**
- tunnel プロセスの維持が必要
- sudo権限が必要な場合がある

## 方法3: NodePort サービス

### サービス設定例
```yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp-nodeport
spec:
  selector:
    app: webapp
  ports:
  - port: 8080
    targetPort: 80
    nodePort: 30080  # 30000-32767の範囲
  type: NodePort
```

### アクセス方法
```bash
# minikube IPを取得
minikube ip

# NodePort経由でアクセス
curl http://$(minikube ip):30080
```

### メリット・デメリット
**メリット:**
- tunnel不要
- 設定が永続的

**デメリット:**
- ポート番号が固定されない場合がある
- 30000-32767の範囲制限

## 方法4: minikube service コマンド

### 基本使用法
```bash
# サービスのURLを取得
minikube service [サービス名] --url

# ブラウザで自動オープン
minikube service [サービス名]

# 特定のNamespace
minikube service [サービス名] -n [namespace] --url
```

### 実例
```bash
# LoadBalancerサービスのURL取得
minikube service webapp-8080-service --url
# 出力例: http://127.0.0.1:36833

# 直接ブラウザで開く
minikube service webapp-8080-service
```

### メリット・デメリット
**メリット:**
- Minikube専用の便利コマンド
- 自動的にランダムポートを割り当て

**デメリット:**
- ポート番号をコントロールできない
- Minikube環境でのみ利用可能

## 実践的な使い分け

### 開発・デバッグ時
```bash
# 最も簡単で迅速
kubectl port-forward service/webapp-8080-service 8080:8080
```

### 複数人での共有・デモ時
```bash
# minikube tunnel を使用
minikube tunnel
# 別ターミナルで: curl http://127.0.0.1:8080
```

### CI/CD・自動テスト時
```bash
# NodePort または minikube service を使用
minikube service webapp-service --url
```

## コンテナ内ポートが8080の場合

### Deploymentでコンテナポートを8080に設定
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-8080-container
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webapp-8080-container
  template:
    metadata:
      labels:
        app: webapp-8080-container
    spec:
      containers:
      - name: webapp
        image: tomcat:9.0-jre11  # 8080ポートで動作
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: webapp-8080-container-service
spec:
  selector:
    app: webapp-8080-container
  ports:
  - port: 8080
    targetPort: 8080    # コンテナポートと一致
  type: LoadBalancer
```

### アクセス方法
```bash
# port-forward で 8080 -> 8080
kubectl port-forward service/webapp-8080-container-service 8080:8080

# または tunnel + 直接アクセス
minikube tunnel
curl http://127.0.0.1:8080
```

## トラブルシューティング

### ポートがすでに使用中の場合
```bash
# ポート使用状況確認
netstat -tulpn | grep :8080
lsof -i :8080

# 別のポートを使用
kubectl port-forward service/webapp-8080-service 8081:8080
```

### サービスが見つからない場合
```bash
# サービス一覧確認
kubectl get services

# 特定のNamespace
kubectl get services -n [namespace]

# ラベルでフィルタ
kubectl get services -l app=webapp-8080
```

### 接続できない場合
```bash
# サービスの詳細確認
kubectl describe service webapp-8080-service

# エンドポイント確認
kubectl get endpoints webapp-8080-service

# Podの状態確認
kubectl get pods -l app=webapp-8080
```

## AWS ECSとの比較

| 操作 | AWS ECS | Minikube |
|------|---------|----------|
| ポート公開 | ALB/NLB設定 | LoadBalancer + tunnel |
| ローカルテスト | ECS CLI + port mapping | kubectl port-forward |
| サービス発見 | Route53 + ALB | minikube service |
| 永続的公開 | ALB固定URL | NodePort または tunnel |

### ECS Service定義例（参考）
```json
{
  "serviceName": "webapp-service",
  "cluster": "dev-cluster",
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "webapp",
      "containerPort": 8080
    }
  ]
}
```

## まとめ

| 方法 | 簡単さ | 永続性 | 複数接続 | 推奨用途 |
|------|--------|--------|----------|----------|
| **port-forward** | ⭐⭐⭐ | ❌ | ❌ | 開発・デバッグ |
| **LoadBalancer + tunnel** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | デモ・共有 |
| **NodePort** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | CI/CD |
| **minikube service** | ⭐⭐⭐ | ⭐ | ⭐⭐ | 迅速なテスト |

**推奨**: 日常的な開発では`kubectl port-forward`、デモや共有時には`minikube tunnel`の組み合わせが最も実用的です。
