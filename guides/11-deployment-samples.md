# Kubernetesデプロイメントサンプル集

## 目次
1. [基本的なWebアプリケーション](#基本的なwebアプリケーション)
2. [データベースデプロイメント](#データベースデプロイメント)
3. [マイクロサービス構成](#マイクロサービス構成)
4. [バッチ処理とCronJob](#バッチ処理とcronjob)
5. [AWS ECS比較](#aws-ecs比較)
6. [監視とロギング](#監視とロギング)

## 基本的なWebアプリケーション

### Node.js Express アプリケーション

```yaml
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: webapp
  labels:
    name: webapp
---
# ConfigMap - アプリケーション設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: webapp-config
  namespace: webapp
data:
  NODE_ENV: "production"
  PORT: "3000"
  API_BASE_URL: "https://api.example.com"
  FRONTEND_URL: "https://app.example.com"
  LOG_LEVEL: "info"
  SESSION_TIMEOUT: "3600"
---
# Secret - 機密情報
apiVersion: v1
kind: Secret
metadata:
  name: webapp-secrets
  namespace: webapp
type: Opaque
data:
  JWT_SECRET: "bXlfc2VjcmV0X2p3dF9rZXk="
  API_KEY: "YXBpX2tleV9oZXJl"
  SESSION_SECRET: "c2Vzc2lvbl9zZWNyZXQ="
---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-deployment
  namespace: webapp
  labels:
    app: webapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
        version: v1.0.0
    spec:
      containers:
      - name: webapp
        image: node:16-alpine
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: webapp-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: webapp-config
              key: PORT
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: webapp-secrets
              key: JWT_SECRET
        volumeMounts:
        - name: app-logs
          mountPath: /app/logs
        - name: config-volume
          mountPath: /app/config
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
      volumes:
      - name: app-logs
        emptyDir: {}
      - name: config-volume
        configMap:
          name: webapp-config
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
  namespace: webapp
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  type: ClusterIP
---
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: webapp-hpa
  namespace: webapp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp-deployment
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### React フロントエンドアプリケーション

```yaml
# ConfigMap - Nginx設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-nginx-config
  namespace: webapp
data:
  nginx.conf: |
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        # SPA用設定
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # API プロキシ
        location /api/ {
            proxy_pass http://webapp-service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # 静的ファイルキャッシュ
        location /static/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # セキュリティヘッダー
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";
    }
---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
  namespace: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
        - name: app-static
          mountPath: /usr/share/nginx/html
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
      volumes:
      - name: nginx-config
        configMap:
          name: frontend-nginx-config
      - name: app-static
        emptyDir: {}
```

## データベースデプロイメント

### PostgreSQL クラスター

```yaml
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: database
---
# StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: postgres-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  encrypted: "true"
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
---
# Secret
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: database
type: Opaque
data:
  POSTGRES_USER: cG9zdGdyZXM=
  POSTGRES_PASSWORD: c3VwZXJzZWNyZXRwYXNzd29yZA==
  POSTGRES_DB: bXlhcHA=
  REPLICATION_USER: cmVwbGljYXRvcg==
  REPLICATION_PASSWORD: cmVwbGljYXRpb25wYXNz
---
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: database
data:
  postgresql.conf: |
    # 接続設定
    listen_addresses = '*'
    port = 5432
    max_connections = 100
    
    # メモリ設定
    shared_buffers = 256MB
    effective_cache_size = 1GB
    work_mem = 4MB
    maintenance_work_mem = 64MB
    
    # WAL設定
    wal_level = replica
    max_wal_senders = 3
    wal_keep_segments = 64
    
    # レプリケーション設定
    hot_standby = on
    hot_standby_feedback = on
    
    # ログ設定
    log_destination = 'stderr'
    logging_collector = on
    log_directory = 'pg_log'
    log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
    log_statement = 'all'
    log_min_duration_statement = 1000
  
  pg_hba.conf: |
    # TYPE  DATABASE        USER            ADDRESS                 METHOD
    local   all             all                                     trust
    host    all             all             127.0.0.1/32            md5
    host    all             all             ::1/128                 md5
    host    all             all             0.0.0.0/0               md5
    host    replication     replicator      0.0.0.0/0               md5
  
  init.sql: |
    -- アプリケーション用データベース作成
    CREATE DATABASE myapp;
    CREATE USER appuser WITH PASSWORD 'apppassword';
    GRANT ALL PRIVILEGES ON DATABASE myapp TO appuser;
    
    -- 監視用ユーザー作成
    CREATE USER monitoring WITH PASSWORD 'monitoring';
    GRANT CONNECT ON DATABASE postgres TO monitoring;
    GRANT USAGE ON SCHEMA public TO monitoring;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;
---
# StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: database
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      securityContext:
        fsGroup: 999
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_DB
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
          name: postgres
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql
        - name: init-scripts
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-config
        configMap:
          name: postgres-config
      - name: init-scripts
        configMap:
          name: postgres-config
          items:
          - key: init.sql
            path: init.sql
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: postgres-ssd
      resources:
        requests:
          storage: 20Gi
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: database
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### Redis クラスター

```yaml
# Redis Master
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-master
  namespace: database
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
      role: master
  template:
    metadata:
      labels:
        app: redis
        role: master
    spec:
      containers:
      - name: redis
        image: redis:6-alpine
        command: ["redis-server"]
        args: ["--requirepass", "$(REDIS_PASSWORD)", "--appendonly", "yes"]
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-master-pvc
---
# Redis Slave
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-slave
  namespace: database
spec:
  replicas: 2
  selector:
    matchLabels:
      app: redis
      role: slave
  template:
    metadata:
      labels:
        app: redis
        role: slave
    spec:
      containers:
      - name: redis
        image: redis:6-alpine
        command: ["redis-server"]
        args:
        - "--slaveof"
        - "redis-master"
        - "6379"
        - "--requirepass"
        - "$(REDIS_PASSWORD)"
        - "--masterauth"
        - "$(REDIS_PASSWORD)"
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "128Mi"
            cpu: "50m"
          limits:
            memory: "256Mi"
            cpu: "100m"
```

## マイクロサービス構成

### API Gateway

```yaml
# API Gateway Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: gateway
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: gateway-config
          mountPath: /etc/nginx/conf.d
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      volumes:
      - name: gateway-config
        configMap:
          name: api-gateway-config
---
# API Gateway Config
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-gateway-config
  namespace: webapp
data:
  default.conf: |
    upstream user_service {
        server user-service:80;
    }
    
    upstream order_service {
        server order-service:80;
    }
    
    upstream payment_service {
        server payment-service:80;
    }
    
    server {
        listen 80;
        
        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        
        # User Service
        location /api/users/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://user_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # Order Service
        location /api/orders/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://order_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # Payment Service
        location /api/payments/ {
            limit_req zone=api burst=5 nodelay;
            proxy_pass http://payment_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
```

### ユーザーサービス

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: webapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        service: user
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          value: "postgresql://appuser:apppassword@postgres.database:5432/myapp"
        - name: REDIS_URL
          value: "redis://redis-master.database:6379"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: webapp-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: webapp
spec:
  selector:
    app: user-service
  ports:
  - port: 80
    targetPort: 8080
```

## バッチ処理とCronJob

### データバックアップジョブ

```yaml
# 日次バックアップ
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
  namespace: database
spec:
  schedule: "0 2 * * *"  # 毎日午前2時
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:13
            command: ["/bin/bash"]
            args:
            - -c
            - |
              # データベースバックアップ
              pg_dump -h postgres -U postgres myapp > /backup/myapp-$(date +%Y%m%d-%H%M%S).sql
              
              # 古いバックアップファイル削除（7日以上）
              find /backup -name "*.sql" -mtime +7 -delete
              
              # S3にアップロード（AWS CLIが利用可能な場合）
              if command -v aws &> /dev/null; then
                  aws s3 cp /backup/myapp-$(date +%Y%m%d-%H%M%S).sql s3://backup-bucket/database/
              fi
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
  failedJobsHistoryLimit: 3
  successfulJobsHistoryLimit: 3
---
# 週次データクリーンアップ
apiVersion: batch/v1
kind: CronJob
metadata:
  name: weekly-cleanup
  namespace: database
spec:
  schedule: "0 3 * * 0"  # 毎週日曜日午前3時
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: postgres:13
            command: ["/bin/bash"]
            args:
            - -c
            - |
              # 古いログデータ削除
              psql -h postgres -U postgres -d myapp -c "
                DELETE FROM access_logs WHERE created_at < NOW() - INTERVAL '30 days';
                DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
                VACUUM ANALYZE;
              "
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
          restartPolicy: OnFailure
```

### 非同期ワーカー

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: background-worker
  namespace: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: background-worker
  template:
    metadata:
      labels:
        app: background-worker
    spec:
      containers:
      - name: worker
        image: worker:latest
        command: ["node", "worker.js"]
        env:
        - name: REDIS_URL
          value: "redis://redis-master.database:6379"
        - name: DATABASE_URL
          value: "postgresql://appuser:apppassword@postgres.database:5432/myapp"
        - name: WORKER_CONCURRENCY
          value: "5"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - health-check.js
          initialDelaySeconds: 30
          periodSeconds: 30
```

## AWS ECS比較

### ECS タスク定義 vs Kubernetes Deployment

**ECS タスク定義例**:
```json
{
  "family": "web-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "my-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/web-app",
          "awslogs-region": "us-east-1"
        }
      }
    }
  ]
}
```

**対応するKubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: my-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Auto Scaling比較

**ECS Auto Scaling**:
```json
{
  "ServiceName": "web-app-service",
  "ScalableDimension": "ecs:service:DesiredCount",
  "MinCapacity": 2,
  "MaxCapacity": 10,
  "TargetTrackingScalingPolicies": [
    {
      "TargetValue": 70.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
      }
    }
  ]
}
```

**Kubernetes HPA**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
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

## 監視とロギング

### Prometheus監視設定

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: webapp-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: webapp
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
---
# Grafana Dashboard ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: webapp-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "Web Application Metrics",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])",
                "legendFormat": "{{method}} {{status}}"
              }
            ]
          },
          {
            "title": "Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)",
                "legendFormat": "95th percentile"
              }
            ]
          },
          {
            "title": "CPU Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(container_cpu_usage_seconds_total[5m])",
                "legendFormat": "{{pod}}"
              }
            ]
          }
        ]
      }
    }
```

### Fluentd ログ収集

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: fluentd
  template:
    metadata:
      labels:
        name: fluentd
    spec:
      serviceAccountName: fluentd
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        - name: FLUENT_ELASTICSEARCH_SCHEME
          value: "http"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: fluentd-config
          mountPath: /fluentd/etc
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: fluentd-config
        configMap:
          name: fluentd-config
```

### ヘルスチェックとアラート

```yaml
# PrometheusRule for alerting
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: webapp-alerts
  namespace: monitoring
spec:
  groups:
  - name: webapp.rules
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }} errors per second"
    
    - alert: HighLatency
      expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "High latency detected"
        description: "95th percentile latency is {{ $value }} seconds"
    
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod is crash looping"
        description: "Pod {{ $labels.pod }} is restarting frequently"
```

このサンプル集は、AWS ECSからKubernetesへの移行時に参考となる実際のデプロイメント例を提供しています。各例には適切なリソース制限、ヘルスチェック、スケーリング設定が含まれており、本番環境での使用に適した設定となっています。
