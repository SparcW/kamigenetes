# 🏃 チュートリアル - 実践的Kubernetes学習

AWS ECS管理者向けの段階的なKubernetesチュートリアルです。実際に手を動かしながらKubernetesの操作を習得できます。

## 📚 学習の進め方

### 推奨順序
1. **[Hello Kubernetes](./hello-kubernetes.md)** - 初めてのPodデプロイ
2. **[基本操作](./kubernetes-basics.md)** - kubectl操作とYAML管理
3. **[ステートレスアプリ](./stateless-application.md)** - Webアプリケーションのデプロイ
4. **[ステートフルアプリ](./stateful-application.md)** - データベースとボリューム
5. **[サービス接続](./service-connection.md)** - マイクロサービス間通信
6. **[設定管理](./configuration.md)** - ConfigMapとSecretの活用
7. **[セキュリティ実装](./security.md)** - RBAC、Pod Security、NetworkPolicy

## 🎯 各チュートリアルの内容

### 🚀 [Hello Kubernetes](./hello-kubernetes.md)
**所要時間**: 30分  
**前提知識**: Docker基本操作

- 初めてのPodデプロイ
- kubectl基本コマンド
- AWS ECSタスクとの比較

### ⚙️ [基本操作](./kubernetes-basics.md)
**所要時間**: 1-2時間  
**前提知識**: Hello Kubernetesチュートリアル完了

- YAML作成と管理
- リソースの作成・更新・削除
- kubectl効率的な使い方

### 🌐 [ステートレスアプリ](./stateless-application.md)
**所要時間**: 2-3時間  
**前提知識**: 基本操作完了

- Webアプリケーションのデプロイ
- Serviceによる公開
- LoadBalancerとIngress

### 💾 [ステートフルアプリ](./stateful-application.md)
**所要時間**: 2-3時間  
**前提知識**: ステートレスアプリ完了

- データベースのデプロイ
- PersistentVolumeの活用
- StatefulSetの理解

### 🔗 [サービス接続](./service-connection.md)
**所要時間**: 1-2時間  
**前提知識**: ステートフルアプリ完了

- マイクロサービス間通信
- DNS解決とサービスディスカバリ
- AWS ECS Service Discoveryとの比較

### ⚙️ [設定管理](./configuration.md)
**所要時間**: 1-2時間  
**前提知識**: サービス接続完了

- ConfigMapによる設定分離
- Secretによる機密情報管理
- 環境変数とマウント

### 🔒 [セキュリティ実装](./security.md)
**所要時間**: 2-3時間  
**前提知識**: 設定管理完了

- RBACによる権限管理
- Pod Securityによる制限
- NetworkPolicyによるネットワーク分離

## 🛠️ 前提環境

### 必要なツール
- Docker Desktop
- kubectl
- minikube または kind

### 動作確認
```bash
# Docker確認
docker --version

# kubectl確認
kubectl version --client

# クラスター起動
minikube start
kubectl cluster-info
```

## 📋 学習進捗管理

各チュートリアル完了後にチェック：

- [ ] Hello Kubernetes - 初回Podデプロイ成功
- [ ] 基本操作 - kubectl操作習得
- [ ] ステートレスアプリ - Webアプリ公開成功
- [ ] ステートフルアプリ - DB永続化成功
- [ ] サービス接続 - マイクロサービス通信成功
- [ ] 設定管理 - ConfigMap/Secret活用
- [ ] セキュリティ実装 - RBAC/Pod Security適用

## 🎮 学習支援

### クイズとチェック
各チュートリアルには理解度チェックが含まれています。

### トラブルシューティング
よくある問題と解決方法を各チュートリアルに記載しています。

### AWS ECS比較
各概念について、AWS ECSでの対応する機能との比較説明を含んでいます。

---
**次のステップ**: [Hello Kubernetes](./hello-kubernetes.md)で最初のPodをデプロイしてみましょう！
