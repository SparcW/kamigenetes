# Ingress Controller トラブルシューティングガイド

## 一般的な問題と解決策

### 1. Ingressリソースが作成されたがアクセスできない

**症状**:
- `kubectl get ingress` でIngressは表示される
- 外部からアクセスできない
- ブラウザでタイムアウトエラー

**確認手順**:

```bash
# 1. Ingressの詳細確認
kubectl describe ingress <ingress-name> -n <namespace>

# 2. IngressControllerのPod状態確認
kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# 3. サービスとエンドポイント確認
kubectl get services -n <namespace>
kubectl get endpoints -n <namespace>

# 4. Pod状態確認
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
```

**よくある原因と解決策**:

1. **サービスセレクターの不一致**
   ```yaml
   # 正しい例
   apiVersion: v1
   kind: Service
   metadata:
     name: webapp-service
   spec:
     selector:
       app: webapp  # Deploymentのlabelsと一致させる
   ```

2. **ポート番号の間違い**
   ```yaml
   # サービスとDeploymentのポート確認
   service:
     ports:
     - port: 80
       targetPort: 8080  # コンテナの実際のポート
   ```

3. **IngressClassの未指定**
   ```yaml
   # annotations または spec.ingressClassName を指定
   metadata:
     annotations:
       kubernetes.io/ingress.class: nginx
   # または
   spec:
     ingressClassName: nginx
   ```

### 2. SSL/TLS証明書の問題

**症状**:
- HTTPS接続時に証明書エラー
- "certificate unknown" エラー
- ブラウザのセキュリティ警告

**確認手順**:

```bash
# cert-manager関連
kubectl get certificates -A
kubectl get certificaterequests -A
kubectl describe certificate <cert-name> -n <namespace>
kubectl logs -n cert-manager deployment/cert-manager

# Secret確認
kubectl get secrets -n <namespace>
kubectl describe secret <tls-secret-name> -n <namespace>

# SSL証明書詳細確認
openssl s_client -connect <domain>:443 -servername <domain>
```

**解決策**:

1. **Let's Encrypt Rate Limiting**
   ```bash
   # staging環境を使用
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-staging
   spec:
     acme:
       server: https://acme-staging-v02.api.letsencrypt.org/directory
   ```

2. **DNS Challenge問題**
   ```bash
   # HTTP-01チャレンジに変更
   solvers:
   - http01:
       ingress:
         class: nginx
   ```

### 3. ロードバランシングが動作しない

**症状**:
- 特定のPodにのみリクエストが集中
- 503 Service Unavailable エラー
- レスポンス時間のばらつき

**確認手順**:

```bash
# エンドポイント確認
kubectl get endpoints <service-name> -n <namespace> -o yaml

# Pod状態確認
kubectl get pods -n <namespace> -o wide

# readinessProbe確認
kubectl describe pod <pod-name> -n <namespace>

# IngressControllerログ確認
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=100
```

**解決策**:

1. **readinessProbeの設定**
   ```yaml
   readinessProbe:
     httpGet:
       path: /health
       port: 8080
     initialDelaySeconds: 10
     periodSeconds: 5
   ```

2. **SessionAffinityの無効化**
   ```yaml
   apiVersion: v1
   kind: Service
   spec:
     sessionAffinity: None  # デフォルト値
   ```

### 4. レート制限が効かない

**症状**:
- 429 Too Many Requests が返されない
- 大量リクエストが通過してしまう

**NGINX Ingress の場合**:

```bash
# 設定確認
kubectl get configmap nginx-configuration -n ingress-nginx -o yaml

# アノテーション確認
kubectl describe ingress <ingress-name> -n <namespace>
```

**正しい設定例**:
```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "10"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/rate-limit-connections: "5"
```

### 5. パスルーティングの問題

**症状**:
- 特定のパスでのみ404エラー
- パスベースルーティングが動作しない

**確認手順**:

```bash
# Ingress設定詳細確認
kubectl get ingress <ingress-name> -n <namespace> -o yaml

# nginx設定確認（NGINX Ingress）
kubectl exec -n ingress-nginx deployment/ingress-nginx-controller -- cat /etc/nginx/nginx.conf
```

**解決策**:

1. **pathType の明示**
   ```yaml
   spec:
     rules:
     - http:
         paths:
         - path: /api/v1
           pathType: Prefix  # または Exact
           backend:
             service:
               name: api-service
   ```

2. **rewrite-target の設定**
   ```yaml
   metadata:
     annotations:
       nginx.ingress.kubernetes.io/rewrite-target: /$2
   spec:
     rules:
     - http:
         paths:
         - path: /api/v1(/|$)(.*)
           pathType: Prefix
   ```

## IngressController別の詳細トラブルシューティング

### NGINX Ingress Controller

**設定確認コマンド**:
```bash
# nginx設定ファイル確認
kubectl exec -n ingress-nginx deployment/ingress-nginx-controller -- nginx -T

# アクセスログ確認
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=100 | grep "access.log"

# メトリクス確認
kubectl get --raw /metrics | grep nginx
```

**よくある問題**:
1. **Large Header問題**
   ```yaml
   data:
     proxy-buffer-size: "16k"
     proxy-buffers: "8 16k"
   ```

2. **Client Body Size制限**
   ```yaml
   metadata:
     annotations:
       nginx.ingress.kubernetes.io/proxy-body-size: "50m"
   ```

### Traefik

**設定確認コマンド**:
```bash
# Traefik API確認
kubectl port-forward -n traefik-system svc/traefik-dashboard 8080:8080
curl http://localhost:8080/api/rawdata

# ログ確認
kubectl logs -n traefik-system deployment/traefik
```

**よくある問題**:
1. **IngressRoute CRD問題**
   ```bash
   # CRD確認
   kubectl get crd ingressroutes.traefik.containo.us
   
   # リソース確認
   kubectl get ingressroute -A
   ```

### Istio Gateway/VirtualService

**設定確認コマンド**:
```bash
# Istio設定検証
istioctl analyze

# Proxy設定確認
istioctl proxy-config routes <pod-name> -n <namespace>

# Envoyログ確認
kubectl logs <pod-name> -n <namespace> -c istio-proxy
```

**よくある問題**:
1. **mTLS設定問題**
   ```yaml
   apiVersion: security.istio.io/v1beta1
   kind: PeerAuthentication
   metadata:
     name: default
   spec:
     mtls:
       mode: PERMISSIVE  # 一時的にPERMISSIVEに設定
   ```

### AWS Load Balancer Controller

**設定確認コマンド**:
```bash
# ALB状況確認
aws elbv2 describe-load-balancers

# Target Group確認
aws elbv2 describe-target-groups

# コントローラーログ確認
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

**よくある問題**:
1. **IAM権限不足**
   ```bash
   # ServiceAccount確認
   kubectl describe serviceaccount aws-load-balancer-controller -n kube-system
   
   # IAMロール確認
   aws iam get-role --role-name AmazonEKSLoadBalancerControllerRole
   ```

2. **サブネット/SecurityGroup問題**
   ```yaml
   metadata:
     annotations:
       alb.ingress.kubernetes.io/subnets: subnet-12345,subnet-67890
       alb.ingress.kubernetes.io/security-groups: sg-abcdef
   ```

## パフォーマンス最適化

### 1. リソース制限の適切な設定

```yaml
# IngressController
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# アプリケーションPod
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### 2. HPA設定

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: webapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 3. 接続プール最適化

**NGINX**:
```yaml
data:
  upstream-keepalive-connections: "50"
  upstream-keepalive-requests: "1000"
  worker-connections: "10240"
```

**Traefik**:
```yaml
spec:
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
```

## 監視とアラート

### 1. 重要なメトリクス

- **リクエスト数**: `nginx_ingress_controller_requests`
- **レスポンス時間**: `nginx_ingress_controller_request_duration_seconds`
- **エラー率**: `nginx_ingress_controller_requests{status=~"5.."}`
- **接続数**: `nginx_ingress_controller_nginx_process_connections`

### 2. アラートルール例

```yaml
groups:
- name: ingress-alerts
  rules:
  - alert: IngressHighLatency
    expr: histogram_quantile(0.95, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le, ingress)) > 1
    for: 10m
    annotations:
      summary: "High latency on ingress {{ $labels.ingress }}"
  
  - alert: IngressHighErrorRate
    expr: sum(rate(nginx_ingress_controller_requests{status=~"5.."}[5m])) by (ingress) / sum(rate(nginx_ingress_controller_requests[5m])) by (ingress) > 0.05
    for: 5m
    annotations:
      summary: "High error rate on ingress {{ $labels.ingress }}"
```

## デバッグ用ツール

### 1. curl によるテスト

```bash
# 基本テスト
curl -v http://example.com/api/v1

# ヘッダー確認
curl -I http://example.com/api/v1

# レスポンス時間測定
curl -w "@curl-format.txt" -s -o /dev/null http://example.com

# curl-format.txt の内容
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer: %{time_pretransfer}\n
time_redirect:    %{time_redirect}\n
time_starttransfer: %{time_starttransfer}\n
time_total:       %{time_total}\n
```

### 2. デバッグPod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
spec:
  containers:
  - name: debug
    image: nicolaka/netshoot
    command: ["/bin/bash"]
    args: ["-c", "while true; do sleep 30; done;"]
  restartPolicy: Never
```

使用例:
```bash
kubectl exec -it debug-pod -- curl http://service-name.namespace.svc.cluster.local
kubectl exec -it debug-pod -- nslookup service-name.namespace.svc.cluster.local
kubectl exec -it debug-pod -- telnet service-name.namespace.svc.cluster.local 80
```

## まとめ

Ingress Controllerのトラブルシューティングでは、以下の順序で確認することが重要です:

1. **基本的な接続**: Pod → Service → Ingress の順で確認
2. **設定の検証**: YAML設定、annotations、labels の確認
3. **ログ分析**: IngressController、アプリケーションPod両方のログ確認
4. **ネットワーク**: DNS解決、ポート疎通、SecurityGroup設定
5. **パフォーマンス**: リソース使用率、レスポンス時間、スループット

各IngressControllerの特性を理解し、適切なツールと手順を使ってトラブルシューティングを行うことで、効率的に問題を解決できます。
