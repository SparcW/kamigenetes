# Phase 1: 基本的なGateway API実装

## 📖 概要

このPhaseでは、Gateway APIの基本的な概念を学習し、シンプルなWebアプリケーションをGateway経由で公開します。

## 🎯 学習目標

- GatewayClassの理解と設定
- 基本的なGatewayの作成
- HTTPRouteによるトラフィックルーティング
- AWS ECSのALBとの比較理解

## 実習内容

### 1. GatewayClassの作成
Gateway Controllerの設定を定義

### 2. Gatewayの作成
ネットワーク入り口の定義

### 3. HTTPRouteの作成
アプリケーション固有のルーティング設定

### 4. サンプルアプリケーションのデプロイ
テスト用のWebアプリケーション

## ファイル構成

```
phase1-basic-gateway/
├── README.md                 # このファイル
├── manifests/
│   ├── 01-gatewayclass.yaml     # GatewayClass定義
│   ├── 02-gateway.yaml          # Gateway定義
│   ├── 03-sample-app.yaml       # サンプルアプリケーション
│   └── 04-httproute.yaml        # HTTPRoute定義
├── scripts/
│   ├── setup.sh                 # セットアップスクリプト
│   ├── test.sh                  # テストスクリプト
│   └── cleanup.sh               # クリーンアップスクリプト
└── docs/
    ├── comparison-with-ingress.md  # Ingressとの比較
    └── troubleshooting.md          # トラブルシューティング
```

## 実行手順

### 1. セットアップ
```bash
# Phase 1ディレクトリに移動
cd <path-to->/kamigenates/hands-on-labs/gateway-api/phase1-basic-gateway

# Gateway API CRDのインストール（まだの場合）
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v0.8.1/standard-install.yaml

# リソースのデプロイ
./scripts/setup.sh
```

### 2. 動作確認
```bash
# テストの実行
./scripts/test.sh
```

### 3. クリーンアップ
```bash
# リソースの削除
./scripts/cleanup.sh
```

## 確認ポイント

1. **GatewayClassの状態**: `kubectl get gatewayclass`
2. **Gatewayの状態**: `kubectl get gateway -n gateway-api-system`
3. **HTTPRouteの状態**: `kubectl get httproute -n default`
4. **アプリケーションへのアクセス**: HTTP経由でのレスポンス確認

## 期待される結果

- サンプルアプリケーションがGateway API経由でアクセス可能
- HTTPRouteによるパスベースルーティングの動作確認
- Gateway APIリソースの状態確認

## 次のステップ

Phase 1が完了したら、[Phase 2: 高度なルーティング](../phase2-advanced-routing/README.md)に進んでください。
