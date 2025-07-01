# Phase 4: AWS統合

## 📖 概要

このPhaseでは、AWS Load Balancer ControllerとGateway APIの統合を学習し、AWSネイティブなロードバランシングを実装します。

## 🎯 学習目標

- AWS Load Balancer ControllerのGateway API対応
- ALB/NLBとGateway APIの統合
- AWS Certificate Managerとの連携
- CloudWatch監視設定
- EKSでの実装パターン

## 🔄 AWS統合の利点

| 項目 | 従来のIngress | Gateway API + AWS LBC |
|------|--------------|----------------------|
| **ロードバランサー** | ALB Ingress | Gateway → ALB/NLB |
| **証明書管理** | ACM統合 | ACM統合（改善） |
| **監視** | CloudWatch | CloudWatch + K8s metrics |
| **マルチプロトコル** | HTTP/HTTPSのみ | TCP/UDP/TLS対応 |

## 📋 前提条件

- EKSクラスター
- AWS Load Balancer Controller
- Gateway API CRDs
- 適切なIAMロール

## 🚀 実習手順

```bash
# AWS環境セットアップ
./setup-aws.sh

# Gateway API + AWS LBC設定
./setup.sh

# テスト実行
./test.sh
```

## 📁 主要ファイル

- `manifests/aws-gatewayclass.yaml` - AWS Gateway Class
- `manifests/alb-gateway.yaml` - ALB Gateway
- `manifests/nlb-gateway.yaml` - NLB Gateway
- `manifests/acm-tls.yaml` - ACM証明書統合

詳細は [Phase 4 README](./README.md) を参照してください。
