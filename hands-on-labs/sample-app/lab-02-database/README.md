# Lab 2: データベース層のデプロイ

## 概要

このラボでは、Kubernetesでステートフルなアプリケーション（PostgreSQL）をデプロイする方法を学習します。永続化ストレージ、StatefulSet、そしてサービスディスカバリについて、AWS ECS + RDSとの違いを理解しながら実践します。

## 学習目標

このラボを完了すると、以下ができるようになります：

- [ ] PersistentVolumeとPersistentVolumeClaimを理解し使用する
- [ ] Deploymentを使用してデータベースをデプロイする
- [ ] Serviceを使用してデータベースへの内部通信を設定する
- [ ] 永続化ストレージでデータを保護する
- [ ] データベースの初期化とヘルスチェックを設定する

## AWS ECS + RDSとの比較

| 機能 | AWS ECS + RDS | Kubernetes |
|------|---------------|------------|
| **データベース** | RDS（マネージド） | Pod内DB または 外部DB |
| **永続化** | RDSが自動管理 | PV/PVC |
| **バックアップ** | RDS自動バックアップ | 手動またはOperator |
| **スケーリング** | RDS Read Replica | StatefulSet |
| **接続** | エンドポイント | Service DNS |
| **監視** | CloudWatch | kubectl + monitoring |

## 前提条件

- [Lab 1: ネームスペースとリソース管理](../lab-01-namespace/README.md)が完了していること
- `sample-app` ネームスペース、ConfigMap、Secretが作成済みであること

## 手順

### ステップ 1: 永続化ボリュームクレーム（PVC）の作成

まず、データベースのデータを永続化するためのストレージを要求します。

```bash
# PVCファイルの確認
cat ../kubernetes/postgres/postgres-pvc.yaml
```

**postgres-pvc.yaml の内容:**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: sample-app
  labels:
    app: sample-app
    component: postgres
    tier: database
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  storageClassName: standard  # Minikubeの場合
```

PVCを作成します：

```bash
# PVCの作成
kubectl apply -f ../kubernetes/postgres/postgres-pvc.yaml

# PVCの状態確認
kubectl get pvc -n sample-app

# PVCの詳細確認
kubectl describe pvc postgres-pvc -n sample-app

# 利用可能なStorageClassの確認
kubectl get storageclass
```

**AWS ECS管理者向け解説**:
- ECSではEBSボリュームを直接タスクにアタッチしていました
- KubernetesではPVCでストレージを「要求」し、システムが適切なストレージを割り当てます
- StorageClassによって、動的にストレージが作成されます

### ステップ 2: PostgreSQLのDeployment作成

```bash
# Deploymentファイルの確認
cat ../kubernetes/postgres/postgres-deployment.yaml
```

**postgres-deployment.yaml の内容:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
  namespace: sample-app
  labels:
    app: sample-app
    component: postgres
    tier: database
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
      component: postgres
  template:
    metadata:
      labels:
        app: sample-app
        component: postgres
        tier: database
    spec:
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_USERNAME
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
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
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
```

Deploymentを作成します：

```bash
# Deploymentの作成
kubectl apply -f ../kubernetes/postgres/postgres-deployment.yaml

# Deploymentの状態確認
kubectl get deployments -n sample-app

# Podの状態確認
kubectl get pods -n sample-app -l component=postgres

# Pod作成プロセスの詳細確認
kubectl describe deployment postgres-deployment -n sample-app

# Podのログ確認
kubectl logs -n sample-app -l component=postgres --tail=20
```

**AWS ECS管理者向け解説**:
- ECSのタスク定義 + サービスに相当
- 環境変数はConfigMapとSecretから注入
- ヘルスチェックはlivenessProbe/readinessProbeで実装

### ステップ 3: PostgreSQLのService作成

データベースへの内部通信用のServiceを作成します。

```bash
# Serviceファイルの確認
cat ../kubernetes/postgres/postgres-service.yaml
```

**postgres-service.yaml の内容:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: sample-app
  labels:
    app: sample-app
    component: postgres
    tier: database
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
  selector:
    app: sample-app
    component: postgres
```

Serviceを作成します：

```bash
# Serviceの作成
kubectl apply -f ../kubernetes/postgres/postgres-service.yaml

# Serviceの確認
kubectl get services -n sample-app

# Serviceの詳細確認
kubectl describe service postgres-service -n sample-app

# Endpointsの確認（実際のPodのIPアドレス）
kubectl get endpoints -n sample-app postgres-service
```

**AWS ECS管理者向け解説**:
- ECSのService DiscoveryやCloud Mapに相当
- ClusterIPタイプは内部通信専用
- DNS名は `postgres-service.sample-app.svc.cluster.local` で解決

### ステップ 4: データベース接続とテスト

```bash
# PostgreSQL Podが完全に起動するまで待機
kubectl wait --for=condition=ready pod -l component=postgres -n sample-app --timeout=300s

# データベース接続テスト
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT version();"

# データベース一覧確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -c "\l"

# テーブル作成テスト
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"

# テストデータ挿入
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "
INSERT INTO users (name, email) VALUES 
('John Doe', 'john@example.com'),
('Jane Smith', 'jane@example.com');"

# データ確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT * FROM users;"
```

### ステップ 5: ネットワーク接続テスト

他のPodからデータベースへの接続をテストします：

```bash
# テスト用Podの起動
kubectl run test-client --image=postgres:15 --rm -it --restart=Never -n sample-app -- bash

# Pod内で以下を実行:
# psql -h postgres-service -U postgres -d sampledb
# \l
# \dt
# SELECT * FROM users;
# \q
# exit
```

また、DNS解決のテストも行います：

```bash
# DNS解決テスト用Podの起動
kubectl run test-dns --image=busybox --rm -it --restart=Never -n sample-app -- sh

# Pod内で以下を実行:
# nslookup postgres-service
# nslookup postgres-service.sample-app.svc.cluster.local
# exit
```

### ステップ 6: データ永続化の確認

データが永続化されていることを確認します：

```bash
# 現在のデータ確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT count(*) FROM users;"

# Podを削除（データベースを再起動）
kubectl delete pod -n sample-app -l component=postgres

# 新しいPodが起動するまで待機
kubectl wait --for=condition=ready pod -l component=postgres -n sample-app --timeout=300s

# データが保持されていることを確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT * FROM users;"
```

## 運用操作の実践

### バックアップとリストア（手動）

```bash
# データベースバックアップ
kubectl exec -n sample-app deployment/postgres-deployment -- pg_dump -U postgres sampledb > backup.sql

# バックアップファイルの確認
head -n 20 backup.sql

# リストアテスト（新しいデータベースに）
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -c "CREATE DATABASE testdb;"
kubectl exec -n sample-app -i deployment/postgres-deployment -- psql -U postgres testdb < backup.sql

# リストア確認
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres testdb -c "SELECT * FROM users;"

# テストデータベースの削除
kubectl exec -n sample-app -it deployment/postgres-deployment -- psql -U postgres -c "DROP DATABASE testdb;"

# バックアップファイルの削除
rm backup.sql
```

### リソース監視

```bash
# PostgreSQL Podのリソース使用量確認
kubectl top pod -n sample-app -l component=postgres

# PostgreSQL Podの詳細状態確認
kubectl describe pod -n sample-app -l component=postgres

# PostgreSQL ログの確認
kubectl logs -n sample-app -l component=postgres --tail=50

# ストレージ使用量の確認
kubectl exec -n sample-app deployment/postgres-deployment -- df -h /var/lib/postgresql/data
```

## 動作確認チェックリスト

以下のすべてが正常に動作することを確認してください：

```bash
# 1. PVCの状態確認
echo "=== PVC Status ==="
kubectl get pvc postgres-pvc -n sample-app

# 2. Deploymentの状態確認
echo "=== Deployment Status ==="
kubectl get deployment postgres-deployment -n sample-app

# 3. Podの状態確認
echo "=== Pod Status ==="
kubectl get pods -n sample-app -l component=postgres

# 4. Serviceの状態確認
echo "=== Service Status ==="
kubectl get service postgres-service -n sample-app

# 5. データベース接続確認
echo "=== Database Connection Test ==="
kubectl exec -n sample-app deployment/postgres-deployment -- pg_isready -U postgres

# 6. テーブル存在確認
echo "=== Table Verification ==="
kubectl exec -n sample-app deployment/postgres-deployment -- psql -U postgres -d sampledb -c "\dt"

# 7. データ確認
echo "=== Data Verification ==="
kubectl exec -n sample-app deployment/postgres-deployment -- psql -U postgres -d sampledb -c "SELECT count(*) FROM users;"
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. PodがPending状態のまま

```bash
# Pod状態の詳細確認
kubectl describe pod -n sample-app -l component=postgres

# PVCの状態確認
kubectl describe pvc postgres-pvc -n sample-app

# ノードのストレージ容量確認
kubectl describe nodes
```

#### 2. データベース接続エラー

```bash
# Pod内のPostgreSQLプロセス確認
kubectl exec -n sample-app deployment/postgres-deployment -- ps aux | grep postgres

# PostgreSQLログの確認
kubectl logs -n sample-app -l component=postgres

# 環境変数の確認
kubectl exec -n sample-app deployment/postgres-deployment -- env | grep -E "(POSTGRES|PG)"
```

#### 3. データが消失する

```bash
# PVCとPVの関係確認
kubectl get pv
kubectl describe pvc postgres-pvc -n sample-app

# マウント状態の確認
kubectl exec -n sample-app deployment/postgres-deployment -- mount | grep postgresql
```

## 学習ポイント

### AWS ECS + RDSとKubernetesの違い

1. **データベース管理**
   - ECS + RDS: フルマネージドサービス
   - K8s: Pod内での自己管理（またはOperatorを使用）

2. **永続化ストレージ**
   - ECS: EBSの直接アタッチメント
   - K8s: PV/PVCによる抽象化

3. **サービスディスカバリ**
   - ECS: Cloud MapまたはELB
   - K8s: Service + DNS

4. **バックアップ**
   - RDS: 自動バックアップ機能
   - K8s: 手動またはOperatorによる自動化

## 次のステップ

このラボで学習した内容：
- ✅ PersistentVolumeClaimによるストレージ要求
- ✅ Deploymentによるステートフルアプリケーションのデプロイ
- ✅ Serviceによる内部通信の設定
- ✅ ConfigMap/Secretの実用的な使用
- ✅ データ永続化の確認

次は[Lab 3: キャッシュ層のデプロイ](../lab-03-cache/README.md)で、Redisクラスターとステートレスサービスについて学習します。

## 関連ドキュメント

- [Persistent Volumes概念ガイド](../../../docs/concepts/storage.md)
- [Deployments詳細ガイド](../../../docs/tutorials/deployments/README.md)
- [Services とネットワーキング](../../../docs/tutorials/services/README.md)
- [データベースのベストプラクティス](../../../docs/best-practices/database.md)
