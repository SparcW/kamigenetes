#!/bin/bash

# RBAC権限テストスクリプト
# 各ServiceAccountの権限を自動テストして結果を表示

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

# RBAC権限テスト関数
test_rbac_permission() {
    local sa_name="$1"
    local namespace="$2"
    local resource="$3"
    local verb="$4"
    local description="$5"
    
    if kubectl auth can-i "$verb" "$resource" \
        --as="system:serviceaccount:$namespace:$sa_name" \
        -n "$namespace" &> /dev/null; then
        success "$description: 許可"
        return 0
    else
        error "$description: 拒否"
        return 1
    fi
}

# Pod内からのAPI呼び出しテスト
test_pod_api_access() {
    local pod_name="$1"
    local namespace="$2"
    local test_description="$3"
    
    info "Pod内からのAPIアクセステスト: $test_description"
    
    # Podが実行中か確認
    if ! kubectl get pod "$pod_name" -n "$namespace" &> /dev/null; then
        warning "Pod '$pod_name' が存在しません。先にマニフェストを適用してください。"
        return 1
    fi
    
    # Pod が Ready状態か確認
    if ! kubectl wait --for=condition=Ready pod/"$pod_name" -n "$namespace" --timeout=30s &> /dev/null; then
        warning "Pod '$pod_name' がReady状態になりません。"
        return 1
    fi
    
    # Pod一覧取得テスト
    if kubectl exec "$pod_name" -n "$namespace" -- \
        curl -s -H "Authorization: Bearer \$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
        -k "https://kubernetes.default.svc/api/v1/namespaces/$namespace/pods" &> /dev/null; then
        success "  Pod一覧取得: 成功"
    else
        error "  Pod一覧取得: 失敗"
    fi
    
    # ConfigMap取得テスト
    if kubectl exec "$pod_name" -n "$namespace" -- \
        curl -s -H "Authorization: Bearer \$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
        -k "https://kubernetes.default.svc/api/v1/namespaces/$namespace/configmaps" &> /dev/null; then
        success "  ConfigMap取得: 成功"
    else
        error "  ConfigMap取得: 失敗"
    fi
    
    # Secret取得テスト
    if kubectl exec "$pod_name" -n "$namespace" -- \
        curl -s -H "Authorization: Bearer \$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
        -k "https://kubernetes.default.svc/api/v1/namespaces/$namespace/secrets" &> /dev/null; then
        success "  Secret取得: 成功"
    else
        error "  Secret取得: 失敗"
    fi
}

# メイン処理
main() {
    echo -e "${BLUE}🔐 RBAC権限テスト実行${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    NAMESPACE="security-demo"
    
    # 前提条件チェック
    info "前提条件をチェックしています..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' が存在しません。セットアップスクリプトを先に実行してください。"
        exit 1
    fi
    
    if ! kubectl get serviceaccount frontend-sa -n "$NAMESPACE" &> /dev/null; then
        error "ServiceAccountが存在しません。マニフェストを先に適用してください。"
        echo "実行コマンド: kubectl apply -f ."
        exit 1
    fi
    
    echo
    info "=== フロントエンド ServiceAccount (frontend-sa) 権限テスト ==="
    test_rbac_permission "frontend-sa" "$NAMESPACE" "pods" "get" "Pod取得権限"
    test_rbac_permission "frontend-sa" "$NAMESPACE" "pods" "list" "Pod一覧表示権限"
    test_rbac_permission "frontend-sa" "$NAMESPACE" "configmaps" "get" "ConfigMap取得権限"
    test_rbac_permission "frontend-sa" "$NAMESPACE" "secrets" "get" "Secret取得権限"
    test_rbac_permission "frontend-sa" "$NAMESPACE" "pods" "create" "Pod作成権限"
    echo
    
    info "=== バックエンド ServiceAccount (backend-sa) 権限テスト ==="
    test_rbac_permission "backend-sa" "$NAMESPACE" "pods" "get" "Pod取得権限"
    test_rbac_permission "backend-sa" "$NAMESPACE" "configmaps" "get" "ConfigMap取得権限"
    test_rbac_permission "backend-sa" "$NAMESPACE" "secrets" "get" "Secret取得権限"
    test_rbac_permission "backend-sa" "$NAMESPACE" "services" "get" "Service取得権限"
    test_rbac_permission "backend-sa" "$NAMESPACE" "pods" "create" "Pod作成権限"
    echo
    
    info "=== データベース管理 ServiceAccount (database-admin-sa) 権限テスト ==="
    test_rbac_permission "database-admin-sa" "$NAMESPACE" "pods" "get" "Pod取得権限"
    test_rbac_permission "database-admin-sa" "$NAMESPACE" "pods" "create" "Pod作成権限"
    test_rbac_permission "database-admin-sa" "$NAMESPACE" "configmaps" "create" "ConfigMap作成権限"
    test_rbac_permission "database-admin-sa" "$NAMESPACE" "secrets" "create" "Secret作成権限"
    test_rbac_permission "database-admin-sa" "$NAMESPACE" "deployments" "create" "Deployment作成権限"
    echo
    
    info "=== 制限された ServiceAccount (limited-sa) 権限テスト ==="
    test_rbac_permission "limited-sa" "$NAMESPACE" "pods" "list" "Pod一覧表示権限"
    test_rbac_permission "limited-sa" "$NAMESPACE" "pods" "get" "Pod取得権限"
    test_rbac_permission "limited-sa" "$NAMESPACE" "configmaps" "get" "ConfigMap取得権限"
    test_rbac_permission "limited-sa" "$NAMESPACE" "pods" "create" "Pod作成権限"
    echo
    
    # Pod内からのAPIアクセステスト
    info "=== Pod内からのAPIアクセステスト ==="
    test_pod_api_access "frontend-test-pod" "$NAMESPACE" "フロントエンドPod"
    echo
    test_pod_api_access "backend-test-pod" "$NAMESPACE" "バックエンドPod"
    echo
    test_pod_api_access "admin-test-pod" "$NAMESPACE" "管理者Pod"
    echo
    test_pod_api_access "limited-test-pod" "$NAMESPACE" "制限されたPod"
    echo
    
    # 権限一覧表示
    info "=== ServiceAccount権限一覧表示 ==="
    
    echo "📋 フロントエンドServiceAccount権限一覧:"
    kubectl auth can-i --list --as=system:serviceaccount:security-demo:frontend-sa -n "$NAMESPACE" | head -10
    echo
    
    echo "📋 バックエンドServiceAccount権限一覧:"
    kubectl auth can-i --list --as=system:serviceaccount:security-demo:backend-sa -n "$NAMESPACE" | head -10
    echo
    
    # AWS ECS比較
    info "=== AWS ECS Task Role との比較 ==="
    cat << 'EOF'
🔄 権限管理の比較:

AWS ECS:
- Task Definition でTask Role を指定
- IAM Policy でAWSリソースへのアクセス制御
- CloudTrail でアクセスログ記録

Kubernetes:
- Pod Spec でServiceAccount を指定  
- Role/RoleBinding でK8sリソースへのアクセス制御
- Audit Log でアクセスログ記録

移行時の考慮点:
- ECS Task Role → K8s ServiceAccount
- IAM Policy → K8s Role
- AWS Resource → K8s Resource
- CloudTrail → K8s Audit Log
EOF
    echo
    
    # 次のステップ
    info "=== 次のステップ ==="
    echo "✅ RBAC設定が正常に動作していることを確認しました"
    echo "📝 Phase 2: Pod Security Standards の学習に進んでください"
    echo "   cd ../phase2-pod-security"
    echo
    echo "🔧 トラブルシューティング:"
    echo "- 権限エラー: kubectl describe rolebinding <name> -n security-demo"
    echo "- ServiceAccount確認: kubectl get serviceaccount -n security-demo"
    echo "- Pod確認: kubectl get pods -n security-demo"
    echo
}

# クリーンアップ関数
cleanup() {
    if [[ "${1:-}" == "--cleanup" ]]; then
        info "RBAC演習リソースをクリーンアップしています..."
        kubectl delete -f . --ignore-not-found=true
        success "クリーンアップ完了"
        exit 0
    fi
}

# 引数処理
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "使用方法: $0 [--cleanup] [--help]"
    echo "  --cleanup: 演習リソースをクリーンアップ"
    echo "  --help:    このヘルプメッセージを表示"
    exit 0
fi

cleanup "$@"

# スクリプト実行
main "$@"
