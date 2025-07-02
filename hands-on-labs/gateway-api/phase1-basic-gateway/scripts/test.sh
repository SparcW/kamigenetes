#!/bin/bash

# Gateway API Phase 1 テストスクリプト
# セットアップされた環境の動作確認を行います

set -e

echo "🧪 Gateway API Phase 1 テストを開始します..."

# 色付きの出力用関数
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_test_header() {
    echo ""
    echo -e "\033[1;36m=== $1 ===\033[0m"
}

# リソース状況の確認
check_resources() {
    print_test_header "リソース状況確認"
    
    local all_ok=true
    
    # GatewayClassの確認
    print_status "GatewayClassの状況を確認中..."
    if kubectl get gatewayclass nginx-gateway-class &> /dev/null; then
        print_success "✓ GatewayClass 'nginx-gateway-class' が存在します"
        kubectl get gatewayclass nginx-gateway-class -o wide
    else
        print_error "✗ GatewayClass 'nginx-gateway-class' が見つかりません"
        all_ok=false
    fi
    
    # Gatewayの確認
    print_status "Gatewayの状況を確認中..."
    if kubectl get gateway basic-gateway -n gateway-api-system &> /dev/null; then
        print_success "✓ Gateway 'basic-gateway' が存在します"
        kubectl get gateway basic-gateway -n gateway-api-system -o wide
        
        # Gatewayの状態確認
        local gateway_status=$(kubectl get gateway basic-gateway -n gateway-api-system -o jsonpath='{.status.conditions[?(@.type=="Programmed")].status}')
        if [ "$gateway_status" = "True" ]; then
            print_success "✓ Gateway が正常にプログラムされています"
        else
            print_warning "⚠ Gateway がまだプログラムされていません"
            kubectl describe gateway basic-gateway -n gateway-api-system
        fi
    else
        print_error "✗ Gateway 'basic-gateway' が見つかりません"
        all_ok=false
    fi
    
    # HTTPRouteの確認
    print_status "HTTPRouteの状況を確認中..."
    local routes=$(kubectl get httproute -n sample-apps --no-headers 2>/dev/null | wc -l)
    if [ "$routes" -gt 0 ]; then
        print_success "✓ HTTPRoute が $routes 個存在します"
        kubectl get httproute -n sample-apps -o wide
    else
        print_error "✗ HTTPRoute が見つかりません"
        all_ok=false
    fi
    
    # サンプルアプリケーションの確認
    print_status "サンプルアプリケーションの状況を確認中..."
    if kubectl get deployment frontend-app -n sample-apps &> /dev/null && kubectl get deployment api-app -n sample-apps &> /dev/null; then
        print_success "✓ サンプルアプリケーションが存在します"
        kubectl get pods -n sample-apps -o wide
        
        # Podの状態確認
        local ready_pods=$(kubectl get pods -n sample-apps --no-headers 2>/dev/null | grep -c "Running" || echo "0")
        local total_pods=$(kubectl get pods -n sample-apps --no-headers 2>/dev/null | wc -l || echo "0")
        print_status "Ready Pods: $ready_pods/$total_pods"
    else
        print_error "✗ サンプルアプリケーションが見つかりません"
        all_ok=false
    fi
    
    if [ "$all_ok" = true ]; then
        print_success "すべてのリソースが正常です"
        return 0
    else
        print_error "一部のリソースに問題があります"
        return 1
    fi
}

# ポートフォワードのセットアップ
setup_port_forward() {
    print_test_header "ポートフォワードセットアップ"
    
    # 既存のポートフォワードを停止
    pkill -f "kubectl port-forward" 2>/dev/null || true
    sleep 2
    
    # Gateway ServiceでのPort Forward設定
    print_status "Gateway用ポートフォワードを設定中..."
    
    # NGINX Gateway Controllerサービスを確認
    if kubectl get service nginx-gateway-controller -n nginx-gateway &> /dev/null; then
        # バックグラウンドでポートフォワードを開始
        kubectl port-forward -n nginx-gateway service/nginx-gateway-controller 8080:80 &
        local pf_pid=$!
        echo $pf_pid > /tmp/gateway-api-pf.pid
        
        # ポートフォワードが開始されるまで待機
        sleep 3
        
        if kill -0 $pf_pid 2>/dev/null; then
            print_success "✓ ポートフォワード設定完了 (PID: $pf_pid)"
            print_status "アクセスURL: http://localhost:8080"
        else
            print_error "✗ ポートフォワードの設定に失敗しました"
            return 1
        fi
    else
        print_warning "⚠ NGINX Gateway Controllerサービスが見つかりません"
        print_status "直接Podへのポートフォワードを試行中..."
        
        # Podへの直接ポートフォワード
        local pod_name=$(kubectl get pods -n nginx-gateway -l app.kubernetes.io/name=nginx-gateway-controller -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [ -n "$pod_name" ]; then
            kubectl port-forward -n nginx-gateway pod/$pod_name 8080:80 &
            local pf_pid=$!
            echo $pf_pid > /tmp/gateway-api-pf.pid
            sleep 3
            print_success "✓ Pod直接ポートフォワード設定完了 (PID: $pf_pid)"
        else
            print_error "✗ 利用可能なPodが見つかりません"
            return 1
        fi
    fi
}

# HTTPテストの実行
run_http_tests() {
    print_test_header "HTTP接続テスト"
    
    # curlコマンドの確認
    if ! command -v curl &> /dev/null; then
        print_warning "⚠ curl が見つかりません。手動でテストしてください"
        print_status "ブラウザで http://localhost:8080 にアクセスしてください"
        return 0
    fi
    
    local base_url="http://localhost:8080"
    local test_passed=0
    local test_total=0
    
    # テスト1: 基本的な接続テスト
    print_status "テスト1: 基本的な接続テスト"
    ((test_total++))
    if curl -s --max-time 5 "$base_url" > /dev/null; then
        print_success "✓ 基本的な接続テスト成功"
        ((test_passed++))
    else
        print_error "✗ 基本的な接続テストに失敗"
    fi
    
    # テスト2: フロントエンドアクセステスト
    print_status "テスト2: フロントエンドアクセステスト"
    ((test_total++))
    local frontend_response=$(curl -s --max-time 5 -H "Host: frontend.local" "$base_url" 2>/dev/null)
    if [[ "$frontend_response" == *"Gateway API"* ]]; then
        print_success "✓ フロントエンドアクセステスト成功"
        ((test_passed++))
    else
        print_error "✗ フロントエンドアクセステストに失敗"
        print_status "レスポンス: ${frontend_response:0:100}..."
    fi
    
    # テスト3: APIヘルスチェックテスト
    print_status "テスト3: APIヘルスチェックテスト"
    ((test_total++))
    local health_response=$(curl -s --max-time 5 -H "Host: api.local" "$base_url/api/health" 2>/dev/null)
    if [[ "$health_response" == *"healthy"* ]]; then
        print_success "✓ APIヘルスチェックテスト成功"
        ((test_passed++))
    else
        print_error "✗ APIヘルスチェックテストに失敗"
        print_status "レスポンス: ${health_response:0:100}..."
    fi
    
    # テスト4: API情報テスト
    print_status "テスト4: API情報テスト"
    ((test_total++))
    local info_response=$(curl -s --max-time 5 -H "Host: api.local" "$base_url/api/info" 2>/dev/null)
    if [[ "$info_response" == *"sample-api"* ]]; then
        print_success "✓ API情報テスト成功"
        ((test_passed++))
    else
        print_error "✗ API情報テストに失敗"
        print_status "レスポンス: ${info_response:0:100}..."
    fi
    
    # テスト結果のサマリー
    echo ""
    print_status "HTTPテスト結果: $test_passed/$test_total テストが成功"
    
    if [ $test_passed -eq $test_total ]; then
        print_success "🎉 すべてのHTTPテストが成功しました！"
        return 0
    else
        print_warning "⚠ 一部のHTTPテストが失敗しました"
        return 1
    fi
}

# Gateway API固有のテスト
run_gateway_api_tests() {
    print_test_header "Gateway API固有テスト"
    
    # HTTPRouteの状態確認
    print_status "HTTPRouteの詳細状態を確認中..."
    local routes=(frontend-route api-route https-frontend-route https-api-route)
    
    for route in "${routes[@]}"; do
        if kubectl get httproute "$route" -n sample-apps &> /dev/null; then
            local status=$(kubectl get httproute "$route" -n sample-apps -o jsonpath='{.status.conditions[?(@.type=="Accepted")].status}' 2>/dev/null)
            if [ "$status" = "True" ]; then
                print_success "✓ HTTPRoute '$route' が正常に受け入れられています"
            else
                print_warning "⚠ HTTPRoute '$route' の状態確認が必要です"
                kubectl describe httproute "$route" -n sample-apps | grep -A 5 "Conditions:"
            fi
        else
            print_error "✗ HTTPRoute '$route' が見つかりません"
        fi
    done
    
    # ReferenceGrantの確認
    print_status "ReferenceGrantの状態を確認中..."
    if kubectl get referencegrant gateway-to-sample-apps -n sample-apps &> /dev/null; then
        print_success "✓ ReferenceGrant が正常に設定されています"
    else
        print_error "✗ ReferenceGrant が見つかりません"
    fi
}

# デバッグ情報の表示
show_debug_info() {
    print_test_header "デバッグ情報"
    
    echo "📊 リソース使用状況:"
    kubectl top nodes 2>/dev/null || echo "メトリクスサーバーが利用できません"
    
    echo ""
    echo "📋 イベント情報:"
    kubectl get events -n gateway-api-system --sort-by='.lastTimestamp' | tail -10
    kubectl get events -n sample-apps --sort-by='.lastTimestamp' | tail -10
    
    echo ""
    echo "🔍 ログサンプル:"
    print_status "サンプルアプリケーションのログ（最新5行）:"
    kubectl logs -n sample-apps deployment/frontend-app --tail=5 2>/dev/null || echo "ログを取得できませんでした"
    kubectl logs -n sample-apps deployment/api-app --tail=5 2>/dev/null || echo "ログを取得できませんでした"
}

# クリーンアップ用の情報表示
show_cleanup_info() {
    print_test_header "クリーンアップ情報"
    
    echo "🧹 テスト完了後のクリーンアップ:"
    echo "  - ポートフォワード停止: pkill -f 'kubectl port-forward'"
    echo "  - 全リソース削除: ./cleanup.sh"
    echo ""
    echo "📁 ポートフォワードPIDファイル: /tmp/gateway-api-pf.pid"
    if [ -f /tmp/gateway-api-pf.pid ]; then
        local pf_pid=$(cat /tmp/gateway-api-pf.pid)
        echo "  現在のPID: $pf_pid"
        if kill -0 $pf_pid 2>/dev/null; then
            echo "  状態: 実行中"
        else
            echo "  状態: 停止済み"
        fi
    fi
}

# メイン実行
main() {
    local overall_success=true
    
    # リソース確認
    if ! check_resources; then
        overall_success=false
    fi
    
    # ポートフォワード設定
    if ! setup_port_forward; then
        print_error "ポートフォワードの設定に失敗しました。手動で設定してください。"
        overall_success=false
    else
        # HTTPテスト実行
        if ! run_http_tests; then
            overall_success=false
        fi
    fi
    
    # Gateway API固有テスト
    run_gateway_api_tests
    
    # デバッグ情報表示
    show_debug_info
    
    # クリーンアップ情報表示
    show_cleanup_info
    
    # 最終結果
    echo ""
    if [ "$overall_success" = true ]; then
        print_success "🎉 Gateway API Phase 1 テストが正常に完了しました！"
        echo ""
        echo "✨ 次のステップ:"
        echo "  1. ブラウザで http://localhost:8080 にアクセス"
        echo "  2. Host ヘッダーを 'frontend.local' に設定"
        echo "  3. Phase 2: 高度なルーティングに進む"
        echo "  4. ./cleanup.sh でリソースをクリーンアップ"
    else
        print_error "⚠ Gateway API Phase 1 テストで問題が検出されました"
        echo ""
        echo "🔧 トラブルシューティング:"
        echo "  1. kubectl get pods -A で全Pod状況確認"
        echo "  2. kubectl describe gateway basic-gateway -n gateway-api-system"
        echo "  3. kubectl logs deployment/nginx-gateway-controller -n nginx-gateway"
        echo "  4. ../docs/troubleshooting.md を参照"
    fi
}

# エラーハンドリング
trap 'print_error "テスト中にエラーが発生しました。"; exit 1' ERR

# スクリプト実行
main "$@"
