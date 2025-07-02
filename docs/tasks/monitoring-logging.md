# 📊 モニタリング・ログ - メトリクス、ログ収集、デバッグ

このタスクガイドでは、Kubernetesにおけるモニタリングとログ管理の実装方法を解説します。AWS ECS経験者向けに、CloudWatchとの比較を交えながら、Prometheus、Grafana、ログ収集システムの実践的な活用法を説明します。

## 🎯 対象タスク

- **メトリクス監視**: Prometheus + Grafana の実装
- **ログ管理**: Fluent Bit / Fluentd による集約
- **アラート**: AlertManagerによる通知システム
- **デバッグ**: 障害対応とトラブルシューティング

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 実装のポイント |
|------|---------|------------|---------------|
| **メトリクス** | CloudWatch | Prometheus | より細かいメトリクス取得 |
| **ログ収集** | CloudWatch Logs | Fluent Bit/Fluentd | ログ処理の柔軟性 |
| **可視化** | CloudWatch Dashboard | Grafana | カスタマイズ性の向上 |
| **アラート** | CloudWatch Alarms | AlertManager | 柔軟なルーティング |

## 📈 1. Prometheus によるメトリクス監視

### Prometheus のインストール

```yaml
# prometheus-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
# prometheus-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    rule_files:
      - "kubernetes.yml"
    
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
    
    scrape_configs:
    # Kubernetes API Server
    - job_name: 'kubernetes-apiservers'
      kubernetes_sd_configs:
      - role: endpoints
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https
    
    # Kubernetes Nodes
    - job_name: 'kubernetes-nodes'
      kubernetes_sd_configs:
      - role: node
      scheme: https
      tls_config:
        ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
      relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
    
    # Kubernetes Pods
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name
    
    # Application Services
    - job_name: 'application-metrics'
      static_configs:
      - targets: ['app-service:9090']
      metrics_path: /metrics
      scrape_interval: 10s
  
  kubernetes.yml: |
    groups:
    - name: kubernetes
      rules:
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[5m]) * 60 * 5 > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: Pod is crash looping
          description: "Pod {{ $labels.pod }} is crash looping"
      
      - alert: PodNotReady
        expr: kube_pod_status_ready{condition="false"} == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Pod not ready
          description: "Pod {{ $labels.pod }} has been in a non-ready state for longer than 5 minutes."
---
# prometheus-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        args:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus/'
        - '--web.console.libraries=/etc/prometheus/console_libraries'
        - '--web.console.templates=/etc/prometheus/consoles'
        - '--storage.tsdb.retention.time=7d'
        - '--web.enable-lifecycle'
        - '--web.enable-admin-api'
        volumeMounts:
        - name: prometheus-config-volume
          mountPath: /etc/prometheus/
        - name: prometheus-storage-volume
          mountPath: /prometheus/
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
      volumes:
      - name: prometheus-config-volume
        configMap:
          defaultMode: 420
          name: prometheus-config
      - name: prometheus-storage-volume
        persistentVolumeClaim:
          claimName: prometheus-pvc
---
# prometheus-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
  type: ClusterIP
```

### ServiceAccount と RBAC

```yaml
# prometheus-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
- apiGroups:
  - extensions
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
```

### アプリケーションメトリクスの実装

```yaml
# app-with-metrics.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-metrics
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app-with-metrics
  template:
    metadata:
      labels:
        app: app-with-metrics
      annotations:
        # Prometheus自動発見用アノテーション
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        
        env:
        - name: METRICS_ENABLED
          value: "true"
        - name: METRICS_PORT
          value: "9090"
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # アプリケーションヘルスチェック
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
  name: app-with-metrics
  labels:
    app: app-with-metrics
spec:
  selector:
    app: app-with-metrics
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: metrics
    port: 9090
    targetPort: 9090
```

## 📊 2. Grafana による可視化

### Grafana のデプロイ

```yaml
# grafana-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secret
              key: admin-password
        - name: GF_SECURITY_ADMIN_USER
          value: "admin"
        - name: GF_INSTALL_PLUGINS
          value: "grafana-kubernetes-app"
        
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        - name: grafana-datasources
          mountPath: /etc/grafana/provisioning/datasources
        - name: grafana-dashboards
          mountPath: /etc/grafana/provisioning/dashboards
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      
      volumes:
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-pvc
      - name: grafana-datasources
        configMap:
          name: grafana-datasources
      - name: grafana-dashboards
        configMap:
          name: grafana-dashboards
---
# grafana-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
spec:
  selector:
    app: grafana
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

### Grafana設定

```yaml
# grafana-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus:9090
      isDefault: true
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: monitoring
data:
  dashboard.yaml: |
    apiVersion: 1
    providers:
    - name: 'default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      updateIntervalSeconds: 10
      allowUiUpdates: true
      options:
        path: /var/lib/grafana/dashboards
  
  kubernetes-cluster.json: |
    {
      "dashboard": {
        "id": null,
        "title": "Kubernetes Cluster Monitoring",
        "tags": ["kubernetes"],
        "style": "dark",
        "timezone": "browser",
        "panels": [
          {
            "id": 1,
            "title": "CPU Usage",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ],
            "fieldConfig": {
              "defaults": {
                "unit": "percent"
              }
            }
          },
          {
            "id": 2,
            "title": "Memory Usage",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(container_memory_usage_bytes) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ],
            "fieldConfig": {
              "defaults": {
                "unit": "bytes"
              }
            }
          }
        ],
        "time": {
          "from": "now-1h",
          "to": "now"
        },
        "refresh": "30s"
      }
    }
```

## 📋 3. ログ管理システム

### Fluent Bit のデプロイ

```yaml
# fluent-bit-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: kube-system
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
        HTTP_Server   On
        HTTP_Listen   0.0.0.0
        HTTP_Port     2020
    
    [INPUT]
        Name              tail
        Path              /var/log/containers/*.log
        Parser            cri
        Tag               kube.*
        Refresh_Interval  5
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
    
    [INPUT]
        Name systemd
        Tag  host.*
        Systemd_Filter _SYSTEMD_UNIT=kubelet.service
        Read_From_Tail On
    
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix     kube.var.log.containers.
        Merge_Log           On
        Keep_Log            Off
        K8S-Logging.Parser  On
        K8S-Logging.Exclude On
    
    [OUTPUT]
        Name  es
        Match kube.*
        Host  elasticsearch.logging.svc.cluster.local
        Port  9200
        Index kubernetes
        Type  _doc
        Logstash_Format On
        Logstash_Prefix kubernetes
        Logstash_DateFormat %Y.%m.%d
        Include_Tag_Key On
        Tag_Key @tag
        Retry_Limit 5
    
    [OUTPUT]
        Name  cloudwatch_logs
        Match host.*
        region us-west-2
        log_group_name /aws/kubernetes/cluster
        log_stream_prefix ${hostname}-
        auto_create_group true
  
  parsers.conf: |
    [PARSER]
        Name   cri
        Format regex
        Regex  ^(?<time>[^ ]+) (?<stream>stdout|stderr) (?<logtag>[^ ]*) (?<message>.*)$
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L%z
    
    [PARSER]
        Name        json
        Format      json
        Time_Key    time
        Time_Format %d/%b/%Y:%H:%M:%S %z
---
# fluent-bit-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: kube-system
  labels:
    k8s-app: fluent-bit-logging
    version: v1
    kubernetes.io/cluster-service: "true"
spec:
  selector:
    matchLabels:
      k8s-app: fluent-bit-logging
  template:
    metadata:
      labels:
        k8s-app: fluent-bit-logging
        version: v1
        kubernetes.io/cluster-service: "true"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "2020"
        prometheus.io/path: /api/v1/metrics/prometheus
    spec:
      serviceAccount: fluent-bit
      serviceAccountName: fluent-bit
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - operator: "Exists"
        effect: "NoExecute"
      - operator: "Exists"
        effect: "NoSchedule"
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 2020
        env:
        - name: FLUENT_CONF
          value: fluent-bit.conf
        - name: FLUENT_OPT
          value: "--config=/fluent-bit/etc/fluent-bit.conf"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: fluent-bit-config
          mountPath: /fluent-bit/etc/
        - name: mnt
          mountPath: /mnt
          readOnly: true
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
      terminationGracePeriodSeconds: 10
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: fluent-bit-config
        configMap:
          name: fluent-bit-config
      - name: mnt
        hostPath:
          path: /mnt
```

### ログ構造化の実装

```yaml
# structured-logging-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: structured-logging-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: structured-logging-app
  template:
    metadata:
      labels:
        app: structured-logging-app
      annotations:
        # Fluent Bit用のアノテーション
        fluentbit.io/parser: json
    spec:
      containers:
      - name: app
        image: structured-app:latest
        ports:
        - containerPort: 8080
        
        env:
        - name: LOG_FORMAT
          value: "json"
        - name: LOG_LEVEL
          value: "info"
        - name: APP_NAME
          value: "structured-logging-app"
        
        # JSON形式でのログ出力設定
        volumeMounts:
        - name: log-config
          mountPath: /app/config
          readOnly: true
        
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      
      volumes:
      - name: log-config
        configMap:
          name: log-config
---
# ログ設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-config
data:
  logback.xml: |
    <configuration>
      <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
          <providers>
            <timestamp/>
            <version/>
            <logLevel/>
            <loggerName/>
            <mdc/>
            <arguments/>
            <message/>
          </providers>
        </encoder>
      </appender>
      <root level="INFO">
        <appender-ref ref="STDOUT"/>
      </root>
    </configuration>
```

## 🚨 4. AlertManager によるアラート

### AlertManager のデプロイ

```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      smtp_smarthost: 'smtp.gmail.com:587'
      smtp_from: 'alerts@example.com'
      smtp_auth_username: 'alerts@example.com'
      smtp_auth_password: 'password'
    
    route:
      group_by: ['alertname']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'web.hook'
      routes:
      - match:
          severity: critical
        receiver: 'critical-alerts'
      - match:
          severity: warning
        receiver: 'warning-alerts'
    
    receivers:
    - name: 'web.hook'
      webhook_configs:
      - url: 'http://webhook-service:5000/webhook'
    
    - name: 'critical-alerts'
      email_configs:
      - to: 'oncall@example.com'
        subject: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '🚨 Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    
    - name: 'warning-alerts'
      email_configs:
      - to: 'team@example.com'
        subject: '⚠️ Warning: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}
    
    inhibit_rules:
    - source_match:
        severity: 'critical'
      target_match:
        severity: 'warning'
      equal: ['alertname', 'instance']
---
# alertmanager-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:latest
        ports:
        - containerPort: 9093
        args:
        - '--config.file=/etc/alertmanager/alertmanager.yml'
        - '--storage.path=/alertmanager'
        - '--web.external-url=http://alertmanager:9093'
        volumeMounts:
        - name: alertmanager-config-volume
          mountPath: /etc/alertmanager
        - name: alertmanager-storage-volume
          mountPath: /alertmanager
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      volumes:
      - name: alertmanager-config-volume
        configMap:
          name: alertmanager-config
      - name: alertmanager-storage-volume
        emptyDir: {}
```

## 🔍 5. デバッグとトラブルシューティング

### デバッグ用ツール

```yaml
# debug-tools.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: debug-tools
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: debug-tools
  template:
    metadata:
      labels:
        app: debug-tools
    spec:
      containers:
      - name: debug
        image: nicolaka/netshoot:latest
        command: ["/bin/bash"]
        args: ["-c", "sleep 3600"]
        
        # デバッグ用権限
        securityContext:
          capabilities:
            add:
            - NET_ADMIN
            - SYS_PTRACE
        
        # 必要なツールを含むイメージ
        # - curl, wget, dig, nslookup
        # - tcpdump, netstat, ss
        # - kubectl, docker
        
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
  
  restartPolicy: Never
```

### 監視Dashboard用メトリクス

```yaml
# kube-state-metrics.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kube-state-metrics
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kube-state-metrics
  template:
    metadata:
      labels:
        app: kube-state-metrics
    spec:
      serviceAccountName: kube-state-metrics
      containers:
      - name: kube-state-metrics
        image: k8s.gcr.io/kube-state-metrics/kube-state-metrics:latest
        ports:
        - containerPort: 8080
          name: http-metrics
        - containerPort: 8081
          name: telemetry
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          timeoutSeconds: 5
        readinessProbe:
          httpGet:
            path: /
            port: 8081
          initialDelaySeconds: 5
          timeoutSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

## 🧪 実践演習

### 演習1: Prometheus環境構築

```bash
# 監視環境のデプロイ
kubectl apply -f prometheus-namespace.yaml
kubectl apply -f prometheus-rbac.yaml
kubectl apply -f prometheus-configmap.yaml
kubectl apply -f prometheus-deployment.yaml

# 動作確認
kubectl get pods -n monitoring
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# ブラウザでPrometheus UIアクセス
# http://localhost:9090
```

### 演習2: ログ収集の確認

```bash
# Fluent Bitのデプロイ
kubectl apply -f fluent-bit-configmap.yaml
kubectl apply -f fluent-bit-daemonset.yaml

# ログ収集の確認
kubectl logs daemonset/fluent-bit -n kube-system

# アプリケーションログの確認
kubectl logs -f deployment/structured-logging-app
```

### 演習3: アラートのテスト

```bash
# AlertManagerのデプロイ
kubectl apply -f alertmanager-config.yaml
kubectl apply -f alertmanager-deployment.yaml

# テスト用の高負荷生成
kubectl run stress-test --image=progrium/stress -- --cpu 2 --timeout 60s

# アラートの確認
kubectl port-forward svc/alertmanager 9093:9093 -n monitoring
# http://localhost:9093
```

## 🎯 ベストプラクティス

### メトリクス設計

1. **適切なメトリクス選択**
   ```yaml
   # アプリケーションメトリクスの例
   - name: http_requests_total
     type: counter
     help: Total HTTP requests
   
   - name: http_request_duration_seconds
     type: histogram
     help: HTTP request duration
   
   - name: active_connections
     type: gauge
     help: Number of active connections
   ```

2. **ラベルの設計**
   ```yaml
   # 良い例
   http_requests_total{method="GET", status="200", endpoint="/api/users"}
   
   # 避けるべき例（高カーディナリティ）
   http_requests_total{user_id="12345", session_id="abc123"}
   ```

### ログ管理

1. **構造化ログ**
   ```json
   {
     "timestamp": "2023-01-01T12:00:00Z",
     "level": "INFO",
     "service": "api-server",
     "message": "User login successful",
     "user_id": "12345",
     "ip_address": "192.168.1.100",
     "trace_id": "abc123def456"
   }
   ```

2. **ログレベルの適切な使用**
   - **ERROR**: 即座の対応が必要
   - **WARN**: 注意が必要
   - **INFO**: 一般的な情報
   - **DEBUG**: 開発時のデバッグ情報

## 🚨 トラブルシューティング

### よくある問題

1. **メトリクス取得できない**
   ```bash
   # Prometheus targets確認
   kubectl port-forward svc/prometheus 9090:9090 -n monitoring
   # http://localhost:9090/targets
   
   # ServiceMonitor確認
   kubectl get servicemonitor -n monitoring
   ```

2. **ログが表示されない**
   ```bash
   # Fluent Bitのステータス確認
   kubectl get pods -n kube-system -l k8s-app=fluent-bit-logging
   kubectl logs daemonset/fluent-bit -n kube-system
   
   # ログ設定確認
   kubectl describe configmap fluent-bit-config -n kube-system
   ```

3. **アラートが発火しない**
   ```bash
   # Prometheusルール確認
   kubectl port-forward svc/prometheus 9090:9090 -n monitoring
   # http://localhost:9090/rules
   
   # AlertManager設定確認
   kubectl describe configmap alertmanager-config -n monitoring
   ```

## 📚 参考リソース

- **[Prometheus Documentation](https://prometheus.io/docs/)**
- **[Grafana Documentation](https://grafana.com/docs/)**
- **[Fluent Bit Documentation](https://docs.fluentbit.io/)**
- **[Kubernetes Monitoring Guide](https://kubernetes.io/docs/tasks/debug-application-cluster/)**

---

**関連タスク**: [Pod設定](./configure-pod-container.md) → [オブジェクト管理](./manage-objects.md) → [ネットワーキング](./networking.md)
