#!/bin/bash

# Phase 1: Gateway API基本環境クリーンアップスクリプト
# AWS ECS管理者向けKubernetes Gateway API学習環境

set -e

echo "🧹 Gateway API Phase 1 クリーンアップを開始します..."
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

# 確認プロンプト
echo -e "${YELLOW}⚠️  このスクリプトは以下のリソースを削除します:${NC}"
echo "- 名前空間: gateway-demo"
echo "- GatewayClass: nginx-gateway"  
echo "- Phase 1で作成したすべてのリソース"
echo ""
echo -e "${RED}この操作は元に戻せません。続行しますか？ (yes/no)${NC}"
read -r confirmation

if [[ ! "$confirmation" =~ ^(yes|YES|y|Y)$ ]]; then
    echo "クリーンアップを中止しました"
    exit 0
fi

# Step 1: HTTPRouteの削除
print_step 1 "HTTPRouteの削除"
if kubectl get httproute demo-route -n gateway-demo &> /dev/null; then
    kubectl delete httproute demo-route -n gateway-demo
    print_success "HTTPRoute 'demo-route' を削除しました"
else
    print_warning "HTTPRoute 'demo-route' は存在しません"
fi

# Step 2: Gatewayの削除
print_step 2 "Gatewayの削除"
if kubectl get gateway demo-gateway -n gateway-demo &> /dev/null; then
    kubectl delete gateway demo-gateway -n gateway-demo
    print_success "Gateway 'demo-gateway' を削除しました"
else
    print_warning "Gateway 'demo-gateway' は存在しません"
fi

# Step 3: サンプルアプリケーションの削除
print_step 3 "サンプルアプリケーションの削除"
if kubectl get namespace gateway-demo &> /dev/null; then
    echo "アプリケーションリソースを削除中..."
    kubectl delete -f manifests/sample-app/ --ignore-not-found=true
    print_success "サンプルアプリケーションを削除しました"
else
    print_warning "名前空間 'gateway-demo' は存在しません"
fi

# Step 4: GatewayClassの削除
print_step 4 "GatewayClassの削除"
echo -e "${YELLOW}GatewayClassを削除しますか？ (他のPhaseでも使用される可能性があります) (y/n)${NC}"
read -r delete_gc

if [[ "$delete_gc" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if kubectl get gatewayclass nginx-gateway &> /dev/null; then
        kubectl delete gatewayclass nginx-gateway
        print_success "GatewayClass 'nginx-gateway' を削除しました"
    else
        print_warning "GatewayClass 'nginx-gateway' は存在しません"
    fi
else
    print_warning "GatewayClass 'nginx-gateway' の削除をスキップしました"
fi

# Step 5: 名前空間の削除
print_step 5 "名前空間の削除"
if kubectl get namespace gateway-demo &> /dev/null; then
    echo "名前空間 'gateway-demo' を削除中..."
    kubectl delete namespace gateway-demo
    
    # 削除完了を待機
    echo "削除完了を待機中..."
    kubectl wait --for=delete namespace/gateway-demo --timeout=60s 2>/dev/null || true
    print_success "名前空間 'gateway-demo' を削除しました"
else
    print_warning "名前空間 'gateway-demo' は存在しません"
fi

# Step 6: Gateway Controller削除の確認
print_step 6 "Gateway Controller削除の確認"
echo -e "${YELLOW}NGINX Gateway Fabric（Gateway Controller）を削除しますか？ (y/n)${NC}"
echo -e "${RED}注意: 他のPhaseやプロジェクトで使用している場合は削除しないでください${NC}"
read -r delete_controller

if [[ "$delete_controller" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if kubectl get namespace nginx-gateway &> /dev/null; then
        echo "NGINX Gateway Fabricを削除中..."
        # NGINX Gateway Fabricの削除
        kubectl delete -f https://github.com/nginxinc/nginx-gateway-fabric/releases/latest/download/nginx-gateway.yaml --ignore-not-found=true
        kubectl delete -f https://github.com/nginxinc/nginx-gateway-fabric/releases/latest/download/crds.yaml --ignore-not-found=true
        print_success "NGINX Gateway Fabric を削除しました"
    else
        print_warning "NGINX Gateway Fabric は存在しません"
    fi
else
    print_warning "NGINX Gateway Fabric の削除をスキップしました"
fi

# Step 7: Gateway API CRDs削除の確認
print_step 7 "Gateway API CRDs削除の確認"
echo -e "${YELLOW}Gateway API CRDsを削除しますか？ (y/n)${NC}"
echo -e "${RED}注意: 他のGateway APIプロジェクトで使用している場合は削除しないでください${NC}"
read -r delete_crds

if [[ "$delete_crds" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if kubectl api-resources | grep -q "gateways.*gateway.networking.k8s.io"; then
        echo "Gateway API CRDsを削除中..."
        kubectl delete -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml --ignore-not-found=true
        print_success "Gateway API CRDs を削除しました"
    else
        print_warning "Gateway API CRDs は存在しません"
    fi
else
    print_warning "Gateway API CRDs の削除をスキップしました"
fi

# Step 8: クリーンアップ確認
print_step 8 "クリーンアップの確認"

echo ""
echo "🔍 残存リソース確認:"
echo "==================="

# Gateway-demo名前空間の確認
if kubectl get namespace gateway-demo &> /dev/null; then
    print_warning "名前空間 'gateway-demo' がまだ存在します（削除処理中の可能性があります）"
else
    print_success "名前空間 'gateway-demo' は削除されました"
fi

# GatewayClassの確認
if kubectl get gatewayclass nginx-gateway &> /dev/null; then
    print_warning "GatewayClass 'nginx-gateway' がまだ存在します"
else
    print_success "GatewayClass 'nginx-gateway' は削除されました（または元々存在しませんでした）"
fi

# Gateway API CRDsの確認
if kubectl api-resources | grep -q "gateways.*gateway.networking.k8s.io"; then
    print_warning "Gateway API CRDs がまだ存在します"
else
    print_success "Gateway API CRDs は削除されました（または元々存在しませんでした）"
fi

echo ""
echo "🎉 Phase 1 クリーンアップが完了しました！"
echo "=================================="
echo ""
echo "📋 次のステップ:"
echo "- Phase 1を再実行: ./setup.sh"
echo "- 他のPhaseに進む: cd ../phase2-advanced-routing/"
echo "- 完全に新しい環境でPhase 1を実行: ./setup.sh"
echo ""
echo "📚 学習の復習:"
echo "- Gateway API基本概念の確認"
echo "- AWS ECSとKubernetes Gateway APIの比較理解"
echo "- 次フェーズでの高度なルーティング学習準備"
echo ""

# port-forwardプロセスが残っている場合の警告
PORTFORWARD_PIDS=$(ps aux | grep "kubectl port-forward" | grep -v grep | awk '{print $2}' || true)
if [ -n "$PORTFORWARD_PIDS" ]; then
    print_warning "port-forwardプロセスが残っている可能性があります"
    echo "必要に応じて手動で終了してください: kill $PORTFORWARD_PIDS"
fi
