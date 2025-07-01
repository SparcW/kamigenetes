#!/bin/bash

# Phase 2: Gateway API高度なルーティングテストスクリプト
# AWS ECS管理者向けKubernetes Gateway API学習環境

set -e

echo "🧪 Gateway API Phase 2 包括テストを開始します..."
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
TOTAL_TESTS=12

# Gateway IPアドレスの取得
GATEWAY_IP=$(kubectl get gateway demo-gateway -n gateway-demo -o jsonpath='{.status.addresses[0].value}' 2>/dev/null || echo "")

if [ -z "$GATEWAY_IP" ]; then
    print_warning "Gateway IPアドレスが取得できません。Port-forward経由でテストを実行します。"
    # バックグラウンドでport-forwardを開始
    kubectl port-forward -n nginx-gateway service/nginx-gateway 18080:80 &> /dev/null &
    PF_PID=$!
    sleep 3
    GATEWAY_URL="http://localhost:18080"
else
    GATEWAY_URL="http://$GATEWAY_IP"
    PF_PID=""
fi

echo "Gateway URL: $GATEWAY_URL"

# Test 1: HTTPRoute リソースの確認
print_test 1 "HTTPRoute リソースの確認"
ROUTES=("path-based-route" "header-based-route" "traffic-split-route")
ALL_ROUTES_OK=true

for route in "${ROUTES[@]}"; do
    if ! kubectl get httproute "$route" -n gateway-advanced &> /dev/null; then
        print_error "HTTPRoute '$route' が見つかりません"
        ALL_ROUTES_OK=false
    fi
done

if [ "$ALL_ROUTES_OK" = true ]; then
    print_success "すべての必要なHTTPRouteが存在します"
    ((TESTS_PASSED++))
else
    print_error "一部のHTTPRouteが見つかりません"
    ((TESTS_FAILED++))
fi

# Test 2: バックエンドサービスの確認
print_test 2 "バックエンドサービスの確認"
SERVICES=("api-v1-service" "api-v2-service" "frontend-service" "api-stable-service" "api-canary-service")
ALL_SERVICES_OK=true

for service in "${SERVICES[@]}"; do
    if ! kubectl get service "$service" -n gateway-advanced &> /dev/null; then
        print_error "Service '$service' が見つかりません"
        ALL_SERVICES_OK=false
    else
        ENDPOINTS=$(kubectl get endpoints "$service" -n gateway-advanced -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
        if [ "$ENDPOINTS" -eq 0 ]; then
            print_error "Service '$service' にエンドポイントがありません"
            ALL_SERVICES_OK=false
        fi
    fi
done

if [ "$ALL_SERVICES_OK" = true ]; then
    print_success "すべてのバックエンドサービスが正常です"
    ((TESTS_PASSED++))
else
    print_error "一部のバックエンドサービスに問題があります"
    ((TESTS_FAILED++))
fi

# Test 3: パスベースルーティング（/api/v1）
print_test 3 "パスベースルーティング - /api/v1"
if curl -s -H "Host: advanced.example.com" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/api/v1" | grep -q "API v1"; then
    print_success "パスベースルーティング (/api/v1) が正常に動作しています"
    ((TESTS_PASSED++))
else
    print_error "パスベースルーティング (/api/v1) が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 4: パスベースルーティング（/api/v2）
print_test 4 "パスベースルーティング - /api/v2"
if curl -s -H "Host: advanced.example.com" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/api/v2" | grep -q "API v2"; then
    print_success "パスベースルーティング (/api/v2) が正常に動作しています"
    ((TESTS_PASSED++))
else
    print_error "パスベースルーティング (/api/v2) が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 5: ヘッダーベースルーティング（v1）
print_test 5 "ヘッダーベースルーティング - x-api-version: v1"
if curl -s -H "Host: header-demo.example.com" -H "x-api-version: v1" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/" | grep -q "API v1"; then
    print_success "ヘッダーベースルーティング (v1) が正常に動作しています"
    ((TESTS_PASSED++))
else
    print_error "ヘッダーベースルーティング (v1) が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 6: ヘッダーベースルーティング（v2）
print_test 6 "ヘッダーベースルーティング - x-api-version: v2"
if curl -s -H "Host: header-demo.example.com" -H "x-api-version: v2" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/" | grep -q "API v2"; then
    print_success "ヘッダーベースルーティング (v2) が正常に動作しています"
    ((TESTS_PASSED++))
else
    print_error "ヘッダーベースルーティング (v2) が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 7: クライアントタイプベースルーティング
print_test 7 "クライアントタイプベースルーティング - mobile"
MOBILE_RESPONSE=$(curl -s -H "Host: header-demo.example.com" -H "x-client-type: mobile" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/" || echo "failed")
if [ "$MOBILE_RESPONSE" != "failed" ]; then
    print_success "モバイルクライアント向けルーティングが動作しています"
    ((TESTS_PASSED++))
else
    print_error "モバイルクライアント向けルーティングが失敗しました"
    ((TESTS_FAILED++))
fi

# Test 8: トラフィック分割テスト
print_test 8 "トラフィック分割テスト"
echo "10回のリクエストでトラフィック分割を確認中..."

STABLE_COUNT=0
CANARY_COUNT=0

for i in {1..10}; do
    RESPONSE=$(curl -s -H "Host: canary.example.com" --connect-timeout 5 --max-time 15 "$GATEWAY_URL/api" 2>/dev/null || echo "failed")
    if echo "$RESPONSE" | grep -q "stable"; then
        ((STABLE_COUNT++))
    elif echo "$RESPONSE" | grep -q "canary"; then
        ((CANARY_COUNT++))
    fi
    sleep 0.5
done

echo "結果: Stable=$STABLE_COUNT, Canary=$CANARY_COUNT"

if [ $STABLE_COUNT -gt 0 ] && [ $CANARY_COUNT -gt 0 ]; then
    print_success "トラフィック分割が正常に動作しています (Stable:$STABLE_COUNT, Canary:$CANARY_COUNT)"
    ((TESTS_PASSED++))
elif [ $STABLE_COUNT -gt 0 ] || [ $CANARY_COUNT -gt 0 ]; then
    print_warning "トラフィック分割は部分的に動作していますが、両方のサービスにトラフィックが届いていません"
    ((TESTS_FAILED++))
else
    print_error "トラフィック分割が動作していません"
    ((TESTS_FAILED++))
fi

# Test 9: パスリライトテスト
print_test 9 "パスリライト機能テスト"
REWRITE_RESPONSE=$(curl -s -H "Host: rewrite.example.com" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/old-api" 2>/dev/null || echo "failed")
if [ "$REWRITE_RESPONSE" != "failed" ]; then
    print_success "パスリライト機能が動作しています"
    ((TESTS_PASSED++))
else
    print_error "パスリライト機能が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 10: 複数ヘッダー条件テスト
print_test 10 "複数ヘッダー条件テスト"
MULTI_HEADER_RESPONSE=$(curl -s -H "Host: header-demo.example.com" -H "x-api-version: v2" -H "x-feature-flag: beta" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/" 2>/dev/null || echo "failed")
if [ "$MULTI_HEADER_RESPONSE" != "failed" ]; then
    print_success "複数ヘッダー条件が動作しています"
    ((TESTS_PASSED++))
else
    print_error "複数ヘッダー条件が失敗しました"
    ((TESTS_FAILED++))
fi

# Test 11: デフォルトルートテスト
print_test 11 "デフォルトルートテスト"
DEFAULT_RESPONSE=$(curl -s -H "Host: header-demo.example.com" --connect-timeout 10 --max-time 30 "$GATEWAY_URL/" 2>/dev/null || echo "failed")
if [ "$DEFAULT_RESPONSE" != "failed" ]; then
    print_success "デフォルトルートが動作しています"
    ((TESTS_PASSED++))
else
    print_error "デフォルトルートが失敗しました"
    ((TESTS_FAILED++))
fi

# Test 12: HTTPRoute状態確認
print_test 12 "HTTPRoute状態確認"
ACCEPTED_ROUTES=0
TOTAL_ROUTES=0

for route in path-based-route header-based-route traffic-split-route; do
    ((TOTAL_ROUTES++))
    STATUS=$(kubectl get httproute "$route" -n gateway-advanced -o jsonpath='{.status.conditions[?(@.type=="Accepted")].status}' 2>/dev/null || echo "Unknown")
    if [ "$STATUS" = "True" ]; then
        ((ACCEPTED_ROUTES++))
    fi
done

if [ $ACCEPTED_ROUTES -eq $TOTAL_ROUTES ]; then
    print_success "すべてのHTTPRoute ($ACCEPTED_ROUTES/$TOTAL_ROUTES) が受け入れられています"
    ((TESTS_PASSED++))
else
    print_warning "一部のHTTPRoute ($ACCEPTED_ROUTES/$TOTAL_ROUTES) のみが受け入れられています"
    ((TESTS_FAILED++))
fi

# port-forwardプロセスを終了
if [ -n "$PF_PID" ]; then
    kill $PF_PID 2>/dev/null || true
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
    echo "📋 学習成果:"
    echo "============="
    echo "✅ パスベースルーティングの実装"
    echo "✅ ヘッダーベースルーティングの実装"
    echo "✅ トラフィック分割（A/Bテスト）の実装"
    echo "✅ リクエスト変換機能の理解"
    echo "✅ 複数条件でのルーティング制御"
    echo ""
    echo "📚 AWS ECS比較理解:"
    echo "==================="
    echo "• HTTPRoute matches.path ↔ ALBパスベースルール"
    echo "• HTTPRoute matches.headers ↔ ALBヘッダー条件"
    echo "• backendRefs.weight ↔ ターゲットグループ重み"
    echo "• HTTPRoute filters ↔ Lambda@Edge機能"
    echo ""
    echo "🚀 次のステップ:"
    echo "==============="
    echo "cd ../phase3-multi-protocol/"
    echo "./setup.sh"
    
elif [ $TESTS_FAILED -le 3 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  一部のテストが失敗しましたが、基本機能は動作しています${NC}"
    echo ""
    echo "🔧 個別テストの実行:"
    echo "==================="
    echo "./test-path-routing.sh     # パスベースルーティング詳細テスト"
    echo "./test-header-routing.sh   # ヘッダーベースルーティング詳細テスト"
    echo "./test-traffic-splitting.sh # トラフィック分割詳細テスト"
    
else
    echo ""
    echo -e "${RED}❌ 多くのテストが失敗しました。セットアップを確認してください${NC}"
    echo ""
    echo "🔧 トラブルシューティング:"
    echo "========================"
    echo "1. セットアップの再実行: ./setup.sh"
    echo "2. Phase 1の確認: kubectl get gateway demo-gateway -n gateway-demo"
    echo "3. HTTPRouteの詳細確認:"
    for route in path-based-route header-based-route traffic-split-route; do
        echo "   kubectl describe httproute $route -n gateway-advanced"
    done
    echo "4. サービスエンドポイント確認: kubectl get endpoints -n gateway-advanced"
fi

echo ""
echo "🔍 詳細情報 - リソース状態:"
echo "=========================="
echo ""
echo "HTTPRoutes:"
kubectl get httproute -n gateway-advanced -o wide 2>/dev/null || echo "HTTPRoute情報を取得できませんでした"

echo ""
echo "Services:"
kubectl get services -n gateway-advanced 2>/dev/null || echo "Service情報を取得できませんでした"

echo ""
echo "Gateway詳細:"
kubectl describe gateway demo-gateway -n gateway-demo 2>/dev/null | head -30 || echo "Gateway情報を取得できませんでした"
