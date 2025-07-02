# 🏗️ クラスター管理 - Kubernetesクラスターの運用管理

Kubernetesクラスターの日常的な管理タスクと運用手順を説明します。AWS ECS経験者向けに、ECSクラスター管理からKubernetesクラスター管理への移行を実践的に解説します。

## 🎯 対象タスク

- **ノード管理** - ワーカーノードの追加・削除・メンテナンス
- **リソース監視** - CPU、メモリ、ストレージの監視
- **バックアップ・復旧** - etcdバックアップと災害復旧
- **クラスター更新** - Kubernetesバージョンアップグレード
- **トラブルシューティング** - 問題の診断と解決

## 🔧 ノード管理

### ノード状態の確認

```bash
# ノード一覧と状態確認
kubectl get nodes
kubectl get nodes -o wide

# 特定ノードの詳細情報
kubectl describe node [node-name]

# ノードの条件（Conditions）確認
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'

# ノードラベルの確認
kubectl get nodes --show-labels
```

### ノードのメンテナンス

```bash
# ノードの Drain（Pod退避）
kubectl drain [node-name] --ignore-daemonsets --delete-emptydir-data

# ノードのスケジューリング無効化
kubectl cordon [node-name]

# ノードのスケジューリング有効化
kubectl uncordon [node-name]

# ノードの削除（クラスターから除外）
kubectl delete node [node-name]
```

### AWS EKS でのノード管理

```bash
# EKS ノードグループの確認
aws eks describe-nodegroup --cluster-name [cluster-name] --nodegroup-name [nodegroup-name]

# ノードグループのスケーリング
aws eks update-nodegroup-config \
  --cluster-name [cluster-name] \
  --nodegroup-name [nodegroup-name] \
  --scaling-config minSize=1,maxSize=10,desiredSize=3

# Auto Scaling Group経由でのスケーリング
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name [asg-name] \
  --desired-capacity 5
```

## 📊 リソース監視

### 基本的なリソース確認

```bash
# クラスター全体のリソース使用状況
kubectl top nodes
kubectl top pods --all-namespaces

# 名前空間別のリソース使用状況
kubectl top pods -n [namespace]

# リソースクォータの確認
kubectl get resourcequota --all-namespaces
kubectl describe resourcequota -n [namespace]

# ストレージ使用状況
kubectl get pv
kubectl get pvc --all-namespaces
```

### Metrics Server の設定

```bash
# Metrics Server のインストール（minikube）
minikube addons enable metrics-server

# Metrics Server のインストール（一般的なクラスター）
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Metrics Server の動作確認
kubectl get pods -n kube-system -l k8s-app=metrics-server
kubectl logs -n kube-system -l k8s-app=metrics-server
```

### カスタムメトリクス監視

```yaml
# resource-monitor.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: monitoring-script
data:
  monitor.sh: |
    #!/bin/bash
    while true; do
      echo "=== $(date) ==="
      echo "Node Resources:"
      kubectl top nodes
      echo "Pod Resources:"
      kubectl top pods --all-namespaces --sort-by=cpu
      echo "Storage:"
      kubectl get pv --no-headers | awk '{print $1, $5, $6, $7}'
      echo "========================"
      sleep 300
    done
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: resource-monitor
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: monitor
            image: bitnami/kubectl:latest
            command: ["/bin/bash"]
            args: ["/scripts/monitor.sh"]
            volumeMounts:
            - name: script-volume
              mountPath: /scripts
          volumes:
          - name: script-volume
            configMap:
              name: monitoring-script
              defaultMode: 0755
          restartPolicy: OnFailure
```

## 💾 バックアップと復旧

### etcd バックアップ

```bash
# etcd エンドポイントの確認
kubectl get pods -n kube-system -l component=etcd

# etcd バックアップの作成
ETCDCTL_API=3 etcdctl snapshot save backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# バックアップの検証
ETCDCTL_API=3 etcdctl snapshot status backup.db --write-out=table
```

### AWS EKS でのバックアップ

```bash
# EKS クラスター設定のバックアップ
aws eks describe-cluster --name [cluster-name] > cluster-backup.json

# 重要なリソースのバックアップ
kubectl get all --all-namespaces -o yaml > all-resources-backup.yaml
kubectl get configmaps --all-namespaces -o yaml > configmaps-backup.yaml
kubectl get secrets --all-namespaces -o yaml > secrets-backup.yaml
kubectl get pv -o yaml > pv-backup.yaml
kubectl get pvc --all-namespaces -o yaml > pvc-backup.yaml
```

### Velero を使用したバックアップ

```bash
# Velero のインストール
curl -fsSL -o velero-v1.9.0-linux-amd64.tar.gz https://github.com/vmware-tanzu/velero/releases/download/v1.9.0/velero-v1.9.0-linux-amd64.tar.gz
tar -xvf velero-v1.9.0-linux-amd64.tar.gz
sudo mv velero-v1.9.0-linux-amd64/velero /usr/local/bin/

# AWS 用 Velero 設定
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.5.0 \
  --bucket [backup-bucket] \
  --backup-location-config region=[region] \
  --snapshot-location-config region=[region]

# バックアップの作成
velero backup create my-backup --include-namespaces default,kube-system

# バックアップの確認
velero backup get
velero backup describe my-backup

# 復旧の実行
velero restore create --from-backup my-backup
```

## 🔄 クラスター更新

### Kubernetesバージョンの確認

```bash
# 現在のバージョン確認
kubectl version --short

# 利用可能なバージョンの確認
kubeadm version
kubeadm upgrade plan

# ノードのkubeletバージョン確認
kubectl get nodes -o wide
```

### minikube の更新

```bash
# minikube バージョン確認
minikube version

# minikube の更新
minikube stop
minikube delete
minikube start --kubernetes-version=v1.25.0
```

### AWS EKS の更新

```bash
# EKS クラスターバージョンの確認
aws eks describe-cluster --name [cluster-name] --query 'cluster.version'

# EKS クラスターの更新
aws eks update-cluster-version \
  --name [cluster-name] \
  --kubernetes-version 1.24

# 更新ステータスの確認
aws eks describe-update \
  --name [cluster-name] \
  --update-id [update-id]

# ノードグループの更新
aws eks update-nodegroup-version \
  --cluster-name [cluster-name] \
  --nodegroup-name [nodegroup-name] \
  --kubernetes-version 1.24
```

## 🚨 トラブルシューティング

### 一般的な問題の診断

```bash
# クラスター全体の健全性チェック
kubectl get componentstatuses
kubectl cluster-info
kubectl get events --sort-by=.metadata.creationTimestamp

# ノードの問題診断
kubectl describe node [node-name]
kubectl get pods --all-namespaces --field-selector spec.nodeName=[node-name]

# ネットワークの問題診断
kubectl get services --all-namespaces
kubectl get endpoints --all-namespaces
kubectl get networkpolicies --all-namespaces
```

### Pod 起動問題の診断

```bash
# Pod状態の詳細確認
kubectl get pods -o wide
kubectl describe pod [pod-name]

# コンテナログの確認
kubectl logs [pod-name] -c [container-name]
kubectl logs [pod-name] --previous

# Pod内部での実行
kubectl exec -it [pod-name] -- /bin/sh

# リソース不足の確認
kubectl top nodes
kubectl describe node [node-name] | grep -A 10 "Allocated resources"
```

### ストレージ問題の診断

```bash
# PV/PVC の状態確認
kubectl get pv
kubectl get pvc --all-namespaces
kubectl describe pv [pv-name]
kubectl describe pvc [pvc-name]

# ストレージクラスの確認
kubectl get storageclass
kubectl describe storageclass [storage-class-name]

# ファイルシステムのマウント確認
kubectl exec -it [pod-name] -- df -h
kubectl exec -it [pod-name] -- mount | grep [volume-path]
```

## 📈 パフォーマンス最適化

### リソース制限の最適化

```yaml
# リソース最適化の例
apiVersion: v1
kind: Pod
metadata:
  name: optimized-pod
spec:
  containers:
  - name: app
    image: nginx:1.21
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
  nodeSelector:
    instance-type: "compute-optimized"
  tolerations:
  - key: "compute-node"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

### クラスター最適化

```bash
# 不要なリソースの削除
kubectl delete pods --field-selector=status.phase=Succeeded --all-namespaces
kubectl delete pods --field-selector=status.phase=Failed --all-namespaces

# 未使用のイメージ削除（各ノードで実行）
docker system prune -f
docker image prune -a -f

# リソース使用量の分析
kubectl get pods --all-namespaces --sort-by=.metadata.creationTimestamp
kubectl top pods --all-namespaces --sort-by=cpu
kubectl top pods --all-namespaces --sort-by=memory
```

## 🔐 セキュリティ監査

### RBAC の確認

```bash
# Role と RoleBinding の確認
kubectl get roles --all-namespaces
kubectl get rolebindings --all-namespaces
kubectl get clusterroles
kubectl get clusterrolebindings

# 特定ユーザーの権限確認
kubectl auth can-i --list --as=[username]
kubectl auth can-i create pods --as=[username]
```

### Pod Security の確認

```bash
# Pod Security Policy の確認
kubectl get psp
kubectl describe psp [psp-name]

# Pod Security Standards の確認
kubectl label namespace [namespace] pod-security.kubernetes.io/enforce=restricted
kubectl label namespace [namespace] pod-security.kubernetes.io/audit=restricted
kubectl label namespace [namespace] pod-security.kubernetes.io/warn=restricted
```

## 📊 AWS ECS vs Kubernetes 管理比較

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **ノード管理** | EC2 Auto Scaling | Node drain/cordon |
| **ヘルスチェック** | ELB Health Check | Node Conditions |
| **リソース監視** | CloudWatch | Metrics Server |
| **バックアップ** | 設定のみ | etcd + リソース |
| **更新** | Rolling Update | kubeadm upgrade |
| **ログ** | CloudWatch Logs | kubectl logs |
| **スケーリング** | Auto Scaling | Cluster Autoscaler |

## ✅ 管理タスクチェックリスト

### 日次作業
- [ ] ノード状態の確認
- [ ] Pod/Serviceの健全性確認
- [ ] リソース使用量の確認
- [ ] ログの確認

### 週次作業
- [ ] バックアップの実行・検証
- [ ] 未使用リソースの削除
- [ ] セキュリティ監査
- [ ] パフォーマンス分析

### 月次作業
- [ ] クラスター更新の計画・実行
- [ ] 災害復旧訓練
- [ ] 容量計画の見直し
- [ ] 運用手順の更新

---

**関連タスク**: 
- [Pod設定](./configure-pod-container.md) - Pod レベルの詳細設定
- [モニタリング・ログ](./monitoring-logging.md) - 監視システムの構築
- [セキュリティ設定](../setup/security-configuration.md) - セキュリティ強化

**AWS ECS経験者向けポイント**: 
- Kubernetesでは、よりきめ細かいノード管理が可能
- etcdバックアップが重要（ECSでは不要）
- 宣言的な設定管理により、設定ドリフトを検出・修正可能
