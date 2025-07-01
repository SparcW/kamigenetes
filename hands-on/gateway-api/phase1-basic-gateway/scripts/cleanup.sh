#!/bin/bash

# Gateway API Phase 1 クリーンアップスクリプト
# Phase 1で作成したすべてのリソースを削除します

set -e

echo "🧹 Gateway API Phase 1 クリーンアップを開始します..."

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

# ポートフォワードの停止
stop_port_forwards() {
    print_status "ポートフォワードを停止中..."
    
    # PIDファイルからプロセスを停止
    if [ -f /tmp/gateway-api-pf.pid ]; then
        local pf_pid=$(cat /tmp/gateway-api-pf.pid)
        if kill -0 $pf_pid 2>/dev/null; then
            kill $pf_pid
            print_success "✓ ポートフォワード (PID: $pf_pid) を停止しました"
        else
            print_status "ポートフォワードは既に停止しています"
        fi
        rm -f /tmp/gateway-api-pf.pid
    fi
    
    # 念のため、kubectl port-forwardプロセスをすべて停止
    pkill -f "kubectl port-forward" 2>/dev/null || true
    print_status "すべてのポートフォワードプロセスを停止しました"
    
    sleep 2
}

# Phase 1リソースの削除
cleanup_phase1_resources() {
    print_status "Phase 1リソースを削除中..."
    
    local MANIFEST_DIR="../manifests"
    local cleanup_success=true
    
    # HTTPRouteの削除
    print_status "HTTPRouteを削除中..."
    if kubectl delete -f "$MANIFEST_DIR/04-httproute.yaml" --ignore-not-found=true; then
        print_success "✓ HTTPRouteの削除が完了しました"
    else
        print_warning "⚠ HTTPRouteの削除で問題が発生しました"
        cleanup_success=false
    fi
    
    # サンプルアプリケーションの削除
    print_status "サンプルアプリケーションを削除中..."
    if kubectl delete -f "$MANIFEST_DIR/03-sample-app.yaml" --ignore-not-found=true; then
        print_success "✓ サンプルアプリケーションの削除が完了しました"
    else
        print_warning "⚠ サンプルアプリケーションの削除で問題が発生しました"
        cleanup_success=false
    fi
    
    # Gatewayの削除
    print_status "Gatewayを削除中..."
    if kubectl delete -f "$MANIFEST_DIR/02-gateway.yaml" --ignore-not-found=true; then
        print_success "✓ Gatewayの削除が完了しました"
    else
        print_warning "⚠ Gatewayの削除で問題が発生しました"
        cleanup_success=false
    fi
    
    # GatewayClassの削除
    print_status "GatewayClassを削除中..."
    if kubectl delete -f "$MANIFEST_DIR/01-gatewayclass.yaml" --ignore-not-found=true; then
        print_success "✓ GatewayClassの削除が完了しました"
    else
        print_warning "⚠ GatewayClassの削除で問題が発生しました"
        cleanup_success=false
    fi
    
    return $cleanup_success
}

# NGINX Gateway Controllerの削除
cleanup_nginx_gateway_controller() {
    print_status "NGINX Gateway Controller（デモ用）を削除中..."
    
    # NGINX Gateway Controllerリソースの削除
    kubectl delete deployment nginx-gateway-controller -n nginx-gateway --ignore-not-found=true
    kubectl delete service nginx-gateway-controller -n nginx-gateway --ignore-not-found=true
    kubectl delete configmap nginx-gateway-config -n nginx-gateway --ignore-not-found=true
    
    # ネームスペースの削除
    kubectl delete namespace nginx-gateway --ignore-not-found=true
    
    print_success "✓ NGINX Gateway Controller（デモ用）の削除が完了しました"
}

# 名前空間の確認と削除
cleanup_namespaces() {
    print_status "ネームスペースの確認と削除中..."
    
    # sample-appsネームスペースの削除
    if kubectl get namespace sample-apps &> /dev/null; then
        print_status "sample-appsネームスペースを削除中..."
        kubectl delete namespace sample-apps --timeout=60s
        print_success "✓ sample-appsネームスペースの削除が完了しました"
    else
        print_status "sample-appsネームスペースは既に削除されています"
    fi
    
    # gateway-api-systemネームスペースの削除
    if kubectl get namespace gateway-api-system &> /dev/null; then
        # 他のリソースが残っているかチェック
        local remaining_resources=$(kubectl get all -n gateway-api-system --no-headers 2>/dev/null | wc -l)
        if [ "$remaining_resources" -eq 0 ]; then
            print_status "gateway-api-systemネームスペースを削除中..."
            kubectl delete namespace gateway-api-system --timeout=60s
            print_success "✓ gateway-api-systemネームスペースの削除が完了しました"
        else
            print_warning "⚠ gateway-api-systemネームスペースに他のリソースが残っています"
            kubectl get all -n gateway-api-system
        fi
    else
        print_status "gateway-api-systemネームスペースは既に削除されています"
    fi
}

# 残留リソースの確認
check_remaining_resources() {
    print_status "残留リソースの確認中..."
    
    echo ""
    echo "🔍 Gateway API関連リソースの確認:"
    
    # GatewayClassの確認
    local gateway_classes=$(kubectl get gatewayclass --no-headers 2>/dev/null | grep nginx-gateway-class | wc -l || echo "0")
    if [ "$gateway_classes" -eq 0 ]; then
        print_success "✓ GatewayClassは正常に削除されました"
    else
        print_warning "⚠ GatewayClassが残っています:"
        kubectl get gatewayclass --no-headers | grep nginx-gateway-class || true
    fi
    
    # Gatewayの確認
    local gateways=$(kubectl get gateway -A --no-headers 2>/dev/null | grep basic-gateway | wc -l || echo "0")
    if [ "$gateways" -eq 0 ]; then
        print_success "✓ Gatewayは正常に削除されました"
    else
        print_warning "⚠ Gatewayが残っています:"
        kubectl get gateway -A --no-headers | grep basic-gateway || true
    fi
    
    # HTTPRouteの確認
    local http_routes=$(kubectl get httproute -A --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$http_routes" -eq 0 ]; then
        print_success "✓ HTTPRouteは正常に削除されました"
    else
        print_warning "⚠ HTTPRouteが残っています:"
        kubectl get httproute -A || true
    fi
    
    # PersistentVolumeの確認（もしあれば）
    local pvs=$(kubectl get pv --no-headers 2>/dev/null | grep -E "(sample-apps|gateway-api)" | wc -l || echo "0")
    if [ "$pvs" -eq 0 ]; then
        print_success "✓ Phase 1関連のPersistentVolumeはありません"
    else
        print_warning "⚠ Phase 1関連のPersistentVolumeが残っています:"
        kubectl get pv | grep -E "(sample-apps|gateway-api)" || true
    fi
}

# ファイナライザーの強制削除（必要な場合）
force_cleanup_stuck_resources() {
    print_status "スタックしたリソースの強制クリーンアップを確認中..."
    
    # Gateway関連のリソースでTerminatingが残っているものをチェック
    local stuck_namespaces=$(kubectl get namespaces --no-headers 2>/dev/null | grep -E "(sample-apps|gateway-api-system|nginx-gateway)" | grep Terminating | wc -l || echo "0")
    
    if [ "$stuck_namespaces" -gt 0 ]; then
        print_warning "⚠ Terminatingのままのネームスペースが見つかりました"
        kubectl get namespaces | grep -E "(sample-apps|gateway-api-system|nginx-gateway)" | grep Terminating || true
        
        echo ""
        print_status "強制削除を実行しますか? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_status "ファイナライザーを削除して強制クリーンアップを実行中..."
            
            # スタックしているネームスペースのファイナライザー削除
            for ns in sample-apps gateway-api-system nginx-gateway; do
                if kubectl get namespace "$ns" &> /dev/null; then
                    kubectl patch namespace "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
                fi
            done
            
            print_success "✓ 強制クリーンアップが完了しました"
        else
            print_status "強制削除をスキップしました"
        fi
    else
        print_success "✓ スタックしたリソースはありません"
    fi
}

# クリーンアップ状況のサマリー表示
show_cleanup_summary() {
    print_status "クリーンアップ状況のサマリーを表示中..."
    
    echo ""
    echo "🧹 Gateway API Phase 1 クリーンアップ完了"
    echo "=================================================="
    
    echo ""
    echo "✅ 削除されたリソース:"
    echo "  - GatewayClass: nginx-gateway-class"
    echo "  - Gateway: basic-gateway"
    echo "  - HTTPRoute: frontend-route, api-route, https-frontend-route, https-api-route"
    echo "  - サンプルアプリケーション: frontend-app, api-app"
    echo "  - ネームスペース: sample-apps, gateway-api-system"
    echo "  - NGINX Gateway Controller (デモ用)"
    echo "  - ポートフォワード設定"
    
    echo ""
    echo "💡 注意事項:"
    echo "  - Gateway API CRDは保持されています"
    echo "  - 他のPhaseのリソースには影響しません"
    echo "  - 本番用Gateway Controllerが別途インストールされている場合は影響しません"
    
    echo ""
    echo "📝 次のステップ:"
    echo "  - Phase 2: 高度なルーティングに進む"
    echo "  - 別のGateway Controllerでテストする"
    echo "  - 本番環境での設定を検討する"
    echo ""
}

# オプション確認
confirm_cleanup() {
    echo "⚠️  Gateway API Phase 1のすべてのリソースを削除しようとしています"
    echo ""
    echo "削除されるもの:"
    echo "  - GatewayClass: nginx-gateway-class"
    echo "  - Gateway: basic-gateway"
    echo "  - HTTPRoute: すべてのPhase 1ルート"
    echo "  - サンプルアプリケーション: frontend-app, api-app"
    echo "  - ネームスペース: sample-apps, gateway-api-system"
    echo "  - NGINX Gateway Controller (デモ用)"
    echo ""
    print_status "続行しますか? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "クリーンアップをキャンセルしました"
        exit 0
    fi
}

# メイン実行
main() {
    # 確認プロンプト（--forceオプションがない場合）
    if [[ "$1" != "--force" ]]; then
        confirm_cleanup
    fi
    
    # クリーンアップ実行
    stop_port_forwards
    
    local cleanup_success=true
    
    if ! cleanup_phase1_resources; then
        cleanup_success=false
    fi
    
    cleanup_nginx_gateway_controller
    cleanup_namespaces
    
    # 残留リソースの確認
    check_remaining_resources
    
    # 必要に応じて強制クリーンアップ
    force_cleanup_stuck_resources
    
    # サマリー表示
    show_cleanup_summary
    
    # 最終結果
    if [ "$cleanup_success" = true ]; then
        print_success "🎉 Gateway API Phase 1 クリーンアップが正常に完了しました！"
    else
        print_warning "⚠ クリーンアップは完了しましたが、一部で問題が発生しました"
        echo ""
        echo "🔧 手動確認が必要な場合:"
        echo "  kubectl get all -A | grep -E '(gateway|sample)'"
        echo "  kubectl get gatewayclass"
        echo "  kubectl get gateway -A"
        echo "  kubectl get httproute -A"
    fi
}

# エラーハンドリング
trap 'print_error "クリーンアップ中にエラーが発生しました。手動でリソースを確認してください。"; exit 1' ERR

# スクリプト実行
main "$@"
