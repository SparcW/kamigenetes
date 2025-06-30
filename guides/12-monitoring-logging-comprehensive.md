# Kubernetesモニタリング・ロギング完全学習ガイド

## 目次
1. [学習概要と前提知識](#学習概要と前提知識)
2. [AWS ECSからKubernetesへの移行視点](#aws-ecsからkubernetesへの移行視点)
3. [ロギングアーキテクチャ理解](#ロギングアーキテクチャ理解)
4. [基本的なログ取得と操作](#基本的なログ取得と操作)
5. [クラスターレベルロギング実装](#クラスターレベルロギング実装)
6. [モニタリング基礎](#モニタリング基礎)
7. [Prometheus + Grafana実装](#prometheus--grafana実装)
8. [実践演習プロジェクト](#実践演習プロジェクト)
9. [トラブルシューティング](#トラブルシューティング)
10. [本番運用ベストプラクティス](#本番運用ベストプラクティス)

---

## 学習概要と前提知識

### 🎯 学習目標

この包括的なガイドでは、AWS ECS管理者がKubernetesのモニタリングとロギングシステムを完全に理解し、実装できるようになることを目指します。

**習得スキル**:
- Kubernetesロギングアーキテクチャの完全理解
- kubectl logsを使った効果的なログ調査
- クラスターレベルロギングシステムの構築
- Prometheus/Grafanaによるモニタリング実装
- 本番環境でのトラブルシューティング手法

### 📋 前提知識チェックリスト

- [ ] Kubernetesの基本概念（Pod、Service、Deployment）
- [ ] kubectl基本操作
- [ ] Docker基本知識
- [ ] AWS ECSでのロギング経験
- [ ] YAML設定ファイルの理解

### 🕐 推定学習時間

- **理論学習**: 4-6時間
- **実践演習**: 8-10時間
- **プロジェクト完成**: 6-8時間
- **総計**: 18-24時間（3-4日間）

---

## AWS ECSからKubernetesへの移行視点

### ECSロギングとKubernetesの対比

#### AWS ECS でのロギング
```json
{
  "family": "my-web-app",
  "taskDefinition": {
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/my-app",
        "awslogs-region": "ap-northeast-1",
        "awslogs-stream-prefix": "web"
      }
    }
  }
}
```

#### Kubernetes での同等実装
```yaml
# ログローテーション設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: logging-config
data:
  container-log-max-size: "10Mi"
  container-log-max-files: "3"
---
# アプリケーションDeployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-web-app
  template:
    metadata:
      labels:
        app: my-web-app
      annotations:
        # ログ収集の設定
        fluentd.org/include: "true"
        fluentd.org/parser: "json"
    spec:
      containers:
      - name: web
        image: my-web-app:latest
        # 構造化ログ出力の推奨
        env:
        - name: LOG_FORMAT
          value: "json"
        - name: LOG_LEVEL
          value: "info"
```

### 重要な概念マッピング

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| CloudWatch Logs | kubectl logs + ロギングエージェント | ログ収集・表示 |
| Log Groups | Namespace + Label | ログの論理分割 |
| Log Streams | Pod/Container | ログストリーム |
| Log Retention | ログローテーション設定 | ログ保持期間 |
| CloudWatch Insights | ログ集約システム (ELK/EFK) | ログ検索・分析 |

---

## ロギングアーキテクチャ理解

### Kubernetesロギングの3つのレベル

#### 1. 基本ログ（Pod/Container レベル）
```yaml
# デバッグ用の基本的なPod
apiVersion: v1
kind: Pod
metadata:
  name: logging-demo
spec:
  containers:
  - name: app
    image: busybox
    command: ["/bin/sh", "-c"]
    args:
      - "while true; do
           echo \"$(date): アプリケーションログメッセージ\";
           echo \"$(date): エラーメッセージ\" >&2;
           sleep 5;
         done"
```

**確認コマンド**:
```bash
# 標準ログ表示
kubectl logs logging-demo

# リアルタイムフォロー
kubectl logs -f logging-demo

# 最新のN行のみ表示
kubectl logs --tail=20 logging-demo

# タイムスタンプ付き
kubectl logs --timestamps logging-demo
```

#### 2. ノードレベルロギング

```yaml
# ノードレベルロギング設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: kubelet-config
data:
  kubelet-config.yaml: |
    # ログローテーション設定
    containerLogMaxSize: 10Mi
    containerLogMaxFiles: 3
    # ログドライバー設定
    logging:
      format: json
```

#### 3. クラスターレベルロギング

```yaml
# Fluentd DaemonSet でのクラスターレベルロギング
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-logging
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: fluentd-logging
  template:
    metadata:
      labels:
        name: fluentd-logging
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

---

## 基本的なログ取得と操作

### kubectl logs 完全マスター

#### 基本的な使用方法
```bash
# 基本的なログ表示
kubectl logs <pod-name>

# 複数コンテナPodの場合
kubectl logs <pod-name> -c <container-name>

# 前のコンテナインスタンスのログ
kubectl logs <pod-name> --previous

# Deploymentの全Podログ
kubectl logs deployment/<deployment-name>

# リアルタイム監視
kubectl logs -f deployment/<deployment-name>

# 複数Podの同時監視
kubectl logs -l app=my-app -f

# 特定時間以降のログ
kubectl logs <pod-name> --since=1h

# 最新N行のみ
kubectl logs <pod-name> --tail=100
```

#### 実践的なログ調査パターン

```bash
#!/bin/bash
# ログ調査スクリプト例

# 1. アプリケーション全体のエラーログ抽出
echo "=== エラーログ検索 ==="
kubectl logs -l app=my-web-app --since=1h | grep -i error

# 2. 特定時間帯の負荷状況確認
echo "=== 負荷状況確認 ==="
kubectl logs -l app=my-web-app --since=10m | grep -E "(request|response|latency)"

# 3. Pod再起動の調査
echo "=== Pod再起動調査 ==="
kubectl get events --field-selector reason=Killing,reason=Created --sort-by='.lastTimestamp'

# 4. リソース制限によるPod終了確認
echo "=== リソース制限確認 ==="
kubectl describe pods -l app=my-web-app | grep -A 5 -B 5 "OOMKilled\|Evicted"
```

### 構造化ログの実装

```javascript
// Node.js での構造化ログ実装例
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'my-web-app',
    version: process.env.APP_VERSION || '1.0.0',
    namespace: process.env.NAMESPACE || 'default',
    pod: process.env.HOSTNAME || 'unknown'
  },
  transports: [
    new winston.transports.Console()
  ]
});

// 使用例
logger.info('ユーザーリクエスト処理開始', {
  userId: 12345,
  requestId: 'req-abc123',
  method: 'GET',
  path: '/api/users'
});

logger.error('データベース接続エラー', {
  error: error.message,
  stack: error.stack,
  database: 'postgresql',
  query: 'SELECT * FROM users'
});
```

---

## クラスターレベルロギング実装

### EFK スタック (Elasticsearch + Fluentd + Kibana)

#### 1. Elasticsearch クラスター構築

```yaml
# Elasticsearch StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: logging
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      initContainers:
      - name: fix-permissions
        image: busybox
        command: ["sh", "-c", "chown -R 1000:1000 /usr/share/elasticsearch/data"]
        securityContext:
          privileged: true
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
        ports:
        - containerPort: 9200
          name: rest
        - containerPort: 9300
          name: inter-node
        env:
        - name: cluster.name
          value: "elasticsearch-cluster"
        - name: node.name
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: discovery.seed_hosts
          value: "elasticsearch-0.elasticsearch,elasticsearch-1.elasticsearch,elasticsearch-2.elasticsearch"
        - name: cluster.initial_master_nodes
          value: "elasticsearch-0,elasticsearch-1,elasticsearch-2"
        - name: ES_JAVA_OPTS
          value: "-Xms2g -Xmx2g"
        - name: xpack.security.enabled
          value: "false"
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
        resources:
          requests:
            memory: 3Gi
            cpu: 1000m
          limits:
            memory: 4Gi
            cpu: 2000m
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 50Gi
---
# Elasticsearch Service
apiVersion: v1
kind: Service
metadata:
  name: elasticsearch
  namespace: logging
spec:
  clusterIP: None
  ports:
  - port: 9200
    name: rest
  - port: 9300
    name: inter-node
  selector:
    app: elasticsearch
```

#### 2. Fluentd ログ収集設定

```yaml
# Fluentd ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: logging
data:
  fluent.conf: |
    # Kubernetesメタデータ取得
    <source>
      @type tail
      @id in_tail_container_logs
      path /var/log/containers/*.log
      pos_file /var/log/containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    # Kubernetesメタデータ追加
    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      skip_labels false
      skip_container_metadata false
      skip_namespace_metadata false
    </filter>

    # 日本語対応の正規化
    <filter kubernetes.**>
      @type record_transformer
      <record>
        hostname ${hostname}
        cluster_name k8s-learning-cluster
        @timestamp ${time}
      </record>
    </filter>

    # システムログ除外
    <filter kubernetes.**>
      @type grep
      <exclude>
        key $.kubernetes.namespace_name
        pattern ^(kube-system|kube-public|logging)$
      </exclude>
    </filter>

    # Elasticsearch出力
    <match kubernetes.**>
      @type elasticsearch
      @id out_es
      host elasticsearch.logging.svc.cluster.local
      port 9200
      logstash_format true
      logstash_prefix kubernetes
      logstash_dateformat %Y.%m.%d
      include_tag_key true
      type_name _doc
      tag_key @log_name
      <buffer>
        @type file
        path /var/log/buffer/kubernetes
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
---
# Fluentd DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: logging
spec:
  selector:
    matchLabels:
      name: fluentd
  template:
    metadata:
      labels:
        name: fluentd
    spec:
      serviceAccount: fluentd
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
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
        - name: config-volume
          mountPath: /fluentd/etc
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: config-volume
        configMap:
          name: fluentd-config
```

#### 3. Kibana 可視化ダッシュボード

```yaml
# Kibana Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kibana
  namespace: logging
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kibana
  template:
    metadata:
      labels:
        app: kibana
    spec:
      containers:
      - name: kibana
        image: docker.elastic.co/kibana/kibana:7.17.0
        ports:
        - containerPort: 5601
        env:
        - name: ELASTICSEARCH_HOSTS
          value: "http://elasticsearch.logging.svc.cluster.local:9200"
        - name: I18N_LOCALE
          value: "ja-JP"
        resources:
          requests:
            memory: 1Gi
            cpu: 500m
          limits:
            memory: 2Gi
            cpu: 1000m
---
# Kibana Service
apiVersion: v1
kind: Service
metadata:
  name: kibana
  namespace: logging
spec:
  type: NodePort
  ports:
  - port: 5601
    targetPort: 5601
    nodePort: 30601
  selector:
    app: kibana
```

---

## モニタリング基礎

### Kubernetesネイティブメトリクス

#### Metrics Server インストール

```yaml
# Metrics Server
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metrics-server
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: metrics-server
  template:
    metadata:
      labels:
        k8s-app: metrics-server
    spec:
      containers:
      - args:
        - --cert-dir=/tmp
        - --secure-port=4443
        - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
        - --kubelet-use-node-status-port
        - --metric-resolution=15s
        - --kubelet-insecure-tls
        image: k8s.gcr.io/metrics-server/metrics-server:v0.6.1
        name: metrics-server
        ports:
        - containerPort: 4443
          name: https
          protocol: TCP
        resources:
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - mountPath: /tmp
          name: tmp-dir
      volumes:
      - emptyDir: {}
        name: tmp-dir
```

#### 基本的なメトリクス確認

```bash
# ノードリソース使用量
kubectl top nodes

# Pod リソース使用量
kubectl top pods --all-namespaces

# 特定NamespaceのPod使用量
kubectl top pods -n my-app

# 使用量の多いPodを特定
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top pods --all-namespaces --sort-by=memory

# HPA (Horizontal Pod Autoscaler) 設定
kubectl autoscale deployment my-web-app --cpu-percent=70 --min=2 --max=10
```

---

## Prometheus + Grafana実装

### Prometheus Operator によるモニタリング構築

#### 1. Prometheus Operator インストール

```yaml
# Prometheus Custom Resource
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 2
  retention: 30d
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 50Gi
  serviceAccountName: prometheus
  serviceMonitorSelector:
    matchLabels:
      team: platform
  ruleSelector:
    matchLabels:
      team: platform
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
    limits:
      memory: 4Gi
      cpu: 2000m
  securityContext:
    fsGroup: 2000
    runAsNonRoot: true
    runAsUser: 1000
---
# ServiceMonitor でアプリケーションメトリクス収集
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-web-app-metrics
  namespace: monitoring
  labels:
    team: platform
spec:
  selector:
    matchLabels:
      app: my-web-app
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

#### 2. アプリケーションメトリクス露出

```javascript
// Node.js アプリケーションでのPrometheusメトリクス
const express = require('express');
const promClient = require('prom-client');

// デフォルトメトリクス収集
promClient.collectDefaultMetrics({ prefix: 'my_app_' });

// カスタムメトリクス定義
const httpRequestDuration = new promClient.Histogram({
  name: 'my_app_http_request_duration_seconds',
  help: 'HTTPリクエスト処理時間',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'my_app_http_requests_total',
  help: 'HTTPリクエスト総数',
  labelNames: ['method', 'route', 'status']
});

const activeConnections = new promClient.Gauge({
  name: 'my_app_active_connections',
  help: 'アクティブな接続数'
});

const app = express();

// メトリクス記録ミドルウェア
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
});

// メトリクス公開エンドポイント
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});

app.listen(3000, () => {
  console.log('アプリケーション開始: http://localhost:3000');
});
```

#### 3. Grafana ダッシュボード設定

```yaml
# Grafana Deployment
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
        image: grafana/grafana:9.1.0
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secret
              key: admin-password
        - name: GF_INSTALL_PLUGINS
          value: "grafana-clock-panel,grafana-simple-json-datasource"
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        - name: grafana-config
          mountPath: /etc/grafana/provisioning
        resources:
          requests:
            memory: 512Mi
            cpu: 250m
          limits:
            memory: 1Gi
            cpu: 500m
      volumes:
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-pvc
      - name: grafana-config
        configMap:
          name: grafana-config
---
# Grafana ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-config
  namespace: monitoring
data:
  datasource.yaml: |
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      access: proxy
      url: http://prometheus.monitoring.svc.cluster.local:9090
      isDefault: true
  dashboard.yaml: |
    apiVersion: 1
    providers:
    - name: 'default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      editable: true
      options:
        path: /var/lib/grafana/dashboards
```

### PrometheusRule による アラート設定

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-app-alerts
  namespace: monitoring
  labels:
    team: platform
spec:
  groups:
  - name: my-app.rules
    rules:
    # 高CPU使用率アラート
    - alert: PodHighCPU
      expr: (rate(container_cpu_usage_seconds_total[5m]) * 100) > 80
      for: 2m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "Pod {{ $labels.pod }} のCPU使用率が高い"
        description: "Pod {{ $labels.pod }} のCPU使用率が {{ $value }}% です"
    
    # 高メモリ使用率アラート
    - alert: PodHighMemory
      expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100 > 90
      for: 5m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Pod {{ $labels.pod }} のメモリ使用率が高い"
        description: "Pod {{ $labels.pod }} のメモリ使用率が {{ $value }}% です"
    
    # HTTPエラー率アラート
    - alert: HTTPHighErrorRate
      expr: (rate(my_app_http_requests_total{status=~"5.."}[5m]) / rate(my_app_http_requests_total[5m])) * 100 > 5
      for: 3m
      labels:
        severity: warning
        team: platform
      annotations:
        summary: "HTTPエラー率が高い"
        description: "過去5分間のHTTPエラー率が {{ $value }}% です"
    
    # Pod再起動アラート
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: critical
        team: platform
      annotations:
        summary: "Pod {{ $labels.pod }} が繰り返し再起動している"
        description: "Pod {{ $labels.pod }} が15分間で {{ $value }} 回再起動しました"
```

---

## 実践演習プロジェクト

### 総合モニタリング・ロギング環境構築

#### プロジェクト概要
Node.js WebアプリケーションとPostgreSQLデータベースからなるシステムに対して、包括的なモニタリング・ロギング環境を構築します。

#### 1. アプリケーション準備

```yaml
# アプリケーション名前空間
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring-demo
  labels:
    monitoring: enabled
---
# PostgreSQL Secret
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: monitoring-demo
type: Opaque
data:
  username: cG9zdGdyZXM=  # postgres
  password: cGFzc3dvcmQxMjM=  # password123
---
# PostgreSQL ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: monitoring-demo
data:
  postgresql.conf: |
    # ログ設定
    log_destination = 'stderr'
    logging_collector = on
    log_directory = '/var/log/postgresql'
    log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
    log_statement = 'all'
    log_min_duration_statement = 100
    
    # 接続設定
    max_connections = 100
    shared_buffers = 128MB
---
# PostgreSQL StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: monitoring-demo
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
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9187"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: postgres
        image: postgres:13
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: monitoring_demo
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql
        resources:
          requests:
            memory: 256Mi
            cpu: 250m
          limits:
            memory: 512Mi
            cpu: 500m
      
      # PostgreSQL Exporter（メトリクス収集）
      - name: postgres-exporter
        image: prometheuscommunity/postgres-exporter:v0.10.1
        ports:
        - containerPort: 9187
        env:
        - name: DATA_SOURCE_NAME
          value: "postgresql://postgres:password123@localhost:5432/monitoring_demo?sslmode=disable"
        resources:
          requests:
            memory: 64Mi
            cpu: 50m
          limits:
            memory: 128Mi
            cpu: 100m
      
      volumes:
      - name: postgres-config
        configMap:
          name: postgres-config
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

#### 2. 詳細な Web アプリケーション

```yaml
# WebアプリケーションConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: webapp-config
  namespace: monitoring-demo
data:
  app.env: |
    NODE_ENV=production
    PORT=3000
    METRICS_PORT=9090
    LOG_LEVEL=info
    DATABASE_URL=postgresql://postgres:password123@postgres:5432/monitoring_demo
---
# WebアプリケーションDeployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: monitoring-demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: webapp
        image: node:16-alpine
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        - name: METRICS_PORT
          value: "9090"
        - name: DATABASE_URL
          value: "postgresql://postgres:password123@postgres:5432/monitoring_demo"
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        volumeMounts:
        - name: app-config
          mountPath: /app/.env
          subPath: app.env
        - name: app-code
          mountPath: /app
        command: ["node", "/app/server.js"]
        resources:
          requests:
            memory: 128Mi
            cpu: 100m
          limits:
            memory: 256Mi
            cpu: 500m
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
      - name: app-config
        configMap:
          name: webapp-config
      - name: app-code
        configMap:
          name: webapp-source
---
# Service 設定
apiVersion: v1
kind: Service
metadata:
  name: webapp
  namespace: monitoring-demo
  labels:
    app: webapp
spec:
  type: NodePort
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 30100
    name: http
  - port: 9090
    targetPort: 9090
    name: metrics
  selector:
    app: webapp
```

#### 3. ログ解析とアラートの実装

```yaml
# カスタムログパーサー設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-parser-config
  namespace: monitoring-demo
data:
  parser.conf: |
    [PARSER]
        Name webapp_json
        Format json
        Time_Key timestamp
        Time_Format %Y-%m-%dT%H:%M:%S.%L%z
        Time_Keep On
        Decode_Field_As escaped_utf8 message
    
    [PARSER]
        Name postgres_log
        Format regex
        Regex ^(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3} \w+)\s+\[(?<pid>\d+)\]\s+(?<level>\w+):\s+(?<message>.*)$
        Time_Key timestamp
        Time_Format %Y-%m-%d %H:%M:%S.%L %Z
---
# FluentBit ログ収集設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: monitoring-demo
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
    
    [INPUT]
        Name              tail
        Tag               webapp.*
        Path              /var/log/containers/*webapp*.log
        Parser            webapp_json
        DB                /var/log/webapp.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
        Refresh_Interval  10
    
    [INPUT]
        Name              tail
        Tag               postgres.*
        Path              /var/log/containers/*postgres*.log
        Parser            postgres_log
        DB                /var/log/postgres.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
        Refresh_Interval  10
    
    [FILTER]
        Name                kubernetes
        Match               *
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix     kube.var.log.containers.
        Merge_Log           On
        Keep_Log            Off
        Annotations         Off
        Labels              On
    
    [FILTER]
        Name                grep
        Match               webapp.*
        Regex               level (error|warn|info)
    
    [OUTPUT]
        Name                elasticsearch
        Match               *
        Host                elasticsearch.logging.svc.cluster.local
        Port                9200
        Index               monitoring-demo
        Type                _doc
        Logstash_Format     On
        Logstash_Prefix     monitoring-demo
        Logstash_DateFormat %Y.%m.%d
        Time_Key            @timestamp
        Time_Key_Format     %Y-%m-%dT%H:%M:%S.%L%z
        Include_Tag_Key     On
        Tag_Key             @log_name
        Generate_ID         On
```

---

## トラブルシューティング

### 一般的な問題と解決方法

#### 1. ログが表示されない問題

```bash
# 診断手順
echo "=== ログ問題診断 ==="

# 1. Pod状態確認
kubectl get pods -n my-app
kubectl describe pod <pod-name> -n my-app

# 2. コンテナログ確認
kubectl logs <pod-name> -n my-app
kubectl logs <pod-name> -c <container-name> -n my-app --previous

# 3. イベント確認
kubectl get events -n my-app --sort-by='.lastTimestamp'

# 4. kubelet ログ確認
journalctl -u kubelet | grep -i error

# 5. Docker/containerd ログ確認
journalctl -u docker
# または
journalctl -u containerd
```

#### 2. メトリクス収集問題

```bash
# Prometheus ターゲット確認
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# ブラウザで http://localhost:9090/targets を確認

# ServiceMonitor確認
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor <name> -n monitoring

# メトリクスエンドポイント直接確認
kubectl port-forward <pod-name> 9090:9090
curl http://localhost:9090/metrics
```

#### 3. 高負荷時のログ調査

```bash
#!/bin/bash
# 高負荷調査スクリプト

echo "=== 高負荷時のシステム状態調査 ==="

# リソース使用量上位Pod
echo "--- CPU使用量TOP10 ---"
kubectl top pods --all-namespaces --sort-by=cpu | head -10

echo "--- メモリ使用量TOP10 ---"
kubectl top pods --all-namespaces --sort-by=memory | head -10

# エラーログ抽出
echo "--- 過去1時間のエラーログ ---"
kubectl logs -l app=webapp --since=1h | grep -i "error\|exception\|fail" | tail -20

# ネットワーク関連エラー
echo "--- ネットワークエラー ---"
kubectl get events --all-namespaces | grep -i "network\|dns\|timeout"

# ストレージ問題
echo "--- ストレージ問題 ---"
kubectl get pvc --all-namespaces | grep -v Bound
kubectl get events | grep -i "volume\|pvc\|storage"
```

#### 4. パフォーマンス問題診断

```yaml
# パフォーマンステスト用Job
apiVersion: batch/v1
kind: Job
metadata:
  name: performance-test
spec:
  template:
    spec:
      containers:
      - name: load-test
        image: williamyeh/wrk
        command: ["wrk"]
        args: [
          "-t12",
          "-c400",
          "-d30s",
          "--timeout=10s",
          "http://webapp.monitoring-demo.svc.cluster.local:3000/"
        ]
      restartPolicy: Never
```

---

## 本番運用ベストプラクティス

### セキュリティ設定

#### 1. RBAC によるアクセス制御

```yaml
# モニタリング用サービスアカウント
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-user
  namespace: monitoring
---
# ClusterRole 定義
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-reader
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/metrics", "pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions", "apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["monitoring.coreos.com"]
  resources: ["servicemonitors", "prometheusrules"]
  verbs: ["get", "list", "watch"]
---
# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-reader-binding
subjects:
- kind: ServiceAccount
  name: monitoring-user
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: monitoring-reader
  apiGroup: rbac.authorization.k8s.io
```

#### 2. Network Policy による通信制御

```yaml
# モニタリング間通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: monitoring
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090  # Prometheus
    - protocol: TCP
      port: 3000  # Grafana
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 9090  # メトリクス収集
    - protocol: TCP
      port: 443   # HTTPS
    - protocol: TCP
      port: 53    # DNS
    - protocol: UDP
      port: 53    # DNS
```

### 自動化とCI/CD統合

#### 1. GitOps によるモニタリング設定管理

```yaml
# ArgoCD Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: monitoring-stack
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/k8s-monitoring
    targetRevision: HEAD
    path: manifests/monitoring
  destination:
    server: https://kubernetes.default.svc
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

#### 2. Helm による構成管理

```yaml
# values.yaml for monitoring stack
prometheus:
  retention: 30d
  storage:
    size: 50Gi
  resources:
    requests:
      memory: 2Gi
      cpu: 1000m
    limits:
      memory: 4Gi
      cpu: 2000m

grafana:
  adminPassword: changeme
  persistence:
    enabled: true
    size: 10Gi
  plugins:
    - grafana-clock-panel
    - grafana-simple-json-datasource

elasticsearch:
  replicas: 3
  storage:
    size: 100Gi
  javaOpts: "-Xms2g -Xmx2g"

fluentd:
  resources:
    limits:
      memory: 200Mi
    requests:
      cpu: 100m
      memory: 200Mi
```

### 運用監視ダッシュボード

#### 1. SLI/SLO ダッシュボード

```json
{
  "dashboard": {
    "title": "サービスレベル監視",
    "panels": [
      {
        "title": "可用性 (99.9% SLO)",
        "type": "singlestat",
        "targets": [
          {
            "expr": "(1 - (rate(my_app_http_requests_total{status=~\"5..\"}[5m]) / rate(my_app_http_requests_total[5m]))) * 100"
          }
        ],
        "thresholds": "99.9,99.5"
      },
      {
        "title": "レスポンス時間 (P95 < 500ms SLO)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(my_app_http_request_duration_seconds_bucket[5m])) * 1000"
          }
        ]
      },
      {
        "title": "エラー率 (< 1% SLO)",
        "type": "graph",
        "targets": [
          {
            "expr": "(rate(my_app_http_requests_total{status=~\"5..\"}[5m]) / rate(my_app_http_requests_total[5m])) * 100"
          }
        ]
      }
    ]
  }
}
```

#### 2. 運用メトリクスダッシュボード

```json
{
  "dashboard": {
    "title": "Kubernetes クラスター監視",
    "panels": [
      {
        "title": "ノードリソース使用率",
        "type": "graph",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "メモリ使用率 - {{instance}}"
          },
          {
            "expr": "(1 - rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100",
            "legendFormat": "CPU使用率 - {{instance}}"
          }
        ]
      },
      {
        "title": "Pod 状態",
        "type": "table",
        "targets": [
          {
            "expr": "kube_pod_status_phase",
            "format": "table"
          }
        ]
      }
    ]
  }
}
```

### まとめ

このガイドでは、AWS ECS管理者向けにKubernetesでのモニタリングとロギングを包括的に学習する内容をお伝えしました。

**主要な学習ポイント**:

1. **段階的アプローチ**: 基本のkubectl logsから始まり、クラスターレベルの本格的なシステムまで
2. **実践重視**: 実際のコードと設定例で即座に試せる内容
3. **ECS比較**: 既存のECS知識を活かした移行アプローチ
4. **セキュリティ配慮**: 本番運用に耐える設定とベストプラクティス
5. **トラブルシューティング**: 実際の運用で遭遇する問題への対処法

次のステップとして、実際の環境でこれらの設定を試し、自社のアプリケーションに適用してみてください。継続的な学習と改善により、効果的なKubernetesモニタリング・ロギング環境を構築できるでしょう。

### 🚀 実践的な学習を始めよう

理論の学習が完了したら、ぜひ実際に手を動かして学習を深めてください。

**ハンズオン演習の場所**:
```bash
cd hands-on/monitoring-logging/
./scripts/setup.sh
```

**段階的な演習内容**:
- **Phase 1**: kubectl logs の完全マスター（60-90分）
- **Phase 2**: 実際のWebアプリでの構造化ログ実装（90-120分）
- **Phase 3**: EFK スタックによるクラスターレベルロギング（120-150分）
- **Phase 4**: Prometheus + Grafana モニタリング構築（120-150分）
- **Phase 5**: アラート設定とトラブルシューティング（90-120分）

次のステップとして、実際の環境でこれらの設定を試し、自社のアプリケーションに適用してみてください。継続的な学習と改善により、効果的なKubernetesモニタリング・ロギング環境を構築できるでしょう。
