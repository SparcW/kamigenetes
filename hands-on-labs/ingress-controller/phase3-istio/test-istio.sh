#!/bin/bash

# Istioテストスクリプト
# Phase 3のIstio演習をテストするスクリプト

set -euo pipefail

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# 使用方法
usage() {
    echo "使用方法: $0 [gateway|traffic|security|observability|all]"
    echo ""
    echo "オプション:"
    echo "  gateway        - Gateway/VirtualServiceのテスト"
    echo "  traffic        - トラフィック管理のテスト"
    echo "  security       - セキュリティ機能のテスト"
    echo "  observability  - 可観測性のテスト"
    echo "  all            - 全テストの実行"
    echo ""
}

# 前提条件の確認
check_prerequisites() {
    info "前提条件の確認中..."
    
    # istioctl の確認
    if ! command -v istioctl &> /dev/null; then
        error "istioctl が見つかりません"
        echo "Istioをインストールしてください: curl -L https://istio.io/downloadIstio | sh -"
        exit 1
    fi
    
    # Istio Control Planeの確認
    if ! kubectl get pods -n istio-system | grep -q "istiod"; then
        error "Istio Control Planeが見つかりません"
        echo "Istioをインストールしてください: istioctl install --set values.defaultRevision=default -y"
        exit 1
    fi
    
    # Sidecar注入の確認
    if ! kubectl get namespace webapp -o jsonpath='{.metadata.labels.istio-injection}' | grep -q "enabled"; then
        warning "webapp名前空間でSidecar注入が有効になっていません"
        kubectl label namespace webapp istio-injection=enabled --overwrite
        kubectl rollout restart deployment -n webapp
    fi
    
    success "前提条件の確認完了"
}

# Gateway/VirtualServiceのテスト
test_gateway() {
    info "Gateway/VirtualServiceのテスト開始"
    
    # Gateway/VirtualServiceの適用
    if [[ -f "02-gateway-virtualservice.yaml" ]]; then
        kubectl apply -f 02-gateway-virtualservice.yaml
        success "Gateway/VirtualServiceを適用しました"
    else
        error "02-gateway-virtualservice.yamlファイルが見つかりません"
        return 1
    fi
    
    # Gateway の作成確認
    if kubectl get gateway webapp-gateway -n webapp &>/dev/null; then
        success "Gatewayが作成されました"
    else
        error "Gatewayの作成に失敗しました"
        return 1
    fi
    
    # VirtualService の作成確認
    if kubectl get virtualservice webapp-virtualservice -n webapp &>/dev/null; then
        success "VirtualServiceが作成されました"
    else
        error "VirtualServiceの作成に失敗しました"
        return 1
    fi
    
    # 設定の検証
    info "Istio設定の検証中..."
    if istioctl analyze -n webapp; then
        success "Istio設定の検証成功"
    else
        warning "Istio設定に問題がある可能性があります"
    fi
    
    # Istio Ingress Gatewayのテスト
    info "Istio Ingress Gatewayのテスト"
    local gateway_ip
    gateway_ip=$(kubectl get service istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [[ -z "$gateway_ip" || "$gateway_ip" == "null" ]]; then
        warning "Istio Ingress GatewayのLoadBalancer IPが取得できませんでした。ポートフォワードでテストします"
        
        kubectl port-forward -n istio-system service/istio-ingressgateway 8080:80 &
        local port_forward_pid=$!
        sleep 5
        
        if curl -s -H "Host: webapp.istio.local" http://localhost:8080/ | grep -q "Kubernetes Ingress"; then
            success "Istio Gatewayのテスト成功（ポートフォワード経由）"
        else
            warning "Istio Gatewayのテスト失敗"
        fi
        
        kill $port_forward_pid 2>/dev/null || true
    else
        if curl -s -H "Host: webapp.istio.local" "http://$gateway_ip/" | grep -q "Kubernetes Ingress"; then
            success "Istio Gatewayのテスト成功"
        else
            warning "Istio Gatewayのテスト失敗"
        fi
    fi
}

# トラフィック管理のテスト
test_traffic() {
    info "トラフィック管理のテスト開始"
    
    # DestinationRuleの確認
    if kubectl get destinationrule webapp-destination-rule -n webapp &>/dev/null; then
        success "DestinationRuleが設定されています"
    else
        warning "DestinationRuleが見つかりません"
    fi
    
    # サブセットの確認
    info "サブセット設定の確認"
    local subsets
    subsets=$(kubectl get destinationrule webapp-destination-rule -n webapp -o jsonpath='{.spec.subsets[*].name}' 2>/dev/null || echo "")
    if [[ -n "$subsets" ]]; then
        success "サブセットが設定されています: $subsets"
    else
        warning "サブセットが設定されていません"
    fi
    
    # Envoy設定の確認
    info "Envoy設定の確認"
    local webapp_pod
    webapp_pod=$(kubectl get pods -n webapp -l app=webapp -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$webapp_pod" ]]; then
        # ルート設定の確認
        if istioctl proxy-config routes "$webapp_pod" -n webapp --port 80 | grep -q "webapp"; then
            success "Envoyルート設定が正常です"
        else
            warning "Envoyルート設定に問題がある可能性があります"
        fi
        
        # クラスター設定の確認
        if istioctl proxy-config clusters "$webapp_pod" -n webapp | grep -q "webapp"; then
            success "Envoyクラスター設定が正常です"
        else
            warning "Envoyクラスター設定に問題がある可能性があります"
        fi
    else
        warning "webappポッドが見つかりません"
    fi
}

# セキュリティ機能のテスト
test_security() {
    info "セキュリティ機能のテスト開始"
    
    # mTLSの確認
    info "mTLS設定の確認"
    if istioctl authn tls-check webapp-deployment -n webapp | grep -q "OK"; then
        success "mTLSが正常に設定されています"
    else
        warning "mTLSの設定を確認してください"
        istioctl authn tls-check webapp-deployment -n webapp
    fi
    
    # PeerAuthenticationの確認
    if kubectl get peerauthentication -n webapp &>/dev/null; then
        local peer_auth_count
        peer_auth_count=$(kubectl get peerauthentication -n webapp --no-headers | wc -l)
        success "PeerAuthentication設定が $peer_auth_count 個見つかりました"
    else
        info "PeerAuthentication設定は見つかりませんでした（デフォルト設定を使用）"
    fi
    
    # AuthorizationPolicyの確認
    if kubectl get authorizationpolicy -n webapp &>/dev/null; then
        local auth_policy_count
        auth_policy_count=$(kubectl get authorizationpolicy -n webapp --no-headers | wc -l)
        success "AuthorizationPolicy設定が $auth_policy_count 個見つかりました"
    else
        info "AuthorizationPolicy設定は見つかりませんでした"
    fi
    
    # ServiceEntryの確認
    if kubectl get serviceentry -n webapp &>/dev/null; then
        local service_entry_count
        service_entry_count=$(kubectl get serviceentry -n webapp --no-headers | wc -l)
        success "ServiceEntry設定が $service_entry_count 個見つかりました"
    else
        info "ServiceEntry設定は見つかりませんでした"
    fi
}

# 可観測性のテスト
test_observability() {
    info "可観測性のテスト開始"
    
    # Prometheus の確認
    if kubectl get pods -n istio-system -l app=prometheus | grep -q "Running"; then
        success "Prometheusが実行中です"
        
        # メトリクスの確認
        info "Istioメトリクスの確認"
        kubectl port-forward -n istio-system service/prometheus 9090:9090 &
        local prometheus_pid=$!
        sleep 5
        
        if curl -s http://localhost:9090/api/v1/query?query=istio_requests_total | grep -q "success"; then
            success "Istioメトリクスが取得できています"
        else
            warning "Istioメトリクスの取得に問題があります"
        fi
        
        kill $prometheus_pid 2>/dev/null || true
    else
        warning "Prometheusが実行されていません"
    fi
    
    # Jaeger の確認
    if kubectl get pods -n istio-system -l app=jaeger | grep -q "Running"; then
        success "Jaegerが実行中です"
        info "Jaeger UIにアクセス: kubectl port-forward -n istio-system service/tracing 16686:80"
    else
        warning "Jaegerが実行されていません"
    fi
    
    # Grafana の確認
    if kubectl get pods -n istio-system -l app=grafana | grep -q "Running"; then
        success "Grafanaが実行中です"
        info "Grafana UIにアクセス: kubectl port-forward -n istio-system service/grafana 3000:3000"
    else
        warning "Grafanaが実行されていません"
    fi
    
    # Kiali の確認
    if kubectl get pods -n istio-system -l app=kiali | grep -q "Running"; then
        success "Kialiが実行中です"
        info "Kiali UIにアクセス: kubectl port-forward -n istio-system service/kiali 20001:20001"
    else
        warning "Kialiが実行されていません"
    fi
    
    # サイドカープロキシの確認
    info "サイドカープロキシの確認"
    local webapp_pod
    webapp_pod=$(kubectl get pods -n webapp -l app=webapp -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -n "$webapp_pod" ]]; then
        local container_count
        container_count=$(kubectl get pod "$webapp_pod" -n webapp -o jsonpath='{.spec.containers[*].name}' | wc -w)
        if [[ $container_count -gt 1 ]]; then
            success "サイドカープロキシが注入されています"
        else
            warning "サイドカープロキシが注入されていません"
        fi
    fi
}

# Istio設定の詳細確認
check_istio_status() {
    info "Istio設定の詳細確認"
    
    echo "=== Istio System ポッド ==="
    kubectl get pods -n istio-system
    echo ""
    
    echo "=== Gateway一覧 ==="
    kubectl get gateway -A
    echo ""
    
    echo "=== VirtualService一覧 ==="
    kubectl get virtualservice -A
    echo ""
    
    echo "=== DestinationRule一覧 ==="
    kubectl get destinationrule -A
    echo ""
    
    echo "=== ServiceEntry一覧 ==="
    kubectl get serviceentry -A
    echo ""
    
    echo "=== Istio分析結果 ==="
    istioctl analyze --all-namespaces
    echo ""
}

# トラフィック生成（テスト用）
generate_traffic() {
    info "テスト用トラフィック生成"
    
    local gateway_ip
    gateway_ip=$(kubectl get service istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "localhost")
    
    if [[ "$gateway_ip" == "localhost" ]]; then
        kubectl port-forward -n istio-system service/istio-ingressgateway 8080:80 &
        local port_forward_pid=$!
        sleep 5
        gateway_ip="localhost:8080"
    fi
    
    info "トラフィック生成中... (30秒間)"
    for i in {1..30}; do
        curl -s -H "Host: webapp.istio.local" "http://$gateway_ip/" > /dev/null &
        curl -s -H "Host: api.istio.local" "http://$gateway_ip/api/v1" > /dev/null &
        sleep 1
    done
    
    wait
    success "トラフィック生成完了"
    
    if [[ -n "${port_forward_pid:-}" ]]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
}

# メイン実行部分
main() {
    echo "🕸️ Istio Service Mesh テストスクリプト"
    echo "========================================"
    
    check_prerequisites
    
    case "${1:-all}" in
        "gateway")
            test_gateway
            ;;
        "traffic")
            test_traffic
            ;;
        "security")
            test_security
            ;;
        "observability")
            test_observability
            ;;
        "all")
            test_gateway
            test_traffic
            test_security
            test_observability
            ;;
        "status")
            check_istio_status
            ;;
        "generate-traffic")
            generate_traffic
            ;;
        *)
            usage
            exit 1
            ;;
    esac
    
    echo ""
    echo "========================================"
    success "テスト完了"
    
    info "便利なコマンド:"
    echo "- istioctl dashboard kiali     : Kialiダッシュボード"
    echo "- istioctl dashboard grafana   : Grafanaダッシュボード"
    echo "- istioctl dashboard jaeger    : Jaegerダッシュボード"
    echo "- ./test-istio.sh generate-traffic : テスト用トラフィック生成"
    echo "- ./test-istio.sh status       : 詳細な状態確認"
}

# スクリプト実行
main "$@"
