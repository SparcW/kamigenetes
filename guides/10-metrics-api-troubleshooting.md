# Kubernetes Metrics API トラブルシューティングガイド

## 問題: "Metrics API not available" エラー

### エラーの症状
```bash
$ kubectl top pod
error: Metrics API not available

$ kubectl top node  
error: Metrics API not available
```

## 🔍 原因と解決方法

### 1. Metrics Serverが無効/未インストールの場合（最も一般的）

#### 原因確認
```bash
# minikubeの場合
minikube addons list | grep metrics-server

# 一般的なクラスターの場合
kubectl get pods -n kube-system | grep metrics
```

#### 解決方法: minikube環境
```bash
# metrics-serverアドオンを有効化
minikube addons enable metrics-server

# 起動確認
kubectl get pods -n kube-system | grep metrics
# 出力例: metrics-server-7fbb699795-4n8tq    1/1     Running   0    4m24s
```

#### 解決方法: 一般的なKubernetesクラスター
```bash
# Metrics Serverをインストール
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# インストール確認
kubectl get deployment metrics-server -n kube-system
```

### 2. Metrics Serverが起動中/準備中の場合

#### 症状
```bash
$ kubectl get pods -n kube-system | grep metrics
metrics-server-7fbb699795-4n8tq    0/1     Running   0    30s
```

#### 解決方法
```bash
# ログを確認
kubectl logs -n kube-system deployment/metrics-server

# 少し待ってから再試行（通常1-2分で起動）
kubectl top nodes
```

### 3. TLS証明書の問題（開発環境でよくある）

#### 症状
```bash
$ kubectl logs -n kube-system deployment/metrics-server
x509: cannot validate certificate for [IP] because it doesn't contain any IP SANs
```

#### 解決方法
```bash
# metrics-serverの設定を修正
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'

# 再起動確認
kubectl get pods -n kube-system | grep metrics
```

## ✅ 動作確認方法

### 基本的なメトリクス確認
```bash
# ノードのリソース使用量
kubectl top nodes
# 出力例:
# NAME       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)   
# minikube   148m         0%       1005Mi          6%

# Podのリソース使用量（デフォルトnamespace）
kubectl top pods

# 全namespaceのPod
kubectl top pods --all-namespaces

# 特定のnamespace
kubectl top pods -n kube-system
```

### 詳細なメトリクス表示
```bash
# CPU使用量でソート
kubectl top pods --all-namespaces --sort-by=cpu

# メモリ使用量でソート  
kubectl top pods --all-namespaces --sort-by=memory

# コンテナ別の表示
kubectl top pods --all-namespaces --containers

# 特定のラベルでフィルタ
kubectl top pods -l app=nginx
```

## 🔧 高度なトラブルシューティング

### Metrics APIの直接アクセス
```bash
# Metrics APIエンドポイントの確認
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# 直接APIを叩く
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes
kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods
```

### Metrics Serverの詳細状態確認
```bash
# デプロイメント状態
kubectl get deployment metrics-server -n kube-system -o wide

# Pod詳細情報
kubectl describe pod -n kube-system -l k8s-app=metrics-server

# サービス確認
kubectl get service metrics-server -n kube-system

# エンドポイント確認
kubectl get endpoints metrics-server -n kube-system
```

### リソース要求/制限の確認
```bash
# メトリクス情報を詳細表示
kubectl top pods --all-namespaces -o json | jq '.items[].containers[].usage'

# ノードの容量情報
kubectl describe nodes | grep -A5 "Capacity:"
```

## 🚨 よくある問題と対処法

### 問題1: "no metrics to serve" エラー
```bash
$ kubectl logs -n kube-system deployment/metrics-server
Failed probe "metric-storage-ready" err="no metrics to serve"
```

**原因**: メトリクス収集がまだ開始されていない  
**対処**: 2-3分待ってから再試行

### 問題2: kubeletとの通信エラー
```bash
$ kubectl logs -n kube-system deployment/metrics-server
unable to fully collect metrics: unable to fully scrape metrics from source kubelet_summary:minikube: unable to fetch metrics from Kubelet minikube
```

**原因**: kubeletのメトリクスエンドポイントにアクセスできない  
**対処**: 
```bash
# kubeletの状態確認
kubectl get nodes -o wide
systemctl status kubelet  # ノード上で実行
```

### 問題3: 権限不足
```bash
$ kubectl top nodes
error: You must be logged in to the server (Unauthorized)
```

**原因**: Metrics APIへのアクセス権限がない  
**対処**:
```bash
# 現在のユーザー確認
kubectl auth whoami

# 権限確認
kubectl auth can-i get pods.metrics.k8s.io
kubectl auth can-i get nodes.metrics.k8s.io
```

## 📊 実用的な使用例

### 1. リソース使用量監視
```bash
# 継続的な監視
watch kubectl top pods --all-namespaces

# リソース使用量の高いPodを特定
kubectl top pods --all-namespaces --sort-by=memory | head -10
kubectl top pods --all-namespaces --sort-by=cpu | head -10
```

### 2. 特定アプリケーションの監視
```bash
# 特定のアプリケーションのみ監視
kubectl top pods -l app=nginx --sort-by=memory

# 本番環境のリソース使用量
kubectl top pods -n production
```

### 3. トラブルシューティング
```bash
# メモリ使用量が多いPodの特定
kubectl top pods --all-namespaces | awk '$3 ~ /[0-9]+Mi/ {print $1, $2, $3}' | sort -k3 -nr

# CPU使用量が0でないPodの特定  
kubectl top pods --all-namespaces | awk '$3 !~ /0m/ {print $1, $2, $3}'
```

## 🔄 Metrics Server の設定オプション

### 推奨設定（本番環境）
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metrics-server
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - name: metrics-server
        image: k8s.gcr.io/metrics-server/metrics-server:v0.7.2
        args:
          - --cert-dir=/tmp
          - --secure-port=4443
          - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
          - --kubelet-use-node-status-port
          - --metric-resolution=15s  # メトリクス収集間隔
        resources:
          requests:
            cpu: 100m
            memory: 200Mi
          limits:
            cpu: 100m
            memory: 200Mi
```

### 開発環境用設定
```yaml
# TLS検証をスキップ（開発環境のみ）
args:
  - --kubelet-insecure-tls
  - --kubelet-preferred-address-types=InternalIP
```

## 🎯 AWS EKSでの違い

| 項目 | minikube | AWS EKS |
|------|----------|---------|
| **インストール方法** | `minikube addons enable metrics-server` | デフォルトで有効 |
| **設定** | アドオンとして管理 | マネージドサービス |
| **トラブルシューティング** | ローカル環境固有の問題 | AWSのIAM/VPC設定 |
| **パフォーマンス** | 単一ノード制限 | 複数ノードスケール |

### EKSでの確認方法
```bash
# EKSでは通常デフォルトで有効
kubectl top nodes
kubectl top pods --all-namespaces

# EKS固有の確認
aws eks describe-addon --cluster-name my-cluster --addon-name metrics-server
```

## ✅ まとめ

### 解決した状態
```bash
$ kubectl top nodes
NAME       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)   
minikube   148m         0%       1005Mi          6%

$ kubectl top pods --all-namespaces
NAMESPACE     NAME                                CPU(cores)   MEMORY(bytes)   
default       nginx                               0m           17Mi            
kube-system   metrics-server-7fbb699795-4n8tq     3m           17Mi            
# ... 他のPod
```

### キーポイント
1. **metrics-server有効化**: `minikube addons enable metrics-server`
2. **起動完了待ち**: 1-2分程度で利用可能
3. **継続的監視**: `watch kubectl top pods`で実時間監視
4. **トラブルシューティング**: ログ確認が重要

これでKubernetesのリソース監視が完全に機能するようになりました！
