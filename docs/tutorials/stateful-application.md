# 🗄️ ステートフルアプリケーション - データベースとボリューム

このチュートリアルでは、データベースなどのステートフルなアプリケーションをKubernetesで動作させる方法を学習します。AWS ECS経験者向けに、EBSボリュームやRDSとの比較を交えて解説します。

## 🎯 学習目標

- **永続ストレージ**: Volume、PV、PVCの概念と使い方
- **ステートフルワークロード**: StatefulSetの理解と実装
- **データベース運用**: PostgreSQL/MySQLのKubernetes実装
- **バックアップ戦略**: データ保護と災害復旧

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 移行のポイント |
|------|---------|------------|---------------|
| **永続ストレージ** | EBS Volume | PersistentVolume | ボリューム管理が宣言的 |
| **データベース** | RDS | StatefulSet + PV | 自己管理 vs マネージドサービス |
| **バックアップ** | RDS Snapshot | Velero/手動 | バックアップ戦略の見直し |
| **HA構成** | Multi-AZ | 複数レプリカ | クラスター内での冗長性 |

## 🏗️ 1. 永続ストレージの基礎

### StorageClass の定義

```yaml
# storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

### PersistentVolumeClaim の作成

```yaml
# database-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  labels:
    app: postgres
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 20Gi
```

**AWS ECS比較**: EBSボリュームの宣言的な管理。タスクに直接アタッチするのではなく、クレームとして要求する形式。

## 🐘 2. PostgreSQLデータベースの実装

### StatefulSet の定義

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  labels:
    app: postgres
spec:
  serviceName: postgres-headless
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
        image: postgres:15
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: "myapp"
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
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER -d $POSTGRES_DB
          initialDelaySeconds: 15
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U $POSTGRES_USER -d $POSTGRES_DB
          initialDelaySeconds: 45
          periodSeconds: 10
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 20Gi
```

### Secret の設定

```yaml
# postgres-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
data:
  username: cG9zdGdyZXM=  # postgres (base64)
  password: bXlzZWNyZXRwYXNzd29yZA==  # mysecretpassword (base64)
```

### Service の定義

```yaml
# postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  labels:
    app: postgres
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
  selector:
    app: postgres
---
# ヘッドレスサービス（StatefulSet用）
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
  labels:
    app: postgres
spec:
  clusterIP: None
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgres
```

## 🔧 3. デプロイメントの実行

### 手順1: Secretの作成

```bash
# Base64エンコーディング
echo -n 'postgres' | base64
echo -n 'mysecretpassword' | base64

# Secretの適用
kubectl apply -f postgres-secret.yaml
```

### 手順2: StatefulSetのデプロイ

```bash
# StorageClassの作成
kubectl apply -f storage-class.yaml

# StatefulSetとServiceの作成
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f postgres-service.yaml
```

### 手順3: 動作確認

```bash
# Pod状態の確認
kubectl get pods -l app=postgres

# ログの確認
kubectl logs postgres-0

# PVCの確認
kubectl get pvc

# データベース接続テスト
kubectl exec -it postgres-0 -- psql -U postgres -d myapp
```

## 📱 4. アプリケーションとの連携

### Web アプリケーションの設定

```yaml
# web-app-deployment.yaml
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
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres:5432/myapp"
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
```

## 🔄 5. バックアップとリストア

### バックアップ用CronJob

```yaml
# postgres-backup.yaml
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
          - name: postgres-backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              BACKUP_FILE="backup-$(date +%Y%m%d_%H%M%S).sql"
              pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB > /backup/$BACKUP_FILE
              echo "Backup completed: $BACKUP_FILE"
            env:
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
            - name: POSTGRES_DB
              value: "myapp"
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

### Backup用PVC

```yaml
# backup-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi
```

## 🚀 6. 高可用性構成

### PostgreSQL HA（レプリケーション）

```yaml
# postgres-ha-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-ha
spec:
  serviceName: postgres-ha-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres-ha
  template:
    metadata:
      labels:
        app: postgres-ha
    spec:
      initContainers:
      - name: postgres-init
        image: postgres:15
        command:
        - /bin/bash
        - -c
        - |
          if [ "$HOSTNAME" = "postgres-ha-0" ]; then
            echo "primary" > /shared/role
          else
            echo "replica" > /shared/role
          fi
        volumeMounts:
        - name: shared-data
          mountPath: /shared
      containers:
      - name: postgres
        image: postgres:15
        # ... (設定は基本版を参考に、レプリケーション設定を追加)
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: shared-data
          mountPath: /shared
      volumes:
      - name: shared-data
        emptyDir: {}
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 20Gi
```

## 🔍 7. 監視とメンテナンス

### PostgreSQL Exporter（Prometheus連携）

```yaml
# postgres-exporter.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-exporter
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-exporter
  template:
    metadata:
      labels:
        app: postgres-exporter
    spec:
      containers:
      - name: postgres-exporter
        image: prometheuscommunity/postgres-exporter:latest
        ports:
        - containerPort: 9187
        env:
        - name: DATA_SOURCE_NAME
          value: "postgresql://postgres:mysecretpassword@postgres:5432/myapp?sslmode=disable"
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
```

## 🧪 実践演習

### 演習1: 基本的なPostgreSQLデプロイ

1. **環境準備**
   ```bash
   # ディレクトリ作成
   mkdir -p stateful-app-lab
   cd stateful-app-lab
   ```

2. **リソース作成**
   - 上記のYAMLファイルを作成
   - 順次適用してPostgreSQLを立ち上げ

3. **動作確認**
   ```bash
   # 接続テスト
   kubectl exec -it postgres-0 -- psql -U postgres -d myapp -c "CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(50));"
   kubectl exec -it postgres-0 -- psql -U postgres -d myapp -c "INSERT INTO test (name) VALUES ('Hello Kubernetes');"
   kubectl exec -it postgres-0 -- psql -U postgres -d myapp -c "SELECT * FROM test;"
   ```

### 演習2: データ永続性の確認

1. **Podの削除と再作成**
   ```bash
   kubectl delete pod postgres-0
   kubectl get pods -w  # Pod再作成を監視
   ```

2. **データ確認**
   ```bash
   kubectl exec -it postgres-0 -- psql -U postgres -d myapp -c "SELECT * FROM test;"
   ```

### 演習3: スケーリングとバックアップ

1. **バックアップCronJobの設定**
2. **手動バックアップの実行**
3. **リストア手順の確認**

## 🎯 ベストプラクティス

### セキュリティ

- **Secret管理**: パスワードは必ずSecretで管理
- **ネットワーク分離**: NetworkPolicyでアクセス制限
- **Pod Security**: 適切なSecurityContextの設定

### パフォーマンス

- **リソース制限**: 適切なCPU/メモリ制限
- **ストレージ性能**: 用途に応じたStorageClassの選択
- **接続プーリング**: PgBouncerなどの導入

### 運用

- **監視**: Prometheus + Grafanaでメトリクス監視
- **ログ管理**: Fluentdでログ集約
- **バックアップ**: 定期的な自動バックアップ
- **災害復旧**: クロスリージョンバックアップ

## 🚨 トラブルシューティング

### よくある問題

1. **Pod起動失敗**
   ```bash
   kubectl describe pod postgres-0
   kubectl logs postgres-0
   ```

2. **PVC Bound失敗**
   ```bash
   kubectl get pvc
   kubectl describe pvc postgres-pvc
   ```

3. **データベース接続エラー**
   ```bash
   kubectl exec -it postgres-0 -- pg_isready
   kubectl port-forward postgres-0 5432:5432
   ```

## 📚 参考リソース

- **[Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)**
- **[StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)**
- **[PostgreSQL on Kubernetes](https://postgresql.org/docs/)**
- **[Database Backup Strategies](https://kubernetes.io/docs/tasks/administer-cluster/backup-restore-etcd/)**

---

**次のステップ**: [サービス接続](./service-connection.md) → [設定管理](./configuration.md) → [セキュリティ実装](./security.md)
