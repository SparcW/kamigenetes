#!/bin/bash

# Phase 1: Gateway API基本環境セットアップスクリプト
# AWS ECS管理者向けKubernetes Gateway API学習環境

set -e

echo "🚀 Gateway API Phase 1 セットアップを開始します..."
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

# Step 1: 前提条件の確認
print_step 1 "前提条件の確認"

# kubectl CLI確認
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl CLI がインストールされていません"
    exit 1
fi
print_success "kubectl CLI が利用可能です"

# Kubernetesクラスター接続確認
if ! kubectl cluster-info &> /dev/null; then
    print_error "Kubernetesクラスターに接続できません"
    exit 1
fi
print_success "Kubernetesクラスターに接続しました"

# Step 2: Gateway API CRDsの確認とインストール
print_step 2 "Gateway API CRDsの確認とインストール"

if ! kubectl api-resources | grep -q "gateways.*gateway.networking.k8s.io"; then
    print_warning "Gateway API CRDsがインストールされていません。インストールを実行します..."
    
    # Standard Gateway API CRDs
    echo "標準Gateway API CRDsをインストール中..."
    kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml
    
    # 少し待機
    echo "CRDs確認のため5秒待機..."
    sleep 5
    
    if kubectl api-resources | grep -q "gateways.*gateway.networking.k8s.io"; then
        print_success "Gateway API CRDsのインストールが完了しました"
    else
        print_error "Gateway API CRDsのインストールに失敗しました"
        exit 1
    fi
else
    print_success "Gateway API CRDsが既にインストールされています"
fi

# Step 3: Gateway Controller（NGINX Gateway Fabric）の確認/インストール
print_step 3 "Gateway Controllerの確認"

if ! kubectl get namespace nginx-gateway &> /dev/null; then
    print_warning "NGINX Gateway Fabricがインストールされていません"
    echo "NGINX Gateway Fabricをインストールしますか？ (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "NGINX Gateway Fabricをインストール中..."
        kubectl apply -f https://github.com/nginxinc/nginx-gateway-fabric/releases/latest/download/crds.yaml
        kubectl apply -f https://github.com/nginxinc/nginx-gateway-fabric/releases/latest/download/nginx-gateway.yaml
        
        echo "NGINX Gateway Fabricの起動を待機中..."
        kubectl wait --for=condition=available --timeout=300s deployment/nginx-gateway -n nginx-gateway
        print_success "NGINX Gateway Fabricのインストールが完了しました"
    else
        print_warning "NGINX Gateway Fabricをスキップしました。手動でGateway Controllerをインストールしてください。"
    fi
else
    print_success "Gateway Controller（名前空間: nginx-gateway）が存在します"
fi

# Step 4: 名前空間の作成
print_step 4 "名前空間の作成"

echo "名前空間を作成中..."
kubectl apply -f manifests/namespace.yaml
print_success "名前空間が作成されました"

# Step 5: GatewayClassの作成
print_step 5 "GatewayClassの作成"

echo "GatewayClassを作成中..."
kubectl apply -f manifests/gatewayclass.yaml

# GatewayClassの状態確認
if kubectl wait --for=condition=Accepted --timeout=60s gatewayclass nginx-gateway; then
    print_success "GatewayClassが正常に作成され、受け入れられました"
else
    print_warning "GatewayClassの受け入れに時間がかかっています。手動で確認してください。"
fi

# Step 6: サンプルアプリケーションのデプロイ
print_step 6 "サンプルアプリケーションのデプロイ"

echo "サンプルアプリケーションをデプロイ中..."
kubectl apply -f manifests/sample-app/

# Deploymentの準備完了を待機
echo "Deploymentの準備を待機中..."
if kubectl wait --for=condition=available --timeout=180s deployment/demo-app -n gateway-demo; then
    print_success "サンプルアプリケーションが正常にデプロイされました"
else
    print_error "サンプルアプリケーションのデプロイに失敗しました"
    exit 1
fi

# Step 7: Gatewayの作成
print_step 7 "Gatewayの作成"

echo "Gatewayを作成中..."
kubectl apply -f manifests/gateway.yaml

# Gatewayの準備完了を待機
echo "Gatewayの準備を待機中..."
sleep 10
if kubectl wait --for=condition=Programmed --timeout=120s gateway/demo-gateway -n gateway-demo; then
    print_success "Gatewayが正常に作成され、プログラムされました"
else
    print_warning "Gatewayのプログラムに時間がかかっています。手動で確認してください。"
fi

# Step 8: HTTPRouteの作成
print_step 8 "HTTPRouteの作成"

echo "HTTPRouteを作成中..."
kubectl apply -f manifests/httproute.yaml

# HTTPRouteの状態確認
sleep 5
if kubectl get httproute demo-route -n gateway-demo &> /dev/null; then
    print_success "HTTPRouteが正常に作成されました"
else
    print_error "HTTPRouteの作成に失敗しました"
    exit 1
fi

# Step 9: セットアップ確認
print_step 9 "セットアップの確認"

echo ""
echo "🔍 リソース確認:"
echo "=================="

# GatewayClass確認
echo -e "\n${BLUE}GatewayClass:${NC}"
kubectl get gatewayclass

# Gateway確認
echo -e "\n${BLUE}Gateway:${NC}"
kubectl get gateway -n gateway-demo

# HTTPRoute確認
echo -e "\n${BLUE}HTTPRoute:${NC}"
kubectl get httproute -n gateway-demo

# Service確認
echo -e "\n${BLUE}Services:${NC}"
kubectl get services -n gateway-demo

# Pod確認
echo -e "\n${BLUE}Pods:${NC}"
kubectl get pods -n gateway-demo

# Gateway IPアドレスの取得
echo -e "\n${BLUE}Gateway IPアドレス:${NC}"
GATEWAY_IP=$(kubectl get gateway demo-gateway -n gateway-demo -o jsonpath='{.status.addresses[0].value}' 2>/dev/null || echo "未確定")
echo "Gateway IP: $GATEWAY_IP"

echo ""
echo "🎉 Phase 1 セットアップが完了しました！"
echo "=================================="
echo ""
echo "📋 次のステップ:"
echo "1. テストスクリプトを実行: ./test.sh"
echo "2. ブラウザでアクセス: http://demo.example.com (hostsファイル設定必要)"
echo "3. curl でテスト: curl -H \"Host: demo.example.com\" http://$GATEWAY_IP/"
echo ""
echo "📚 学習のポイント:"
echo "- GatewayClass: AWS ALBの種類選択に相当"
echo "- Gateway: AWS ALBインスタンスに相当"  
echo "- HTTPRoute: ALBリスナールールに相当"
echo "- Service: ALBターゲットグループに相当"
echo ""
echo "❓ 問題が発生した場合は docs/troubleshooting.md を確認してください"
