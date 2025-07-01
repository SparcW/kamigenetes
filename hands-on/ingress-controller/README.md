# Kubernetes Ingressコントローラー ハンズオン演習

このディレクトリでは、様々なIngressコントローラーの実践的な演習を提供します。AWS ECS管理者向けに設計された段階的な学習プログラムです。

## 📚 学習目標

- 各種Ingressコントローラーの特徴と使い分けを理解する
- 実際のWebアプリケーションでの設定と運用を学ぶ
- SSL/TLS、認証、ロードバランシングなどの高度な機能を習得する
- AWS ECSとの違いと移行のポイントを把握する

## 🎯 演習構成

### Phase 1: NGINX Ingress Controller 基礎演習
**学習時間**: 2-3時間  
**難易度**: ⭐⭐☆☆☆

- 基本的なIngressの作成と設定
- パス/ホストベースルーティング
- SSL/TLS終端の設定
- 基本的な認証設定

**主なファイル**:
- `phase1-nginx/01-basic-ingress.yaml` - 基本設定
- `phase1-nginx/02-path-routing.yaml` - パスベースルーティング
- `phase1-nginx/03-ssl-tls.yaml` - SSL/TLS設定
- `phase1-nginx/04-authentication.yaml` - 認証設定

### Phase 2: Traefik 演習
**学習時間**: 2-3時間  
**難易度**: ⭐⭐⭐☆☆

- Traefik Dashboard の活用
- 動的設定とサービス発見
- Let's Encrypt自動証明書取得
- ミドルウェアによる高度な設定

**主なファイル**:
- `phase2-traefik/01-traefik-setup.yaml` - Traefik基本セットアップ
- `phase2-traefik/02-ingressroute.yaml` - IngressRoute CRD
- `phase2-traefik/03-middleware.yaml` - ミドルウェア設定
- `phase2-traefik/04-dashboard.yaml` - ダッシュボード設定

### Phase 3: Istio Gateway/VirtualService 演習
**学習時間**: 4-5時間  
**難易度**: ⭐⭐⭐⭐☆

- Istio Service Meshの基本概念
- Gateway/VirtualServiceによるトラフィック管理
- カナリアデプロイメントとA/Bテスト
- セキュリティポリシーとmTLS

**主なファイル**:
- `phase3-istio/01-istio-setup.yaml` - Istio基本セットアップ
- `phase3-istio/02-gateway-virtualservice.yaml` - 基本ルーティング
- `phase3-istio/03-traffic-management.yaml` - 高度なトラフィック管理
- `phase3-istio/04-security.yaml` - セキュリティ設定

### Phase 4: AWS Load Balancer Controller 演習
**学習時間**: 2-3時間  
**難易度**: ⭐⭐⭐☆☆

- AWS ALB/NLBとの統合
- AWS Certificate Managerの活用
- ターゲットグループとヘルスチェック
- AWS WAFとの連携

**主なファイル**:
- `phase4-aws/01-alb-setup.yaml` - ALB基本設定
- `phase4-aws/02-nlb-setup.yaml` - NLB設定
- `phase4-aws/03-acm-integration.yaml` - ACM統合
- `phase4-aws/04-waf-integration.yaml` - WAF連携

### Phase 5: 高度な機能と運用演習
**学習時間**: 3-4時間  
**難易度**: ⭐⭐⭐⭐⭐

- 複数Ingressコントローラーの組み合わせ
- 監視とアラート設定
- パフォーマンスチューニング
- 災害復旧とフェイルオーバー

**主なファイル**:
- `phase5-advanced/01-multi-ingress.yaml` - 複数Ingress設定
- `phase5-advanced/02-monitoring.yaml` - 監視設定
- `phase5-advanced/03-performance.yaml` - パフォーマンス設定
- `phase5-advanced/04-disaster-recovery.yaml` - DR設定

## 🛠️ 前提条件

### 必要なツール
```bash
# Kubernetes cluster (minikube, kind, EKS等)
kubectl version

# Helm (パッケージ管理)
helm version

# curl (API テスト用)
curl --version

# jq (JSON処理用)
jq --version
```

### 必要なKubernetesリソース
- 最小2GB RAM、2 CPU cores
- インターネット接続（Dockerイメージ取得用）
- LoadBalancer対応（クラウド環境推奨）

## 🚀 クイックスタート

### 1. 演習環境のセットアップ
```bash
# リポジトリのクローン（すでに完了している場合はスキップ）
cd /mnt/c/dev/k8s/hands-on/ingress-controller

# セットアップスクリプトの実行
./scripts/setup-environment.sh

# 演習用アプリケーションのデプロイ
kubectl apply -f sample-apps/
```

### 2. Phase 1から開始
```bash
# NGINX Ingress Controller演習
cd phase1-nginx
./test-nginx-ingress.sh

# 結果の確認
kubectl get ingress -A
curl -H "Host: webapp.local" http://localhost
```

## 📊 AWS ECSとの比較ポイント

### Application Load Balancer vs Kubernetes Ingress

| 項目 | AWS ALB | Kubernetes Ingress |
|------|---------|-------------------|
| **設定方法** | AWSコンソール/CloudFormation | YAMLマニフェスト |
| **ルーティング** | パス/ホスト/ヘッダー | 同様 + より柔軟なルール |
| **SSL/TLS** | ACM統合 | cert-manager/Let's Encrypt |
| **認証** | Cognito統合 | OAuth2-proxy/OIDC |
| **監視** | CloudWatch | Prometheus/Grafana |
| **コスト** | 時間課金 | インスタンス課金 |

### 移行時の主な変更点

**ECS Service Discovery → Kubernetes Service**:
```yaml
# ECS (CloudMapサービス発見)
# 自動的にサービス発見される

# Kubernetes (明示的なService定義)
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 3000
```

**ALB Target Group → Ingress Backend**:
```yaml
# AWS ALB設定
# Target Group経由でコンテナにルーティング

# Kubernetes Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: webapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp-service
            port:
              number: 80
```

## 🔧 便利なスクリプト

### セットアップ・テスト・クリーンアップ
```bash
# 全環境セットアップ
./scripts/setup-all.sh

# 特定Phase のテスト
./scripts/test-phase.sh <phase-number>

# 全リソースのクリーンアップ
./scripts/cleanup-all.sh

# 演習進捗の確認
./scripts/check-progress.sh
```

### デバッグユーティリティ
```bash
# Ingressの状態一覧
./scripts/debug-ingress.sh

# SSL証明書の確認
./scripts/check-certificates.sh

# ログの一括取得
./scripts/collect-logs.sh
```

## 📖 学習リソース

### 公式ドキュメント
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Traefik](https://traefik.io/traefik/)
- [Istio](https://istio.io/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)

### 参考記事とベストプラクティス
- `docs/best-practices.md` - 本番環境でのベストプラクティス
- `docs/troubleshooting.md` - よくある問題と解決策
- `docs/performance-tuning.md` - パフォーマンスチューニング
- `docs/security-guide.md` - セキュリティ設定ガイド

## 🤝 サポート

### 質問・フィードバック
演習中に問題が発生した場合は、以下の方法でサポートを受けられます：

1. **ログの確認**: `scripts/collect-logs.sh` でログを収集
2. **設定の検証**: `scripts/validate-config.sh` で設定をチェック
3. **コミュニティ**: Kubernetes Slack、GitHub Issues

### 演習の進め方
1. 各Phaseは順序立てて進めることを推奨
2. 理解できない部分は `docs/` の詳細説明を参照
3. 実際の本番環境への適用前に十分なテストを実施

---

**注意**: この演習は学習目的で設計されています。本番環境では、セキュリティ、パフォーマンス、可用性の要件に応じて適切な設定を行ってください。
