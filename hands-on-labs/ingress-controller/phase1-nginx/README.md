# Phase 1: NGINX Ingress Controller 基礎演習

## 🎯 学習目標
- NGINX Ingress Controllerの基本的な設定と使用方法を理解する
- パスベースおよびホストベースルーティングを実装する
- SSL/TLS終端の設定を行う
- 基本的な認証機能を設定する

## 📋 演習内容

### 1. 基本的なIngress設定
- 単一サービスへのルーティング
- ヘルスチェックの設定
- 基本的なアノテーション

### 2. 高度なルーティング
- パスベースルーティング
- ホストベースルーティング
- URL書き換えとリダイレクト

### 3. SSL/TLS設定
- 自己署名証明書の作成
- cert-managerによる自動証明書取得
- HTTPSリダイレクト

### 4. 認証・認可
- 基本認証
- OAuth2-proxyによるOAuth認証
- IP制限

## 🛠️ 前提条件

### NGINX Ingress Controllerのインストール
```bash
# Helm リポジトリの追加
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# NGINX Ingress Controller のインストール
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.metrics.enabled=true \
  --set controller.metrics.serviceMonitor.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"=true \
  --set controller.podAnnotations."prometheus\.io/port"=10254
```

### サンプルアプリケーションのデプロイ
```bash
# 演習用アプリケーションをデプロイ
kubectl apply -f ../sample-apps/webapp.yaml
kubectl apply -f ../sample-apps/api.yaml
kubectl apply -f ../sample-apps/admin.yaml
```

## 📚 演習ステップ

### Step 1: 基本的なIngressの作成
```bash
# 基本Ingressの適用
kubectl apply -f 01-basic-ingress.yaml

# 状態確認
kubectl get ingress -A
kubectl describe ingress webapp-ingress -n webapp

# テスト
curl -H "Host: webapp.local" http://localhost
```

### Step 2: パスベースルーティング
```bash
# パスベースルーティングの適用
kubectl apply -f 02-path-routing.yaml

# テスト
curl -H "Host: api.local" http://localhost/v1/users
curl -H "Host: api.local" http://localhost/v2/users
```

### Step 3: SSL/TLS設定
```bash
# SSL証明書の作成
kubectl apply -f 03-ssl-tls.yaml

# 証明書の確認
kubectl get certificates -A
kubectl describe certificate webapp-tls -n webapp

# HTTPSテスト
curl -k -H "Host: webapp.local" https://localhost
```

### Step 4: 認証設定
```bash
# 認証の設定
kubectl apply -f 04-authentication.yaml

# 認証テスト
curl -H "Host: admin.local" http://localhost
curl -u admin:password -H "Host: admin.local" http://localhost
```

## 🧪 テストスクリプト

### 自動テストの実行
```bash
# 全テストの実行
./test-nginx-ingress.sh

# 個別テストの実行
./test-nginx-ingress.sh basic
./test-nginx-ingress.sh routing
./test-nginx-ingress.sh ssl
./test-nginx-ingress.sh auth
```

## 🔍 トラブルシューティング

### よくある問題

**1. Ingressにアクセスできない**
```bash
# NGINX Ingress Controllerの状態確認
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/nginx-ingress-controller

# サービスエンドポイントの確認
kubectl get endpoints -n webapp
```

**2. SSL証明書が取得できない**
```bash
# cert-managerの状態確認
kubectl get pods -n cert-manager
kubectl get certificaterequests -A
kubectl describe certificate webapp-tls -n webapp
```

**3. 認証が機能しない**
```bash
# シークレットの確認
kubectl get secret basic-auth -n webapp
kubectl describe secret basic-auth -n webapp
```

## 📊 AWS ECSとの比較

### ALB vs NGINX Ingress
| 機能 | AWS ALB | NGINX Ingress |
|------|---------|---------------|
| **設定方法** | AWS Console/CLI | Kubernetes YAML |
| **ルール数** | 100ルール/リスナー | 制限なし |
| **パスルーティング** | 基本的 | 正規表現対応 |
| **SSL終端** | ACM統合 | cert-manager |
| **認証** | Cognito/OIDC | 多様な認証方式 |
| **監視** | CloudWatch | Prometheus |

### 設定例の比較

**AWS ALB (ECS)**:
```json
{
  "Type": "AWS::ElasticLoadBalancingV2::ListenerRule",
  "Properties": {
    "Actions": [{
      "Type": "forward",
      "TargetGroupArn": "arn:aws:elasticloadbalancing:..."
    }],
    "Conditions": [{
      "Field": "path-pattern",
      "Values": ["/api/*"]
    }],
    "ListenerArn": "arn:aws:elasticloadbalancing:..."
  }
}
```

**NGINX Ingress (Kubernetes)**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
```

## 🎓 学習のポイント

### 重要な概念
1. **Ingressリソース**: ルーティングルールの定義
2. **IngressController**: 実際のプロキシ実装
3. **アノテーション**: 機能の詳細設定
4. **BackendService**: トラフィックの転送先

### ベストプラクティス
1. **名前空間の分離**: 環境ごとにnamespaceを分ける
2. **リソース制限**: CPU/メモリ制限の設定
3. **監視**: メトリクスとログの収集
4. **セキュリティ**: 最小権限の原則

## 📝 演習後の確認事項

- [ ] 基本的なIngressが正常に動作する
- [ ] パス/ホストベースルーティングが理解できた
- [ ] SSL/TLS証明書の自動取得ができる
- [ ] 基本認証が設定できる
- [ ] NGINX設定のカスタマイズ方法を理解した

## 🚀 次のステップ

Phase 1が完了したら、以下に進んでください：
- **Phase 2**: Traefik演習 - 動的設定とサービス発見
- **Phase 3**: Istio演習 - Service Meshによる高度なトラフィック管理

---

**注意**: 本演習は学習用途です。本番環境では適切なセキュリティ設定を行ってください。
