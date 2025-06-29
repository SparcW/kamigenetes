### README.md

# Kubernetes JAMStack ガイド

このプロジェクトは、Kubernetesを使用してAPI GatewayとServerlessアーキテクチャを実装する方法を学ぶためのガイドです。TypeScriptとHonoフレームワークを使用したサンプルアプリケーションを通じて、PostgreSQLによるデータ管理とRemixを用いたフロントエンドの構築を行います。

## 目次

1. [アーキテクチャの概要](01-architecture.md)
2. [前提条件](02-prerequisites.md)
3. [Kubernetesのセットアップ](03-kubernetes-setup.md)
4. [PostgreSQLのセットアップ](04-postgresql-setup.md)
5. [API開発](05-api-development.md)
6. [デプロイメント](06-deployment.md)
7. [フロントエンドのセットアップ](07-frontend-setup.md)
8. [モニタリング](08-monitoring.md)

## プロジェクトの特徴

- **API Gateway**: Honoフレームワークを使用してAPIリクエストを処理します。
- **Serverless Functions**: Knativeを使用してKubernetes上にデプロイします。
- **データベース**: PostgreSQLを使用してデータを管理します。
- **フロントエンド**: Remixを使用してユーザーインターフェースを構築します。

## サンプルアプリケーションの構成

サンプルアプリケーションは以下のディレクトリに格納されています。

```
hands-on/
└── jamstack-app/
    ├── api/               # API関連のコード
    ├── frontend/          # フロントエンド関連のコード
    ├── database/          # データベース関連の設定
    ├── monitoring/        # モニタリング関連の設定
    └── scripts/           # スクリプト
```

## 使い方

このガイドに従って、Kubernetes上にJAMStackアプリケーションを構築する手順を学びます。各ステップには詳細な手順とコード例が含まれています。

## 注意事項

- 環境変数や機密情報はKubernetesのSecretsを使用して管理してください。
- CI/CDパイプラインを実装して自動デプロイメントを行うことを推奨します。
- PrometheusやGrafanaなどのモニタリングツールを追加して、アプリケーションの可観測性を向上させることを検討してください。

このガイドを通じて、Kubernetesを利用したスケーラブルでサーバーレスなアプリケーションの構築方法を習得してください。