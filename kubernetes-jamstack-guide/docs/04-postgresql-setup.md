### 04-postgresql-setup.md

# PostgreSQLのインストールと設定手順

このドキュメントでは、Kubernetes上にPostgreSQLをインストールし、設定する手順を説明します。PostgreSQLはデータ管理のためのリレーショナルデータベースです。

## ステップ1: Helmのインストール

HelmはKubernetes用のパッケージマネージャーです。まだインストールしていない場合は、以下のコマンドでインストールします。

```bash
curl https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash
```

## ステップ2: PostgreSQLのHelmチャートを追加

BitnamiのHelmリポジトリを追加します。このリポジトリには、PostgreSQLのHelmチャートが含まれています。

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

## ステップ3: PostgreSQLのデプロイ

以下のコマンドを実行して、PostgreSQLをデプロイします。ここでは、デフォルトのパスワードを`mysecretpassword`に設定していますが、実際の環境ではより強力なパスワードを使用してください。

```bash
helm install my-postgres bitnami/postgresql --set postgresqlPassword=mysecretpassword
```

## ステップ4: PostgreSQLの接続情報を取得

PostgreSQLのサービスが正常にデプロイされたら、接続情報を取得します。以下のコマンドを実行して、サービスの詳細を確認します。

```bash
kubectl get svc --namespace default -w
```

出力結果から、PostgreSQLのサービス名（通常は`my-postgres`）とポート番号（通常は`5432`）を確認します。

## ステップ5: データベースの初期化

データベースを初期化するためのSQLスクリプトを作成します。`hands-on/jamstack-app/database/migrations/001_initial_schema.sql`に以下の内容を追加します。

```sql
CREATE TABLE my_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
```

このスクリプトは、`my_table`というテーブルを作成します。

## ステップ6: 初期化スクリプトの設定

初期化スクリプトをKubernetesにデプロイするために、`hands-on/jamstack-app/database/k8s/init-scripts.yaml`を作成します。

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: init-postgres
spec:
  template:
    spec:
      containers:
      - name: init-postgres
        image: bitnami/postgresql:latest
        env:
        - name: POSTGRES_PASSWORD
          value: mysecretpassword
        command: ["/bin/sh", "-c", "psql -h my-postgres.default.svc.cluster.local -U postgres -d postgres -f /init-scripts/001_initial_schema.sql"]
        volumeMounts:
        - name: init-scripts
          mountPath: /init-scripts
      restartPolicy: OnFailure
      volumes:
      - name: init-scripts
        configMap:
          name: init-scripts-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: init-scripts-config
data:
  001_initial_schema.sql: |
    CREATE TABLE my_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
    );
```

この設定により、PostgreSQLが起動した後に初期化スクリプトが実行されます。

## ステップ7: 初期化ジョブの実行

初期化ジョブを実行するために、以下のコマンドを実行します。

```bash
kubectl apply -f hands-on/jamstack-app/database/k8s/init-scripts.yaml
```

ジョブが完了したら、データベースが正常に初期化されたことを確認できます。

## ステップ8: Volumeの概要と重要性

### Volumeとは

VolumeはKubernetesにおいてPodがデータを永続化するためのメカニズムです。PostgreSQLのようなデータベースでは、Podが再起動や削除されてもデータが失われないよう、適切なVolumeの設定が必要不可欠です。

### PostgreSQLにおけるVolumeの重要性

データベースは状態を持つアプリケーション（Stateful Application）です。Podが削除されてもデータが保持される必要があります。これを実現するためにVolumeを使用します。

#### AWS ECSとの比較
- **AWS ECS**: EFSやEBSボリュームをタスク定義で指定
- **Kubernetes**: PersistentVolume (PV)とPersistentVolumeClaim (PVC)を使用

### Volumeの種類

#### 1. emptyDir
- Podと同じライフサイクル
- 一時的なデータ保存に適用
- PostgreSQLには**推奨されません**

#### 2. hostPath
- ノードのファイルシステムをマウント
- 単一ノード環境でのみ使用可能
- 本番環境では**推奨されません**

#### 3. PersistentVolume (PV) と PersistentVolumeClaim (PVC)
- 永続的なデータ保存
- PostgreSQLに**最適**
- クラウドプロバイダーのストレージサービスと連携可能

### PostgreSQL用のPVCの設定例

```yaml
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
  storageClassName: standard
```

### Helmを使用したPostgreSQLでのVolume設定

Bitnamiのpostgreslql Helmチャートでは、以下のパラメータでVolumeを設定できます：

```bash
helm install my-postgres bitnami/postgresql \
  --set postgresqlPassword=mysecretpassword \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set persistence.storageClass=standard
```

### Volume設定のベストプラクティス

1. **適切なストレージサイズの設定**
   - 予想されるデータサイズの2-3倍を確保

2. **ストレージクラスの選択**
   - 本番環境では高性能・高可用性のストレージクラスを選択

3. **バックアップ戦略**
   - VolumeSnapshotを活用したバックアップ

4. **アクセスモードの理解**
   - ReadWriteOnce: 単一ノードからの読み書き（PostgreSQLに適用）
   - ReadOnlyMany: 複数ノードからの読み取り専用
   - ReadWriteMany: 複数ノードからの読み書き

### Volumeのトラブルシューティング

#### PVCがPendingの場合
```bash
kubectl describe pvc postgres-pvc
```

#### ストレージ容量の確認
```bash
kubectl get pv
kubectl get pvc
```

#### Podのマウント状況確認
```bash
kubectl describe pod <postgres-pod-name>
```

## 結論

これで、Kubernetes上にPostgreSQLをインストールし、初期化スクリプトを実行する手順が完了しました。次のステップでは、APIの開発に進むことができます。