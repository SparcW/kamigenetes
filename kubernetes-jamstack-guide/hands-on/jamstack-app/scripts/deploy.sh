#!/bin/bash

# デプロイメントスクリプト
# このスクリプトは、Kubernetesクラスターにアプリケーションをデプロイします。

# 環境変数の設定
export NAMESPACE=default

# APIのデプロイ
echo "APIをデプロイしています..."
kubectl apply -f hands-on/jamstack-app/api/k8s/deployment.yaml --namespace $NAMESPACE
kubectl apply -f hands-on/jamstack-app/api/k8s/service.yaml --namespace $NAMESPACE

# フロントエンドのデプロイ
echo "フロントエンドをデプロイしています..."
kubectl apply -f hands-on/jamstack-app/frontend/k8s/deployment.yaml --namespace $NAMESPACE
kubectl apply -f hands-on/jamstack-app/frontend/k8s/service.yaml --namespace $NAMESPACE

# PostgreSQLのデプロイ
echo "PostgreSQLをデプロイしています..."
kubectl apply -f hands-on/jamstack-app/database/k8s/postgresql-helm-values.yaml --namespace $NAMESPACE
kubectl apply -f hands-on/jamstack-app/database/k8s/persistent-volume.yaml --namespace $NAMESPACE
kubectl apply -f hands-on/jamstack-app/database/k8s/init-scripts.yaml --namespace $NAMESPACE

# デプロイメントの確認
echo "デプロイメントの状態を確認しています..."
kubectl get all --namespace $NAMESPACE

echo "デプロイメントが完了しました。"