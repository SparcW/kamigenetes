# 📄 Kubernetes設定ファイルリファレンス

このガイドでは、Kubernetesで使用する主要なYAML設定ファイルの実例とベストプラクティスを、AWS ECS経験者向けに詳しく解説します。実用的な設定例と運用上の注意点を中心に構成されています。

## 📋 目次

1. [基本設定ファイル](#基本設定ファイル)
2. [ワークロード設定](#ワークロード設定)
3. [ネットワーク設定](#ネットワーク設定)
4. [ストレージ設定](#ストレージ設定)
5. [セキュリティ設定](#セキュリティ設定)
6. [設定管理](#設定管理)
7. [監視・ログ設定](#監視ログ設定)
8. [ベストプラクティス](#ベストプラクティス)

## 🔄 AWS ECSとの設定比較

| AWS ECS | Kubernetes | 設定ファイル例 |
|---------|------------|---------------|
| **Task Definition** | **Deployment + Pod** | `deployment.yaml` |
| **Service Definition** | **Service** | `service.yaml` |
| **ALB/Target Group** | **Ingress** | `ingress.yaml` |
| **Parameter Store** | **ConfigMap** | `configmap.yaml` |
| **Secrets Manager** | **Secret** | `secret.yaml` |
| **Task Role** | **ServiceAccount + RBAC** | `rbac.yaml` |

## 📄 基本設定ファイル

### 1. Pod設定

```yaml
# pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
  namespace: production
  labels:
    app: example-app
    version: v1.0.0
    environment: production
    team: platform
  annotations:
    description: "Example application pod"
    maintainer: "team-platform@company.com"
    deployment.kubernetes.io/revision: "1"
spec:
  serviceAccountName: example-app-sa
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: app
    image: example-app:v1.0.0
    imagePullPolicy: IfNotPresent
    ports:
    - name: http
      containerPort: 8080
      protocol: TCP
    - name: metrics
      containerPort: 9090
      protocol: TCP
    env:
    - name: ENV
      value: "production"
    - name: LOG_LEVEL
      value: "info"
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: database.host
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: database.password
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
        ephemeral-storage: "1Gi"
      limits:
        memory: "512Mi"
        cpu: "500m"
        ephemeral-storage: "2Gi"
    livenessProbe:
      httpGet:
        path: /health
        port: http
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: http
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 3
    startupProbe:
      httpGet:
        path: /startup
        port: http
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 30
    volumeMounts:
    - name: app-config
      mountPath: /etc/config
      readOnly: true
    - name: app-logs
      mountPath: /var/log/app
    - name: tmp-storage
      mountPath: /tmp
  volumes:
  - name: app-config
    configMap:
      name: app-config
      defaultMode: 0644
  - name: app-logs
    emptyDir:
      sizeLimit: 1Gi
  - name: tmp-storage
    emptyDir:
      sizeLimit: 512Mi
  restartPolicy: Always
  terminationGracePeriodSeconds: 30
  dnsPolicy: ClusterFirst
  nodeSelector:
    workload-type: application
  tolerations:
  - key: "workload"
    operator: "Equal"
    value: "application"
    effect: "NoSchedule"
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app
              operator: In
              values: ["example-app"]
          topologyKey: kubernetes.io/hostname
```

### 2. Namespace設定

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    name: production
    environment: production
    cost-center: "platform"
    owner: "team-platform"
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
  annotations:
    description: "Production environment namespace"
    contact: "team-platform@company.com"
    budget-limit: "10000"
spec:
  finalizers:
  - kubernetes
---
# ResourceQuota for namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    requests.storage: 100Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    persistentvolumeclaims: "10"
    pods: "50"
    services: "20"
    secrets: "30"
    configmaps: "20"
---
# LimitRange for namespace
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
  - max:
      cpu: "2000m"
      memory: "4Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
    type: Container
```

## 🚀 ワークロード設定

### 1. Deployment設定

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: production
  labels:
    app: web-app
    component: frontend
    version: v2.1.0
  annotations:
    deployment.kubernetes.io/revision: "1"
    description: "Web application frontend"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: web-app
      component: frontend
  template:
    metadata:
      labels:
        app: web-app
        component: frontend
        version: v2.1.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: web-app-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: web-app
        image: web-app:v2.1.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 8080
        - name: metrics
          containerPort: 9090
        env:
        - name: NODE_ENV
          value: "production"
        - name: API_ENDPOINT
          valueFrom:
            configMapKeyRef:
              name: web-app-config
              key: api.endpoint
        envFrom:
        - configMapRef:
            name: web-app-config
        - secretRef:
            name: web-app-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config-volume
          mountPath: /etc/config
        - name: cache-volume
          mountPath: /app/cache
      volumes:
      - name: config-volume
        configMap:
          name: web-app-config
      - name: cache-volume
        emptyDir:
          sizeLimit: 1Gi
      nodeSelector:
        workload-type: application
      tolerations:
      - key: "workload"
        operator: "Equal"
        value: "application"
        effect: "NoSchedule"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: ["web-app"]
              topologyKey: kubernetes.io/hostname
```

### 2. StatefulSet設定

```yaml
# statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: production
  labels:
    app: postgres
    component: database
spec:
  serviceName: postgres-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
        component: database
    spec:
      serviceAccountName: postgres-sa
      securityContext:
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      containers:
      - name: postgres
        image: postgres:14-alpine
        ports:
        - name: postgres
          containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "myapp"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        - name: PGDATA
          value: "/var/lib/postgresql/data/pgdata"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - exec pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1 -p 5432
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 6
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - exec pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1 -p 5432
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 6
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
      volumes:
      - name: postgres-config
        configMap:
          name: postgres-config
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp3-encrypted
      resources:
        requests:
          storage: 50Gi
```

### 3. DaemonSet設定

```yaml
# daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: kube-system
  labels:
    app: fluentd
    component: logging
spec:
  selector:
    matchLabels:
      app: fluentd
  template:
    metadata:
      labels:
        app: fluentd
        component: logging
    spec:
      serviceAccountName: fluentd
      tolerations:
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
      - key: node-role.kubernetes.io/control-plane
        effect: NoSchedule
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1.14-debian-elasticsearch7-1
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        - name: FLUENT_ELASTICSEARCH_SCHEME
          value: "http"
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: fluentd-config
          mountPath: /fluentd/etc/conf.d
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

## 🌐 ネットワーク設定

### 1. Service設定

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
  namespace: production
  labels:
    app: web-app
    component: frontend
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
spec:
  type: ClusterIP  # ClusterIP, NodePort, LoadBalancer, ExternalName
  selector:
    app: web-app
    component: frontend
  ports:
  - name: http
    port: 80
    targetPort: http
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: metrics
    protocol: TCP
  sessionAffinity: None
---
# LoadBalancer Service例
apiVersion: v1
kind: Service
metadata:
  name: web-app-lb
  namespace: production
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
spec:
  type: LoadBalancer
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 8080
  loadBalancerSourceRanges:
  - 203.0.113.0/24
---
# Headless Service例
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
  namespace: production
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### 2. Ingress設定

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app-ingress
  namespace: production
  labels:
    app: web-app
  annotations:
    # NGINX Ingress Controller
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    
    # セキュリティヘッダー
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains";
    
    # レート制限
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    
    # SSL証明書（cert-manager）
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    
    # AWS ALB Controller
    # kubernetes.io/ingress.class: alb
    # alb.ingress.kubernetes.io/scheme: internet-facing
    # alb.ingress.kubernetes.io/target-type: ip
    # alb.ingress.kubernetes.io/healthcheck-path: /health
spec:
  tls:
  - hosts:
    - app.example.com
    - api.example.com
    secretName: web-app-tls
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app-service
            port:
              number: 80
  - host: api.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
      - path: /health
        pathType: Exact
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

### 3. NetworkPolicy設定

```yaml
# networkpolicy.yaml
# デフォルト拒否ポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# DNS通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
---
# Web → API通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      component: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          component: frontend
    ports:
    - protocol: TCP
      port: 8080
---
# 外部HTTPS通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-https
  namespace: production
spec:
  podSelector:
    matchLabels:
      external-access: "true"
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

## 💾 ストレージ設定

### 1. StorageClass設定

```yaml
# storageclass.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-encrypted
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"
  iops: "3000"
  throughput: "125"
  kmsKeyId: "arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Delete
---
# 高性能ストレージ
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: io2-high-performance
provisioner: ebs.csi.aws.com
parameters:
  type: io2
  fsType: ext4
  encrypted: "true"
  iops: "10000"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Retain
---
# 共有ストレージ（EFS）
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-storage
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap
  fileSystemId: fs-0123456789abcdef0
  directoryPerms: "0755"
reclaimPolicy: Retain
```

### 2. PersistentVolume/PersistentVolumeClaim設定

```yaml
# pv-pvc.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
  labels:
    app: postgres
    environment: production
spec:
  capacity:
    storage: 100Gi
  volumeMode: Filesystem
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: gp3-encrypted
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: vol-0123456789abcdef0
    fsType: ext4
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: topology.ebs.csi.aws.com/zone
          operator: In
          values:
          - us-west-2a
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: production
  labels:
    app: postgres
spec:
  accessModes:
  - ReadWriteOnce
  volumeMode: Filesystem
  resources:
    requests:
      storage: 100Gi
  storageClassName: gp3-encrypted
  selector:
    matchLabels:
      app: postgres
---
# 共有ストレージ用PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage
  namespace: production
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 1Ti
  storageClassName: efs-storage
```

## 🔐 セキュリティ設定

### 1. ServiceAccount・RBAC設定

```yaml
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web-app-sa
  namespace: production
  labels:
    app: web-app
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/WebAppRole
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: web-app-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: web-app-rolebinding
  namespace: production
subjects:
- kind: ServiceAccount
  name: web-app-sa
  namespace: production
roleRef:
  kind: Role
  name: web-app-role
  apiGroup: rbac.authorization.k8s.io
---
# ClusterRole例
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-reader
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/metrics", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: monitoring-reader
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
```

### 2. Pod Security Standards設定

```yaml
# pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: secure-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# セキュアなPod設定例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
  namespace: secure-namespace
spec:
  replicas: 2
  selector:
    matchLabels:
      app: secure-app
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      serviceAccountName: secure-app-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: secure-app
        image: secure-app:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE
        resources:
          limits:
            cpu: 500m
            memory: 512Mi
            ephemeral-storage: 1Gi
          requests:
            cpu: 100m
            memory: 128Mi
            ephemeral-storage: 512Mi
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: cache-volume
          mountPath: /app/cache
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: cache-volume
        emptyDir:
          sizeLimit: 100Mi
```

## ⚙️ 設定管理

### 1. ConfigMap設定

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
  labels:
    app: web-app
    config-type: application
data:
  # キー・バリュー形式
  database.host: "postgres.production.svc.cluster.local"
  database.port: "5432"
  database.name: "myapp"
  api.timeout: "30s"
  log.level: "info"
  
  # ファイル形式
  nginx.conf: |
    server {
        listen 80;
        server_name _;
        
        location / {
            proxy_pass http://backend:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
    
  app.properties: |
    spring.datasource.url=jdbc:postgresql://postgres:5432/myapp
    spring.datasource.username=${DB_USERNAME}
    spring.datasource.password=${DB_PASSWORD}
    spring.jpa.hibernate.ddl-auto=validate
    spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
    
    logging.level.com.company.app=INFO
    logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} - %msg%n
    
    management.endpoints.web.exposure.include=health,metrics,info
    management.endpoint.health.show-details=always
    
  config.yaml: |
    api:
      host: "0.0.0.0"
      port: 8080
      timeout: 30s
    database:
      host: postgres
      port: 5432
      name: myapp
      pool_size: 10
    redis:
      host: redis
      port: 6379
      db: 0
    logging:
      level: info
      format: json
---
# Binary data用ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-binary-config
  namespace: production
binaryData:
  app.jar: <base64-encoded-binary-data>
  truststore.jks: <base64-encoded-binary-data>
```

### 2. Secret設定

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
  labels:
    app: web-app
    secret-type: application
type: Opaque
data:
  # base64エンコード済み
  database.username: bXlhcHA=  # myapp
  database.password: cGFzc3dvcmQxMjM=  # password123
  api.key: YWJjZGVmZ2hpams=  # abcdefghijk
stringData:
  # プレーンテキスト（自動でbase64エンコード）
  redis.password: "redis-secret-password"
  jwt.secret: "super-secret-jwt-key-for-production"
  
  # JSON形式の設定
  service-account.json: |
    {
      "type": "service_account",
      "project_id": "my-project",
      "private_key_id": "key-id",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "service@my-project.iam.gserviceaccount.com",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token"
    }
---
# TLS Secret
apiVersion: v1
kind: Secret
metadata:
  name: web-app-tls
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi... # base64エンコード済み証明書
  tls.key: LS0tLS1CRUdJTi... # base64エンコード済み秘密鍵
---
# Docker Registry Secret
apiVersion: v1
kind: Secret
metadata:
  name: docker-registry-secret
  namespace: production
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: eyJhdXRocyI6eyJoYXJib3IuY29tcGFueS5jb20iOnsidXNlcm5hbWUiOiJkZXBsb3kiLCJwYXNzd29yZCI6InBhc3N3b3JkIiwiYXV0aCI6IlpHVndiRzk1T25CaGMzTjNiM0prIiwiZW1haWwiOiJkZXBsb3lAY29tcGFueS5jb20ifX19
---
# Basic Auth Secret
apiVersion: v1
kind: Secret
metadata:
  name: basic-auth
  namespace: production
type: Opaque
data:
  auth: YWRtaW46JGFwcjEkSDY1dnBkTU8kLlRiaUY3T2RPTnI5Zzc2RlNma3k4MA== # admin:admin
```

## 📊 監視・ログ設定

### 1. ServiceMonitor設定（Prometheus）

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: web-app-metrics
  namespace: production
  labels:
    app: web-app
    monitoring: enabled
spec:
  selector:
    matchLabels:
      app: web-app
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    scheme: http
    honorLabels: true
    relabelings:
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod_name
    - sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: kubernetes_namespace
  namespaceSelector:
    matchNames:
    - production
---
# PrometheusRule設定
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: web-app-alerts
  namespace: production
  labels:
    app: web-app
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: web-app
    rules:
    - alert: WebAppDown
      expr: up{job="web-app-metrics"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Web application is down"
        description: "Web application {{ $labels.instance }} has been down for more than 1 minute."
    
    - alert: WebAppHighMemoryUsage
      expr: container_memory_usage_bytes{pod=~"web-app-.*"} / container_spec_memory_limit_bytes > 0.8
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage detected"
        description: "Pod {{ $labels.pod }} memory usage is above 80% for more than 5 minutes."
    
    - alert: WebAppHighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"
        description: "Error rate is above 10% for more than 2 minutes."
```

### 2. ログ設定（Fluent Bit）

```yaml
# fluentbit-config.yaml
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

    @INCLUDE input-kubernetes.conf
    @INCLUDE filter-kubernetes.conf
    @INCLUDE output-cloudwatch.conf

  input-kubernetes.conf: |
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
        Refresh_Interval  10

  filter-kubernetes.conf: |
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix     kube.var.log.containers.
        Merge_Log           On
        Merge_Log_Key       log_processed
        K8S-Logging.Parser  On
        K8S-Logging.Exclude Off

    [FILTER]
        Name             grep
        Match            kube.*
        Exclude          kubernetes_namespace_name (kube-system|kube-public|kube-node-lease)

    [FILTER]
        Name             modify
        Match            kube.*
        Add              cluster_name production-cluster
        Add              region us-west-2

  output-cloudwatch.conf: |
    [OUTPUT]
        Name                cloudwatch_logs
        Match               kube.*
        region              us-west-2
        log_group_name      /aws/eks/production-cluster/application
        log_stream_prefix   fluentbit-
        auto_create_group   true
        retry_limit         2

  parsers.conf: |
    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ

    [PARSER]
        Name        nginx
        Format      regex
        Regex       ^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) \[(?<time>[^\]]*)\] "(?<method>\S+)(?: +(?<path>[^\"]*?)(?: +\S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^\"]*)" "(?<agent>[^\"]*)")?$
        Time_Key    time
        Time_Format %d/%b/%Y:%H:%M:%S %z
```

## 📚 ベストプラクティス

### 1. 設定ファイル管理

#### ファイル構成
```
k8s-manifests/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── development/
│   │   ├── kustomization.yaml
│   │   ├── deployment-patch.yaml
│   │   └── config-patch.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── deployment-patch.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── deployment-patch.yaml
│       └── hpa.yaml
└── docs/
    └── README.md
```

#### 共通設定テンプレート
```yaml
# _template.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: REPLACE_APP_NAME
  namespace: REPLACE_NAMESPACE
  labels:
    app: REPLACE_APP_NAME
    version: REPLACE_VERSION
    environment: REPLACE_ENVIRONMENT
    team: REPLACE_TEAM
  annotations:
    description: "REPLACE_DESCRIPTION"
    maintainer: "REPLACE_MAINTAINER"
spec:
  replicas: REPLACE_REPLICAS
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: REPLACE_APP_NAME
  template:
    metadata:
      labels:
        app: REPLACE_APP_NAME
        version: REPLACE_VERSION
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: REPLACE_APP_NAME-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: REPLACE_APP_NAME
        image: REPLACE_IMAGE
        ports:
        - name: http
          containerPort: 8080
        - name: metrics
          containerPort: 9090
        env:
        - name: ENVIRONMENT
          value: "REPLACE_ENVIRONMENT"
        envFrom:
        - configMapRef:
            name: REPLACE_APP_NAME-config
        - secretRef:
            name: REPLACE_APP_NAME-secrets
        resources:
          requests:
            memory: "REPLACE_MEMORY_REQUEST"
            cpu: "REPLACE_CPU_REQUEST"
          limits:
            memory: "REPLACE_MEMORY_LIMIT"
            cpu: "REPLACE_CPU_LIMIT"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. 設定検証

#### Linting設定
```yaml
# .yamllint
extends: default
rules:
  line-length:
    max: 120
  comments:
    min-spaces-from-content: 1
  document-start: disable
  truthy:
    allowed-values: ['true', 'false']
    check-keys: false
```

#### ポリシー検証
```yaml
# conftest-policy.rego
package kubernetes.admission

deny[msg] {
  input.kind == "Deployment"
  not input.spec.template.spec.securityContext
  msg := "Deployment must have securityContext"
}

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits
  msg := "Container must have resource limits"
}

deny[msg] {
  input.kind == "Service"
  input.spec.type == "LoadBalancer"
  not input.spec.loadBalancerSourceRanges
  msg := "LoadBalancer service must specify source ranges"
}
```

### 3. セキュリティチェック

#### 必須設定チェックリスト
- [ ] 非rootユーザーで実行（runAsNonRoot: true）
- [ ] 読み取り専用ルートファイルシステム（readOnlyRootFilesystem: true）
- [ ] 権限昇格無効（allowPrivilegeEscalation: false）
- [ ] 不要なCapability削除（capabilities.drop: [ALL]）
- [ ] リソース制限設定（resources.limits）
- [ ] ヘルスチェック設定（livenessProbe, readinessProbe）
- [ ] NetworkPolicy適用
- [ ] Secret適切な管理
- [ ] ServiceAccount最小権限

#### 自動化スクリプト
```bash
#!/bin/bash
# validate-configs.sh

echo "🔍 Kubernetes設定ファイル検証開始..."

# YAML構文チェック
echo "📝 YAML構文チェック..."
find . -name "*.yaml" -o -name "*.yml" | xargs yamllint

# セキュリティポリシーチェック
echo "🔒 セキュリティポリシーチェック..."
find . -name "*.yaml" | xargs conftest verify --policy security-policies/

# Kubernetesリソース検証
echo "⚙️ Kubernetesリソース検証..."
kubectl apply --dry-run=client --validate=true -f .

# リソース使用量チェック
echo "📊 リソース使用量チェック..."
kubectl top nodes
kubectl top pods --all-namespaces

echo "✅ 検証完了"
```

---

**CLI参考リンク**:
- **[kubectl公式リファレンス](https://kubernetes.io/docs/reference/kubectl/)**
- **[Helm公式ドキュメント](https://helm.sh/docs/)**
- **[Kustomize公式ガイド](https://kustomize.io/)**

**AWS ECS管理者へのアドバイス**: 
設定ファイルの管理は、ECSのTask DefinitionやService Definitionと同様の考え方です。ただし、Kubernetesではより細かい粒度での設定が可能なため、段階的に設定を追加していくことをお勧めします。まずは基本的なDeployment + Serviceから始め、徐々にセキュリティ設定やリソース制限を強化していってください。
