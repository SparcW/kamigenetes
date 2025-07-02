# Gateway API Hands-on環境

## 概要

このディレクトリには、Kubernetes Gateway APIの学習用hands-on環境が含まれています。
AWS ECS管理者がGateway APIを効率的に学習できるよう、段階的なカリキュラムを提供します。

## 🎯 学習目標

- Gateway APIの基本概念の理解
- HTTPRoute、TCPRoute、UDPRoute、TLSRouteの実装
- 高度なトラフィック管理の習得
- AWS Load Balancer ControllerとGateway APIの統合
- Ingress APIからGateway APIへの移行手法

## 📚 カリキュラム構成

### Phase 1: 基本的なGateway環境
**ディレクトリ**: `phase1-basic-gateway/`
- GatewayClassの設定
- 基本的なGatewayの作成
- HTTPRouteによるルーティング
- 簡単なWebアプリケーションのデプロイ

### Phase 2: 高度なルーティング
**ディレクトリ**: `phase2-advanced-routing/`
- Path-basedルーティング
- Header-basedルーティング
- Traffic Splitting（A/Bテスト）
- リクエスト/レスポンス変換

### Phase 3: マルチプロトコル対応
**ディレクトリ**: `phase3-multi-protocol/`
- TCPRouteの実装
- UDPRouteの実装
- TLSRouteとSSL終端
- gRPCサービスの公開

### Phase 4: AWS統合
**ディレクトリ**: `phase4-aws-integration/`
- AWS Load Balancer ControllerとGateway API
- ALB/NLBとの統合
- AWS Certificate Managerとの連携
- CloudWatch監視設定

## 🛠️ 前提条件

### 必要なツール
- Kubernetes クラスター (minikube/EKS)
- kubectl CLI
- Gateway API CRDs
- 各PhaseごとのGateway実装

### Gateway API実装

サポートされているGateway API実装：
- **NGINX Gateway Fabric** (推奨 - 学習用)
- **Istio** (高機能)
- **AWS Load Balancer Controller** (AWS環境)
- **Traefik** (開発者フレンドリー)

## 🚀 クイックスタート

### 1. Gateway API CRDsのインストール

```bash
# Gateway API CRDsのインストール
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml

# Experimental features（TCPRoute、UDPRoute等）
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/experimental-install.yaml
```

### 2. 各Phaseの実行

```bash
# Phase 1から開始
cd phase1-basic-gateway/
./setup.sh

# Phase 2へ進む
cd ../phase2-advanced-routing/
./setup.sh

# Phase 3へ進む
cd ../phase3-multi-protocol/
./setup.sh

# Phase 4（AWS環境）
cd ../phase4-aws-integration/
./setup.sh
```

## 📖 各Phaseの詳細

| Phase | 対象リソース | 学習内容 | 所要時間 |
|-------|-------------|----------|----------|
| **Phase 1** | GatewayClass, Gateway, HTTPRoute | 基本概念とシンプルなWebアプリ | 30分 |
| **Phase 2** | HTTPRoute (高度), ReferenceGrant | 複雑なルーティングとトラフィック制御 | 45分 |
| **Phase 3** | TCPRoute, UDPRoute, TLSRoute | マルチプロトコル対応 | 60分 |
| **Phase 4** | AWS LB Controller, ACM連携 | AWS環境での実装 | 90分 |

## 🔧 トラブルシューティング

### よくある問題

1. **Gateway APIが認識されない**
   ```bash
   kubectl api-resources | grep gateway
   ```

2. **GatewayClassが見つからない**
   ```bash
   kubectl get gatewayclass
   kubectl describe gatewayclass <class-name>
   ```

3. **HTTPRouteが機能しない**
   ```bash
   kubectl get httproute -A
   kubectl describe httproute <route-name> -n <namespace>
   ```

### ログ確認

```bash
# Gateway実装ごとのログ確認
# NGINX Gateway Fabric
kubectl logs -n nginx-gateway deployment/nginx-gateway

# Istio
kubectl logs -n istio-system deployment/istiod

# AWS LB Controller
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

## 📝 学習後の次のステップ

1. **本番環境への適用計画**
   - 段階的移行戦略の策定
   - 既存Ingressからの移行スケジュール
   - パフォーマンス要件の定義

2. **既存IngressからGateway APIへの移行**
   - 現在のIngress設定の棚卸し
   - Gateway API設定への変換
   - テスト環境での検証

3. **監視・アラート設定**
   - Prometheus + Grafana統合
   - CloudWatch監視（AWS環境）
   - SLI/SLO設定

4. **セキュリティポリシーの実装**
   - RBAC設定
   - NetworkPolicy統合
   - TLS/mTLS設定

5. **パフォーマンスチューニング**
   - リソース最適化
   - オートスケーリング設定
   - キャッシュ戦略

## 📈 学習進捗確認

各Phaseで以下の習得を目指してください：

### Phase 1 完了チェックリスト
- [ ] GatewayClass、Gateway、HTTPRouteの基本概念理解
- [ ] AWS ECSのALBとの比較理解
- [ ] 基本的なWebアプリケーションの公開
- [ ] kubectl での Gateway API操作

### Phase 2 完了チェックリスト
- [ ] パスベース、ヘッダーベースルーティング実装
- [ ] トラフィック分割（A/Bテスト）の実装
- [ ] リクエスト/レスポンス変換の理解
- [ ] 複数条件でのルーティング制御

### Phase 3 完了チェックリスト
- [ ] TCPRoute、UDPRoute、TLSRouteの実装
- [ ] マルチプロトコル対応の理解
- [ ] gRPCサービスの公開
- [ ] SSL/TLS終端の設定

### Phase 4 完了チェックリスト
- [ ] AWS Load Balancer ControllerとGateway API統合
- [ ] ACM証明書との連携
- [ ] CloudWatch監視設定
- [ ] EKS本番環境での実装

## 🔗 関連ドキュメント

- [Gateway API包括ガイド](../../guides/15-gateway-api-comprehensive.md)
- [Ingressコントローラーガイド](../../guides/14-ingress-controller-comprehensive.md)
- [Kubernetes公式 Gateway API](https://gateway-api.sigs.k8s.io/)

---

**開始準備ができましたら、Phase 1から始めてください！**

### Phase 2: 高度なルーティング
- **ディレクトリ**: `phase2-advanced-routing/`
- **内容**: トラフィック分割、A/Bテスト、カナリアデプロイメント
- **学習目標**: 高度なルーティング機能の習得

### Phase 3: マルチプロトコルサポート
- **ディレクトリ**: `phase3-multi-protocol/`
- **内容**: TCPRoute、UDPRoute、TLSRoute
- **学習目標**: L4/L7ネットワーキングの理解

### Phase 4: AWS統合
- **ディレクトリ**: `phase4-aws-integration/`
- **内容**: AWS Gateway API Controller、EKS統合
- **学習目標**: クラウドネイティブな運用

## サポートリソース

### サンプルアプリケーション
- **ディレクトリ**: `sample-apps/`
- **内容**: Gateway APIテスト用のサンプルアプリケーション

### ドキュメント
- **ディレクトリ**: `docs/`
- **内容**: トラブルシューティング、FAQ、移行ガイド

### スクリプト
- **ディレクトリ**: `scripts/`
- **内容**: セットアップ、テスト、クリーンアップスクリプト

## 前提条件

1. **Kubernetesクラスター**: v1.25以上（Gateway API CRDサポート）
2. **Gateway Controller**: NGINX Gateway、Istio、またはAWS Gateway API Controller
3. **kubectl**: Kubernetesクライアント
4. **基本知識**: Kubernetes Pod、Service、Deploymentの理解

## クイックスタート

```bash
# Gateway APIのCRDインストール
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v0.8.1/standard-install.yaml

# Phase 1の開始
cd phase1-basic-gateway
./setup.sh

# テストの実行
./test.sh

# クリーンアップ
./cleanup.sh
```

## 学習パス

1. **初心者**: Phase 1 → Phase 2
2. **中級者**: Phase 2 → Phase 3 → Phase 4
3. **ECS移行者**: 全Phase + 移行ガイド

## トラブルシューティング

問題が発生した場合は、各Phaseの `docs/troubleshooting.md` を参照してください。

## 参考資料

- [Gateway API公式ドキュメント](https://gateway-api.sigs.k8s.io/)
- [Kubernetes Gateway APIガイド](../guides/15-gateway-api-comprehensive.md)
- [AWS Gateway API Controller](https://www.gateway-api-controller.eks.aws.dev/)
