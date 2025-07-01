# Phase 2: Pod Security Standards 演習

## 概要

この演習では、Kubernetes Pod Security Standards（PSS）について学習します。AWS ECSのTask定義でのセキュリティ設定と比較しながら、Kubernetesでの Pod レベルのセキュリティ制御を理解しましょう。

## 学習目標

1. **Pod Security Standards**の3つのレベルの理解
2. **securityContext**の適切な設定
3. **非特権コンテナ**の実行方法
4. **Pod Security Admission**の設定
5. AWS ECS Task Security との比較理解

## AWS ECS vs Kubernetes Pod Security比較

| セキュリティ設定 | AWS ECS | Kubernetes |
|----------------|---------|------------|
| 実行ユーザー | Task Definition `user` | securityContext `runAsUser` |
| 特権モード | `privileged: true` | securityContext `privileged: true` |
| 読み取り専用ルートFS | `readonlyRootFilesystem` | securityContext `readOnlyRootFilesystem` |
| Capability | Docker security-opt | securityContext `capabilities` |
| SELinux/AppArmor | AWS固有設定 | securityContext `seLinuxOptions` |
| ネットワークモード | `networkMode` | Pod Network Policy |

## Pod Security Standards の3つのレベル

### 1. Privileged (特権レベル)
- **制限なし**: 最も緩い設定
- **用途**: システム管理、特権が必要なワークロード
- **AWS ECS対応**: 特権モードECSタスク

### 2. Baseline (ベースラインレベル)
- **基本的な制限**: 一般的な特権エスカレーションを防止
- **用途**: 一般的なアプリケーション
- **AWS ECS対応**: 標準的なECSタスク

### 3. Restricted (制限レベル)
- **厳重な制限**: セキュリティのベストプラクティスを強制
- **用途**: セキュリティが重要なワークロード
- **AWS ECS対応**: 強化されたECSタスク

## 実践演習の流れ

### 1. Namespace にPod Security Standards設定
```bash
kubectl apply -f 01-namespace-pss.yaml
```

### 2. セキュアなPod設定例の適用
```bash
kubectl apply -f 02-secure-pod.yaml
```

### 3. 非セキュアなPod例（エラー確認）
```bash
kubectl apply -f 03-insecure-pod.yaml
```

### 4. 自動テスト実行
```bash
./test-pod-security.sh
```

## 演習シナリオ

### シナリオ: 金融アプリケーションのセキュリティ強化

AWS ECSで運用していた金融アプリケーションをKubernetesに移行する際の、Pod レベルのセキュリティ設定を学習します。

**要件:**
- フロントエンド: Baseline レベル（一般的なWebアプリ）
- API Gateway: Baseline レベル（外部通信あり）
- 決済処理: Restricted レベル（最高レベルのセキュリティ）
- データベース: Restricted レベル（機密データ保護）

## 重要な securityContext 設定

### 1. 基本的なセキュリティ設定
```yaml
securityContext:
  runAsNonRoot: true          # 非rootユーザーで実行
  runAsUser: 1000            # 特定のユーザーIDで実行
  runAsGroup: 3000           # 特定のグループIDで実行
  fsGroup: 2000              # ファイルシステムグループ
```

### 2. ファイルシステム制限
```yaml
securityContext:
  readOnlyRootFilesystem: true    # ルートファイルシステムを読み取り専用
  allowPrivilegeEscalation: false # 特権エスカレーション防止
```

### 3. Capability制御
```yaml
securityContext:
  capabilities:
    drop:
    - ALL                    # 全てのCapabilityを削除
    add:
    - NET_BIND_SERVICE       # 必要最小限のCapabilityのみ追加
```

## Pod Security Admission設定

### Namespaceレベルでの設定
```yaml
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 段階的適用
```yaml
# 開発環境: 警告のみ
pod-security.kubernetes.io/warn: baseline

# ステージング環境: 監査 + 警告
pod-security.kubernetes.io/audit: restricted
pod-security.kubernetes.io/warn: restricted

# 本番環境: 完全適用
pod-security.kubernetes.io/enforce: restricted
```

## ベストプラクティス

### 1. 段階的なセキュリティ強化
```bash
# Step 1: 警告レベルで影響確認
kubectl label namespace myapp pod-security.kubernetes.io/warn=baseline

# Step 2: 監査ログで詳細確認
kubectl label namespace myapp pod-security.kubernetes.io/audit=baseline

# Step 3: 本格適用
kubectl label namespace myapp pod-security.kubernetes.io/enforce=baseline
```

### 2. セキュリティコンテキストのテンプレート化
```yaml
# 標準セキュアPodテンプレート
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

### 3. アプリケーション別設定指針

#### Webアプリケーション (Baseline)
- 非rootユーザーで実行
- 特権エスカレーション防止
- 必要最小限のCapability

#### APIサーバー (Baseline → Restricted)
- 読み取り専用ルートファイルシステム
- セキュアな一時ディレクトリ
- ネットワーク制限

#### データベース (Restricted)
- 最厳格なセキュリティ設定
- 全Capabilityの削除
- 暗号化ボリューム使用

## トラブルシューティング

### よくあるエラーと解決方法

#### 1. `violates PodSecurity "baseline"`
```bash
# エラー詳細確認
kubectl describe pod <pod-name>

# セキュリティコンテキスト確認
kubectl get pod <pod-name> -o yaml | grep -A 10 securityContext
```

#### 2. `container has runAsNonRoot and image will run as root`
```yaml
# 解決方法: 明示的にユーザーIDを指定
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
```

#### 3. `ReadOnlyRootFilesystem`でアプリが動かない
```yaml
# 解決方法: 一時ディレクトリをマウント
volumeMounts:
- name: tmp
  mountPath: /tmp
volumes:
- name: tmp
  emptyDir: {}
```

## セキュリティ検証

### 1. Pod Security レベル確認
```bash
# Namespace のPod Security設定確認
kubectl get namespace <namespace> -o yaml | grep pod-security

# Pod のセキュリティコンテキスト確認
kubectl get pod <pod-name> -o jsonpath='{.spec.securityContext}'
```

### 2. 実行時セキュリティ確認
```bash
# Pod内での実行ユーザー確認
kubectl exec <pod-name> -- id

# ファイルシステム権限確認
kubectl exec <pod-name> -- ls -la /

# Capability確認
kubectl exec <pod-name> -- capsh --print
```

### 3. セキュリティポリシー違反テスト
```bash
# 特権Pod作成試行（失敗することを確認）
kubectl apply -f insecure-pod.yaml

# エラーメッセージの確認
kubectl get events --sort-by=.metadata.creationTimestamp
```

## 次のPhase への準備

Phase 2完了後、以下を確認してください：

1. ✅ Pod Security Standards の3レベルの理解
2. ✅ securityContext の適切な設定方法
3. ✅ AWS ECS Task Security との違いの理解
4. ✅ セキュリティ違反の検出と対処方法

**次のPhase**: NetworkPolicy によるネットワークレベルのセキュリティ制御

## 参考資料

- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
- [Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [AWS ECS Task Definition Security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_security)
