#!/bin/bash

# Phase 1: Gateway API基本環境テストスクリプト
# AWS ECS管理者向けKubernetes Gateway API学習環境

set -e

echo "🧪 Gateway API Phase 1 テストを開始します..."
echo "=================================="

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 関数定義
print_test() {
    echo -e "${BLUE}🧪 Test $1: $2${NC}"
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

# テスト結果カウンタ
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=8

# Test 1: Gateway API CRDsの確認
print_test 1 "Gateway API CRDsの確認"
if kubectl api-resources | grep -q "gateways.*gateway.networking.k8s.io"; then
    print_success "Gateway API CRDsが利用可能です"
    ((TESTS_PASSED++))
else
    print_error "Gateway API CRDsが見つかりません"
    ((TESTS_FAILED++))
fi

# Test 2: GatewayClassの状態確認
print_test 2 "GatewayClassの状態確認"
if kubectl get gatewayclass nginx-gateway &> /dev/null; then
    STATUS=$(kubectl get gatewayclass nginx-gateway -o jsonpath='{.status.conditions[?(@.type=="Accepted")].status}' 2>/dev/null || echo "Unknown")
    if [ "$STATUS" = "True" ]; then
        print_success "GatewayClass 'nginx-gateway' が正常に受け入れられています"
        ((TESTS_PASSED++))
    else
        print_warning "GatewayClass 'nginx-gateway' の状態: $STATUS"
        ((TESTS_FAILED++))
    fi
else
    print_error "GatewayClass 'nginx-gateway' が見つかりません"
    ((TESTS_FAILED++))
fi

# Test 3: Gatewayの状態確認
print_test 3 "Gatewayの状態確認"
if kubectl get gateway demo-gateway -n gateway-demo &> /dev/null; then
    STATUS=$(kubectl get gateway demo-gateway -n gateway-demo -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}' 2>/dev/null || echo "Unknown")
    if [ "$STATUS" = "True" ]; then
        print_success "Gateway 'demo-gateway' が正常にプログラムされています"
        ((TESTS_PASSED++))
    else
        print_warning "Gateway 'demo-gateway' の状態: $STATUS"
        ((TESTS_FAILED++))
    fi
else
    print_error "Gateway 'demo-gateway' が見つかりません"
    ((TESTS_FAILED++))
fi

# Test 4: HTTPRouteの状態確認
print_test 4 "HTTPRouteの状態確認"
if kubectl get httproute demo-route -n gateway-demo &> /dev/null; then
    STATUS=$(kubectl get httproute demo-route -n gateway-demo -o jsonpath='{.status.conditions[?(@.type=="Accepted")].status}' 2>/dev/null || echo "Unknown")
    if [ "$STATUS" = "True" ]; then
        print_success "HTTPRoute 'demo-route' が正常に受け入れられています"
        ((TESTS_PASSED++))
    else
        print_warning "HTTPRoute 'demo-route' の状態: $STATUS"
        ((TESTS_FAILED++))
    fi
else
    print_error "HTTPRoute 'demo-route' が見つかりません"
    ((TESTS_FAILED++))
fi

# Test 5: アプリケーションPodの状態確認
print_test 5 "アプリケーションPodの状態確認"
if kubectl get pods -n gateway-demo -l app=demo-app &> /dev/null; then
    READY_PODS=$(kubectl get pods -n gateway-demo -l app=demo-app -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
    TOTAL_PODS=$(kubectl get pods -n gateway-demo -l app=demo-app -o jsonpath='{.items[*].metadata.name}' | wc -w)
    
    if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$READY_PODS" -gt 0 ]; then
        print_success "すべてのアプリケーションPod($READY_PODS/$TOTAL_PODS)が正常に実行中です"
        ((TESTS_PASSED++))
    else
        print_warning "実行中Pod: $READY_PODS/$TOTAL_PODS"
        ((TESTS_FAILED++))
    fi
else
    print_error "アプリケーションPodが見つかりません"
    ((TESTS_FAILED++))
fi

# Test 6: Serviceエンドポイントの確認
print_test 6 "Serviceエンドポイントの確認"
if kubectl get endpoints demo-service -n gateway-demo &> /dev/null; then
    ENDPOINTS=$(kubectl get endpoints demo-service -n gateway-demo -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
    if [ "$ENDPOINTS" -gt 0 ]; then
        print_success "Service 'demo-service' に $ENDPOINTS 個のエンドポイントが登録されています"
        ((TESTS_PASSED++))
    else
        print_error "Service 'demo-service' にエンドポイントが登録されていません"
        ((TESTS_FAILED++))
    fi
else
    print_error "Service 'demo-service' のエンドポイントが見つかりません"
    ((TESTS_FAILED++))
fi

# Test 7: Gateway IPアドレスの取得
print_test 7 "Gateway IPアドレスの取得"
GATEWAY_IP=$(kubectl get gateway demo-gateway -n gateway-demo -o jsonpath='{.status.addresses[0].value}' 2>/dev/null || echo "")
if [ -n "$GATEWAY_IP" ]; then
    print_success "Gateway IPアドレス: $GATEWAY_IP"
    ((TESTS_PASSED++))
else
    print_warning "Gateway IPアドレスがまだ割り当てられていません"
    ((TESTS_FAILED++))
fi

# Test 8: HTTP接続テスト
print_test 8 "HTTP接続テスト"
if [ -n "$GATEWAY_IP" ]; then
    echo "HTTP接続テストを実行中..."
    
    # 複数の方法でテスト
    SUCCESS=false
    
    # 方法1: 直接IPアドレスでアクセス（Hostヘッダー付き）
    if curl -s -H "Host: demo.example.com" --connect-timeout 10 --max-time 30 "http://$GATEWAY_IP/" | grep -q "Gateway API Demo"; then
        print_success "HTTP接続テスト成功 (IP: $GATEWAY_IP)"
        SUCCESS=true
        ((TESTS_PASSED++))
    else
        # 方法2: Port-forward経由でテスト
        echo "直接接続が失敗。Port-forward経由でテストを試行中..."
        
        # バックグラウンドでport-forwardを開始
        kubectl port-forward -n nginx-gateway service/nginx-gateway 18080:80 &> /dev/null &
        PF_PID=$!
        
        # 少し待機
        sleep 3
        
        if curl -s -H "Host: demo.example.com" --connect-timeout 5 --max-time 10 "http://localhost:18080/" | grep -q "Gateway API Demo"; then
            print_success "HTTP接続テスト成功 (Port-forward経由)"
            SUCCESS=true
            ((TESTS_PASSED++))
        fi
        
        # port-forwardプロセスを終了
        kill $PF_PID 2>/dev/null || true
    fi
    
    if [ "$SUCCESS" = false ]; then
        print_error "HTTP接続テストに失敗しました"
        ((TESTS_FAILED++))
    fi
else
    print_error "Gateway IPアドレスが利用できないため、HTTP接続テストをスキップしました"
    ((TESTS_FAILED++))
fi

echo ""
echo "📊 テスト結果"
echo "=============="
echo -e "✅ 成功: ${GREEN}$TESTS_PASSED${NC}/$TOTAL_TESTS"
echo -e "❌ 失敗: ${RED}$TESTS_FAILED${NC}/$TOTAL_TESTS"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 すべてのテストが成功しました！${NC}"
    echo ""
    echo "📋 アクセス方法:"
    echo "================"
    if [ -n "$GATEWAY_IP" ]; then
        echo "1. curl経由でのアクセス:"
        echo "   curl -H \"Host: demo.example.com\" http://$GATEWAY_IP/"
        echo ""
        echo "2. ブラウザでのアクセス (hostsファイル設定が必要):"
        echo "   echo \"$GATEWAY_IP demo.example.com\" | sudo tee -a /etc/hosts"
        echo "   ブラウザで http://demo.example.com/ にアクセス"
    else
        echo "1. Port-forward経由でのアクセス:"
        echo "   kubectl port-forward -n nginx-gateway service/nginx-gateway 8080:80"
        echo "   curl -H \"Host: demo.example.com\" http://localhost:8080/"
    fi
    echo ""
    echo "📚 次のステップ:"
    echo "- Phase 2の高度なルーティングに進む: cd ../phase2-advanced-routing/"
    echo "- 設定の確認: kubectl describe gateway demo-gateway -n gateway-demo"
    echo "- HTTPRouteの詳細確認: kubectl describe httproute demo-route -n gateway-demo"
    
elif [ $TESTS_FAILED -le 2 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  一部のテストが失敗しましたが、基本機能は動作しています${NC}"
    echo "失敗したテストについては、トラブルシューティングガイドを確認してください"
    
else
    echo ""
    echo -e "${RED}❌ 複数のテストが失敗しました。セットアップを確認してください${NC}"
    echo ""
    echo "🔧 トラブルシューティング:"
    echo "========================"
    echo "1. セットアップの再実行: ./setup.sh"
    echo "2. リソースの状態確認: kubectl get all -n gateway-demo"
    echo "3. Gateway Controllerのログ確認: kubectl logs -n nginx-gateway deployment/nginx-gateway"
    echo "4. トラブルシューティングガイド: docs/troubleshooting.md"
fi

echo ""
echo "🔍 詳細情報:"
echo "============"
echo "Gateway詳細:"
kubectl describe gateway demo-gateway -n gateway-demo 2>/dev/null | head -20 || echo "Gateway情報を取得できませんでした"

echo ""
echo "HTTPRoute詳細:"
kubectl describe httproute demo-route -n gateway-demo 2>/dev/null | head -20 || echo "HTTPRoute情報を取得できませんでした"
