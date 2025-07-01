# Kubernetes Ingressコントローラー包括ガイド

> **⚠️ 重要な注意事項 (2025年7月更新)**
> 
> **Ingress APIは機能凍結されています。新機能はGateway APIに追加されます。**
> 
> Kubernetes公式ドキュメント: [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
> 
> - **現状**: Ingressは既存機能の維持のみで、新機能開発は停止
> - **将来**: Gateway APIがL4-L7ネットワーク管理の標準として開発中
> - **推奨**: 新規プロジェクトはGateway APIの採用を検討
> - **移行**: 既存IngressからGateway APIへの段階的移行を計画
> 
> **📚 Gateway API学習ガイド**: [Gateway API包括ガイド](./15-gateway-api-comprehensive.md)

## 目次
1. [Ingressコントローラーの基本概念](#ingressコントローラーの基本概念)
2. [AWS ECSとの比較](#aws-ecsとの比較)
3. [主要なIngressコントローラー比較](#主要なingressコントローラー比較)
4. [NGINX Ingress Controller](#nginx-ingress-controller)
5. [Traefik](#traefik)
6. [Istio Service Mesh (Gateway/VirtualService)](#istio-service-mesh-gatewayvirtualservice)
7. [AWS Load Balancer Controller](#aws-load-balancer-controller)
8. [高度な機能と設定](#高度な機能と設定)
9. [選択指針とベストプラクティス](#選択指針とベストプラクティス)
10. [トラブルシューティング](#トラブルシューティング)

## Ingressコントローラーの基本概念

### Ingressとは

KubernetesのIngressは、クラスター外部からクラスター内のサービスへのHTTP/HTTPSアクセスを管理するAPIオブジェクトです。ロードバランシング、SSL終端、名前ベースの仮想ホスティングを提供します。

```yaml
# 基本的なIngress例
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basic-ingress
  namespace: webapp
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp-service
            port:
              number: 80
```

### Ingressコントローラーの役割

Ingressコントローラーは、Ingressリソースを監視し、実際のトラフィックルーティングを実行するコンポーネントです。

**主な機能**:
- HTTP/HTTPSトラフィックルーティング
- SSL/TLS終端
- ロードバランシング
- 名前ベース/パスベースルーティング
- レート制限
- 認証・認可
- ヘルスチェック

## AWS ECSとの比較

### AWS Application Load Balancer (ALB) vs Kubernetes Ingress

| 機能 | AWS ALB | Kubernetes Ingress |
|------|---------|-------------------|
| **SSL/TLS終端** | AWS Certificate Manager連携 | cert-manager、Let's Encrypt対応 |
| **ルーティング** | パス/ホストベース | パス/ホストベース + 高度なルール |
| **認証** | AWS Cognito連携 | OAuth、JWT、基本認証 |
| **監視** | CloudWatch統合 | Prometheus、Grafana統合 |
| **コスト** | 時間課金 + データ転送料 | インスタンス/リソース使用量ベース |
| **可搬性** | AWS専用 | クラウド非依存 |

**AWS ECS + ALB設定例**:
```json
{
  "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
  "Properties": {
    "Type": "application",
    "Subnets": ["subnet-12345", "subnet-67890"],
    "SecurityGroups": ["sg-abcdef"]
  }
}
```

**対応するKubernetes Ingress**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - webapp.example.com
    secretName: webapp-tls
  rules:
  - host: webapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp-service
            port:
              number: 80
```

## 主要なIngressコントローラー比較

| 項目 | NGINX Ingress | Traefik | Istio Gateway | AWS LB Controller |
|------|---------------|---------|---------------|-------------------|
| **学習コストかるさ** | 中 | 低 | 高 | 中 |
| **機能の豊富さ** | 高 | 中 | 非常に高 | 中 |
| **パフォーマンス** | 高 | 中 | 高 | 高 |
| **マイクロサービス対応** | 良 | 良 | 優秀 | 良 |
| **可観測性** | 良 | 優秀 | 優秀 | 良 |
| **コミュニティ** | 大 | 中 | 大 | 中 |
| **クラウド依存** | なし | なし | なし | AWS専用 |

### 選択の指針

**NGINX Ingress Controller**：
- 実績豊富で安定性重視
- シンプルなWebアプリケーション
- 高トラフィック対応

**Traefik**：
- 動的設定とサービス発見
- マイクロサービス環境
- DevOps中心の運用

**Istio**：
- 本格的なマイクロサービス
- 高度なトラフィック管理が必要
- セキュリティ・可観測性重視

**AWS Load Balancer Controller**：
- AWS環境での運用
- AWS サービス統合重視
- コスト最適化

## NGINX Ingress Controller

### 基本インストールと設定

```yaml
# NGINX Ingress Controller Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-ingress-controller
  namespace: ingress-nginx
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-ingress
  template:
    metadata:
      labels:
        app: nginx-ingress
    spec:
      containers:
      - name: nginx-ingress-controller
        image: k8s.gcr.io/ingress-nginx/controller:v1.8.1
        args:
        - /nginx-ingress-controller
        - --configmap=$(POD_NAMESPACE)/nginx-configuration
        - --tcp-services-configmap=$(POD_NAMESPACE)/tcp-services
        - --udp-services-configmap=$(POD_NAMESPACE)/udp-services
        - --publish-service=$(POD_NAMESPACE)/nginx-ingress-service
        - --annotations-prefix=nginx.ingress.kubernetes.io
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        ports:
        - name: http
          containerPort: 80
        - name: https
          containerPort: 443
        - name: webhook
          containerPort: 8443
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 高度な設定例

```yaml
# パスベースルーティング
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  namespace: webapp
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/configuration-snippet: |
      rewrite ^(/api)$ $1/ redirect;
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api/v1(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-v1-service
            port:
              number: 80
      - path: /api/v2(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-v2-service
            port:
              number: 80
---
# レート制限設定
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rate-limited-ingress
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "10"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/rate-limit-connections: "5"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
```

## Traefik

### Traefik設定

```yaml
# Traefik Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: traefik
  namespace: kube-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: traefik
  template:
    metadata:
      labels:
        app: traefik
    spec:
      containers:
      - name: traefik
        image: traefik:v3.0
        args:
        - --api.insecure=true
        - --api.dashboard=true
        - --providers.kubernetescrd
        - --providers.kubernetesingress
        - --entrypoints.web.address=:80
        - --entrypoints.websecure.address=:443
        - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
        - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
        - --certificatesresolvers.letsencrypt.acme.email=admin@example.com
        - --certificatesresolvers.letsencrypt.acme.storage=/data/acme.json
        ports:
        - name: web
          containerPort: 80
        - name: websecure
          containerPort: 443
        - name: admin
          containerPort: 8080
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: traefik-data
---
# Traefik IngressRoute CRD
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: api-route
  namespace: webapp
spec:
  entryPoints:
  - websecure
  routes:
  - match: Host(`api.example.com`) && PathPrefix(`/v1`)
    kind: Rule
    services:
    - name: api-v1-service
      port: 80
    middlewares:
    - name: rate-limit
  - match: Host(`api.example.com`) && PathPrefix(`/v2`)
    kind: Rule
    services:
    - name: api-v2-service
      port: 80
  tls:
    certResolver: letsencrypt
---
# Traefik Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
  namespace: webapp
spec:
  rateLimit:
    burst: 20
    average: 10
```

## Istio Service Mesh (Gateway/VirtualService)

### Istio概要とIngressController機能

IstioはService Meshアーキテクチャを提供し、マイクロサービス間の通信を管理します。Istio GatewayとVirtualServiceを使用することで、従来のIngressControllerを置き換えることができます。

**Istioの主な特徴**:
- **トラフィック管理**: 高度なルーティング、負荷分散、フェイルオーバー
- **セキュリティ**: mTLS、認証・認可、ポリシー管理
- **可観測性**: 分散トレーシング、メトリクス、ログ
- **A/Bテスト**: カナリアデプロイメント、トラフィック分割

### Istio基本設定

```yaml
# Istio Gateway - 外部トラフィックの入り口
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: webapp-gateway
  namespace: webapp
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - webapp.example.com
    tls:
      httpsRedirect: true
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: webapp-tls
    hosts:
    - webapp.example.com
---
# VirtualService - トラフィックルーティング
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: webapp-virtual-service
  namespace: webapp
spec:
  hosts:
  - webapp.example.com
  gateways:
  - webapp-gateway
  http:
  - match:
    - uri:
        prefix: /api/v1
    route:
    - destination:
        host: api-v1-service
        port:
          number: 80
      weight: 90
    - destination:
        host: api-v1-canary-service
        port:
          number: 80
      weight: 10
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    retries:
      attempts: 3
      perTryTimeout: 2s
  - match:
    - uri:
        prefix: /api/v2
    route:
    - destination:
        host: api-v2-service
        port:
          number: 80
    headers:
      request:
        add:
          x-api-version: "v2"
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: frontend-service
        port:
          number: 80
```

### Istio高度なトラフィック管理

```yaml
# DestinationRule - ロードバランシングとサーキットブレーカー
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-destination-rule
  namespace: webapp
spec:
  host: api-v1-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    circuitBreaker:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v1-canary
    labels:
      version: v1-canary
---
# ServiceEntry - 外部サービス連携
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
  namespace: webapp
spec:
  hosts:
  - external-api.example.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS
---
# AuthorizationPolicy - 認可ポリシー
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-access-control
  namespace: webapp
spec:
  selector:
    matchLabels:
      app: api-v1-service
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/webapp/sa/frontend-service"]
  - to:
    - operation:
        methods: ["GET", "POST"]
    when:
    - key: request.headers[x-api-key]
      values: ["valid-api-key"]
```

### Istio vs 従来のIngressController比較

| 機能 | 従来のIngress | Istio Gateway/VirtualService |
|------|---------------|------------------------------|
| **設定の複雑さ** | シンプル | 複雑だが柔軟 |
| **トラフィック分割** | 基本的 | 高度（重み付け、ヘッダー等） |
| **セキュリティ** | 基本的なTLS | mTLS、認証・認可ポリシー |
| **可観測性** | 限定的 | 分散トレーシング、詳細メトリクス |
| **フォルトインジェクション** | なし | 遅延、エラー注入 |
| **サーキットブレーカー** | 限定的 | 高度な設定 |
| **A/Bテスト** | 難しい | 簡単 |

## AWS Load Balancer Controller

### AWS Load Balancer Controller設定

```yaml
# AWS Load Balancer Controller用Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aws-ingress
  namespace: webapp
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/cert-id
    alb.ingress.kubernetes.io/actions.ssl-redirect: |
      {
        "Type": "redirect",
        "RedirectConfig": {
          "Protocol": "HTTPS",
          "Port": "443",
          "StatusCode": "HTTP_301"
        }
      }
    alb.ingress.kubernetes.io/actions.weighted-routing: |
      {
        "type": "forward",
        "forwardConfig": {
          "targetGroups": [
            {
              "serviceName": "api-v1-service",
              "servicePort": 80,
              "weight": 90
            },
            {
              "serviceName": "api-v1-canary-service", 
              "servicePort": 80,
              "weight": 10
            }
          ]
        }
      }
spec:
  rules:
  - host: webapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ssl-redirect
            port:
              name: use-annotation
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: weighted-routing
            port:
              name: use-annotation
```

## 高度な機能と設定

### SSL/TLS証明書管理

```yaml
# cert-manager Issuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
---
# 自動TLS証明書取得Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - secure.example.com
    secretName: secure-example-tls
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 80
```

### 認証・認可

```yaml
# OAuth2認証Ingress (oauth2-proxy)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: oauth-protected-ingress
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://oauth2-proxy.example.com/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://oauth2-proxy.example.com/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "x-auth-request-user,x-auth-request-email"
spec:
  rules:
  - host: protected.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: protected-service
            port:
              number: 80
---
# 基本認証
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basic-auth-ingress
  annotations:
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth-secret
    nginx.ingress.kubernetes.io/auth-realm: 'Authentication Required'
spec:
  rules:
  - host: admin.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 80
```

### カナリアデプロイメント

```yaml
# メインIngress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  annotations:
    nginx.ingress.kubernetes.io/canary: "false"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-main-service
            port:
              number: 80
---
# カナリアIngress (10%のトラフィック)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: canary-ingress
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
    nginx.ingress.kubernetes.io/canary-by-header: "canary"
    nginx.ingress.kubernetes.io/canary-by-cookie: "canary"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-canary-service
            port:
              number: 80
```

## 選択指針とベストプラクティス

### 環境別選択指針

**開発環境**:
- NGINX Ingress Controller（シンプル、軽量）
- Traefik（動的設定、開発者フレンドリー）

**ステージング環境**:
- 本番環境と同じ構成
- テスト用の追加機能（フォルトインジェクション等）

**本番環境**:
- **シンプルなアプリ**: NGINX Ingress Controller
- **マイクロサービス**: Istio Gateway
- **AWS環境**: AWS Load Balancer Controller
- **高可用性重視**: 複数IngressControllerの組み合わせ

### パフォーマンスチューニング

```yaml
# NGINX高パフォーマンス設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
data:
  worker-processes: "auto"
  worker-connections: "10240"
  keep-alive: "75"
  keep-alive-requests: "1000"
  upstream-keepalive-connections: "50"
  upstream-keepalive-requests: "1000"
  client-body-buffer-size: "1M"
  client-max-body-size: "50M"
  proxy-buffer-size: "8k"
  proxy-buffers: "8 8k"
  ssl-protocols: "TLSv1.2 TLSv1.3"
  ssl-ciphers: "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
  use-gzip: "true"
  gzip-level: "6"
  gzip-types: "text/plain text/css application/json application/javascript text/xml application/xml"
```

### 監視とアラート

```yaml
# PrometheusRule for Ingress monitoring
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ingress-alerts
  namespace: monitoring
spec:
  groups:
  - name: ingress.rules
    rules:
    - alert: IngressHighLatency
      expr: histogram_quantile(0.95, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le, ingress)) > 1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High latency on ingress {{ $labels.ingress }}"
    
    - alert: IngressHighErrorRate
      expr: sum(rate(nginx_ingress_controller_requests_total{status=~"5.."}[5m])) by (ingress) / sum(rate(nginx_ingress_controller_requests_total[5m])) by (ingress) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate on ingress {{ $labels.ingress }}"
```

## トラブルシューティング

### 一般的な問題と解決策

**1. Ingressが作成されたがアクセスできない**

```bash
# Ingressの状態確認
kubectl get ingress -A
kubectl describe ingress <ingress-name> -n <namespace>

# IngressControllerの状態確認
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/nginx-ingress-controller

# サービスとエンドポイントの確認
kubectl get services -n <namespace>
kubectl get endpoints -n <namespace>
```

**2. SSL証明書の問題**

```bash
# cert-managerの状態確認
kubectl get certificaterequests -A
kubectl get certificates -A
kubectl describe certificate <cert-name> -n <namespace>

# Let's Encryptの制限確認
kubectl logs -n cert-manager deployment/cert-manager
```

**3. Istio Gateway/VirtualServiceの問題**

```bash
# Istio設定の検証
istioctl analyze

# Proxy設定の確認
istioctl proxy-config routes <pod-name> -n <namespace>
istioctl proxy-config clusters <pod-name> -n <namespace>

# Envoyログの確認
kubectl logs <istio-proxy-pod> -n <namespace> -c istio-proxy
```

**4. パフォーマンス問題**

```bash
# メトリクスの確認
kubectl top pods -n ingress-nginx
kubectl get hpa -A

# 接続数とレスポンス時間の確認
curl -w "@curl-format.txt" -s -o /dev/null http://example.com

# Nginx統計の確認（NGINX Ingress）
curl http://nginx-controller/nginx_status
```

### デバッグ用の設定

```yaml
# デバッグ用NGINX設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
data:
  enable-access-log: "true"
  access-log-path: "/var/log/nginx/access.log"
  error-log-level: "debug"
  log-format-upstream: |
    $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent 
    "$http_referer" "$http_user_agent" $request_length $request_time 
    [$proxy_upstream_name] [$proxy_alternative_upstream_name] $upstream_addr 
    $upstream_response_length $upstream_response_time $upstream_status $req_id
```

このガイドは、AWS ECS管理者がKubernetesのIngressコントローラーを効果的に選択・設定・運用するための包括的な情報を提供しています。各IngressControllerの特徴を理解し、要件に応じて適切な選択を行ってください。
