#!/bin/bash

# NGINX Ingress Controller テストスクリプト
# Phase 1の演習をテストするスクリプト

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
    echo "使用方法: $0 [basic|routing|ssl|auth|all]"
    echo ""
    echo "オプション:"
    echo "  basic    - 基本Ingressのテスト"
    echo "  routing  - パス/ホストルーティングのテスト"
    echo "  ssl      - SSL/TLS設定のテスト"
    echo "  auth     - 認証設定のテスト"
    echo "  all      - 全テストの実行"
    echo ""
}

# 前提条件の確認
check_prerequisites() {
    info "前提条件の確認中..."
    
    # NGINX Ingress Controllerの確認
    if ! kubectl get pods -n ingress-nginx | grep -q "nginx-ingress"; then
        error "NGINX Ingress Controllerが見つかりません"
        echo "セットアップスクリプトを実行してください: ./scripts/setup-environment.sh nginx"
        exit 1
    fi
    
    # サンプルアプリの確認
    if ! kubectl get deployment webapp-deployment -n webapp &>/dev/null; then
        error "サンプルアプリケーションが見つかりません"
        echo "セットアップスクリプトを実行してください: ./scripts/setup-environment.sh"
        exit 1
    fi
    
    success "前提条件の確認完了"
}

# 基本Ingressのテスト
test_basic_ingress() {
    info "基本Ingressのテスト開始"
    
    # 基本Ingressの適用
    kubectl apply -f 01-basic-ingress.yaml
    
    # Ingressの作成確認
    if kubectl get ingress webapp-basic-ingress -n webapp &>/dev/null; then
        success "基本Ingressが作成されました"
    else
        error "基本Ingressの作成に失敗しました"
        return 1
    fi
    
    # LoadBalancerのIPアドレス取得
    info "LoadBalancerのIPアドレス取得中..."
    local lb_ip
    for i in {1..30}; do
        lb_ip=$(kubectl get service nginx-ingress-ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        if [[ -n "$lb_ip" && "$lb_ip" != "null" ]]; then
            break
        fi
        echo "待機中... ($i/30)"
        sleep 10
    done
    
    if [[ -z "$lb_ip" || "$lb_ip" == "null" ]]; then
        warning "LoadBalancerのIPアドレスが取得できませんでした。ローカルテストを実行します"
        lb_ip="localhost"
        
        # ポートフォワードでテスト
        kubectl port-forward -n ingress-nginx service/nginx-ingress-ingress-nginx-controller 8080:80 &
        local port_forward_pid=$!
        sleep 5
        
        # HTTP テスト
        if curl -s -H "Host: webapp.local" http://localhost:8080/ | grep -q "Kubernetes Ingress"; then
            success "基本Ingressのテスト成功（ポートフォワード経由）"
        else
            error "基本Ingressのテスト失敗"
        fi
        
        # ポートフォワード終了
        kill $port_forward_pid 2>/dev/null || true
    else
        # 直接テスト
        if curl -s -H "Host: webapp.local" "http://$lb_ip/" | grep -q "Kubernetes Ingress"; then
            success "基本Ingressのテスト成功"
        else
            error "基本Ingressのテスト失敗"
        fi
    fi
    
    # ヘルスチェックテスト
    info "ヘルスチェックエンドポイントのテスト"
    if [[ "$lb_ip" == "localhost" ]]; then
        kubectl port-forward -n ingress-nginx service/nginx-ingress-ingress-nginx-controller 8080:80 &
        local port_forward_pid=$!
        sleep 5
        
        if curl -s -H "Host: webapp.local" http://localhost:8080/health | grep -q "healthy"; then
            success "ヘルスチェックエンドポイントのテスト成功"
        else
            warning "ヘルスチェックエンドポイントのテスト失敗"
        fi
        
        kill $port_forward_pid 2>/dev/null || true
    else
        if curl -s -H "Host: webapp.local" "http://$lb_ip/health" | grep -q "healthy"; then
            success "ヘルスチェックエンドポイントのテスト成功"
        else
            warning "ヘルスチェックエンドポイントのテスト失敗"
        fi
    fi
}

# パス/ホストルーティングのテスト
test_routing() {
    info "パス/ホストルーティングのテスト開始"
    
    # ルーティング設定の適用
    kubectl apply -f 02-path-routing.yaml
    
    # API v1サービスの作成確認
    if ! kubectl get service api-v1-service -n api &>/dev/null; then
        warning "API v1サービスが見つかりません。作成します..."
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: api-v1-service
  namespace: api
spec:
  selector:
    app: api
    version: v1
  ports:
  - port: 80
    targetPort: 80
    name: http
  type: ClusterIP
EOF
    fi
    
    # Ingressの作成確認
    if kubectl get ingress api-path-routing -n api &>/dev/null; then
        success "パスベースルーティングIngressが作成されました"
    else
        error "パスベースルーティングIngressの作成に失敗しました"
        return 1
    fi
    
    # マルチテナントIngressの確認
    if kubectl get ingress multi-tenant-ingress -n webapp &>/dev/null; then
        success "マルチテナントIngressが作成されました"
    else
        error "マルチテナントIngressの作成に失敗しました"
        return 1
    fi
    
    info "ルーティングテストは手動で確認してください："
    echo "1. curl -H 'Host: api.local' http://<ingress-ip>/api/v1/"
    echo "2. curl -H 'Host: company-a.local' http://<ingress-ip>/"
    echo "3. curl -H 'Host: company-b.local' http://<ingress-ip>/"
}

# SSL/TLS設定のテスト
test_ssl() {
    info "SSL/TLS設定のテスト開始"
    
    # cert-managerがインストールされているか確認
    if ! kubectl get crd certificates.cert-manager.io &>/dev/null; then
        warning "cert-managerがインストールされていません。SSL/TLSテストをスキップします"
        echo "cert-managerをインストールしてください:"
        echo "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml"
        return 0
    fi
    
    # SSL設定の適用（実際のファイルが存在する場合）
    if [[ -f "03-ssl-tls.yaml" ]]; then
        kubectl apply -f 03-ssl-tls.yaml
        success "SSL/TLS設定を適用しました"
    else
        warning "03-ssl-tls.yamlファイルが見つかりません"
    fi
    
    # 証明書の状態確認
    info "証明書の状態確認中..."
    sleep 10
    if kubectl get certificates -A | grep -q "True"; then
        success "SSL証明書が正常に取得されました"
    else
        warning "SSL証明書の取得を確認してください"
        kubectl get certificates -A
    fi
}

# 認証設定のテスト
test_auth() {
    info "認証設定のテスト開始"
    
    # 基本認証用Secretの作成
    info "基本認証用Secretの作成"
    echo -n "admin:$(openssl passwd -apr1 password)" | kubectl create secret generic basic-auth --from-file=auth=/dev/stdin -n webapp --dry-run=client -o yaml | kubectl apply -f -
    
    # 認証設定の適用（実際のファイルが存在する場合）
    if [[ -f "04-authentication.yaml" ]]; then
        kubectl apply -f 04-authentication.yaml
        success "認証設定を適用しました"
    else
        warning "04-authentication.yamlファイルが見つかりません"
    fi
    
    # 認証テストの案内
    info "認証テストは手動で確認してください："
    echo "1. 認証なし: curl -H 'Host: admin.local' http://<ingress-ip>/ (401エラーが期待されます)"
    echo "2. 認証あり: curl -u admin:password -H 'Host: admin.local' http://<ingress-ip>/ (成功が期待されます)"
}

# Ingressの状態確認
check_ingress_status() {
    info "Ingress状態の確認"
    
    echo "=== 全Ingressリソース ==="
    kubectl get ingress -A
    echo ""
    
    echo "=== NGINX Ingress Controller ログ（最新10行） ==="
    kubectl logs -n ingress-nginx deployment/nginx-ingress-ingress-nginx-controller --tail=10
    echo ""
    
    echo "=== サービス一覧 ==="
    kubectl get services -A | grep -E "(ingress|webapp|api)"
    echo ""
}

# メイン実行部分
main() {
    echo "🧪 NGINX Ingress Controller テストスクリプト"
    echo "=============================================="
    
    check_prerequisites
    
    case "${1:-all}" in
        "basic")
            test_basic_ingress
            ;;
        "routing")
            test_routing
            ;;
        "ssl")
            test_ssl
            ;;
        "auth")
            test_auth
            ;;
        "all")
            test_basic_ingress
            test_routing
            test_ssl
            test_auth
            ;;
        "status")
            check_ingress_status
            ;;
        *)
            usage
            exit 1
            ;;
    esac
    
    echo ""
    echo "=============================================="
    success "テスト完了"
    
    info "詳細な状態確認:"
    echo "./test-nginx-ingress.sh status"
}

# スクリプト実行
main "$@"
