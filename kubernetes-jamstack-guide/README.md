# README.md

このプロジェクトは、Kubernetes上でAPI GatewayとServerlessアーキテクチャを実装するためのガイドです。TypeScriptとHonoフレームワークを使用してJAMStackサンプルアプリケーションを構築し、データ管理にはPostgreSQLを、フロントエンドにはRemixを利用します。

## プロジェクトの目的

- **Kubernetesの学習**: AWS ECSからKubernetesへの移行を考えている方に向けて、Kubernetesの基本的な使い方を学ぶためのリソースを提供します。
- **実践的なハンズオン**: 実際に手を動かしながら学べるように、具体的な手順を示します。
- **モダンなアーキテクチャの理解**: API Gateway、Serverless、データベース、フロントエンドの役割を理解し、統合的なアプリケーションを構築します。

## プロジェクトの構成

- `docs/`: プロジェクトに関する詳細なドキュメントを格納します。
  - `README.md`: プロジェクトの概要や目的を説明します。
  - `01-architecture.md`: アーキテクチャの概要を説明します。
  - `02-prerequisites.md`: 前提条件をリストアップします。
  - `03-kubernetes-setup.md`: Kubernetesクラスターのセットアップ手順を詳述します。
  - `04-postgresql-setup.md`: PostgreSQLのインストールと設定手順を説明します。
  - `05-api-development.md`: Honoフレームワークを使用したAPIの開発手順を解説します。
  - `06-deployment.md`: アプリケーションのKubernetesへのデプロイ手順を説明します。
  - `07-frontend-setup.md`: Remixを使用したフロントエンドのセットアップ手順を解説します。
  - `08-monitoring.md`: モニタリングの設定方法について説明します。

- `hands-on/`: 実際のアプリケーションコードを格納します。
  - `jamstack-app/`: JAMStackアプリケーションのコードと設定を含みます。
    - `api/`: APIに関するコードと設定。
    - `frontend/`: フロントエンドに関するコードと設定。
    - `database/`: データベースに関する設定とマイグレーション。
    - `monitoring/`: モニタリングに関する設定。
    - `scripts/`: セットアップやデプロイのためのスクリプト。

## 使い方

1. **前提条件の確認**: `docs/02-prerequisites.md`を参照して、必要な環境を整えます。
2. **Kubernetesクラスターのセットアップ**: `docs/03-kubernetes-setup.md`に従って、Kubernetesクラスターをセットアップします。
3. **PostgreSQLの設定**: `docs/04-postgresql-setup.md`を参照して、PostgreSQLをインストールし設定します。
4. **APIの開発**: `docs/05-api-development.md`に従って、APIを開発します。
5. **デプロイ**: `docs/06-deployment.md`を参照して、アプリケーションをKubernetesにデプロイします。
6. **フロントエンドのセットアップ**: `docs/07-frontend-setup.md`に従って、フロントエンドをセットアップします。
7. **モニタリングの設定**: `docs/08-monitoring.md`を参照して、モニタリングを設定します。

このプロジェクトを通じて、Kubernetesの基本的な使い方や、モダンなアーキテクチャの構築方法を学ぶことができます。