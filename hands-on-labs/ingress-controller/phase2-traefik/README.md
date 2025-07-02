# Phase 2: Traefik Ingress Controller実習

## 目標
- Traefikの動的設定とサービス発見機能を学習
- IngressRouteとMiddleware CRDの使用方法を習得
- TraefikダッシュボードとAPIを活用した運用を理解

## 前提条件
- minikubeが起動していること
- kubectl CLIが設定済みであること

## 学習項目

### 1. Traefikの特徴と利点

**主な特徴**：
- **動的設定**: サービスの自動発見と設定更新
- **豊富なプロトコル対応**: HTTP、HTTPS、TCP、UDP
- **リアルタイムダッシュボード**: Web UIでの監視・管理
- **Middleware機能**: 認証、レート制限、ヘッダー操作などのプラグイン機能
- **Let's Encrypt統合**: 自動SSL証明書取得・更新

**AWS ECSとの比較**：
- **サービス発見**: ECS Service Discovery vs Traefik自動発見
- **ルーティング**: ALB Target Groups vs Traefik IngressRoute
- **設定管理**: CloudFormation vs Kubernetes YAML + CRD

### 2. Traefikアーキテクチャ

```
[インターネット] 
      ↓
[Traefik Ingress Controller]
      ↓
[Kubernetes Services]
      ↓  
[アプリケーションPods]
```

## 実習手順

### ステップ 1: Traefik CRDのインストール

```bash
# Traefik CRDの適用
kubectl apply -f https://raw.githubusercontent.com/traefik/traefik/v3.0/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml
```

### ステップ 2: Traefik本体のデプロイ

```bash
# Traefik設定ファイルの適用
kubectl apply -f 01-traefik-setup.yaml

# デプロイ状況の確認
kubectl get pods -n kube-system -l app=traefik
kubectl get services -n kube-system -l app=traefik
```

### ステップ 3: サンプルアプリケーションのデプロイ

```bash
# サンプルアプリのデプロイ
kubectl apply -f ../sample-apps/

# Pod状態の確認
kubectl get pods -n webapp
```

### ステップ 4: IngressRouteの設定

```bash
# IngressRoute設定の適用
kubectl apply -f 02-ingress-routing.yaml

# IngressRouteの確認
kubectl get ingressroute -n webapp
kubectl describe ingressroute webapp-route -n webapp
```

### ステップ 5: Traefikダッシュボードへのアクセス

```bash
# ダッシュボードアクセス用ポート転送
kubectl port-forward -n kube-system svc/traefik-dashboard 8080:8080

# ブラウザでアクセス
# http://localhost:8080
```

### ステップ 6: 動作確認とテスト

```bash
# テストスクリプトの実行
chmod +x test-traefik.sh
./test-traefik.sh
```

## 高度な機能の学習

### Middleware機能

1. **レート制限**
2. **認証機能**
3. **ヘッダー操作**
4. **リダイレクト**
5. **サーキットブレーカー**

### 監視とメトリクス

1. **Prometheusメトリクス**
2. **アクセスログ**
3. **トレーシング**

## AWS ECSとの移行ポイント

### 設定の対応関係

| AWS ECS | Traefik |
|---------|---------|
| Target Groups | Service |
| ALB Rules | IngressRoute |
| Health Checks | readinessProbe |
| Auto Scaling | HPA |

### 移行時の考慮点

1. **セッション管理**: ALB Sticky Sessions vs Traefik Session Affinity
2. **SSL終端**: ACM vs Let's Encrypt
3. **監視**: CloudWatch vs Prometheus + Grafana
4. **ログ**: CloudWatch Logs vs FluentD + Elasticsearch

## トラブルシューティング

### よくある問題

1. **CRDインストールエラー**
2. **ダッシュボードアクセス不可**
3. **SSL証明書取得失敗**
4. **ルーティングが動作しない**

### デバッグコマンド

```bash
# Traefikログの確認
kubectl logs -n kube-system deployment/traefik

# IngressRouteの詳細確認
kubectl describe ingressroute <name> -n <namespace>

# サービスエンドポイント確認
kubectl get endpoints -n webapp
```

## 次のステップ

- Phase 3: Istio Service Mesh（高度なトラフィック管理）
- Phase 4: AWS Load Balancer Controller（AWSネイティブ統合）

## 参考資料

- [Traefik公式ドキュメント](https://doc.traefik.io/traefik/)
- [Kubernetes CRD Reference](https://doc.traefik.io/traefik/reference/dynamic-configuration/kubernetes-crd/)
- [Traefik Middleware](https://doc.traefik.io/traefik/middlewares/overview/)
