#!/bin/bash

# Pod Security Standards テストスクリプト
# 各セキュリティレベルでのPod作成テストと違反検証

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

# Pod Security Standards レベル確認
check_namespace_pss() {
    local namespace="$1"
    local description="$2"
    
    info "Namespace '$namespace' Pod Security Standards設定確認"
    
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        warning "Namespace '$namespace' が存在しません"
        return 1
    fi
    
    # Pod Security Standards ラベル確認
    local enforce_level=$(kubectl get namespace "$namespace" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null || echo "none")
    local audit_level=$(kubectl get namespace "$namespace" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/audit}' 2>/dev/null || echo "none")
    local warn_level=$(kubectl get namespace "$namespace" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/warn}' 2>/dev/null || echo "none")
    
    echo "  📋 $description"
    echo "    Enforce: $enforce_level"
    echo "    Audit:   $audit_level"
    echo "    Warn:    $warn_level"
    echo
}

# セキュアなPod作成テスト
test_secure_pod_creation() {
    local pod_name="$1"
    local namespace="$2"
    local description="$3"
    
    info "セキュアなPod作成テスト: $description"
    
    # 既存Podのクリーンアップ
    kubectl delete pod "$pod_name" -n "$namespace" --ignore-not-found=true &> /dev/null
    
    # Pod作成試行
    if kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $pod_name
  namespace: $namespace
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: test-container
    image: alpine:3.16
    command: ["sleep", "300"]
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      requests:
        memory: "64Mi"
        cpu: "125m"
      limits:
        memory: "128Mi"
        cpu: "250m"
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
EOF
    then
        success "  Pod作成成功: $pod_name"
        
        # Pod Ready待機
        if kubectl wait --for=condition=Ready pod/"$pod_name" -n "$namespace" --timeout=30s &> /dev/null; then
            success "  Pod Ready状態: $pod_name"
            
            # セキュリティコンテキスト確認
            local run_as_user=$(kubectl get pod "$pod_name" -n "$namespace" -o jsonpath='{.spec.securityContext.runAsUser}' 2>/dev/null)
            local read_only_fs=$(kubectl get pod "$pod_name" -n "$namespace" -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}' 2>/dev/null)
            echo "    実行ユーザー: $run_as_user"
            echo "    読み取り専用FS: $read_only_fs"
        else
            warning "  Pod Ready状態待機タイムアウト: $pod_name"
        fi
        return 0
    else
        error "  Pod作成失敗: $pod_name"
        return 1
    fi
}

# セキュリティ違反Pod作成テスト
test_violation_pod_creation() {
    local pod_name="$1"
    local namespace="$2"
    local violation_type="$3"
    local description="$4"
    
    info "セキュリティ違反テスト: $description"
    
    # 既存Podのクリーンアップ
    kubectl delete pod "$pod_name" -n "$namespace" --ignore-not-found=true &> /dev/null
    
    local manifest=""
    case "$violation_type" in
        "privileged")
            manifest='
apiVersion: v1
kind: Pod
metadata:
  name: '$pod_name'
  namespace: '$namespace'
spec:
  containers:
  - name: privileged-container
    image: alpine:3.16
    command: ["sleep", "300"]
    securityContext:
      privileged: true
    resources:
      requests:
        memory: "64Mi"
        cpu: "125m"
      limits:
        memory: "128Mi"
        cpu: "250m"'
            ;;
        "root-user")
            manifest='
apiVersion: v1
kind: Pod
metadata:
  name: '$pod_name'
  namespace: '$namespace'
spec:
  containers:
  - name: root-container
    image: alpine:3.16
    command: ["sleep", "300"]
    securityContext:
      runAsUser: 0
    resources:
      requests:
        memory: "64Mi"
        cpu: "125m"
      limits:
        memory: "128Mi"
        cpu: "250m"'
            ;;
        "privilege-escalation")
            manifest='
apiVersion: v1
kind: Pod
metadata:
  name: '$pod_name'
  namespace: '$namespace'
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: escalation-container
    image: alpine:3.16
    command: ["sleep", "300"]
    securityContext:
      allowPrivilegeEscalation: true
    resources:
      requests:
        memory: "64Mi"
        cpu: "125m"
      limits:
        memory: "128Mi"
        cpu: "250m"'
            ;;
        "host-network")
            manifest='
apiVersion: v1
kind: Pod
metadata:
  name: '$pod_name'
  namespace: '$namespace'
spec:
  hostNetwork: true
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: host-network-container
    image: alpine:3.16
    command: ["sleep", "300"]
    resources:
      requests:
        memory: "64Mi"
        cpu: "125m"
      limits:
        memory: "128Mi"
        cpu: "250m"'
            ;;
    esac
    
    # Pod作成試行
    if echo "$manifest" | kubectl apply -f - &> /dev/null; then
        warning "  Pod作成成功（違反が検出されませんでした）: $pod_name"
        return 1
    else
        success "  Pod作成拒否（正常）: $pod_name"
        
        # エラー詳細を表示
        local error_msg=$(echo "$manifest" | kubectl apply -f - 2>&1 | head -1)
        echo "    エラー: $error_msg"
        return 0
    fi
}

# Pod内実行権限確認
test_pod_runtime_security() {
    local pod_name="$1"
    local namespace="$2"
    local description="$3"
    
    info "Pod実行時セキュリティ確認: $description"
    
    if ! kubectl get pod "$pod_name" -n "$namespace" &> /dev/null; then
        warning "Pod '$pod_name' が存在しません"
        return 1
    fi
    
    # Pod Ready状態確認
    if ! kubectl wait --for=condition=Ready pod/"$pod_name" -n "$namespace" --timeout=10s &> /dev/null; then
        warning "Pod '$pod_name' がReady状態ではありません"
        return 1
    fi
    
    # 実行ユーザー確認
    local current_user=$(kubectl exec "$pod_name" -n "$namespace" -- id -u 2>/dev/null || echo "unknown")
    local current_group=$(kubectl exec "$pod_name" -n "$namespace" -- id -g 2>/dev/null || echo "unknown")
    echo "  現在のユーザー: $current_user"
    echo "  現在のグループ: $current_group"
    
    # ファイルシステム権限確認
    if kubectl exec "$pod_name" -n "$namespace" -- touch /test-write 2>/dev/null; then
        warning "  ルートファイルシステムに書き込み可能"
        kubectl exec "$pod_name" -n "$namespace" -- rm -f /test-write 2>/dev/null || true
    else
        success "  ルートファイルシステムは読み取り専用"
    fi
    
    # Capability確認
    if command -v capsh &> /dev/null; then
        local capabilities=$(kubectl exec "$pod_name" -n "$namespace" -- capsh --print 2>/dev/null | grep "Current:" || echo "確認できません")
        echo "  現在のCapability: $capabilities"
    else
        echo "  Capability確認: capshコマンドが利用できません"
    fi
    
    echo
}

# AWS ECS比較表示
show_ecs_comparison() {
    info "AWS ECS vs Kubernetes Pod Security 比較"
    cat << 'EOF'
====================================================

🔄 セキュリティ設定の比較:

┌─────────────────────┬─────────────────────┬─────────────────────┐
│      設定項目       │      AWS ECS        │     Kubernetes      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 実行ユーザー        │ Task Definition     │ securityContext     │
│                     │ "user": "1000:1000" │ runAsUser: 1000     │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 特権モード          │ "privileged": true  │ privileged: true    │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 読み取り専用FS      │ readonlyRootFilesys │ readOnlyRootFilesys │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ Capability制御      │ security-opt        │ capabilities        │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ ネットワークモード  │ networkMode         │ hostNetwork         │
└─────────────────────┴─────────────────────┴─────────────────────┘

📋 移行時の考慮点:
1. ECS Task Definition → K8s securityContext
2. ECS Security Groups → K8s NetworkPolicy  
3. ECS IAM Task Role → K8s ServiceAccount + RBAC
4. CloudWatch Logs → K8s Logging + Monitoring

EOF
}

# メイン処理
main() {
    echo -e "${BLUE}🔐 Pod Security Standards テスト実行${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    # 前提条件チェック
    info "前提条件をチェックしています..."
    
    required_namespaces=("development" "staging" "production" "security-test" "financial-app")
    for ns in "${required_namespaces[@]}"; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            warning "Namespace '$ns' が存在しません。01-namespace-pss.yamlを先に適用してください。"
        fi
    done
    echo
    
    # Namespace Pod Security Standards設定確認
    info "=== Namespace Pod Security Standards設定確認 ==="
    check_namespace_pss "development" "開発環境 (Baseline)"
    check_namespace_pss "staging" "ステージング環境 (Baseline enforce, Restricted audit)"
    check_namespace_pss "production" "本番環境 (Restricted)"
    check_namespace_pss "financial-app" "金融アプリ (Maximum Security)"
    check_namespace_pss "security-test" "セキュリティテスト (Privileged)"
    
    # セキュアなPod作成テスト
    info "=== セキュアなPod作成テスト ==="
    test_secure_pod_creation "secure-test-dev" "development" "開発環境でのBaselineレベル準拠Pod"
    test_secure_pod_creation "secure-test-prod" "production" "本番環境でのRestrictedレベル準拠Pod"
    test_secure_pod_creation "secure-test-financial" "financial-app" "金融アプリでの最高セキュリティPod"
    echo
    
    # セキュリティ違反テスト
    info "=== セキュリティ違反テスト ==="
    test_violation_pod_creation "violation-privileged" "production" "privileged" "特権コンテナ（本番環境）"
    test_violation_pod_creation "violation-root" "development" "root-user" "Rootユーザー（開発環境）"
    test_violation_pod_creation "violation-escalation" "staging" "privilege-escalation" "特権エスカレーション（ステージング）"
    test_violation_pod_creation "violation-hostnet" "production" "host-network" "ホストネットワーク（本番環境）"
    echo
    
    # 正常動作確認（Privileged Namespace）
    info "=== Privileged Namespace動作確認 ==="
    test_secure_pod_creation "privileged-test" "security-test" "セキュリティテスト環境でのPod"
    echo
    
    # Pod実行時セキュリティ確認
    info "=== Pod実行時セキュリティ確認 ==="
    test_pod_runtime_security "secure-test-dev" "development" "開発環境Pod"
    test_pod_runtime_security "secure-test-prod" "production" "本番環境Pod"
    test_pod_runtime_security "secure-test-financial" "financial-app" "金融アプリPod"
    
    # AWS ECS比較
    show_ecs_comparison
    
    # 次のステップ
    info "=== 次のステップ ==="
    echo "✅ Pod Security Standards の動作を確認しました"
    echo "📝 Phase 3: NetworkPolicy によるネットワークセキュリティに進んでください"
    echo "   cd ../phase3-network-policy"
    echo
    echo "🔧 トラブルシューティング:"
    echo "- Pod Security違反: kubectl describe pod <pod-name> -n <namespace>"
    echo "- Namespace設定確認: kubectl get namespace <namespace> -o yaml"
    echo "- イベント確認: kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp"
    echo
    
    # クリーンアップオプション
    if [[ "${1:-}" == "--cleanup" ]]; then
        info "テスト用Podをクリーンアップしています..."
        
        test_pods=("secure-test-dev" "secure-test-prod" "secure-test-financial" "privileged-test")
        for pod in "${test_pods[@]}"; do
            kubectl delete pod "$pod" --all-namespaces --ignore-not-found=true &> /dev/null
        done
        
        success "クリーンアップ完了"
    fi
}

# 引数処理
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "使用方法: $0 [--cleanup] [--help]"
    echo "  --cleanup: テスト用Podをクリーンアップ"
    echo "  --help:    このヘルプメッセージを表示"
    exit 0
fi

# スクリプト実行
main "$@"
