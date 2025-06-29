# データベースに関するREADME.md

このディレクトリは、JAMStackアプリケーションにおけるデータベースの設定と管理に関する情報を提供します。以下に、各ファイルの役割と使用方法を説明します。

## ディレクトリ構成

```
database/
├── k8s/
│   ├── postgresql-helm-values.yaml  # PostgreSQLのHelmチャート用の値を設定するファイル
│   ├── persistent-volume.yaml         # 永続ボリュームの設定を記述するファイル
│   └── init-scripts.yaml             # データベース初期化スクリプトを定義するファイル
├── migrations/
│   └── 001_initial_schema.sql        # データベースの初期スキーマを定義するSQLファイル
└── README.md                         # このドキュメント
```

## 各ファイルの説明

### k8s/postgresql-helm-values.yaml
このファイルは、PostgreSQLのHelmチャートをデプロイする際に使用する設定値を定義します。データベースのユーザー名やパスワード、データベース名などを指定できます。

### k8s/persistent-volume.yaml
このファイルでは、PostgreSQLデータベースのための永続ボリュームを設定します。データの永続性を確保するために、KubernetesのPersistentVolumeとPersistentVolumeClaimを使用します。

### k8s/init-scripts.yaml
データベースの初期化スクリプトを定義するファイルです。データベースの初期設定や初期データの挿入を行うSQLスクリプトを含めることができます。

### migrations/001_initial_schema.sql
このSQLファイルは、データベースの初期スキーマを定義します。テーブルの作成やインデックスの設定など、アプリケーションが必要とするデータ構造をここに記述します。

## 使用方法

1. **Helmを使用してPostgreSQLをデプロイする**
   - `postgresql-helm-values.yaml`を使用して、HelmでPostgreSQLをデプロイします。

2. **永続ボリュームの設定**
   - `persistent-volume.yaml`を適用して、データの永続性を確保します。

3. **初期化スクリプトの実行**
   - `init-scripts.yaml`を使用して、データベースの初期化を行います。

4. **マイグレーションの実行**
   - `001_initial_schema.sql`を実行して、データベースの初期スキーマを作成します。

このガイドを参考にして、JAMStackアプリケーションのデータベース設定を行ってください。