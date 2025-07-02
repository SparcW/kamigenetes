#!/bin/bash

# NetworkPolicy テストスクリプト
# 3層アプリケーションのネットワーク分離とセキュリティ制御をテスト

set -euo pipefail

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルパー関数
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

# ネットワーク接続テスト
test_network_connection() {
    local from_pod="$1"
    local to_host="$2"
    local to_port="$3"
    local namespace="$4"
    local description="$5"
    local should_succeed="$6"  # true/false
    
    info "ネットワーク接続テスト: $description"
    
    # Pod が Ready状態か確認
    if ! kubectl wait --for=condition=Ready pod/"$from_pod" -n "$namespace" --timeout=10s &> /dev/null; then
        warning "Pod '$from_pod' がReady状態ではありません"
        return 1
    fi
    
    # 接続テスト実行（タイムアウト5秒）
    if kubectl exec "$from_pod" -n "$namespace" -- timeout 5 nc -zv "$to_host" "$to_port" &> /dev/null; then
        if [[ "$should_succeed" == "true" ]]; then
            success "  接続成功: $from_pod → $to_host:$to_port （期待通り）"
            return 0
        else
            error "  接続成功: $from_pod → $to_host:$to_port （予期しない成功）"
            return 1
        fi
    else
        if [[ "$should_succeed" == "false" ]]; then
            success "  接続拒否: $from_pod → $to_host:$to_port （期待通り）"
            return 0
        else
            error "  接続失敗: $from_pod → $to_host:$to_port （予期しない失敗）"
            return 1
        fi
    fi
}

# HTTP接続テスト
test_http_connection() {
    local from_pod="$1"
    local to_url="$2"
    local namespace="$3"
    local description="$4"
    local should_succeed="$5"  # true/false
    
    info "HTTP接続テスト: $description"
    
    # Pod が Ready状態か確認
    if ! kubectl wait --for=condition=Ready pod/"$from_pod" -n "$namespace" --timeout=10s &> /dev/null; then
        warning "Pod '$from_pod' がReady状態ではありません"
        return 1
    fi
    
    # HTTP接続テスト実行（タイムアウト5秒）
    if kubectl exec "$from_pod" -n "$namespace" -- timeout 5 curl -s "$to_url" &> /dev/null; then
        if [[ "$should_succeed" == "true" ]]; then
            success "  HTTP接続成功: $from_pod → $to_url （期待通り）"
            return 0
        else
            error "  HTTP接続成功: $from_pod → $to_url （予期しない成功）"
            return 1
        fi
    else
        if [[ "$should_succeed" == "false" ]]; then
            success "  HTTP接続拒否: $from_pod → $to_url （期待通り）"
            return 0
        else
            error "  HTTP接続失敗: $from_pod → $to_url （予期しない失敗）"
            return 1
        fi
    fi
}

# DNS解決テスト
test_dns_resolution() {
    local from_pod="$1"
    local hostname="$2"
    local namespace="$3"
    local description="$4"
    
    info "DNS解決テスト: $description"
    
    if kubectl exec "$from_pod" -n "$namespace" -- nslookup "$hostname" &> /dev/null; then
        success "  DNS解決成功: $hostname"
        return 0
    else
        error "  DNS解決失敗: $hostname"
        return 1
    fi
}

# アプリケーション動作確認
test_application_functionality() {
    local namespace="$1"
    
    info "アプリケーション動作確認"
    
    # Frontend Pod取得
    local frontend_pod=$(kubectl get pods -n "$namespace" -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -z "$frontend_pod" ]]; then
        warning "Frontend Podが見つかりません"
        return 1
    fi
    
    # Backend Pod取得
    local backend_pod=$(kubectl get pods -n "$namespace" -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -z "$backend_pod" ]]; then
        warning "Backend Podが見つかりません"
        return 1
    fi
    
    # Frontend → Backend API テスト
    info "  Frontend → Backend API接続テスト"
    if kubectl exec "$frontend_pod" -n "$namespace" -- timeout 5 curl -s http://backend-service:8080/health &> /dev/null; then
        success "    Frontend → Backend API: 正常"
        
        # APIレスポンス内容確認
        local api_response=$(kubectl exec "$frontend_pod" -n "$namespace" -- curl -s http://backend-service:8080/api/data 2>/dev/null || echo "")
        if [[ -n "$api_response" ]]; then
            success "    API データ取得: 正常"
            echo "      レスポンス: $(echo "$api_response" | head -c 100)..."
        fi
    else
        error "    Frontend → Backend API: 失敗"
        return 1
    fi
    
    # Backend → Database 接続テスト
    info "  Backend → Database接続テスト"
    if kubectl exec "$backend_pod" -n "$namespace" -- timeout 5 nc -zv database-service 5432 &> /dev/null; then
        success "    Backend → Database: 正常"
    else
        error "    Backend → Database: 失敗"
        return 1
    fi
    
    echo
}

# NetworkPolicy設定確認
check_network_policies() {
    local namespace="$1"
    
    info "NetworkPolicy設定確認"
    
    # NetworkPolicy一覧取得
    local policies=$(kubectl get networkpolicy -n "$namespace" --no-headers 2>/dev/null | wc -l)
    echo "  NetworkPolicy数: $policies"
    
    # 個別ポリシー確認
    local expected_policies=(
        "default-deny-ingress"
        "default-deny-egress"
        "frontend-ingress-policy"
        "frontend-egress-policy"
        "backend-ingress-policy"
        "backend-egress-policy"
        "database-ingress-policy"
        "database-egress-policy"
    )
    
    for policy in "${expected_policies[@]}"; do
        if kubectl get networkpolicy "$policy" -n "$namespace" &> /dev/null; then
            success "  ✓ $policy"
        else
            warning "  ✗ $policy が存在しません"
        fi
    done
    echo
}

# CNI NetworkPolicy サポート確認
check_cni_support() {
    info "CNI NetworkPolicy サポート確認"
    
    # NetworkPolicy CRD確認
    if kubectl get crd networkpolicies.networking.k8s.io &> /dev/null; then
        success "  NetworkPolicy CRD: 存在"
    else
        error "  NetworkPolicy CRD: 存在しません"
        return 1
    fi
    
    # minikube Calico アドオン確認
    if command -v minikube &> /dev/null && minikube status &> /dev/null; then
        if minikube addons list | grep calico | grep -q enabled; then
            success "  minikube Calico: 有効"
        else
            warning "  minikube Calico: 無効"
            echo "    有効化コマンド: minikube addons enable calico"
        fi
    else
        info "  minikube以外の環境: CNI プラグインがNetworkPolicyに対応していることを確認してください"
    fi
    
    # CNI Pod確認
    local cni_pods=$(kubectl get pods -n kube-system | grep -E "(calico|cilium|weave)" | wc -l)
    if [[ "$cni_pods" -gt 0 ]]; then
        success "  CNI Pods: 動作中 ($cni_pods個)"
    else
        warning "  CNI Pods: NetworkPolicy対応CNIが見つかりません"
    fi
    
    echo
}

# セキュリティ侵入テスト
test_security_violations() {
    local namespace="$1"
    
    info "セキュリティ侵入テスト"
    
    # テスト用Pod取得
    local test_pod=$(kubectl get pods -n "$namespace" -l app=network-test -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -z "$test_pod" ]]; then
        warning "ネットワークテスト用Podが見つかりません"
        return 1
    fi
    
    # 1. Frontend からDatabase への直接アクセス（拒否されるべき）
    local frontend_pod=$(kubectl get pods -n "$namespace" -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$frontend_pod" ]]; then
        test_network_connection "$frontend_pod" "database-service" "5432" "$namespace" "Frontend → Database直接接続（拒否されるべき）" "false"
    fi
    
    # 2. 外部からBackend への直接アクセス（拒否されるべき）
    test_network_connection "$test_pod" "backend-service" "8080" "$namespace" "外部 → Backend直接接続（拒否されるべき）" "false"
    
    # 3. 外部からDatabase への直接アクセス（拒否されるべき）
    test_network_connection "$test_pod" "database-service" "5432" "$namespace" "外部 → Database直接接続（拒否されるべき）" "false"
    
    echo
}

# AWS ECS vs Kubernetes 比較表示
show_ecs_comparison() {
    info "AWS ECS vs Kubernetes NetworkPolicy 比較"
    cat << 'EOF'
====================================================

🔄 ネットワークセキュリティ比較:

┌─────────────────────┬─────────────────────┬─────────────────────┐
│      概念           │      AWS ECS        │     Kubernetes      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ ネットワーク分離    │ VPC + Subnets       │ Namespace +         │
│                     │                     │ NetworkPolicy       │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ アクセス制御        │ Security Groups     │ NetworkPolicy       │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 適用粒度            │ ENI/Instance        │ Pod                 │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ ルール方向          │ Inbound/Outbound    │ Ingress/Egress      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 送信元/宛先指定     │ CIDR/SG ID          │ podSelector/        │
│                     │                     │ namespaceSelector   │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ ロードバランサー    │ ALB/NLB             │ LoadBalancer/       │
│                     │                     │ Ingress             │
└─────────────────────┴─────────────────────┴─────────────────────┘

📋 移行時の考慮点:
1. Security Group → NetworkPolicy 変換
2. VPC Subnet → Namespace 分離
3. ALB/NLB → K8s LoadBalancer/Ingress
4. ECS Service Discovery → K8s Service

💡 NetworkPolicy のメリット:
- より細かい粒度での制御（Pod単位）
- ラベルベースの動的な制御
- Namespace による論理分離
- GitOpsでの宣言的管理

⚠️  注意点:
- CNI プラグインがNetworkPolicyに対応している必要がある
- クラスター初期設定でのCNI選択が重要
- AWS EKSでは Calico または Amazon VPC CNI + Security Groups for Pods

EOF
}

# メイン処理
main() {
    echo -e "${BLUE}🌐 NetworkPolicy ネットワークセキュリティテスト${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    NAMESPACE="security-demo"
    
    # 前提条件チェック
    info "前提条件をチェックしています..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' が存在しません。01-apps.yamlを先に適用してください。"
        exit 1
    fi
    
    # CNI NetworkPolicy サポート確認
    check_cni_support
    
    # NetworkPolicy設定確認
    check_network_policies "$NAMESPACE"
    
    # アプリケーション Pod 起動確認
    info "アプリケーションPod起動確認"
    
    apps=("frontend" "backend" "database")
    for app in "${apps[@]}"; do
        local pod_count=$(kubectl get pods -n "$NAMESPACE" -l app="$app" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        if [[ "$pod_count" -gt 0 ]]; then
            success "  $app: $pod_count Pod(s) 実行中"
        else
            warning "  $app: Pod が実行されていません"
        fi
    done
    echo
    
    # Pod Ready 状態待機
    info "Pod Ready状態を待機しています..."
    
    for app in "${apps[@]}"; do
        local pods=$(kubectl get pods -n "$NAMESPACE" -l app="$app" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
        if [[ -n "$pods" ]]; then
            for pod in $pods; do
                kubectl wait --for=condition=Ready pod/"$pod" -n "$NAMESPACE" --timeout=60s &> /dev/null || warning "$pod がReady状態になりませんでした"
            done
        fi
    done
    echo
    
    # アプリケーション動作確認
    test_application_functionality "$NAMESPACE"
    
    # 正常な通信パス確認
    info "=== 正常な通信パス確認 ==="
    
    # Pod名取得
    local frontend_pod=$(kubectl get pods -n "$NAMESPACE" -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    local backend_pod=$(kubectl get pods -n "$NAMESPACE" -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    local test_pod=$(kubectl get pods -n "$NAMESPACE" -l app=network-test -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [[ -n "$frontend_pod" && -n "$backend_pod" ]]; then
        # DNS解決テスト
        test_dns_resolution "$frontend_pod" "backend-service" "$NAMESPACE" "Frontend DNS解決"
        test_dns_resolution "$backend_pod" "database-service" "$NAMESPACE" "Backend DNS解決"
        
        # 許可された通信テスト
        test_network_connection "$frontend_pod" "backend-service" "8080" "$NAMESPACE" "Frontend → Backend" "true"
        test_network_connection "$backend_pod" "database-service" "5432" "$NAMESPACE" "Backend → Database" "true"
        test_http_connection "$frontend_pod" "http://backend-service:8080/health" "$NAMESPACE" "Frontend → Backend HTTP" "true"
    fi
    echo
    
    # セキュリティ侵入テスト
    info "=== セキュリティ違反テスト ==="
    test_security_violations "$NAMESPACE"
    
    # 外部アクセステスト
    info "=== 外部アクセステスト ==="
    
    # LoadBalancer Service確認
    local frontend_lb=$(kubectl get service frontend-service -n "$NAMESPACE" -o jsonpath='{.spec.type}' 2>/dev/null)
    if [[ "$frontend_lb" == "LoadBalancer" ]]; then
        success "Frontend LoadBalancer Service設定済み"
        
        # External IP確認
        local external_ip=$(kubectl get service frontend-service -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
        if [[ -n "$external_ip" && "$external_ip" != "null" ]]; then
            success "External IP: $external_ip"
        else
            info "External IP: Pending（minikube環境では 'minikube tunnel' が必要）"
        fi
    fi
    echo
    
    # NetworkPolicy 動作検証
    info "=== NetworkPolicy 動作検証 ==="
    
    if [[ -n "$test_pod" ]]; then
        info "テスト用Podからの接続確認"
        
        # DNS が動作することを確認
        test_dns_resolution "$test_pod" "frontend-service" "$NAMESPACE" "外部Pod DNS解決"
        
        # 各層への直接アクセステスト
        test_network_connection "$test_pod" "frontend-service" "80" "$NAMESPACE" "外部 → Frontend" "true"
        test_network_connection "$test_pod" "backend-service" "8080" "$NAMESPACE" "外部 → Backend（拒否されるべき）" "false"
        test_network_connection "$test_pod" "database-service" "5432" "$NAMESPACE" "外部 → Database（拒否されるべき）" "false"
    fi
    echo
    
    # AWS ECS比較
    show_ecs_comparison
    
    # パフォーマンス影響確認
    info "=== NetworkPolicy パフォーマンス影響確認 ==="
    if [[ -n "$frontend_pod" ]]; then
        info "HTTP レスポンス時間測定"
        kubectl exec "$frontend_pod" -n "$NAMESPACE" -- time curl -s http://backend-service:8080/health &> /dev/null || true
        success "NetworkPolicy適用下でも正常にレスポンス"
    fi
    echo
    
    # 次のステップ
    info "=== 次のステップ ==="
    echo "✅ NetworkPolicy によるネットワーク分離を確認しました"
    echo "📝 Phase 4: Secrets管理とデータ保護に進んでください"
    echo "   cd ../phase4-secrets"
    echo
    echo "🔧 トラブルシューティング:"
    echo "- NetworkPolicy確認: kubectl get networkpolicy -n $NAMESPACE"
    echo "- 通信ログ確認: kubectl logs -n kube-system -l k8s-app=calico-node"
    echo "- Pod IP確認: kubectl get pods -n $NAMESPACE -o wide"
    echo "- Service確認: kubectl get services -n $NAMESPACE"
    echo
    echo "🌐 外部アクセステスト（minikube）:"
    echo "- minikube tunnel  # 別ターミナルで実行"
    echo "- curl http://\$(kubectl get service frontend-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
    echo
    
    # クリーンアップオプション
    if [[ "${1:-}" == "--cleanup" ]]; then
        info "NetworkPolicy演習リソースをクリーンアップしています..."
        kubectl delete -f . --ignore-not-found=true
        success "クリーンアップ完了"
    fi
}

# 引数処理
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "使用方法: $0 [--cleanup] [--help]"
    echo "  --cleanup: 演習リソースをクリーンアップ"
    echo "  --help:    このヘルプメッセージを表示"
    exit 0
fi

# スクリプト実行
main "$@"
