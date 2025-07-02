# Phase 2: 高度なルーティング実装

## 📖 概要

このPhaseでは、Gateway APIの高度なルーティング機能を学習し、パスベース、ヘッダーベース、重み付きルーティングを実装します。

## 🎯 学習目標

- パスベースルーティングの実装
- ヘッダーベースルーティングの設定
- トラフィック分割（A/Bテスト、Canary deployment）
- リクエスト/レスポンス変換
- ReferenceGrantによるクロス名前空間アクセス

## 🏗️ アーキテクチャ図

```
インターネット
    │
    ▼
┌─────────────┐
│   Gateway   │
│             │
└─────────────┘
    │
    ▼ HTTPRoute (複数ルール)
┌─────────────┬─────────────┬─────────────┐
│    API v1   │    API v2   │  Frontend   │
│   Service   │   Service   │   Service   │
└─────────────┴─────────────┴─────────────┘
    │              │              │
    ▼              ▼              ▼
┌─────────────┬─────────────┬─────────────┐
│  API v1     │  API v2     │  Frontend   │
│   Pods      │   Pods      │    Pods     │
└─────────────┴─────────────┴─────────────┘
```

## 🔄 AWS ECSとの比較

| 機能 | AWS ALB | Gateway API HTTPRoute |
|------|---------|----------------------|
| **パスベースルーティング** | リスナールール | HTTPRoute matches.path |
| **ヘッダーベースルーティング** | リスナールール | HTTPRoute matches.headers |
| **重み付きルーティング** | ターゲットグループの重み | backendRefs.weight |
| **リクエスト変換** | Lambda@Edge | HTTPRoute filters |
| **ヘルスチェック** | ターゲットグループ | Kubernetesヘルスチェック |

## 📋 前提条件

- Phase 1の完了
- Gateway API CRDs
- NGINX Gateway Fabric（または他のGateway実装）

## 🚀 実習手順

### ステップ1: 環境セットアップ

```bash
# Phase 1が完了していることを確認
kubectl get gateway demo-gateway -n gateway-demo

# Phase 2環境のセットアップ
./setup.sh
```

### ステップ2: 高度なルーティングのテスト

```bash
# 各種ルーティングのテスト
./test.sh

# 個別テスト
./test-path-routing.sh
./test-header-routing.sh
./test-traffic-splitting.sh
```

### ステップ3: A/Bテストの確認

```bash
# トラフィック分割の確認
for i in {1..10}; do
  curl -H "Host: advanced.example.com" http://<GATEWAY-IP>/api/v1
done
```

## 📁 ファイル構成

```
phase2-advanced-routing/
├── README.md              # このファイル
├── setup.sh              # 環境セットアップスクリプト
├── test.sh               # 包括的テストスクリプト
├── test-path-routing.sh  # パスルーティングテスト
├── test-header-routing.sh # ヘッダールーティングテスト
├── test-traffic-splitting.sh # トラフィック分割テスト
├── cleanup.sh            # クリーンアップスクリプト
├── manifests/
│   ├── namespace.yaml    # 追加名前空間
│   ├── advanced-gateway.yaml # 高度なGateway設定
│   ├── path-based-route.yaml # パスベースルーティング
│   ├── header-based-route.yaml # ヘッダーベースルーティング
│   ├── traffic-split-route.yaml # トラフィック分割
│   ├── request-modifier-route.yaml # リクエスト変換
│   └── apps/
│       ├── api-v1/       # API v1アプリケーション
│       ├── api-v2/       # API v2アプリケーション
│       ├── frontend/     # フロントエンドアプリケーション
│       └── canary/       # Canaryアプリケーション
└── docs/
    ├── routing-concepts.md # ルーティング概念
    └── traffic-management.md # トラフィック管理
```

## 📚 実装する機能

### 1. パスベースルーティング

```yaml
# パスベースルーティングの例
rules:
- matches:
  - path:
      type: PathPrefix
      value: "/api/v1"
  backendRefs:
  - name: api-v1-service
    port: 80
- matches:
  - path:
      type: PathPrefix
      value: "/api/v2"
  backendRefs:
  - name: api-v2-service
    port: 80
```

**AWS ALB比較**: パスベースルーティングルール

### 2. ヘッダーベースルーティング

```yaml
# ヘッダーベースルーティングの例
rules:
- matches:
  - headers:
    - name: "x-api-version"
      value: "v2"
  backendRefs:
  - name: api-v2-service
    port: 80
```

**AWS ALB比較**: ヘッダー条件付きルール

### 3. トラフィック分割

```yaml
# 重み付きルーティングの例
rules:
- matches:
  - path:
      type: PathPrefix
      value: "/api"
  backendRefs:
  - name: api-stable-service
    port: 80
    weight: 90
  - name: api-canary-service
    port: 80
    weight: 10
```

**AWS ALB比較**: ターゲットグループの重み設定

### 4. リクエスト変換

```yaml
# リクエスト変換の例
rules:
- matches:
  - path:
      type: PathPrefix
      value: "/old-api"
  filters:
  - type: URLRewrite
    urlRewrite:
      path:
        type: ReplacePrefixMatch
        replacePrefixMatch: "/api/v2"
  backendRefs:
  - name: api-v2-service
    port: 80
```

**AWS ALB比較**: Lambda@EdgeやALBの組み込み変換

## 🔧 トラブルシューティング

### よくある問題

1. **ルーティングが期待通りに動作しない**
   ```bash
   kubectl describe httproute <route-name> -n <namespace>
   kubectl get httproute <route-name> -n <namespace> -o yaml
   ```

2. **トラフィック分割が機能しない**
   ```bash
   # バックエンドサービスの確認
   kubectl get services -n <namespace>
   kubectl get endpoints -n <namespace>
   ```

3. **ヘッダーベースルーティングの問題**
   ```bash
   # ヘッダー値の確認
   curl -H "x-api-version: v2" -H "Host: example.com" http://<GATEWAY-IP>/
   ```

## 📈 次のステップ

Phase 2が完了したら、Phase 3へ進んでください：
- [Phase 3: マルチプロトコル対応](../phase3-multi-protocol/README.md)

このPhaseでは以下を学習します：
- TCPRouteの実装
- UDPRouteの実装
- TLSRouteとSSL終端

---

## 🤔 練習問題

1. **カスタムヘッダー**: `x-client-type: mobile` でモバイル専用サービスにルーティング
2. **複合条件**: パス + ヘッダーの組み合わせルーティング
3. **段階的カナリー**: 5% → 25% → 50% → 100% の段階的移行

解答例は `solutions/` ディレクトリにあります。
