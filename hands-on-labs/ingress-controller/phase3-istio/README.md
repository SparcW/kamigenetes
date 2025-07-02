# Phase 3: Istio Service Mesh - Gateway/VirtualService 演習

## 🎯 学習目標
- Istio Service Meshの基本概念とアーキテクチャを理解する
- Gateway/VirtualServiceによる高度なトラフィック管理を実装する
- カナリアデプロイメントとA/Bテストを実践する
- mTLSとセキュリティポリシーを設定する
- 分散トレーシングと可観測性を体験する

## 📋 演習内容

### 1. Istio基本セットアップ
- Istio Control Planeのインストール
- Sidecar Proxyの自動注入設定
- Istio Gatewayの基本設定

### 2. Gateway/VirtualServiceによるトラフィック管理
- 基本的なルーティング設定
- ヘッダーベースルーティング
- 重み付きトラフィック分散

### 3. 高度なトラフィック管理
- フォルトインジェクション
- サーキットブレーカー
- リトライとタイムアウト設定

### 4. セキュリティ機能
- mTLS有効化
- AuthorizationPolicyによる認可
- 外部サービス連携

### 5. 可観測性
- 分散トレーシング（Jaeger）
- メトリクス収集（Prometheus）
- ダッシュボード（Grafana）

## 🛠️ 前提条件

### Istioのインストール
```bash
# Istioctl のダウンロード
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Istio のインストール
istioctl install --set values.defaultRevision=default -y

# アドオンのインストール
kubectl apply -f samples/addons/
```

### 名前空間へのSidecar注入有効化
```bash
# webapp名前空間にIstio注入ラベルを追加
kubectl label namespace webapp istio-injection=enabled

# 既存のPodを再作成
kubectl rollout restart deployment -n webapp
```

## 📚 演習ステップ

### Step 1: Istio基本セットアップ
```bash
# Istioの状態確認
istioctl version
kubectl get pods -n istio-system

# Gateway/VirtualServiceの適用
kubectl apply -f 01-istio-setup.yaml
```

### Step 2: 基本的なトラフィック管理
```bash
# Gateway/VirtualServiceの適用
kubectl apply -f 02-gateway-virtualservice.yaml

# 設定の確認
istioctl analyze
kubectl get gateway,virtualservice -A
```

### Step 3: 高度なトラフィック管理
```bash
# トラフィック管理設定の適用
kubectl apply -f 03-traffic-management.yaml

# カナリアデプロイメントのテスト
kubectl apply -f 03-canary-deployment.yaml
```

### Step 4: セキュリティ設定
```bash
# mTLSとセキュリティポリシーの適用
kubectl apply -f 04-security.yaml

# mTLSの確認
istioctl authn tls-check webapp-v1-xxx.webapp
```

### Step 5: 可観測性の確認
```bash
# Jaeger UIアクセス
istioctl dashboard jaeger

# Grafana UIアクセス  
istioctl dashboard grafana

# Kiali UIアクセス
istioctl dashboard kiali
```

## 🧪 テストスクリプト

### 自動テストの実行
```bash
# 全テストの実行
./test-istio.sh

# 個別テストの実行
./test-istio.sh gateway
./test-istio.sh traffic
./test-istio.sh security
./test-istio.sh observability
```

## 🔍 Istio vs 従来のIngressController

### 機能比較

| 機能 | NGINX Ingress | Istio Gateway/VirtualService |
|------|---------------|------------------------------|
| **設定の複雑さ** | シンプル | 複雑だが非常に柔軟 |
| **トラフィック分割** | 基本的（重み付け） | 高度（ヘッダー、ユーザー等） |
| **フォルトインジェクション** | なし | 遅延・エラー注入 |
| **サーキットブレーカー** | 限定的 | 高度な設定 |
| **分散トレーシング** | 外部設定必要 | 自動収集 |
| **mTLS** | 手動設定 | 自動・透明 |
| **可観測性** | 限定的 | 包括的 |
| **学習コスト** | 低-中 | 高 |

### 設定例の比較

**NGINX Ingress（従来）**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: app-canary
            port:
              number: 80
```

**Istio Gateway/VirtualService**:
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app-vs
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: app-canary
        port:
          number: 80
  - route:
    - destination:
        host: app-stable
        port:
          number: 80
      weight: 90
    - destination:
        host: app-canary
        port:
          number: 80
      weight: 10
    fault:
      delay:
        percentage:
          value: 1.0
        fixedDelay: 5s
```

## 📊 AWS ECSとの比較

### ECS Service Connect vs Istio Service Mesh

| 項目 | ECS Service Connect | Istio Service Mesh |
|------|-------------------|-------------------|
| **サービス発見** | AWS Cloud Map | Kubernetes DNS + Istio |
| **負荷分散** | ELB統合 | Envoy Proxy |
| **暗号化** | TLS設定必要 | 自動mTLS |
| **可観測性** | CloudWatch | Prometheus + Jaeger + Grafana |
| **トラフィック管理** | 基本的 | 高度（重み、ヘッダー等） |
| **ポリシー管理** | IAM + SG | Istio AuthorizationPolicy |
| **学習コスト** | 低-中 | 高 |
| **ベンダーロックイン** | AWS依存 | クラウド非依存 |

## 🎓 学習のポイント

### Istioの主要コンポーネント
1. **Istiod**: コントロールプレーン（設定管理、証明書発行）
2. **Envoy Proxy**: データプレーン（サイドカー）
3. **Gateway**: エッジプロキシ（外部トラフィック受信）
4. **VirtualService**: ルーティングルール定義
5. **DestinationRule**: 負荷分散・接続プール設定

### Service Meshの利点
1. **透明性**: アプリケーションコードの変更不要
2. **統一性**: 全サービスで一貫した機能
3. **可観測性**: 自動的なメトリクス・トレース収集
4. **セキュリティ**: 自動mTLSと細かいポリシー制御

## 🚨 注意事項

### パフォーマンスへの影響
- Sidecar ProxyによるCPU/メモリオーバーヘッド
- ネットワークレイテンシーの増加（通常1-3ms）
- 適切なリソース設定が重要

### 運用上の考慮事項
- Istio自体の監視と運用が必要
- アップグレード戦略の計画
- トラブルシューティングの複雑性

## 📝 演習後の確認事項

- [ ] Istio Gateway/VirtualServiceでトラフィックルーティングができる
- [ ] カナリアデプロイメントとA/Bテストが実装できる
- [ ] mTLSによる自動暗号化が有効になっている
- [ ] 分散トレーシングでリクエストフローが確認できる
- [ ] メトリクスダッシュボードでサービス状態が監視できる
- [ ] フォルトインジェクションによる障害テストができる

## 🚀 次のステップ

Phase 3が完了したら、以下に進んでください：
- **Phase 4**: AWS Load Balancer Controller演習
- **Phase 5**: 高度な機能と運用演習
- **実際のマイクロサービスアプリケーションでのIstio適用**

---

**注意**: Istioは本格的なService Meshです。本番環境導入前に十分なテストと運用体制の整備が必要です。
