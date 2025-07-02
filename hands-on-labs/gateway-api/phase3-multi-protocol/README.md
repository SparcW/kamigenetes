# Phase 3: マルチプロトコル対応

## 📖 概要

このPhaseでは、Gateway APIのマルチプロトコル機能を学習し、TCP、UDP、TLSRouteを実装します。

## 🎯 学習目標

- TCPRouteによるL4ロードバランシング
- UDPRouteの実装
- TLSRouteとSSL終端
- gRPCサービスの公開
- プロトコル別のトラフィック管理

## 🔄 AWS ECSとの比較

| プロトコル | AWS | Gateway API |
|-----------|-----|-------------|
| **HTTP/HTTPS** | ALB | HTTPRoute |
| **TCP** | NLB | TCPRoute |
| **UDP** | NLB | UDPRoute |
| **TLS終端** | ACM+ALB | TLSRoute |
| **gRPC** | ALB(HTTP/2) | HTTPRoute+gRPC |

## 📋 前提条件

- Phase 1, 2の完了
- Gateway API Experimental CRDs
- マルチプロトコル対応Gateway実装

## 🚀 実習手順

```bash
# 環境セットアップ
./setup.sh

# テスト実行
./test.sh
```

## 📁 主要ファイル

- `manifests/tcproute.yaml` - TCPルーティング
- `manifests/udproute.yaml` - UDPルーティング  
- `manifests/tlsroute.yaml` - TLS終端
- `manifests/grpc-service.yaml` - gRPCサービス

詳細は [Phase 3 README](./README.md) を参照してください。
