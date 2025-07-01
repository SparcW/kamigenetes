# Kubernetes Gateway API包括ガイド

> **重要**: Gateway APIは、KubernetesのIngressリソースの次世代として開発された新しい標準です。より柔軟で表現力豊かなAPI設計により、L4-L7ネットワーキング機能を提供します。新規プロジェクトではGateway APIの採用を推奨します。

## 目次
1. [Gateway APIの基本概念](#gateway-apiの基本概念)
2. [IngressからGateway APIへの進化](#ingressからgateway-apiへの進化)
3. [AWS ECSとの比較](#aws-ecsとの比較)
4. [Gateway APIリソース階層](#gateway-apiリソース階層)
5. [HTTPRoute - L7 HTTPルーティング](#httproute---l7-httpルーティング)
6. [TCPRoute - L4 TCPルーティング](#tcproute---l4-tcpルーティング)
7. [UDPRoute - L4 UDPルーティング](#udproute---l4-udpルーティング)
8. [TLSRoute - TLS終端とSNIルーティング](#tlsroute---tls終端とsniルーティング)
9. [AWS Gateway API Controller](#aws-gateway-api-controller)
10. [移行戦略とベストプラクティス](#移行戦略とベストプラクティス)
11. [監視と可観測性](#監視と可観測性)
12. [トラブルシューティング](#トラブルシューティング)

## Gateway APIの基本概念

### Gateway APIとは

Gateway APIは、Kubernetes上でL4-L7ネットワーキング機能を提供する次世代のAPIです。従来のIngressリソースの制限を克服し、より柔軟で表現力豊かなトラフィック管理を実現します。

**Gateway APIの主な特徴**:
- **役割分離**: インフラ管理者とアプリケーション開発者の責務を明確に分離
- **表現力**: 高度なルーティングルールとトラフィック管理
- **拡張性**: カスタムリソースによる機能拡張
- **ポータビリティ**: 複数のIngressControllerで標準化されたAPI
- **型安全性**: 強力な型システムによる設定ミスの防止

### リソース階層の概要

```yaml
# Gateway API リソース階層
GatewayClass      # インフラ管理者が管理
    ↓
Gateway           # インフラ管理者が管理  
    ↓
HTTPRoute         # アプリケーション開発者が管理
TCPRoute
UDPRoute
TLSRoute
```

## IngressからGateway APIへの進化

### 従来のIngressの制限

**Ingressの課題**:
- **表現力の不足**: 複雑なルーティングルールの記述が困難
- **アノテーション依存**: 実装固有のアノテーションが必要
- **役割の混在**: インフラとアプリケーションの設定が混在
- **プロトコル制限**: HTTP/HTTPSのみサポート

### Gateway APIによる改善

| 項目 | Ingress | Gateway API |
|------|---------|-------------|
| **プロトコルサポート** | HTTP/HTTPS | HTTP/HTTPS/TCP/UDP/TLS |
| **ルーティング表現力** | 基本的 | 高度（ヘッダー、クエリ、重み等） |
| **役割分離** | なし | 明確（GatewayClass/Gateway/Route） |
| **型安全性** | 弱い | 強い |
| **拡張性** | アノテーション | CRD |
| **標準化** | 実装依存 | 標準化されたAPI |

### 移行マッピング例

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
```

**対応するGateway API**:
```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: webapp-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - name: webapp-tls
    hostname: webapp.example.com
---
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
```

## AWS ECSとの比較

### AWS Application Load Balancer vs Gateway API

| 機能 | AWS ALB + ECS | Kubernetes Gateway API |
|------|---------------|------------------------|
| **プロトコルサポート** | HTTP/HTTPS/gRPC | HTTP/HTTPS/TCP/UDP/TLS |
| **ルーティング** | パス/ホスト/ヘッダー | 高度なマッチング条件 |
| **重み付けルーティング** | ターゲットグループ | HTTPRoute.spec.rules[].backendRefs[].weight |
| **ヘルスチェック** | ALB設定 | Service/Endpoint + Readiness Probe |
| **SSL終端** | ACM証明書 | cert-manager + Gateway TLS |
| **認証** | AWS Cognito | 外部認証プロバイダー統合 |
| **監視** | CloudWatch | Prometheus + Grafana |
| **コスト** | ALB時間課金 + データ転送 | クラスターリソース使用量 |
| **可搬性** | AWS専用 | マルチクラウド |

### ECS Task DefinitionからKubernetes Deploymentへの移行

**ECS Task Definition例**:
```json
{
  "family": "webapp-task",
  "networkMode": "awsvpc",
  "requiresAttributes": [
    {
      "name": "com.amazonaws.ecs.capability.docker-remote-api.1.18"
    }
  ],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "webapp",
      "image": "webapp:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://..."
        }
      ]
    }
  ]
}
```

**対応するKubernetes + Gateway API**:
```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: webapp:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "250m"
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 8080
---
# Gateway
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: webapp-gateway
spec:
  gatewayClassName: aws-load-balancer-controller
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
---
# HTTPRoute
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: webapp-route
spec:
  parentRefs:
  - name: webapp-gateway
  rules:
  - backendRefs:
    - name: webapp-service
      port: 80
```

## Gateway APIリソース階層

### GatewayClass - インフラストラクチャ定義

GatewayClassは、Gateway Controllerの実装を定義するクラスターレベルのリソースです。

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: k8s.nginx.org/nginx-gateway-controller
  parametersRef:
    group: k8s.nginx.org
    kind: NginxGateway
    name: nginx-gateway-config
  description: "NGINX Gateway Controller for production workloads"
---
# NGINX設定パラメータ
apiVersion: k8s.nginx.org/v1alpha1
kind: NginxGateway
metadata:
  name: nginx-gateway-config
spec:
  logging:
    level: info
  observability:
    tracing:
      strategy: jaeger
      endpoint: "http://jaeger-collector:14268/api/traces"
```

### Gateway - ネットワーク入り口定義

Gatewayは、クラスター外部からのトラフィックを受け入れるネットワークエンドポイントを定義します。

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: production-gateway
  namespace: gateway-system
spec:
  gatewayClassName: nginx
  listeners:
  # HTTP リスナー (HTTPSリダイレクト用)
  - name: http
    port: 80
    protocol: HTTP
    allowedRoutes:
      namespaces:
        from: All
  # HTTPS リスナー
  - name: https
    port: 443
    protocol: HTTPS
    hostname: "*.example.com"
    tls:
      mode: Terminate
      certificateRefs:
      - name: wildcard-example-com-tls
        namespace: cert-manager
    allowedRoutes:
      namespaces:
        from: All
  # API専用リスナー
  - name: api-https
    port: 8443
    protocol: HTTPS
    hostname: api.example.com
    tls:
      mode: Terminate
      certificateRefs:
      - name: api-example-com-tls
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            gateway.networking.k8s.io/ns-api: "true"
  addresses:
  - type: IPAddress
    value: "203.0.113.1"
```

## HTTPRoute - L7 HTTPルーティング

### 基本的なHTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: webapp-routes
  namespace: webapp
spec:
  parentRefs:
  - name: production-gateway
    namespace: gateway-system
    sectionName: https
  hostnames:
  - webapp.example.com
  rules:
  # フロントエンドルート
  - matches:
    - path:
        type: PathPrefix
        value: /
      headers:
      - name: accept
        value: text/html
    backendRefs:
    - name: frontend-service
      port: 80
      weight: 100
  # APIルート
  - matches:
    - path:
        type: PathPrefix
        value: /api/v1
    backendRefs:
    - name: api-v1-service
      port: 80
      weight: 90
    - name: api-v1-canary-service
      port: 80
      weight: 10
  # APIv2ルート（ヘッダーベース）
  - matches:
    - path:
        type: PathPrefix
        value: /api
      headers:
      - name: x-api-version
        value: v2
    backendRefs:
    - name: api-v2-service
      port: 80
```

### 高度なHTTPRouteルーティング

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: advanced-routing
  namespace: webapp
spec:
  parentRefs:
  - name: production-gateway
    namespace: gateway-system
  hostnames:
  - api.example.com
  rules:
  # クエリパラメータベースルーティング
  - matches:
    - path:
        type: PathPrefix
        value: /search
      queryParams:
      - name: version
        value: beta
    backendRefs:
    - name: search-beta-service
      port: 80
  # メソッドベースルーティング
  - matches:
    - path:
        type: Exact
        value: /users
      method: POST
    backendRefs:
    - name: user-write-service
      port: 80
  - matches:
    - path:
        type: PathPrefix
        value: /users
      method: GET
    backendRefs:
    - name: user-read-service
      port: 80
  # リクエスト変換
  - matches:
    - path:
        type: PathPrefix
        value: /legacy-api
    filters:
    - type: URLRewrite
      urlRewrite:
        path:
          type: ReplacePrefixMatch
          replacePrefixMatch: /api/v1
    - type: RequestHeaderModifier
      requestHeaderModifier:
        add:
        - name: x-legacy-api
          value: "true"
        remove:
        - "x-debug"
    backendRefs:
    - name: modern-api-service
      port: 80
  # レスポンス変換
  - matches:
    - path:
        type: PathPrefix
        value: /api/internal
    filters:
    - type: ResponseHeaderModifier
      responseHeaderModifier:
        add:
        - name: x-internal-api
          value: "true"
        remove:
        - "server"
    backendRefs:
    - name: internal-api-service
      port: 80
```

### A/Bテストとカナリアデプロイメント

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: ab-testing-route
  namespace: webapp
spec:
  parentRefs:
  - name: production-gateway
    namespace: gateway-system
  hostnames:
  - webapp.example.com
  rules:
  # カナリア用（特定ヘッダー）
  - matches:
    - path:
        type: PathPrefix
        value: /
      headers:
      - name: x-canary
        value: "true"
    backendRefs:
    - name: webapp-canary-service
      port: 80
  # A/Bテスト（Cookieベース）
  - matches:
    - path:
        type: PathPrefix
        value: /
      headers:
      - name: cookie
        value: ".*ab_test=variant_b.*"
        type: RegularExpression
    backendRefs:
    - name: webapp-variant-b-service
      port: 80
  # 通常トラフィック（重み付け）
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: webapp-stable-service
      port: 80
      weight: 95
    - name: webapp-canary-service
      port: 80
      weight: 5
```

## TCPRoute - L4 TCPルーティング

### 基本的なTCPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TCPRoute
metadata:
  name: database-tcp-route
  namespace: database
spec:
  parentRefs:
  - name: tcp-gateway
    namespace: gateway-system
    sectionName: postgresql
  rules:
  - backendRefs:
    - name: postgresql-primary-service
      port: 5432
      weight: 100
---
# TCP専用Gateway
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: tcp-gateway
  namespace: gateway-system
spec:
  gatewayClassName: nginx
  listeners:
  - name: postgresql
    port: 5432
    protocol: TCP
    allowedRoutes:
      kinds:
      - kind: TCPRoute
      namespaces:
        from: Selector
        selector:
          matchLabels:
            database.example.com/allowed: "true"
  - name: redis
    port: 6379
    protocol: TCP
    allowedRoutes:
      kinds:
      - kind: TCPRoute
      namespaces:
        from: Same
```

### 高可用性TCPルーティング

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TCPRoute
metadata:
  name: ha-database-route
  namespace: database
spec:
  parentRefs:
  - name: tcp-gateway
    namespace: gateway-system
    sectionName: postgresql
  rules:
  # プライマリ・セカンダリ構成
  - backendRefs:
    - name: postgresql-primary-service
      port: 5432
      weight: 90
    - name: postgresql-secondary-service
      port: 5432
      weight: 10
---
# Redis Cluster TCPRoute
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TCPRoute
metadata:
  name: redis-cluster-route
  namespace: cache
spec:
  parentRefs:
  - name: tcp-gateway
    namespace: gateway-system
    sectionName: redis
  rules:
  - backendRefs:
    - name: redis-cluster-node-1-service
      port: 6379
      weight: 34
    - name: redis-cluster-node-2-service
      port: 6379
      weight: 33
    - name: redis-cluster-node-3-service
      port: 6379
      weight: 33
```

## UDPRoute - L4 UDPルーティング

### 基本的なUDPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: UDPRoute
metadata:
  name: dns-udp-route
  namespace: dns-system
spec:
  parentRefs:
  - name: udp-gateway
    namespace: gateway-system
    sectionName: dns
  rules:
  - backendRefs:
    - name: coredns-service
      port: 53
---
# UDP Gateway設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: udp-gateway
  namespace: gateway-system
spec:
  gatewayClassName: nginx
  listeners:
  - name: dns
    port: 53
    protocol: UDP
    allowedRoutes:
      kinds:
      - kind: UDPRoute
      namespaces:
        from: Selector
        selector:
          matchLabels:
            network.example.com/dns: "true"
  - name: syslog
    port: 514
    protocol: UDP
    allowedRoutes:
      kinds:
      - kind: UDPRoute
```

### 高負荷UDPサービス

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: UDPRoute
metadata:
  name: game-server-route
  namespace: gaming
spec:
  parentRefs:
  - name: udp-gateway
    namespace: gateway-system
    sectionName: game-udp
  rules:
  # ゲームサーバークラスター
  - backendRefs:
    - name: game-server-1-service
      port: 7000
      weight: 25
    - name: game-server-2-service
      port: 7000
      weight: 25
    - name: game-server-3-service
      port: 7000
      weight: 25
    - name: game-server-4-service
      port: 7000
      weight: 25
---
# Syslog集約
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: UDPRoute
metadata:
  name: syslog-route
  namespace: logging
spec:
  parentRefs:
  - name: udp-gateway
    namespace: gateway-system
    sectionName: syslog
  rules:
  - backendRefs:
    - name: fluentd-aggregator-service
      port: 514
```

## TLSRoute - TLS終端とSNIルーティング

### 基本的なTLSRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TLSRoute
metadata:
  name: secure-app-route
  namespace: secure-apps
spec:
  parentRefs:
  - name: tls-gateway
    namespace: gateway-system
    sectionName: secure-tls
  hostnames:
  - secure-app.example.com
  rules:
  - backendRefs:
    - name: secure-app-service
      port: 443
---
# TLS Passthrough Gateway
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: tls-gateway
  namespace: gateway-system
spec:
  gatewayClassName: nginx
  listeners:
  - name: secure-tls
    port: 443
    protocol: TLS
    tls:
      mode: Passthrough
    allowedRoutes:
      kinds:
      - kind: TLSRoute
      namespaces:
        from: All
```

### SNIベースルーティング

```yaml
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TLSRoute
metadata:
  name: multi-tenant-tls-route
  namespace: multi-tenant
spec:
  parentRefs:
  - name: tls-gateway
    namespace: gateway-system
  hostnames:
  - tenant1.example.com
  rules:
  - backendRefs:
    - name: tenant1-service
      port: 443
---
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: TLSRoute
metadata:
  name: tenant2-tls-route
  namespace: multi-tenant
spec:
  parentRefs:
  - name: tls-gateway
    namespace: gateway-system
  hostnames:
  - tenant2.example.com
  rules:
  - backendRefs:
    - name: tenant2-service
      port: 443
---
# 証明書管理
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: multi-cert-gateway
  namespace: gateway-system
spec:
  gatewayClassName: nginx
  listeners:
  # 各テナント専用TLS
  - name: tenant1-tls
    port: 8443
    protocol: HTTPS
    hostname: tenant1.example.com
    tls:
      certificateRefs:
      - name: tenant1-tls-cert
        namespace: tenant1
  - name: tenant2-tls
    port: 9443
    protocol: HTTPS
    hostname: tenant2.example.com
    tls:
      certificateRefs:
      - name: tenant2-tls-cert
        namespace: tenant2
```

## AWS Gateway API Controller

### AWS Load Balancer Controllerとの統合

```yaml
# AWS Gateway Class
apiVersion: gateway.networking.k8s.io/v1beta1
kind: GatewayClass
metadata:
  name: aws-application-load-balancer
spec:
  controllerName: application-networking.k8s.aws/aws-gateway-controller
  parametersRef:
    group: application-networking.k8s.aws
    kind: ApplicationLoadBalancer
    name: aws-load-balancer-config
---
# AWS設定パラメータ
apiVersion: application-networking.k8s.aws/v1alpha1
kind: ApplicationLoadBalancer
metadata:
  name: aws-load-balancer-config
spec:
  scheme: internet-facing
  ipAddressType: ipv4
  securityGroups:
  - sg-12345678
  subnets:
  - subnet-12345678
  - subnet-87654321
  tags:
    Environment: production
    Project: webapp
```

### AWS特化Gateway設定

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: aws-production-gateway
  namespace: gateway-system
  annotations:
    application-networking.k8s.aws/load-balancer-attributes: |
      {
        "deletion_protection.enabled": "true",
        "idle_timeout.timeout_seconds": "60",
        "routing.http2.enabled": "true"
      }
spec:
  gatewayClassName: aws-application-load-balancer
  listeners:
  - name: http
    port: 80
    protocol: HTTP
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - name: aws-acm-certificate
        group: application-networking.k8s.aws
        kind: AWSCertificate
  addresses:
  - type: NamedAddress
    value: production-alb
---
# AWS ACM証明書参照
apiVersion: application-networking.k8s.aws/v1alpha1
kind: AWSCertificate
metadata:
  name: aws-acm-certificate
spec:
  certificateArn: arn:aws:acm:us-west-2:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

### AWS統合HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: aws-webapp-route
  namespace: webapp
  annotations:
    application-networking.k8s.aws/target-group-attributes: |
      {
        "deregistration_delay.timeout_seconds": "30",
        "healthy_threshold_count": "2",
        "health_check.interval_seconds": "15",
        "health_check.path": "/health",
        "health_check.protocol": "HTTP",
        "health_check.timeout_seconds": "5",
        "unhealthy_threshold_count": "3"
      }
spec:
  parentRefs:
  - name: aws-production-gateway
    namespace: gateway-system
  hostnames:
  - webapp.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-service
      port: 80
      weight: 100
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: frontend-service
      port: 80
      weight: 100
```

## 移行戦略とベストプラクティス

### IngressからGateway APIへの段階的移行

**Phase 1: 並行運用**
```yaml
# 既存Ingress（維持）
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: legacy-webapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: webapp-legacy.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp-service
            port:
              number: 80
---
# 新しいGateway API（テスト用）
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: test-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    hostname: webapp-test.example.com
    tls:
      certificateRefs:
      - name: webapp-test-tls
---
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: test-webapp-route
spec:
  parentRefs:
  - name: test-gateway
  hostnames:
  - webapp-test.example.com
  rules:
  - backendRefs:
    - name: webapp-service
      port: 80
```

**Phase 2: トラフィック分割**
```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: migration-route
spec:
  parentRefs:
  - name: production-gateway
  hostnames:
  - webapp.example.com
  rules:
  # 新機能は Gateway API経由
  - matches:
    - path:
        type: PathPrefix
        value: /api/v2
    backendRefs:
    - name: api-v2-service
      port: 80
  # 既存機能は一時的にIngress経由へリダイレクト
  - matches:
    - path:
        type: PathPrefix
        value: /
    filters:
    - type: RequestRedirect
      requestRedirect:
        hostname: webapp-legacy.example.com
        statusCode: 302
```

**Phase 3: 完全移行**
```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: production-webapp-route
spec:
  parentRefs:
  - name: production-gateway
  hostnames:
  - webapp.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-service
      port: 80
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: frontend-service
      port: 80
```

### ベストプラクティス

**1. 役割分離の実践**
```yaml
# インフラ管理者のGatewayClass設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: GatewayClass
metadata:
  name: production-nginx
spec:
  controllerName: k8s.nginx.org/nginx-gateway-controller
  parametersRef:
    group: k8s.nginx.org
    kind: NginxGateway
    name: production-config
---
# インフラ管理者のGateway設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: gateway-system
spec:
  gatewayClassName: production-nginx
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - name: wildcard-cert
    allowedRoutes:
      namespaces:
        from: All
---
# アプリケーション開発者のHTTPRoute設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: my-app-route
  namespace: my-app
spec:
  parentRefs:
  - name: shared-gateway
    namespace: gateway-system
  hostnames:
  - myapp.example.com
  rules:
  - backendRefs:
    - name: my-app-service
      port: 80
```

**2. セキュリティのベストプラクティス**
```yaml
# ReferenceGrant - 名前空間間のリソース参照許可
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: gateway-to-app-services
  namespace: my-app
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: my-app
  to:
  - group: ""
    kind: Service
---
# 証明書の名前空間間参照許可
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: gateway-to-certs
  namespace: cert-manager
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: Gateway
    namespace: gateway-system
  to:
  - group: ""
    kind: Secret
```

**3. 可観測性の設定**
```yaml
# Gateway用ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: gateway-metrics
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: nginx-gateway
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
---
# HTTPRoute用PrometheusRule
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: httproute-alerts
  namespace: monitoring
spec:
  groups:
  - name: httproute.rules
    rules:
    - alert: HTTPRouteHighLatency
      expr: histogram_quantile(0.95, sum(rate(gateway_api_httproute_request_duration_seconds_bucket[5m])) by (le, httproute, namespace)) > 1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High latency on HTTPRoute {{ $labels.httproute }} in namespace {{ $labels.namespace }}"
```

## 監視と可観測性

### Gateway APIメトリクス

```yaml
# Gateway Controllerメトリクス設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-controller-config
  namespace: gateway-system
data:
  config.yaml: |
    observability:
      metrics:
        enabled: true
        port: 8080
        path: /metrics
      tracing:
        enabled: true
        collector: "http://jaeger-collector:14268/api/traces"
      logging:
        level: info
        format: json
---
# Grafanaダッシュボード設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-api-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  gateway-api-dashboard.json: |
    {
      "dashboard": {
        "title": "Gateway API Dashboard",
        "panels": [
          {
            "title": "Gateway Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(gateway_api_gateway_requests_total[5m])) by (gateway, namespace)"
              }
            ]
          },
          {
            "title": "HTTPRoute Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, sum(rate(gateway_api_httproute_request_duration_seconds_bucket[5m])) by (le, httproute))"
              }
            ]
          }
        ]
      }
    }
```

### 分散トレーシング

```yaml
# Jaeger設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: jaeger-config
  namespace: tracing
data:
  config.yaml: |
    receivers:
      jaeger:
        protocols:
          grpc:
            endpoint: 0.0.0.0:14250
          thrift_http:
            endpoint: 0.0.0.0:14268
    processors:
      batch:
    exporters:
      logging:
        loglevel: debug
    service:
      pipelines:
        traces:
          receivers: [jaeger]
          processors: [batch]
          exporters: [logging]
---
# Gateway API トレーシング設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: traced-route
  annotations:
    gateway.networking.k8s.io/tracing-enabled: "true"
    gateway.networking.k8s.io/tracing-sampler: "1.0"
spec:
  parentRefs:
  - name: production-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    filters:
    - type: RequestHeaderModifier
      requestHeaderModifier:
        add:
        - name: x-trace-id
          value: "${request_id}"
    backendRefs:
    - name: api-service
      port: 80
```

## トラブルシューティング

### 一般的な問題と解決策

**1. Gateway APIリソースが作成されない**

```bash
# Gateway API CRDの確認
kubectl get crd | grep gateway.networking.k8s.io

# Gateway Controller の状態確認
kubectl get pods -n gateway-system
kubectl logs -n gateway-system deployment/gateway-controller

# GatewayClass の状態確認
kubectl get gatewayclass
kubectl describe gatewayclass <gateway-class-name>
```

**2. HTTPRouteがトラフィックを受信しない**

```bash
# HTTPRoute の状態確認
kubectl get httproute -A
kubectl describe httproute <httproute-name> -n <namespace>

# Gateway の状態確認
kubectl describe gateway <gateway-name> -n <namespace>

# Service と Endpoint の確認
kubectl get services -n <namespace>
kubectl get endpoints -n <namespace>

# ReferenceGrant の確認（名前空間間参照の場合）
kubectl get referencegrant -A
```

**3. TLS証明書の問題**

```bash
# 証明書の状態確認
kubectl get secrets -A | grep tls
kubectl describe secret <tls-secret-name> -n <namespace>

# cert-manager の状態確認（使用している場合）
kubectl get certificate -A
kubectl get certificaterequest -A
kubectl describe certificate <cert-name> -n <namespace>
```

**4. AWS Gateway API Controller の問題**

```bash
# AWS Gateway Controller ログ
kubectl logs -n aws-application-networking-system deployment/aws-gateway-controller-manager

# AWS リソースの確認
aws elbv2 describe-load-balancers --region <region>
aws elbv2 describe-target-groups --region <region>

# SecurityGroup とサブネットの確認
kubectl describe gateway <gateway-name> -n <namespace>
```

### デバッグ用設定

```yaml
# デバッグ用Gateway Controller設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: debug-gateway-config
  namespace: gateway-system
data:
  config.yaml: |
    logging:
      level: debug
      format: json
    observability:
      metrics:
        enabled: true
      tracing:
        enabled: true
        sampling_rate: 1.0
    debugging:
      enable_profiling: true
      profile_port: 6060
---
# テスト用HTTPRoute
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: debug-route
  namespace: default
  annotations:
    gateway.networking.k8s.io/debug: "true"
spec:
  parentRefs:
  - name: test-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /debug
    filters:
    - type: RequestHeaderModifier
      requestHeaderModifier:
        add:
        - name: x-debug-route
          value: "true"
        - name: x-debug-timestamp
          value: "${timestamp}"
    backendRefs:
    - name: debug-service
      port: 80
```

### パフォーマンス最適化

```yaml
# 高パフォーマンスGateway設定
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: high-performance-gateway
  annotations:
    gateway.networking.k8s.io/connection-idle-timeout: "60s"
    gateway.networking.k8s.io/max-connections: "10000"
    gateway.networking.k8s.io/keepalive-timeout: "75s"
spec:
  gatewayClassName: nginx-high-performance
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      certificateRefs:
      - name: wildcard-cert
---
# パフォーマンス最適化HTTPRoute
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: optimized-route
  annotations:
    gateway.networking.k8s.io/timeout: "30s"
    gateway.networking.k8s.io/retry-count: "3"
    gateway.networking.k8s.io/load-balancing: "least_conn"
spec:
  parentRefs:
  - name: high-performance-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-service
      port: 80
      weight: 100
```

このガイドは、AWS ECS管理者がKubernetesのGateway APIを効果的に理解・導入・運用するための包括的な情報を提供しています。Gateway APIの強力な機能を活用して、より柔軟で管理しやすいネットワーキング環境を構築してください。
