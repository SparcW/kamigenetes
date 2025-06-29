#!/bin/bash

# このスクリプトは、Kubernetesクラスター内のリソースをクリーンアップするためのものです。

# Knativeサービスの削除
kubectl delete ksvc hono-api --ignore-not-found

# PostgreSQLの削除
helm uninstall my-postgres

# デプロイメントとサービスの削除
kubectl delete -f hands-on/jamstack-app/api/k8s/deployment.yaml --ignore-not-found
kubectl delete -f hands-on/jamstack-app/api/k8s/service.yaml --ignore-not-found

# フロントエンドのデプロイメントとサービスの削除
kubectl delete -f hands-on/jamstack-app/frontend/k8s/deployment.yaml --ignore-not-found
kubectl delete -f hands-on/jamstack-app/frontend/k8s/service.yaml --ignore-not-found

# その他のリソースの削除
kubectl delete configmap --all --namespace default
kubectl delete secret --all --namespace default

echo "クリーンアップが完了しました。"