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

## 結論

これで、Kubernetes上にPostgreSQLをインストールし、初期化スクリプトを実行する手順が完了しました。次のステップでは、APIの開発に進むことができます。