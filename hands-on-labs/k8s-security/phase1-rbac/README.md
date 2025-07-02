# Phase 1: RBAC (Role-Based Access Control) 演習

## 概要

この演習では、KubernetesのRBAC（Role-Based Access Control）について学習します。AWS ECSのTask Roleと比較しながら、Kubernetesでの認証・認可システムを理解しましょう。

## 学習目標

1. **ServiceAccount**の概念と作成方法
2. **Role**と**ClusterRole**の違い
3. **RoleBinding**と**ClusterRoleBinding**の使い方
4. **最小権限の原則**の実装
5. AWS ECS Task Role との比較理解

## AWS ECS vs Kubernetes RBAC比較

| 概念 | AWS ECS | Kubernetes |
|------|---------|------------|
| 実行主体 | ECS Task | Pod (ServiceAccount) |
| 権限管理 | IAM Role | Role/ClusterRole |
| 権限割り当て | Task Definition | RoleBinding/ClusterRoleBinding |
| スコープ | AWS リソース全般 | K8sクラスター内リソース |
| 粒度 | AWS API アクション | K8s API verb (get, create, etc.) |

## 実践演習の流れ

### 1. ServiceAccount 作成
```bash
kubectl apply -f 01-serviceaccount.yaml
```

### 2. Role 定義
```bash
kubectl apply -f 02-role.yaml
```

### 3. RoleBinding で権限割り当て
```bash
kubectl apply -f 03-rolebinding.yaml
```

### 4. テスト用Pod でアクセス確認
```bash
kubectl apply -f 04-test-pod.yaml
```

### 5. 自動テスト実行
```bash
./test-rbac.sh
```

## 演習シナリオ

### シナリオ: マイクロサービス環境での権限分離

AWS ECSで運用していたマイクロサービスをKubernetesに移行する際の権限設計を学習します。

**要件:**
- フロントエンドアプリ: Podの読み取り権限のみ
- バックエンドAPI: ConfigMapとSecretの読み取り権限
- データベース管理: 全リソースへの管理権限（Namespace内）

## 重要な概念

### 1. ServiceAccount
```yaml
# ECS Task Role に相当
apiVersion: v1
kind: ServiceAccount
metadata:
  name: frontend-sa
  namespace: security-demo
```

### 2. Role (Namespace スコープ)
```yaml
# ECS Task Role Policy に相当
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: security-demo
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
```

### 3. RoleBinding
```yaml
# Role と ServiceAccount を結びつける
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: security-demo
subjects:
- kind: ServiceAccount
  name: frontend-sa
  namespace: security-demo
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## ベストプラクティス

### 1. 最小権限の原則
- 必要最小限の権限のみ付与
- Namespace を活用したスコープ制限
- 定期的な権限レビューの実施

### 2. ServiceAccount の命名規則
```
<アプリケーション名>-<環境>-sa
例: frontend-prod-sa, api-dev-sa
```

### 3. Role の粒度設計
- 機能別にRole を分割
- 再利用可能な汎用Role の作成
- アプリケーション固有の専用Role

## トラブルシューティング

### よくあるエラーと解決方法

#### 1. `forbidden: User "system:serviceaccount:..." cannot get pods`
```bash
# 権限確認
kubectl auth can-i get pods --as=system:serviceaccount:security-demo:frontend-sa

# RoleBinding確認
kubectl get rolebinding -n security-demo
kubectl describe rolebinding read-pods -n security-demo
```

#### 2. ServiceAccount が見つからない
```bash
# ServiceAccount確認
kubectl get serviceaccounts -n security-demo

# Pod の ServiceAccount確認
kubectl get pod <pod-name> -n security-demo -o yaml | grep serviceAccount
```

#### 3. ClusterRole vs Role の混同
- **Role**: Namespace内のリソースのみ
- **ClusterRole**: クラスター全体のリソース

## 検証コマンド

### 権限テスト
```bash
# 特定のServiceAccountでの権限確認
kubectl auth can-i get pods \
  --as=system:serviceaccount:security-demo:frontend-sa \
  -n security-demo

# 権限一覧表示
kubectl auth can-i --list \
  --as=system:serviceaccount:security-demo:frontend-sa \
  -n security-demo
```

### Pod からの API アクセステスト
```bash
# Pod内からKubernetes APIにアクセス
kubectl exec -it test-pod -n security-demo -- \
  curl -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  -k https://kubernetes.default.svc/api/v1/namespaces/security-demo/pods
```

## 次のPhase への準備

Phase 1完了後、以下を確認してください：

1. ✅ ServiceAccount, Role, RoleBinding の概念理解
2. ✅ AWS ECS Task Role との違いの理解
3. ✅ 権限テストコマンドの実行方法
4. ✅ 最小権限の原則の実装

**次のPhase**: Pod Security Standards による Pod レベルのセキュリティ設定

## 参考資料

- [Kubernetes RBAC 公式ドキュメント](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [AWS ECS Task Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [kubectl auth コマンド](https://kubernetes.io/docs/reference/access-authn-authz/authorization/#checking-api-access)
