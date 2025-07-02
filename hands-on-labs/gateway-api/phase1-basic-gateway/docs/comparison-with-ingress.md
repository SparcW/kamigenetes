# IngressとGateway APIの比較

このドキュメントでは、従来のKubernetes IngressとGateway APIの違いを詳しく説明し、移行の際のポイントを示します。

## 概要比較

| 項目 | Ingress | Gateway API |
|------|---------|-------------|
| **APIバージョン** | networking.k8s.io/v1 | gateway.networking.k8s.io/v1beta1 |
| **役割分離** | なし | あり（GatewayClass/Gateway/Route） |
| **プロトコルサポート** | HTTP/HTTPS | HTTP/HTTPS/TCP/UDP/TLS |
| **設定方法** | アノテーション依存 | ネイティブフィールド |
| **表現力** | 基本的 | 高度 |
| **ポータビリティ** | 実装依存 | 標準化 |

## 具体的な移行例

### 基本的なIngress

**従来のIngress**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - webapp.example.com
    secretName: webapp-tls
  rules:
  - host: webapp.example.com
    http:
      paths:
      - path: /api(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

**対応するGateway API**:
```yaml
# 1. GatewayClass（インフラ管理者が管理）
apiVersion: gateway.networking.k8s.io/v1beta1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: k8s.nginx.org/nginx-gateway-controller

---
# 2. Gateway（インフラ管理者が管理）
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: webapp-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    port: 80
    protocol: HTTP
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - name: webapp-tls
    hostname: webapp.example.com

---
# 3. HTTPRoute（アプリケーション開発者が管理）
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: webapp-routes
spec:
  parentRefs:
  - name: webapp-gateway
  hostnames:
  - webapp.example.com
  rules:
  # APIルート
  - matches:
    - path:
        type: PathPrefix
        value: /api
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /
    backendRefs:
    - name: api-service
      port: 80
  # フロントエンドルート
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: frontend-service
      port: 80
```

## 主な違いと利点

### 1. 役割分離の明確化

**Ingress**:
- 単一リソースにすべての設定が集約
- インフラとアプリケーション設定が混在

**Gateway API**:
- **GatewayClass**: インフラストラクチャの定義
- **Gateway**: ネットワーク入り口の設定
- **HTTPRoute**: アプリケーション固有のルーティング

### 2. アノテーションからネイティブフィールドへ

**Ingress（アノテーション依存）**:
```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /$2
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
  nginx.ingress.kubernetes.io/rate-limit: "100"
  nginx.ingress.kubernetes.io/auth-type: basic
```

**Gateway API（ネイティブフィールド）**:
```yaml
filters:
- type: URLRewrite
  urlRewrite:
    path:
      type: ReplacePrefixMatch
      replacePrefixMatch: /
- type: RequestHeaderModifier
  requestHeaderModifier:
    add:
    - name: x-forwarded-proto
      value: https
```

### 3. より柔軟なルーティング条件

**Gateway API の高度なマッチング**:
```yaml
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api/v1
    headers:
    - name: x-api-version
      value: v1
    queryParams:
    - name: beta
      value: "true"
    method: POST
  backendRefs:
  - name: api-v1-beta-service
    port: 80
```

### 4. 重み付けトラフィック分割

**Gateway API でのカナリアデプロイメント**:
```yaml
backendRefs:
- name: stable-service
  port: 80
  weight: 90
- name: canary-service
  port: 80
  weight: 10
```

## 移行戦略

### 段階的移行アプローチ

#### Phase 1: 並行運用
```yaml
# 既存のIngressを維持
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: legacy-webapp-ingress
spec:
  rules:
  - host: webapp-legacy.example.com  # 別ホスト名
    # ... existing configuration

---
# 新しいGateway APIをテスト環境で導入
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: test-gateway
spec:
  listeners:
  - name: https
    hostname: webapp-test.example.com  # テスト用ホスト名
```

#### Phase 2: トラフィック分割
```yaml
# 新機能はGateway API経由
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: new-features-route
spec:
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api/v2  # 新APIバージョン
    backendRefs:
    - name: new-api-service
      port: 80
```

#### Phase 3: 完全移行
```yaml
# すべてのトラフィックをGateway API経由に変更
# 古いIngressを削除
```

## よくある移行課題と解決策

### 1. アノテーション機能の移行

**課題**: Ingressアノテーションの機能をGateway APIで実現

**解決策**:
```yaml
# Rate Limiting
filters:
- type: ExtensionRef
  extensionRef:
    group: networking.example.com
    kind: RateLimitPolicy
    name: api-rate-limit

# Authentication
filters:
- type: ExtensionRef
  extensionRef:
    group: security.example.com
    kind: AuthPolicy
    name: basic-auth
```

### 2. 複雑なパスルーティング

**課題**: 正規表現パスの移行

**解決策**:
```yaml
# より明確なパスマッチング
rules:
- matches:
  - path:
      type: PathPrefix
      value: /api/v1/users/
  - path:
      type: RegularExpression
      value: "^/api/v1/users/[0-9]+/profile$"
```

### 3. 名前空間間リソース参照

**課題**: 異なる名前空間のServiceへの参照

**解決策**:
```yaml
# ReferenceGrantを使用
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: api-access
  namespace: api-system
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: frontend
  to:
  - group: ""
    kind: Service
```

## ベストプラクティス

### 1. 段階的導入
- 既存のIngressを急に削除しない
- テスト環境で十分な検証を行う
- トラフィック分割で段階的に移行

### 2. モニタリング強化
```yaml
# メトリクス収集の設定
filters:
- type: ExtensionRef
  extensionRef:
    group: observability.example.com
    kind: MetricsPolicy
    name: detailed-metrics
```

### 3. セキュリティ考慮
```yaml
# 最小権限の原則
allowedRoutes:
  namespaces:
    from: Selector
    selector:
      matchLabels:
        gateway.example.com/allowed: "true"
```

### 4. ドキュメント化
- 移行計画の文書化
- 新旧の設定例の準備
- チーム向けトレーニング資料の作成

## まとめ

Gateway APIは、従来のIngressの制限を克服し、より柔軟で表現力豊かなトラフィック管理を提供します。段階的な移行アプローチを採用することで、リスクを最小限に抑えながらGateway APIの利点を活用できます。

### 移行のタイミング
- **新規プロジェクト**: Gateway APIを最初から採用
- **既存プロジェクト**: 段階的移行でリスク最小化
- **複雑なルーティング要件**: Gateway APIの高度な機能を活用
