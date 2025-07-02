# ⚙️ Pod設定 - リソース制限、ヘルスチェック

このタスクガイドでは、Podの詳細設定方法について解説します。AWS ECS経験者向けに、Task Definitionとの比較を交えながら、リソース制限、ヘルスチェック、セキュリティ設定の実践的な実装方法を説明します。

## 🎯 対象タスク

- **リソース制限**: CPU/メモリの適切な設定
- **ヘルスチェック**: Liveness/Readiness Probeの実装
- **セキュリティ設定**: SecurityContextの活用
- **起動時間最適化**: Init Containersと起動順序制御

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 設定のポイント |
|------|---------|------------|---------------|
| **リソース制限** | Task Definition | resources | より細かい制御が可能 |
| **ヘルスチェック** | ELB Health Check | Probe | 複数種類のProbeを組み合わせ |
| **起動順序** | dependsOn | initContainers | より柔軟な制御 |
| **セキュリティ** | Task Role | SecurityContext | コンテナレベルでの制御 |

## 🔧 1. リソース制限の設定

### 基本的なリソース制限

```yaml
# resource-limits.yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-demo
  labels:
    app: resource-demo
spec:
  containers:
  - name: app
    image: nginx:1.21
    ports:
    - containerPort: 80
    
    resources:
      # リクエスト（最低保証リソース）
      requests:
        memory: "128Mi"    # 128メガバイト
        cpu: "100m"        # 0.1 CPU（100ミリコア）
        ephemeral-storage: "1Gi"  # 一時ストレージ
      
      # 制限（最大使用可能リソース）
      limits:
        memory: "256Mi"    # 256メガバイト
        cpu: "500m"        # 0.5 CPU（500ミリコア）
        ephemeral-storage: "2Gi"  # 一時ストレージ
```

### 実践的なリソース設定例

```yaml
# practical-resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-application
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-application
  template:
    metadata:
      labels:
        app: web-application
    spec:
      containers:
      # Webアプリケーション（メインコンテナ）
      - name: web-app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
            ephemeral-storage: "1Gi"
          limits:
            memory: "1Gi"
            cpu: "1000m"
            ephemeral-storage: "2Gi"
      
      # Nginx プロキシ（サイドカー）
      - name: nginx-proxy
        image: nginx:1.21
        ports:
        - containerPort: 80
        
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
            ephemeral-storage: "100Mi"
          limits:
            memory: "128Mi"
            cpu: "200m"
            ephemeral-storage: "200Mi"
      
      # ログエージェント（サイドカー）
      - name: log-agent
        image: fluent/fluent-bit:1.8
        
        resources:
          requests:
            memory: "32Mi"
            cpu: "25m"
          limits:
            memory: "64Mi"
            cpu: "100m"
```

### QoS クラスの理解

```yaml
# qos-examples.yaml
# Guaranteed (最高優先度)
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-pod
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        memory: "200Mi"
        cpu: "100m"
      limits:
        memory: "200Mi"  # requestsと同じ値
        cpu: "100m"      # requestsと同じ値
---
# Burstable (中間優先度)
apiVersion: v1
kind: Pod
metadata:
  name: burstable-pod
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:
        memory: "100Mi"
        cpu: "50m"
      limits:
        memory: "200Mi"  # requestsより大きい
        cpu: "150m"      # requestsより大きい
---
# BestEffort (最低優先度)
apiVersion: v1
kind: Pod
metadata:
  name: besteffort-pod
spec:
  containers:
  - name: app
    image: nginx
    # resources設定なし
```

## ❤️ 2. ヘルスチェックの実装

### Liveness Probe（生存確認）

```yaml
# liveness-probe.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-liveness
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app-with-liveness
  template:
    metadata:
      labels:
        app: app-with-liveness
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        # HTTP Liveness Probe
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTP
            httpHeaders:
            - name: Custom-Header
              value: liveness-check
          initialDelaySeconds: 30  # 初回実行まで30秒待機
          periodSeconds: 10        # 10秒間隔で実行
          timeoutSeconds: 5        # タイムアウト5秒
          failureThreshold: 3      # 3回失敗で Pod再起動
          successThreshold: 1      # 1回成功で正常
        
        # TCP Liveness Probe（代替例）
        # livenessProbe:
        #   tcpSocket:
        #     port: 8080
        #   initialDelaySeconds: 30
        #   periodSeconds: 10
        
        # Exec Liveness Probe（代替例）
        # livenessProbe:
        #   exec:
        #     command:
        #     - /bin/sh
        #     - -c
        #     - "ps aux | grep '[m]yapp' || exit 1"
        #   initialDelaySeconds: 30
        #   periodSeconds: 10
```

### Readiness Probe（準備状態確認）

```yaml
# readiness-probe.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-readiness
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app-with-readiness
  template:
    metadata:
      labels:
        app: app-with-readiness
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 5   # 起動後5秒で開始
          periodSeconds: 3         # 3秒間隔で実行
          timeoutSeconds: 2        # タイムアウト2秒
          failureThreshold: 3      # 3回失敗でトラフィック停止
          successThreshold: 1      # 1回成功でトラフィック開始
        
        # データベース接続確認の例
        # readinessProbe:
        #   exec:
        #     command:
        #     - /bin/sh
        #     - -c
        #     - "pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER"
        #   initialDelaySeconds: 10
        #   periodSeconds: 5
```

### Startup Probe（起動時チェック）

```yaml
# startup-probe.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: slow-starting-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: slow-starting-app
  template:
    metadata:
      labels:
        app: slow-starting-app
    spec:
      containers:
      - name: app
        image: slow-app:latest
        ports:
        - containerPort: 8080
        
        # 起動時間が長いアプリケーション用
        startupProbe:
          httpGet:
            path: /startup
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30     # 最大150秒（5×30）待機
          successThreshold: 1
        
        # Startup Probe成功後にLiveness Probeが開始
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### 複合的なヘルスチェック例

```yaml
# comprehensive-health-checks.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: robust-application
spec:
  replicas: 3
  selector:
    matchLabels:
      app: robust-application
  template:
    metadata:
      labels:
        app: robust-application
    spec:
      containers:
      - name: app
        image: robust-app:latest
        ports:
        - containerPort: 8080
        - containerPort: 9090  # メトリクスポート
        
        env:
        - name: HEALTH_CHECK_TIMEOUT
          value: "5"
        - name: STARTUP_DELAY
          value: "30"
        
        # 段階的ヘルスチェック
        startupProbe:
          httpGet:
            path: /startup
            port: 8080
            httpHeaders:
            - name: User-Agent
              value: k8s-startup-probe
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 12     # 最大60秒待機
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
            httpHeaders:
            - name: User-Agent
              value: k8s-liveness-probe
          periodSeconds: 20
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
            httpHeaders:
            - name: User-Agent
              value: k8s-readiness-probe
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 🔒 3. SecurityContext の設定

### 基本的なセキュリティ設定

```yaml
# security-context.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-application
spec:
  replicas: 2
  selector:
    matchLabels:
      app: secure-application
  template:
    metadata:
      labels:
        app: secure-application
    spec:
      # Pod レベルのSecurityContext
      securityContext:
        # 非rootユーザーで実行
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        
        # SELinux設定
        seLinuxOptions:
          level: "s0:c123,c456"
        
        # Seccomp プロファイル
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      - name: app
        image: secure-app:latest
        ports:
        - containerPort: 8080
        
        # コンテナレベルのSecurityContext
        securityContext:
          # 読み取り専用ルートファイルシステム
          readOnlyRootFilesystem: true
          
          # 特権昇格の禁止
          allowPrivilegeEscalation: false
          
          # Capabilities制限
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE  # 80番ポートバインド用
          
          # ユーザー設定（Pod設定を上書き）
          runAsNonRoot: true
          runAsUser: 1001
        
        # 読み取り専用対応のボリューム設定
        volumeMounts:
        - name: app-config
          mountPath: /app/config
          readOnly: true
        - name: tmp-volume
          mountPath: /tmp
        - name: var-log
          mountPath: /var/log
        - name: app-cache
          mountPath: /app/cache
        
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
      
      volumes:
      - name: app-config
        configMap:
          name: app-config
      - name: tmp-volume
        emptyDir: {}
      - name: var-log
        emptyDir: {}
      - name: app-cache
        emptyDir:
          sizeLimit: "1Gi"
```

## 🚀 4. Init Containers と起動順序制御

### 基本的なInit Container

```yaml
# init-containers.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-init
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app-with-init
  template:
    metadata:
      labels:
        app: app-with-init
    spec:
      # Init Containers（順次実行）
      initContainers:
      # 1. 依存サービスの待機
      - name: wait-for-database
        image: busybox:1.35
        command:
        - /bin/sh
        - -c
        - |
          echo "Waiting for database..."
          until nc -z postgres-service 5432; do
            echo "Database not ready, waiting..."
            sleep 2
          done
          echo "Database is ready!"
      
      # 2. 設定ファイルの初期化
      - name: config-init
        image: myapp-config:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Initializing configuration..."
          cp /config-template/* /shared-config/
          envsubst < /config-template/app.conf > /shared-config/app.conf
          echo "Configuration initialized!"
        volumeMounts:
        - name: shared-config
          mountPath: /shared-config
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres-service:5432/myapp"
      
      # 3. データベースマイグレーション
      - name: db-migration
        image: migrate/migrate:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Running database migrations..."
          migrate -path /migrations -database $DATABASE_URL up
          echo "Migrations completed!"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: database-url
        volumeMounts:
        - name: migrations
          mountPath: /migrations
          readOnly: true
      
      # メインコンテナ
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        env:
        - name: CONFIG_PATH
          value: /app/config
        
        volumeMounts:
        - name: shared-config
          mountPath: /app/config
          readOnly: true
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      
      volumes:
      - name: shared-config
        emptyDir: {}
      - name: migrations
        configMap:
          name: db-migrations
```

## 📊 5. Pod 監視とデバッグ

### リソース使用量の監視

```yaml
# monitoring-setup.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitored-application
spec:
  replicas: 3
  selector:
    matchLabels:
      app: monitored-application
  template:
    metadata:
      labels:
        app: monitored-application
      annotations:
        # Prometheus監視用アノテーション
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: app
        image: monitored-app:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        
        # 詳細なリソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
            ephemeral-storage: "1Gi"
          limits:
            memory: "512Mi"
            cpu: "500m"
            ephemeral-storage: "2Gi"
        
        # 環境変数でのメトリクス設定
        env:
        - name: METRICS_ENABLED
          value: "true"
        - name: METRICS_PORT
          value: "9090"
        
        # ヘルスチェック
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### デバッグ用Pod

```yaml
# debug-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
  labels:
    app: debug
spec:
  containers:
  - name: debug
    image: nicolaka/netshoot:latest
    command: ["/bin/bash"]
    args: ["-c", "sleep 3600"]
    
    securityContext:
      capabilities:
        add:
        - NET_ADMIN
        - SYS_PTRACE
    
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "100m"
  
  restartPolicy: Never
```

## 🧪 実践演習

### 演習1: リソース制限の実装

```bash
# リソース制限の確認
kubectl apply -f resource-limits.yaml

# Pod のリソース使用量確認
kubectl top pod resource-demo

# リソース制限に達した場合の動作確認
kubectl describe pod resource-demo
```

### 演習2: ヘルスチェックのテスト

```bash
# ヘルスチェック付きアプリケーションのデプロイ
kubectl apply -f comprehensive-health-checks.yaml

# Probe の状態確認
kubectl describe pod robust-application-xxx

# 故意にヘルスチェックを失敗させる
kubectl exec -it robust-application-xxx -- curl -X POST localhost:8080/fail

# 自動回復の確認
kubectl get pods -w
```

### 演習3: Init Container の動作確認

```bash
# Init Container付きアプリケーションのデプロイ
kubectl apply -f init-containers.yaml

# Init Container の実行状況確認
kubectl get pods -w
kubectl describe pod app-with-init-xxx

# Init Container のログ確認
kubectl logs app-with-init-xxx -c wait-for-database
kubectl logs app-with-init-xxx -c config-init
```

## 🎯 ベストプラクティス

### リソース設定

1. **適切なサイジング**
   ```bash
   # リソース使用量の測定
   kubectl top pods
   kubectl describe node
   
   # 過去のメトリクス確認（Prometheusを使用）
   kubectl port-forward svc/prometheus-server 9090:80
   ```

2. **QoS クラスの選択**
   - **Guaranteed**: 重要なサービス
   - **Burstable**: 一般的なアプリケーション
   - **BestEffort**: バッチジョブ等

### ヘルスチェック

1. **適切なProbe設定**
   ```yaml
   # 推奨設定例
   livenessProbe:
     initialDelaySeconds: 30  # アプリ起動時間を考慮
     periodSeconds: 10        # 頻繁すぎない間隔
     timeoutSeconds: 5        # 適度なタイムアウト
     failureThreshold: 3      # 即座に再起動しない
   
   readinessProbe:
     initialDelaySeconds: 5   # 早めの開始
     periodSeconds: 5         # 短い間隔
     timeoutSeconds: 3        # 短いタイムアウト
     failureThreshold: 3      # 早めのトラフィック停止
   ```

## 🚨 トラブルシューティング

### よくある問題

1. **OOMKilled (Out of Memory)**
   ```bash
   # Pod のイベント確認
   kubectl describe pod problematic-pod
   
   # ノードの状態確認
   kubectl describe node
   
   # メモリ使用量の確認
   kubectl top pod problematic-pod
   ```

2. **CrashLoopBackOff**
   ```bash
   # Pod の状態確認
   kubectl get pods
   kubectl describe pod failing-pod
   
   # ログの確認
   kubectl logs failing-pod --previous
   
   # ヘルスチェック設定の確認
   kubectl get pod failing-pod -o yaml | grep -A 10 livenessProbe
   ```

3. **Init Container 失敗**
   ```bash
   # Init Container の状態確認
   kubectl describe pod init-failing-pod
   
   # 各 Init Container のログ確認
   kubectl logs init-failing-pod -c init-container-name
   
   # Init Container の再実行
   kubectl delete pod init-failing-pod
   ```

## 📚 参考リソース

- **[Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)**
- **[Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)**
- **[Managing Resources](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)**
- **[Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)**

---

**関連タスク**: [モニタリング・ログ](./monitoring-logging.md) → [Secret管理](./manage-secrets.md) → [ネットワーキング](./networking.md)
