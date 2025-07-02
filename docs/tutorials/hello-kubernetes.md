# 🚀 Hello Kubernetes - 初めてのPodデプロイ

AWS ECS管理者のためのKubernetes入門チュートリアルです。初めてのPodをデプロイして、Kubernetesの基本操作を体験します。

## 🎯 学習目標

このチュートリアルを完了すると、以下ができるようになります：
- 基本的なkubectlコマンドの使用
- 初めてのPodのデプロイと管理
- AWS ECSタスクとKubernetes Podの違いの理解

## 📋 前提条件

- Docker Desktopがインストール済み
- kubectlがインストール済み  
- minikubeまたはkindでローカルクラスターが起動済み

## 🔧 環境確認

まず、Kubernetesクラスターが正常に動作していることを確認します：

```bash
# クラスター情報の確認
kubectl cluster-info

# ノードの確認
kubectl get nodes

# 現在のコンテキストの確認
kubectl config current-context
```

## 📦 Step 1: 初めてのPodを作成

### 1.1 YAMLファイルの作成

`hello-pod.yaml`ファイルを作成します：

```yaml
# hello-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-kubernetes
  labels:
    app: hello
spec:
  containers:
  - name: hello-container
    image: nginx:1.21
    ports:
    - containerPort: 80
    env:
    - name: MESSAGE
      value: "Hello from Kubernetes!"
```

### 1.2 AWS ECSとの比較

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| Task Definition | Pod YAML | コンテナの実行仕様 |
| Task | Pod | 実際の実行インスタンス |
| Container Definition | containers[] | コンテナの設定 |
| Port Mappings | ports[] | ポート設定 |
| Environment | env[] | 環境変数 |

### 1.3 Podのデプロイ

```bash
# Podの作成
kubectl apply -f hello-pod.yaml

# 作成確認
kubectl get pods

# 詳細情報の確認
kubectl describe pod hello-kubernetes
```

## 🔍 Step 2: Podの状態確認

### 2.1 Podのライフサイクル理解

```bash
# Pod状態の監視
kubectl get pods -w

# ログの確認
kubectl logs hello-kubernetes

# Pod内部への接続
kubectl exec -it hello-kubernetes -- /bin/bash
```

### 2.2 AWS ECSとの状態比較

| ECS Task状態 | Kubernetes Pod状態 | 説明 |
|-------------|-------------------|------|
| PROVISIONING | Pending | リソース確保中 |
| PENDING | Pending | 起動準備中 |
| RUNNING | Running | 正常実行中 |
| STOPPED | Succeeded/Failed | 完了または失敗 |

## 🌐 Step 3: Podへのアクセス

### 3.1 ポートフォワーディング

```bash
# ローカルポートからPodへの転送
kubectl port-forward hello-kubernetes 8080:80

# 別ターミナルでアクセステスト
curl http://localhost:8080
```

### 3.2 AWS ECSとのアクセス比較

- **AWS ECS**: ALB/NLBでタスクへ直接ルーティング
- **Kubernetes**: Serviceリソースでアクセス抽象化（次のチュートリアルで学習）

## 🛠️ Step 4: Podの管理操作

### 4.1 基本的な管理コマンド

```bash
# Podの一覧表示
kubectl get pods
kubectl get pods -o wide

# 特定Podの詳細情報
kubectl describe pod hello-kubernetes

# Pod内のプロセス確認
kubectl top pod hello-kubernetes

# Podの削除
kubectl delete pod hello-kubernetes

# または、YAMLファイル指定で削除
kubectl delete -f hello-pod.yaml
```

### 4.2 YAMLファイルの更新

```yaml
# hello-pod-updated.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-kubernetes
  labels:
    app: hello
    version: v2
spec:
  containers:
  - name: hello-container
    image: nginx:1.22  # バージョンアップ
    ports:
    - containerPort: 80
    env:
    - name: MESSAGE
      value: "Hello from Kubernetes v2!"
    resources:  # リソース制限を追加
      limits:
        memory: "128Mi"
        cpu: "500m"
      requests:
        memory: "64Mi"
        cpu: "250m"
```

```bash
# 更新されたPodのデプロイ
kubectl apply -f hello-pod-updated.yaml
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. Pod が Pending 状態のまま
```bash
# 原因確認
kubectl describe pod hello-kubernetes

# 一般的な原因:
# - ノードのリソース不足
# - イメージのプル失敗
# - 無効なYAML
```

#### 2. Pod が CrashLoopBackOff 状態
```bash
# ログの確認
kubectl logs hello-kubernetes
kubectl logs hello-kubernetes --previous

# 一般的な原因:
# - アプリケーションの起動エラー
# - 設定ミス
# - リソース不足
```

#### 3. イメージのプルエラー
```bash
# イメージ名と存在を確認
docker pull nginx:1.21

# ネットワーク問題の場合はプロキシ設定を確認
```

## 📚 学習チェック

以下の項目をすべて実行できたかチェックしてください：

- [ ] hello-pod.yamlを作成できた
- [ ] kubectlでPodをデプロイできた
- [ ] kubectl get podsでPod状態を確認できた
- [ ] kubectl logsでログを確認できた
- [ ] kubectl execでPod内部にアクセスできた
- [ ] port-forwardでPodにHTTPアクセスできた
- [ ] kubectlでPodを削除できた

## 🎯 理解度クイズ

1. AWS ECSのTask DefinitionはKubernetesの何に相当しますか？
2. Podが"Pending"状態の場合、考えられる原因は何ですか？
3. kubectl apply -f と kubectl create -f の違いは何ですか？

<details>
<summary>答えを見る</summary>

1. **Pod YAML**: 両方ともコンテナの実行仕様を定義
2. **リソース不足、イメージプル失敗、スケジューリング問題**
3. **apply**は更新可能、**create**は新規作成のみ

</details>

## 🚀 次のステップ

Hello Kubernetesチュートリアルお疲れさまでした！

次は **[基本操作](./kubernetes-basics.md)** で、より詳細なkubectl操作とYAML管理を学習しましょう。

---

**AWS ECS経験者向けポイント**:
- Pod = 1つ以上のコンテナをまとめた実行単位（ECSのTaskに近い）
- 通常は直接Podを作らず、DeploymentやReplicaSetを使用
- Serviceを使ってPodへのアクセスを抽象化するのが一般的
