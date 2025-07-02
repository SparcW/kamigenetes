# リソースのクリーンアップ

このガイドでは、3層Webアプリケーションのハンズオンラボで作成したすべてのKubernetesリソースを安全に削除する方法を説明します。

## クリーンアップの重要性

適切なリソースのクリーンアップは以下の理由で重要です：

- **リソース消費の削減**: CPU、メモリ、ストレージの無駄遣いを防ぐ
- **コスト削減**: クラウド環境でのコスト最適化
- **環境の整理**: 次回の学習時に清潔な環境で開始可能
- **セキュリティ**: 不要なサービスエンドポイントの除去

## クリーンアップ手順

### ステップ 1: 現在のリソース状況確認

削除前に、どのようなリソースが作成されているかを確認します：

```bash
# 全体概要の確認
echo "=== Sample App Namespace Overview ==="
kubectl get all -n sample-app

# 詳細なリソース一覧
echo -e "\n=== Detailed Resource List ==="
kubectl get all,configmaps,secrets,pvc -n sample-app

# ネームスペース外のリソース確認（もしあれば）
echo -e "\n=== Cluster-wide Resources (if any) ==="
kubectl get pv | grep sample-app || echo "No persistent volumes found"
```

### ステップ 2: アプリケーション層の削除

まず、外部に公開されているWebアプリケーションから削除します：

```bash
echo "Cleaning up Web Application layer..."

# Web Service の削除
kubectl delete service web-service -n sample-app

# Web Deployment の削除
kubectl delete deployment web-deployment -n sample-app

# Web層の削除確認
kubectl get all -n sample-app -l component=web
```

### ステップ 3: キャッシュ層の削除

次に、Redisキャッシュ層を削除します：

```bash
echo "Cleaning up Cache layer..."

# Redis Service の削除
kubectl delete service redis-service -n sample-app

# Redis Deployment の削除
kubectl delete deployment redis-deployment -n sample-app

# Redis設定用ConfigMapの削除
kubectl delete configmap redis-config -n sample-app

# キャッシュ層の削除確認
kubectl get all -n sample-app -l component=redis
```

### ステップ 4: データベース層の削除

データベース層を削除します（永続化データも含む）：

```bash
echo "Cleaning up Database layer..."

# PostgreSQL Service の削除
kubectl delete service postgres-service -n sample-app

# PostgreSQL Deployment の削除
kubectl delete deployment postgres-deployment -n sample-app

# データベース層の削除確認
kubectl get all -n sample-app -l component=postgres
```

### ステップ 5: 永続化ストレージの削除

**⚠️ 注意**: この操作により、データベースのデータが完全に失われます。

```bash
echo "Cleaning up Persistent Storage..."

# PVCの削除
kubectl delete pvc postgres-pvc -n sample-app

# PVCの削除確認
kubectl get pvc -n sample-app

# 関連するPVの確認と削除（必要に応じて）
kubectl get pv | grep sample-app
# 手動で作成したPVがある場合は個別に削除
# kubectl delete pv <pv-name>
```

### ステップ 6: 設定情報の削除

ConfigMapとSecretを削除します：

```bash
echo "Cleaning up Configuration..."

# アプリケーション設定の削除
kubectl delete configmap app-config -n sample-app

# 機密情報の削除
kubectl delete secret app-secrets -n sample-app

# 設定の削除確認
kubectl get configmaps,secrets -n sample-app
```

### ステップ 7: ネームスペースの削除

最後に、ネームスペース全体を削除します（これにより残存リソースもすべて削除）：

```bash
echo "Cleaning up Namespace..."

# ネームスペースの削除（残存リソースもすべて削除される）
kubectl delete namespace sample-app

# 削除の確認
kubectl get namespace sample-app
# 出力: Error from server (NotFound): namespaces "sample-app" not found
```

### ステップ 8: Dockerイメージのクリーンアップ（オプション）

ローカルのDockerイメージも削除する場合：

```bash
echo "Cleaning up Docker images..."

# アプリケーションイメージの削除
docker rmi k8s-sample-app:latest k8s-sample-app:v2 2>/dev/null || echo "Some images may not exist"

# 未使用イメージの削除
docker image prune -f

# 未使用ボリュームの削除
docker volume prune -f

# イメージ削除の確認
docker images | grep k8s-sample-app || echo "No sample app images found"
```

## 一括削除スクリプト

時間短縮のために、以下のスクリプトですべてを一度に削除できます：

```bash
#!/bin/bash

echo "🧹 Starting cleanup of Sample App resources..."

# ネームスペース全体を削除（最も効率的）
echo "Deleting namespace sample-app..."
kubectl delete namespace sample-app

# 削除完了まで待機
echo "Waiting for namespace deletion to complete..."
while kubectl get namespace sample-app &> /dev/null; do
    echo "  Still deleting..."
    sleep 5
done

echo "✅ Namespace deleted successfully"

# Dockerイメージのクリーンアップ
echo "Cleaning up Docker images..."
docker rmi k8s-sample-app:latest k8s-sample-app:v2 2>/dev/null || true
docker image prune -f

echo "🎉 Cleanup completed successfully!"
echo "Your cluster is now clean and ready for the next lab."
```

このスクリプトを `cleanup.sh` として保存し、実行可能にするには：

```bash
chmod +x cleanup.sh
./cleanup.sh
```

## トラブルシューティング

### リソースが削除されない場合

```bash
# Finalizer が設定されているリソースの確認
kubectl get all -n sample-app -o yaml | grep finalizers

# 強制削除（最後の手段）
kubectl delete namespace sample-app --force --grace-period=0
```

### PVが削除されない場合

```bash
# PVの状態確認
kubectl get pv -o wide

# 手動でPVのfinalizer削除（必要に応じて）
kubectl patch pv <pv-name> -p '{"metadata":{"finalizers":null}}'
```

### Dockerイメージが削除できない場合

```bash
# 実行中のコンテナ確認
docker ps -a | grep k8s-sample-app

# 実行中のコンテナを停止・削除
docker stop $(docker ps -q --filter "ancestor=k8s-sample-app") 2>/dev/null || true
docker rm $(docker ps -aq --filter "ancestor=k8s-sample-app") 2>/dev/null || true

# 再度イメージ削除を試行
docker rmi k8s-sample-app:latest
```

## 削除確認チェックリスト

クリーンアップが完了したことを確認してください：

```bash
# 1. ネームスペースが存在しないことを確認
echo "=== Namespace Check ==="
kubectl get namespace sample-app 2>&1 | grep "NotFound" && echo "✅ Namespace deleted" || echo "❌ Namespace still exists"

# 2. 関連するPVが削除されていることを確認
echo -e "\n=== Persistent Volume Check ==="
kubectl get pv | grep sample-app && echo "❌ PVs still exist" || echo "✅ No related PVs found"

# 3. Dockerイメージが削除されていることを確認
echo -e "\n=== Docker Image Check ==="
docker images | grep k8s-sample-app && echo "❌ Images still exist" || echo "✅ No sample app images found"

# 4. 一般的なクラスターリソース確認
echo -e "\n=== Cluster Resource Check ==="
kubectl get all --all-namespaces | grep sample-app && echo "❌ Some resources still exist" || echo "✅ No sample app resources found"

echo -e "\n🎉 Cleanup verification completed!"
```

## 次のステップ

クリーンアップが完了したら：

1. **新しいラボの開始**: 他のハンズオンラボに進む
2. **環境の再利用**: 同じ環境で別のアプリケーションをデプロイ
3. **本番準備**: 学習した内容をもとに本番環境での計画を立てる

## AWS ECS管理者向けのメモ

ECSからKubernetesへの移行における、リソース管理の違い：

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **リソース削除** | サービス→タスク定義の順 | Namespace削除で一括 |
| **データ永続化** | EBSボリューム手動管理 | PVCの削除でPVも削除 |
| **設定削除** | Parameter Store手動削除 | ConfigMap/Secret自動削除 |
| **監視停止** | CloudWatch設定残存 | Podと同時に監視停止 |

Kubernetesでは、ネームスペースによる論理分離により、リソースの一括管理・削除が容易になります。

---

**これで3層Webアプリケーションハンズオンラボのすべてのリソースが清潔に削除されました。お疲れさまでした！** 🎉
