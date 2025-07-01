#!/bin/bash

# Phase 2: Gateway API高度なルーティング環境セットアップスクリプト
# AWS ECS管理者向けKubernetes Gateway API学習環境

set -e

echo "🚀 Gateway API Phase 2 セットアップを開始します..."
echo "=================================="

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 関数定義
print_step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Phase 1の前提条件確認
print_step 1 "Phase 1の前提条件確認"

if ! kubectl get gateway demo-gateway -n gateway-demo &> /dev/null; then
    print_error "Phase 1のGateway 'demo-gateway' が見つかりません"
    echo "Phase 1を先に完了してください: cd ../phase1-basic-gateway && ./setup.sh"
    exit 1
fi
print_success "Phase 1のGateway 'demo-gateway' が確認できました"

if ! kubectl get gatewayclass nginx-gateway &> /dev/null; then
    print_error "GatewayClass 'nginx-gateway' が見つかりません"
    echo "Phase 1を先に完了してください"
    exit 1
fi
print_success "GatewayClass 'nginx-gateway' が確認できました"

# Step 2: 名前空間の作成
print_step 2 "追加名前空間の作成"

echo "高度なルーティング用の名前空間を作成中..."
kubectl apply -f manifests/namespace.yaml
print_success "名前空間が作成されました"

# Step 3: API v1アプリケーションのデプロイ
print_step 3 "API v1アプリケーションのデプロイ"

echo "API v1サービスをデプロイ中..."
kubectl apply -f manifests/apps/api-v1/
if kubectl wait --for=condition=available --timeout=120s deployment/api-v1 -n gateway-advanced; then
    print_success "API v1アプリケーションが正常にデプロイされました"
else
    print_error "API v1アプリケーションのデプロイに失敗しました"
    exit 1
fi

# Step 4: API v2アプリケーションのデプロイ
print_step 4 "API v2アプリケーションのデプロイ"

echo "API v2サービスをデプロイ中..."
kubectl apply -f manifests/apps/api-v2/
if kubectl wait --for=condition=available --timeout=120s deployment/api-v2 -n gateway-advanced; then
    print_success "API v2アプリケーションが正常にデプロイされました"
else
    print_error "API v2アプリケーションのデプロイに失敗しました"
    exit 1
fi

# Step 5: 追加のサンプルアプリケーション作成
print_step 5 "追加のサンプルアプリケーション作成"

echo "Frontend、Admin、Static、Health、Canaryサービスを作成中..."

# Frontend Service
kubectl create deployment frontend-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment frontend-service --port=80 --target-port=80 -n gateway-advanced

# Admin Service  
kubectl create deployment admin-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment admin-service --port=8080 --target-port=80 -n gateway-advanced

# Static Service
kubectl create deployment static-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment static-service --port=80 --target-port=80 -n gateway-advanced

# Health Service
kubectl create deployment health-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment health-service --port=8080 --target-port=80 -n gateway-advanced

# Mobile/Web API Services
kubectl create deployment mobile-api-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment mobile-api-service --port=80 --target-port=80 -n gateway-advanced

kubectl create deployment web-api-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment web-api-service --port=80 --target-port=80 -n gateway-advanced

# Authenticated Service
kubectl create deployment authenticated-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment authenticated-service --port=80 --target-port=80 -n gateway-advanced

# Beta API Service
kubectl create deployment beta-api-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment beta-api-service --port=80 --target-port=80 -n gateway-advanced

# Default API Service
kubectl create deployment default-api-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment default-api-service --port=80 --target-port=80 -n gateway-advanced

# Canary Services
kubectl create deployment api-stable-service --image=nginx:1.25-alpine --replicas=3 -n gateway-advanced
kubectl expose deployment api-stable-service --port=80 --target-port=80 -n gateway-advanced

kubectl create deployment api-canary-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment api-canary-service --port=80 --target-port=80 -n gateway-advanced

# Blue-Green Services
kubectl create deployment frontend-blue-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment frontend-blue-service --port=80 --target-port=80 -n gateway-advanced

kubectl create deployment frontend-green-service --image=nginx:1.25-alpine --replicas=2 -n gateway-advanced
kubectl expose deployment frontend-green-service --port=80 --target-port=80 -n gateway-advanced

# A/B Test Services
kubectl create deployment experiment-a-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment experiment-a-service --port=80 --target-port=80 -n gateway-advanced

kubectl create deployment experiment-b-service --image=nginx:1.25-alpine --replicas=1 -n gateway-advanced
kubectl expose deployment experiment-b-service --port=80 --target-port=80 -n gateway-advanced

print_success "追加のサンプルアプリケーションが作成されました"

# すべてのDeploymentの準備完了を待機
echo "すべてのDeploymentの準備を待機中..."
sleep 10

# Step 6: パスベースルーティングの作成
print_step 6 "パスベースルーティングの作成"

echo "パスベースHTTPRouteを作成中..."
kubectl apply -f manifests/path-based-route.yaml
print_success "パスベースルーティングが作成されました"

# Step 7: ヘッダーベースルーティングの作成
print_step 7 "ヘッダーベースルーティングの作成"

echo "ヘッダーベースHTTPRouteを作成中..."
kubectl apply -f manifests/header-based-route.yaml
print_success "ヘッダーベースルーティングが作成されました"

# Step 8: トラフィック分割ルーティングの作成
print_step 8 "トラフィック分割ルーティングの作成"

echo "トラフィック分割HTTPRouteを作成中..."
kubectl apply -f manifests/traffic-split-route.yaml
print_success "トラフィック分割ルーティングが作成されました"

# Step 9: HTTPRouteの状態確認
print_step 9 "HTTPRouteの状態確認"

echo "HTTPRouteの準備を待機中..."
sleep 5

# 各HTTPRouteの状態確認
ROUTES=("path-based-route" "header-based-route" "traffic-split-route" "path-rewrite-route" "header-modifier-route" "conditional-canary-route")

for route in "${ROUTES[@]}"; do
    if kubectl get httproute "$route" -n gateway-advanced &> /dev/null; then
        STATUS=$(kubectl get httproute "$route" -n gateway-advanced -o jsonpath='{.status.conditions[?(@.type=="Accepted")].status}' 2>/dev/null || echo "Unknown")
        if [ "$STATUS" = "True" ]; then
            print_success "HTTPRoute '$route' が正常に受け入れられました"
        else
            print_warning "HTTPRoute '$route' の状態: $STATUS"
        fi
    else
        print_warning "HTTPRoute '$route' が見つかりません"
    fi
done

# Step 10: セットアップ確認
print_step 10 "セットアップの確認"

echo ""
echo "🔍 リソース確認:"
echo "=================="

# 名前空間確認
echo -e "\n${BLUE}名前空間:${NC}"
kubectl get namespaces | grep gateway

# Services確認
echo -e "\n${BLUE}Services (gateway-advanced):${NC}"
kubectl get services -n gateway-advanced

# HTTPRoutes確認
echo -e "\n${BLUE}HTTPRoutes:${NC}"
kubectl get httproute -n gateway-advanced

# Deployments確認
echo -e "\n${BLUE}Deployments:${NC}"
kubectl get deployments -n gateway-advanced

# Gateway IPアドレスの取得
echo -e "\n${BLUE}Gateway IPアドレス:${NC}"
GATEWAY_IP=$(kubectl get gateway demo-gateway -n gateway-demo -o jsonpath='{.status.addresses[0].value}' 2>/dev/null || echo "未確定")
echo "Gateway IP: $GATEWAY_IP"

echo ""
echo "🎉 Phase 2 セットアップが完了しました！"
echo "=================================="
echo ""
echo "📋 テスト方法:"
echo "=============="
echo ""
echo "1. パスベースルーティングテスト:"
echo "   curl -H \"Host: advanced.example.com\" http://$GATEWAY_IP/api/v1"
echo "   curl -H \"Host: advanced.example.com\" http://$GATEWAY_IP/api/v2"
echo ""
echo "2. ヘッダーベースルーティングテスト:"
echo "   curl -H \"Host: header-demo.example.com\" -H \"x-api-version: v1\" http://$GATEWAY_IP/"
echo "   curl -H \"Host: header-demo.example.com\" -H \"x-api-version: v2\" http://$GATEWAY_IP/"
echo ""
echo "3. トラフィック分割テスト:"
echo "   for i in {1..10}; do curl -H \"Host: canary.example.com\" http://$GATEWAY_IP/api; done"
echo ""
echo "4. 包括的テスト実行:"
echo "   ./test.sh"
echo ""
echo "📚 学習のポイント:"
echo "=================="
echo "- パスベースルーティング: AWS ALBのパスベースルールに相当"
echo "- ヘッダーベースルーティング: AWS ALBのヘッダー条件に相当"
echo "- トラフィック分割: AWS ALBの重み付きターゲットグループに相当"
echo "- HTTPRoute filters: AWS Lambda@Edgeの機能に相当"
echo ""
echo "❓ 問題が発生した場合は、個別テストスクリプトで確認してください:"
echo "   ./test-path-routing.sh"
echo "   ./test-header-routing.sh"
echo "   ./test-traffic-splitting.sh"
