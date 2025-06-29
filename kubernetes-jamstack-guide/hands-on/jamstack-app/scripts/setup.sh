#!/bin/bash

# このスクリプトは、JAMStackアプリケーションのセットアップを行います。

# 必要なツールがインストールされているか確認
command -v kubectl >/dev/null 2>&1 || { echo >&2 "kubectlがインストールされていません。インストールしてください。"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo >&2 "Helmがインストールされていません。インストールしてください。"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo >&2 "Dockerがインストールされていません。インストールしてください。"; exit 1; }

# Kubernetesクラスターの起動
echo "Kubernetesクラスターを起動しています..."
minikube start

# PostgreSQLのデプロイ
echo "PostgreSQLをデプロイしています..."
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-postgres bitnami/postgresql --set postgresqlPassword=mysecretpassword

# Knativeのインストール
echo "Knativeをインストールしています..."
kubectl apply -f https://github.com/knative/serving/releases/latest/download/serving.yaml

# APIのDockerイメージをビルド
echo "APIのDockerイメージをビルドしています..."
cd api
docker build -t my-hono-api .

# フロントエンドのDockerイメージをビルド
echo "フロントエンドのDockerイメージをビルドしています..."
cd ../frontend
docker build -t my-remix-app .

# 完了メッセージ
echo "セットアップが完了しました。次のステップに進んでください。"