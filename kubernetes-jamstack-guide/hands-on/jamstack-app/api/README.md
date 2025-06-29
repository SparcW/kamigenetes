# hands-on/jamstack-app/api/README.md

このディレクトリは、Kubernetes上でAPI GatewayとServerlessアーキテクチャを実装するためのHonoフレームワークを使用したサンプルAPIのコードを含んでいます。このAPIは、PostgreSQLデータベースと連携し、Remixフロントエンドと統合されています。

## 構成

- **src/**: APIのソースコードが含まれています。
  - **index.ts**: アプリケーションのエントリーポイントで、Honoフレームワークを使用してAPIを設定します。
  - **routes/**: APIエンドポイントを定義するファイルが含まれています。
    - **data.ts**: データに関連するAPIエンドポイントを定義します。
    - **health.ts**: ヘルスチェック用のAPIエンドポイントを定義します。
  - **database/**: PostgreSQLデータベースへの接続を管理するためのコードが含まれています。
    - **connection.ts**: データベース接続の設定を行います。
  - **types/**: アプリケーションで使用する型定義を含むファイルです。

- **k8s/**: Kubernetesに関連する設定ファイルが含まれています。
  - **deployment.yaml**: APIのKubernetesデプロイメント設定を記述します。
  - **service.yaml**: APIのKubernetesサービス設定を記述します。
  - **configmap.yaml**: 設定マップを定義するファイルです。
  - **secret.yaml**: セキュリティ情報を管理するためのシークレット設定を記述します。

- **Dockerfile**: APIのDockerイメージをビルドするための設定ファイルです。

- **package.json**: APIの依存関係やスクリプトを管理するためのファイルです。

- **tsconfig.json**: TypeScriptのコンパイル設定を記述するファイルです。

## セットアップ手順

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **APIの起動**
   ```bash
   ts-node src/index.ts
   ```

3. **Kubernetesへのデプロイ**
   - Kubernetesクラスターがセットアップされていることを確認し、以下のコマンドを実行します。
   ```bash
   kubectl apply -f k8s/
   ```

## 注意事項

- 環境変数やセキュリティ情報は、Kubernetesのシークレットを使用して管理してください。
- データベースの接続情報は、`src/database/connection.ts`で設定されています。必要に応じて変更してください。

このAPIは、Kubernetes上でのスケーラブルなサーバーレスアーキテクチャの実装を学ぶための基盤となります。