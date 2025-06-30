# Kubernetes Volume完全ガイド

## 目次
1. [Volumeとは](#volumeとは)
2. [AWS ECSとの比較](#aws-ecsとの比較)
3. [Volumeの種類](#volumeの種類)
4. [実践例](#実践例)
5. [ベストプラクティス](#ベストプラクティス)
6. [トラブルシューティング](#トラブルシューティング)

## Volumeとは

KubernetesのVolumeは、Pod内のコンテナ間でデータを共有したり、Podが削除された後もデータを永続化するための仕組みです。

### なぜVolumeが必要なのか

```yaml
# Volume使用前の問題例
apiVersion: v1
kind: Pod
metadata:
  name: data-loss-example
spec:
  containers:
  - name: app
    image: nginx
    # コンテナ内のデータはPod削除時に失われる
    # データベースファイルやログは保持されない
```

### Volumeの基本概念

1. **一時的ストレージ（emptyDir）**: Pod内でのデータ共有
2. **永続的ストレージ（PersistentVolume）**: Pod削除後もデータ保持
3. **設定データ（ConfigMap/Secret）**: アプリケーション設定の管理
4. **ホストマウント（hostPath）**: ノードのファイルシステムアクセス

## AWS ECSとの比較

### ECS タスク定義での永続化
```json
{
  "family": "my-app",
  "volumes": [
    {
      "name": "my-efs-volume",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-12345678",
        "transitEncryption": "ENABLED"
      }
    }
  ],
  "containerDefinitions": [
    {
      "name": "app",
      "image": "my-app:latest",
      "mountPoints": [
        {
          "sourceVolume": "my-efs-volume",
          "containerPath": "/data"
        }
      ]
    }
  ]
}
```

### Kubernetesでの同等実装
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: efs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  csi:
    driver: efs.csi.aws.com
    volumeHandle: fs-12345678
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: efs-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: my-app:latest
        volumeMounts:
        - name: data-volume
          mountPath: /data
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: efs-pvc
```

## Volumeの種類

### 1. emptyDir - 一時的共有ストレージ

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-volume-pod
spec:
  containers:
  - name: writer
    image: busybox
    command: ["/bin/sh", "-c"]
    args:
      - "while true; do
           echo 'データを書き込み中...' > /shared/data.txt;
           date >> /shared/data.txt;
           sleep 10;
         done"
    volumeMounts:
    - name: shared-data
      mountPath: /shared
  - name: reader
    image: busybox
    command: ["/bin/sh", "-c"]
    args:
      - "while true; do
           echo '読み込みデータ:';
           cat /shared/data.txt;
           sleep 15;
         done"
    volumeMounts:
    - name: shared-data
      mountPath: /shared
  volumes:
  - name: shared-data
    emptyDir: {}
```

**使用例**: ログ収集、一時ファイル処理、コンテナ間データ共有

### 2. hostPath - ホストディレクトリマウント

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: host-logs
      mountPath: /var/log/nginx
  volumes:
  - name: host-logs
    hostPath:
      path: /var/log/pods
      type: DirectoryOrCreate
```

**注意**: セキュリティリスクがあるため、本番環境では慎重に使用

### 3. ConfigMap - 設定データ

```yaml
# ConfigMap定義
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.properties: |
    database.host=postgres-service
    database.port=5432
    database.name=myapp
    log.level=INFO
  nginx.conf: |
    server {
        listen 80;
        location / {
            proxy_pass http://backend:8080;
        }
    }
---
# ConfigMapを使用するPod
apiVersion: v1
kind: Pod
metadata:
  name: configmap-pod
spec:
  containers:
  - name: app
    image: my-app:latest
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config
    - name: nginx-config
      mountPath: /etc/nginx/conf.d
      subPath: nginx.conf
  volumes:
  - name: config-volume
    configMap:
      name: app-config
      items:
      - key: app.properties
        path: application.properties
  - name: nginx-config
    configMap:
      name: app-config
```

### 4. Secret - 機密データ

```yaml
# Secret作成
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  username: cG9zdGdyZXM=  # base64エンコード済み
  password: bXlzZWNyZXRwYXNzd29yZA==
---
# Secretを使用するDeployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: db-app
  template:
    metadata:
      labels:
        app: db-app
    spec:
      containers:
      - name: app
        image: postgres:13
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        volumeMounts:
        - name: cert-volume
          mountPath: /etc/ssl/certs
          readOnly: true
      volumes:
      - name: cert-volume
        secret:
          secretName: ssl-certificates
```

### 5. PersistentVolume (PV) & PersistentVolumeClaim (PVC)

```yaml
# PersistentVolume定義
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/data/postgres
---
# PersistentVolumeClaim定義
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
# PVCを使用するStatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
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
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_DB
          value: myapp
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
          subPath: postgres
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
```

### 6. NFS Volume

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: nfs-pv
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: nfs-server.example.com
    path: /shared/data
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-storage-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shared-storage-app
  template:
    metadata:
      labels:
        app: shared-storage-app
    spec:
      containers:
      - name: app
        image: nginx
        volumeMounts:
        - name: shared-data
          mountPath: /usr/share/nginx/html
      volumes:
      - name: shared-data
        nfs:
          server: nfs-server.example.com
          path: /shared/web-content
```

## 実践例

### PostgreSQLの永続化設定

```yaml
# PostgreSQL用Secret
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: database
type: Opaque
data:
  password: bXlzZWNyZXRwYXNzd29yZA==
---
# PostgreSQL用PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data-pvc
  namespace: database
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
---
# PostgreSQL ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: database
data:
  postgresql.conf: |
    # PostgreSQL設定
    max_connections = 200
    shared_buffers = 256MB
    effective_cache_size = 1GB
    work_mem = 4MB
    maintenance_work_mem = 64MB
    
  init.sql: |
    -- 初期化SQL
    CREATE DATABASE myapp;
    CREATE USER appuser WITH PASSWORD 'apppassword';
    GRANT ALL PRIVILEGES ON DATABASE myapp TO appuser;
---
# PostgreSQL Deployment
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
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_DB
          value: postgres
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
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
      volumes:
      - name: postgres-data
        persistentVolumeClaim:
          claimName: postgres-data-pvc
      - name: postgres-config
        configMap:
          name: postgres-config
          items:
          - key: postgresql.conf
            path: postgresql.conf
      - name: init-scripts
        configMap:
          name: postgres-config
          items:
          - key: init.sql
            path: init.sql
```

### Node.jsアプリでのVolume活用

```yaml
# アプリケーション設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: nodejs-app-config
data:
  app.env: |
    NODE_ENV=production
    PORT=3000
    DATABASE_URL=postgresql://appuser:apppassword@postgres:5432/myapp
    REDIS_URL=redis://redis:6379
    LOG_LEVEL=info
---
# アプリケーションDeployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs-app
  template:
    metadata:
      labels:
        app: nodejs-app
    spec:
      containers:
      - name: app
        image: node:16-alpine
        command: ["node", "server.js"]
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: app-config
          mountPath: /app/.env
          subPath: app.env
        - name: logs
          mountPath: /app/logs
        - name: uploads
          mountPath: /app/uploads
        env:
        - name: NODE_ENV
          value: production
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      - name: log-collector
        image: busybox
        command: ["tail", "-f", "/app/logs/app.log"]
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: app-config
        configMap:
          name: nodejs-app-config
      - name: logs
        emptyDir: {}
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
```

## ベストプラクティス

### 1. セキュリティ

```yaml
# セキュアなVolume設定
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: app
    image: my-app:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    volumeMounts:
    - name: temp-storage
      mountPath: /tmp
    - name: config
      mountPath: /etc/config
      readOnly: true
  volumes:
  - name: temp-storage
    emptyDir: {}
  - name: config
    configMap:
      name: app-config
      defaultMode: 0400  # 読み取り専用
```

### 2. パフォーマンス最適化

```yaml
# StorageClass定義
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
---
# 高性能PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: high-performance-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd
```

### 3. リソース管理

```yaml
# リソース制限付きVolume
apiVersion: v1
kind: Pod
metadata:
  name: resource-limited-pod
spec:
  containers:
  - name: app
    image: my-app:latest
    volumeMounts:
    - name: cache
      mountPath: /cache
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
        ephemeral-storage: "1Gi"
      limits:
        memory: "512Mi"
        cpu: "500m"
        ephemeral-storage: "2Gi"
  volumes:
  - name: cache
    emptyDir:
      sizeLimit: 1Gi
```

## トラブルシューティング

### 1. Volume マウントエラー

```bash
# Pod状態確認
kubectl describe pod <pod-name>

# Volumeイベント確認
kubectl get events --field-selector involvedObject.name=<pod-name>

# PVC状態確認
kubectl describe pvc <pvc-name>
```

### 2. 権限問題の解決

```yaml
# 権限修正Job
apiVersion: batch/v1
kind: Job
metadata:
  name: fix-permissions
spec:
  template:
    spec:
      containers:
      - name: fix-perms
        image: busybox
        command: ["chown", "-R", "1000:1000", "/data"]
        volumeMounts:
        - name: data-volume
          mountPath: /data
        securityContext:
          runAsUser: 0
      restartPolicy: Never
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: my-pvc
```

### 3. ストレージ使用量監視

```yaml
# 監視用DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: disk-usage-monitor
spec:
  selector:
    matchLabels:
      app: disk-monitor
  template:
    metadata:
      labels:
        app: disk-monitor
    spec:
      containers:
      - name: monitor
        image: busybox
        command: ["/bin/sh", "-c"]
        args:
          - "while true; do
               df -h;
               du -sh /host/var/lib/kubelet/pods/*;
               sleep 300;
             done"
        volumeMounts:
        - name: host-var
          mountPath: /host/var
          readOnly: true
      volumes:
      - name: host-var
        hostPath:
          path: /var
      hostNetwork: true
      hostPID: true
```

### 4. バックアップ戦略

```yaml
# バックアップCronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # 毎日午前2時
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:13
            command: ["/bin/bash", "-c"]
            args:
              - "pg_dump -h postgres -U postgres myapp > /backup/backup-$(date +%Y%m%d-%H%M%S).sql"
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
```

## まとめ

Kubernetes Volumeは、データの永続化と共有において非常に重要な機能です。適切なVolume種類の選択と設定により、安全で効率的なアプリケーション運用が可能になります。

### 選択指針

- **一時データ**: emptyDir
- **設定ファイル**: ConfigMap
- **機密情報**: Secret
- **永続データ**: PersistentVolume/PVC
- **共有ファイル**: NFS、EFS
- **ホストアクセス**: hostPath（注意して使用）

AWS ECSからの移行時は、EFSやEBSの概念をKubernetesのVolumeタイプに適切にマッピングすることが重要です。
