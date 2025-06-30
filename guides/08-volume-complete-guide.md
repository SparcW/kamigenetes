# Kubernetes Volume 完全ガイド

## 概要

Kubernetesにおけるボリュームは、コンテナ内のデータを永続化し、Pod間でデータを共有するための仕組みです。AWS ECSのボリュームマウントに相当する機能ですが、より柔軟で多様なオプションを提供します。

## Volume の基本概念

### AWS ECS との比較

| 要素 | AWS ECS | Kubernetes |
|------|---------|------------|
| **永続化ストレージ** | EBS ボリューム | PersistentVolume (PV) |
| **一時ストレージ** | Task のローカルディスク | emptyDir |
| **共有ストレージ** | EFS マウント | ReadWriteMany PV |
| **設定ファイル** | Parameter Store/Secrets | ConfigMap/Secret |
| **ボリュームの管理** | ECS Task Definition | PersistentVolumeClaim (PVC) |

## Volume の種類

### 1. emptyDir（一時ボリューム）
```yaml
# emptydir-example.yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-pod
  labels:
    app: volume-demo
spec:
  containers:
  - name: web-server
    image: nginx:1.21
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-data
      mountPath: /usr/share/nginx/html
      
  - name: content-generator
    image: busybox:1.35
    command: ["/bin/sh"]
    args:
    - -c
    - |
      while true; do
        echo "$(date): Hello from content generator" > /shared/index.html
        sleep 30
      done
    volumeMounts:
    - name: shared-data
      mountPath: /shared
      
  volumes:
  - name: shared-data
    emptyDir: {}  # Pod削除時にデータも削除される
```

**特徴:**
- Pod削除時にデータが消失
- 同一Pod内のコンテナ間でデータ共有
- AWS ECSのタスクローカルディスクに相当

### 2. hostPath（ホストディレクトリマウント）
```yaml
# hostpath-example.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
  labels:
    app: hostpath-demo
spec:
  containers:
  - name: log-reader
    image: busybox:1.35
    command: ["/bin/sh"]
    args:
    - -c
    - "tail -f /host-logs/system.log"
    volumeMounts:
    - name: host-logs
      mountPath: /host-logs
      readOnly: true
      
  volumes:
  - name: host-logs
    hostPath:
      path: /var/log        # ホストの/var/logをマウント
      type: Directory       # ディレクトリが存在することを確認
```

**注意点:**
- セキュリティリスクがあるため本番環境では注意が必要
- ノード固有のデータにアクセス可能

### 3. PersistentVolume (PV) と PersistentVolumeClaim (PVC)

#### PersistentVolume の定義
```yaml
# persistent-volume.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql-pv
  labels:
    app: mysql
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce       # 単一ノードからの読み書き
  persistentVolumeReclaimPolicy: Retain  # PVC削除後もデータを保持
  storageClassName: standard
  hostPath:
    path: /data/mysql     # 実際の環境では適切なストレージを使用
```

#### PersistentVolumeClaim の定義
```yaml
# persistent-volume-claim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
  labels:
    app: mysql
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 8Gi        # 最低8Giのストレージを要求
  storageClassName: standard
```

#### PVCを使用するDeployment
```yaml
# mysql-deployment-with-pvc.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mysql-deployment
  labels:
    app: mysql
spec:
  replicas: 1             # データベースは通常1つのレプリカ
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          value: "rootpassword"
        - name: MYSQL_DATABASE
          value: "sampledb"
        - name: MYSQL_USER
          value: "user"
        - name: MYSQL_PASSWORD
          value: "password"
        ports:
        - containerPort: 3306
          name: mysql
        volumeMounts:
        - name: mysql-storage
          mountPath: /var/lib/mysql
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
            
      volumes:
      - name: mysql-storage
        persistentVolumeClaim:
          claimName: mysql-pvc
```

### 4. ConfigMap ボリューム
```yaml
# configmap-volume.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.properties: |
    database.host=mysql-service
    database.port=3306
    database.name=sampledb
    log.level=INFO
  nginx.conf: |
    server {
        listen 80;
        server_name _;
        location / {
            root /usr/share/nginx/html;
            index index.html;
        }
    }

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-config
spec:
  replicas: 2
  selector:
    matchLabels:
      app: config-demo
  template:
    metadata:
      labels:
        app: config-demo
    spec:
      containers:
      - name: app
        image: nginx:1.21
        ports:
        - containerPort: 80
        volumeMounts:
        - name: config-volume
          mountPath: /etc/config
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
          
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
          items:
          - key: nginx.conf
            path: default.conf
```

### 5. Secret ボリューム
```yaml
# secret-volume.yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: dXNlcm5hbWU=    # base64エンコード: "username"
  password: cGFzc3dvcmQ=    # base64エンコード: "password"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-secret
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secret-demo
  template:
    metadata:
      labels:
        app: secret-demo
    spec:
      containers:
      - name: app
        image: busybox:1.35
        command: ["/bin/sh"]
        args:
        - -c
        - |
          while true; do
            echo "Username: $(cat /etc/secret/username)"
            echo "Password: $(cat /etc/secret/password)"
            sleep 30
          done
        volumeMounts:
        - name: secret-volume
          mountPath: /etc/secret
          readOnly: true
          
      volumes:
      - name: secret-volume
        secret:
          secretName: db-secret
          defaultMode: 0400     # 読み取り専用権限
```

## StorageClass による動的プロビジョニング

### StorageClass の定義
```yaml
# storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/gce-pd    # GCP環境の例
parameters:
  type: pd-ssd
  replication-type: regional-pd
allowVolumeExpansion: true            # ボリューム拡張を許可
reclaimPolicy: Delete                 # PVC削除時にPVも削除
```

### 動的プロビジョニングを使用するPVC
```yaml
# dynamic-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd          # 動的プロビジョニング用のStorageClass
  resources:
    requests:
      storage: 20Gi
```

## 複数ボリュームの組み合わせ例

```yaml
# multi-volume-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wordpress
  labels:
    app: wordpress
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wordpress
  template:
    metadata:
      labels:
        app: wordpress
    spec:
      containers:
      - name: wordpress
        image: wordpress:6.1-apache
        env:
        - name: WORDPRESS_DB_HOST
          value: mysql-service
        - name: WORDPRESS_DB_USER
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: username
        - name: WORDPRESS_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        ports:
        - containerPort: 80
        volumeMounts:
        # 1. 永続化ストレージ（WordPressファイル）
        - name: wordpress-storage
          mountPath: /var/www/html
        # 2. 設定ファイル
        - name: php-config
          mountPath: /usr/local/etc/php/conf.d
        # 3. 一時ファイル
        - name: temp-storage
          mountPath: /tmp
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
            
      volumes:
      # 永続化ボリューム
      - name: wordpress-storage
        persistentVolumeClaim:
          claimName: wordpress-pvc
      # 設定ファイル
      - name: php-config
        configMap:
          name: php-config
      # 一時ストレージ
      - name: temp-storage
        emptyDir:
          sizeLimit: 1Gi
```

## ボリュームのアクセスモード

| アクセスモード | 説明 | 使用例 |
|---------------|------|--------|
| **ReadWriteOnce (RWO)** | 単一ノードから読み書き | データベース、単一インスタンス |
| **ReadOnlyMany (ROX)** | 複数ノードから読み取り専用 | 静的コンテンツ、設定ファイル |
| **ReadWriteMany (RWX)** | 複数ノードから読み書き | 共有ファイルシステム |

```yaml
# アクセスモードの例
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage
spec:
  accessModes:
    - ReadWriteMany         # 複数Podから同時アクセス可能
  resources:
    requests:
      storage: 10Gi
  storageClassName: nfs     # NFSやCephなどの共有ストレージ
```

## 実践的な使用例

### 1. ログ収集システム
```yaml
# log-collection.yaml
apiVersion: apps/v1
kind: DaemonSet              # 各ノードで実行
metadata:
  name: log-collector
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd:latest
        volumeMounts:
        - name: host-logs
          mountPath: /var/log
          readOnly: true
        - name: fluentd-config
          mountPath: /fluentd/etc
          
      volumes:
      - name: host-logs
        hostPath:
          path: /var/log
      - name: fluentd-config
        configMap:
          name: fluentd-config
```

### 2. バックアップ用ボリューム
```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
spec:
  schedule: "0 2 * * *"       # 毎日午前2時に実行
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mysql:8.0
            command: ["/bin/sh"]
            args:
            - -c
            - |
              mysqldump -h mysql-service -u root -p$MYSQL_ROOT_PASSWORD --all-databases > /backup/backup-$(date +%Y%m%d).sql
            env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
              
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

## トラブルシューティング

### 1. PVCがPendingの場合
```bash
# PVCの状態確認
kubectl get pvc
kubectl describe pvc [pvc-name]

# 利用可能なPVを確認
kubectl get pv

# StorageClassを確認
kubectl get storageclass
```

### 2. ボリュームマウントエラー
```bash
# Podの詳細確認
kubectl describe pod [pod-name]

# イベント確認
kubectl get events --sort-by=.metadata.creationTimestamp

# ボリュームの権限確認
kubectl exec [pod-name] -- ls -la /mounted-path
```

### 3. ストレージ容量不足
```bash
# ボリューム使用量確認
kubectl exec [pod-name] -- df -h

# PVの詳細確認
kubectl describe pv [pv-name]
```

## ベストプラクティス

### 1. 適切なボリュームタイプの選択
```yaml
# データベース：永続化ストレージ
persistentVolumeClaim:
  claimName: database-pvc

# 一時ファイル：emptyDir
emptyDir:
  sizeLimit: 1Gi

# 設定ファイル：ConfigMap
configMap:
  name: app-config
```

### 2. セキュリティ設定
```yaml
# Secret使用時は適切な権限設定
secret:
  secretName: credentials
  defaultMode: 0400    # 読み取り専用

# hostPathは可能な限り避ける
# 必要な場合は readOnly: true を設定
```

### 3. リソース制限
```yaml
# emptyDirにサイズ制限を設定
emptyDir:
  sizeLimit: 500Mi

# PVCに適切なサイズを要求
resources:
  requests:
    storage: 10Gi
```

## 監視とメンテナンス

```bash
# ボリューム使用量監視
kubectl top pods --use-protocol-buffers

# PVの状態確認
kubectl get pv -o wide

# 容量不足の警告
kubectl describe pv | grep -i warning

# ボリューム拡張（対応している場合）
kubectl patch pvc [pvc-name] -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'
```

## まとめ

1. **適切なボリュームタイプの選択**: 用途に応じてemptyDir、PVC、ConfigMapを使い分け
2. **セキュリティ**: Secretの適切な権限設定とhostPathの使用制限
3. **パフォーマンス**: 適切なStorageClassとアクセスモードの選択
4. **運用**: 容量監視とバックアップ戦略の策定
5. **AWS ECS移行**: EBSボリューム→PVC、EFS→ReadWriteMany PVCとして移行検討
