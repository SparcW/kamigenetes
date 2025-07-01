#!/bin/bash

# Traefik Ingress Controller テストスクリプト
# このスクリプトはTraefikの機能をテストし、動作確認を行います

set -e

echo "🚀 Traefik Ingress Controller テスト開始"
echo "=========================================="

# 色付きログ用関数
log_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

log_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # kubectl チェック
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl が見つかりません"
        exit 1
    fi
    
    # minikube チェック
    if ! minikube status &> /dev/null; then
        log_error "minikube が起動していません"
        exit 1
    fi
    
    log_success "前提条件OK"
}

# Traefikデプロイメント状態確認
check_traefik_deployment() {
    log_info "Traefikデプロイメント状態を確認中..."
    
    # Traefik Pod状態確認
    kubectl wait --for=condition=ready pod -l app=traefik -n traefik-system --timeout=300s
    
    # サービス状態確認
    kubectl get services -n traefik-system
    
    log_success "Traefikが正常に動作中"
}

# サンプルアプリケーション状態確認
check_sample_apps() {
    log_info "サンプルアプリケーション状態を確認中..."
    
    # Pod状態確認
    kubectl wait --for=condition=ready pod -l app=api-v1 -n webapp --timeout=300s
    kubectl wait --for=condition=ready pod -l app=api-v2 -n webapp --timeout=300s
    kubectl wait --for=condition=ready pod -l app=frontend -n webapp --timeout=300s
    
    # エンドポイント確認
    kubectl get endpoints -n webapp
    
    log_success "サンプルアプリケーションが正常に動作中"
}

# IngressRoute設定確認
check_ingress_routes() {
    log_info "IngressRoute設定を確認中..."
    
    # IngressRoute一覧表示
    kubectl get ingressroute -n webapp
    
    # 詳細な設定確認
    kubectl describe ingressroute webapp-route -n webapp
    
    log_success "IngressRoute設定確認完了"
}

# ポート転送開始
start_port_forwarding() {
    log_info "ポート転送を設定中..."
    
    # 既存のポート転送プロセスを終了
    pkill -f "kubectl port-forward.*traefik" || true
    pkill -f "kubectl port-forward.*webapp" || true
    
    # Traefikサービス（HTTP）
    kubectl port-forward -n traefik-system svc/traefik 8080:80 &
    TRAEFIK_HTTP_PID=$!
    
    # Traefikダッシュボード
    kubectl port-forward -n traefik-system svc/traefik-dashboard 8081:8080 &
    TRAEFIK_DASHBOARD_PID=$!
    
    # 少し待機
    sleep 5
    
    log_success "ポート転送開始完了"
    echo "  - Traefik HTTP: http://localhost:8080"
    echo "  - Traefik Dashboard: http://localhost:8081"
}

# /etc/hostsファイル設定チェック
check_hosts_file() {
    log_info "/etc/hostsファイルの設定を確認中..."
    
    if ! grep -q "webapp.local" /etc/hosts; then
        log_warning "/etc/hostsにwebapp.localが設定されていません"
        echo "以下のコマンドで設定してください:"
        echo "echo '127.0.0.1 webapp.local traefik.local' | sudo tee -a /etc/hosts"
    else
        log_success "/etc/hostsファイル設定OK"
    fi
}

# HTTP テスト
test_http_endpoints() {
    log_info "HTTPエンドポイントをテスト中..."
    
    # フロントエンドテスト
    log_info "フロントエンドアクセステスト..."
    if curl -s -H "Host: webapp.local" http://localhost:8080 | grep -q "Traefik Demo Frontend"; then
        log_success "フロントエンドアクセス成功"
    else
        log_error "フロントエンドアクセス失敗"
    fi
    
    # API v1テスト
    log_info "API v1アクセステスト..."
    if curl -s -H "Host: webapp.local" http://localhost:8080/api/v1 | grep -q "Version 1.0"; then
        log_success "API v1アクセス成功"
    else
        log_error "API v1アクセス失敗"
    fi
    
    # API v2テスト
    log_info "API v2アクセステスト..."
    if curl -s -H "Host: webapp.local" http://localhost:8080/api/v2 | grep -q "Version 2.0"; then
        log_success "API v2アクセス成功"
    else
        log_error "API v2アクセス失敗"
    fi
}

# レスポンスヘッダーテスト
test_response_headers() {
    log_info "レスポンスヘッダーをテスト中..."
    
    # API v1ヘッダーテスト
    log_info "API v1ヘッダーテスト..."
    HEADERS=$(curl -s -I -H "Host: webapp.local" http://localhost:8080/api/v1)
    if echo "$HEADERS" | grep -q "X-API-Version: v1"; then
        log_success "API v1ヘッダー設定確認"
    else
        log_warning "API v1ヘッダー設定が見つかりません"
    fi
    
    # API v2ヘッダーテスト
    log_info "API v2ヘッダーテスト..."
    HEADERS=$(curl -s -I -H "Host: webapp.local" http://localhost:8080/api/v2)
    if echo "$HEADERS" | grep -q "X-API-Version: v2"; then
        log_success "API v2ヘッダー設定確認"
    else
        log_warning "API v2ヘッダー設定が見つかりません"
    fi
}

# レート制限テスト
test_rate_limiting() {
    log_info "レート制限をテスト中..."
    
    log_info "連続リクエストを送信してレート制限をテスト..."
    for i in {1..15}; do
        RESPONSE=$(curl -s -w "%{http_code}" -H "Host: webapp.local" http://localhost:8080/api/v1 -o /dev/null)
        if [ "$RESPONSE" = "429" ]; then
            log_success "レート制限が正常に動作（$i回目のリクエストで制限発動）"
            return 0
        fi
        sleep 0.1
    done
    
    log_warning "レート制限が検出されませんでした（設定値が高い可能性があります）"
}

# Traefikダッシュボードテスト
test_dashboard() {
    log_info "Traefikダッシュボードをテスト中..."
    
    if curl -s http://localhost:8081/api/overview | grep -q "traefik"; then
        log_success "Traefikダッシュボードアクセス成功"
        echo "  ダッシュボードURL: http://localhost:8081"
    else
        log_error "Traefikダッシュボードアクセス失敗"
    fi
}

# メトリクス確認
test_metrics() {
    log_info "Prometheusメトリクスを確認中..."
    
    if curl -s http://localhost:8081/metrics | grep -q "traefik_"; then
        log_success "Prometheusメトリクス取得成功"
    else
        log_error "Prometheusメトリクス取得失敗"
    fi
}

# ロードバランシングテスト
test_load_balancing() {
    log_info "ロードバランシングをテスト中..."
    
    log_info "複数のリクエストを送信してロードバランシングを確認..."
    
    # Pod名を取得
    PODS=$(kubectl get pods -n webapp -l app=api-v1 -o jsonpath='{.items[*].metadata.name}')
    
    # 複数回リクエストを送信
    for i in {1..10}; do
        curl -s -H "Host: webapp.local" http://localhost:8080/api/v1 > /dev/null
        sleep 0.1
    done
    
    log_success "ロードバランシングテスト完了"
    echo "  Traefkダッシュボードでトラフィック分散を確認してください"
}

# クリーンアップ関数
cleanup() {
    log_info "クリーンアップ中..."
    
    # ポート転送プロセスを終了
    [ ! -z "$TRAEFIK_HTTP_PID" ] && kill $TRAEFIK_HTTP_PID 2>/dev/null || true
    [ ! -z "$TRAEFIK_DASHBOARD_PID" ] && kill $TRAEFIK_DASHBOARD_PID 2>/dev/null || true
    
    pkill -f "kubectl port-forward.*traefik" 2>/dev/null || true
}

# シグナルハンドラ設定
trap cleanup EXIT

# メイン実行
main() {
    echo "Traefik Ingress Controller 総合テスト"
    echo "======================================"
    
    check_prerequisites
    check_traefik_deployment
    check_sample_apps
    check_ingress_routes
    start_port_forwarding
    check_hosts_file
    
    echo ""
    echo "🧪 機能テスト開始"
    echo "=================="
    
    test_http_endpoints
    test_response_headers
    test_rate_limiting
    test_dashboard
    test_metrics
    test_load_balancing
    
    echo ""
    echo "✅ テスト完了"
    echo "============="
    echo ""
    echo "📋 テスト結果まとめ:"
    echo "  - Traefik HTTP: http://localhost:8080"
    echo "  - Traefik Dashboard: http://localhost:8081"
    echo "  - フロントエンド: curl -H 'Host: webapp.local' http://localhost:8080"
    echo "  - API v1: curl -H 'Host: webapp.local' http://localhost:8080/api/v1"
    echo "  - API v2: curl -H 'Host: webapp.local' http://localhost:8080/api/v2"
    echo ""
    echo "🔍 追加確認事項:"
    echo "  - Traefikダッシュボードでリアルタイムメトリクスを確認"
    echo "  - ブラウザでwebapp.localにアクセス（/etc/hosts設定が必要）"
    echo "  - IngressRouteとMiddlewareの動的設定更新を試行"
    echo ""
    echo "ポート転送を停止するには Ctrl+C を押してください"
    
    # ポート転送を維持
    wait
}

# スクリプト実行
main "$@"
