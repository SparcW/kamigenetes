#!/bin/bash

# Kubernetesセキュリティ演習環境チェックスクリプト
# 環境の正常性とセキュリティ設定を確認

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

# Kubernetes クラスター基本情報
check_cluster_info() {
    info "Kubernetesクラスター基本情報"
    echo "=================================="
    
    # バージョン情報
    echo "📋 クラスター情報:"
    kubectl cluster-info || error "クラスター情報取得失敗"
    echo
    
    echo "🏷️  バージョン情報:"
    kubectl version --short || warning "バージョン情報取得エラー"
    echo
    
    # ノード情報
    echo "🖥️  ノード情報:"
    kubectl get nodes -o wide || error "ノード情報取得失敗"
    echo
}

# Namespace確認
check_namespaces() {
    info "セキュリティ演習用Namespace確認"
    echo "=================================="
    
    required_namespaces=("security-demo" "frontend" "backend" "database")
    
    for ns in "${required_namespaces[@]}"; do
        if kubectl get namespace "$ns" &> /dev/null; then
            success "Namespace '$ns' が存在します"
            
            # Pod Security Standards確認
            labels=$(kubectl get namespace "$ns" -o jsonpath='{.metadata.labels}' 2>/dev/null || echo "{}")
            if echo "$labels" | grep -q "pod-security"; then
                success "  Pod Security Standards設定済み"
            else
                warning "  Pod Security Standards未設定"
            fi
        else
            error "Namespace '$ns' が存在しません"
        fi
    done
    echo
}

# RBAC権限確認
check_rbac_permissions() {
    info "RBAC権限確認"
    echo "=================================="
    
    # 基本的な権限チェック項目
    permissions=(
        "create pods"
        "create serviceaccounts"
        "create roles"
        "create rolebindings"
        "create clusterroles"
        "create clusterrolebindings"
        "create secrets"
        "create networkpolicies"
    )
    
    for perm in "${permissions[@]}"; do
        if kubectl auth can-i $perm --all-namespaces &> /dev/null; then
            success "$perm: 権限あり"
        else
            warning "$perm: 権限制限"
        fi
    done
    echo
}

# NetworkPolicy サポート確認
check_network_policy_support() {
    info "NetworkPolicy サポート確認"
    echo "=================================="
    
    # CNI情報確認
    echo "🌐 CNI情報:"
    kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.nodeInfo.containerRuntimeVersion}{"\n"}{end}' || warning "CNI情報取得エラー"
    
    # NetworkPolicy CRD確認
    if kubectl get crd networkpolicies.networking.k8s.io &> /dev/null; then
        success "NetworkPolicy CRD が存在します"
    else
        error "NetworkPolicy CRD が存在しません"
    fi
    
    # minikube Calico アドオン確認
    if command -v minikube &> /dev/null && minikube status &> /dev/null; then
        if minikube addons list | grep calico | grep -q enabled; then
            success "minikube Calico アドオンが有効です"
        else
            warning "minikube Calico アドオンが無効です。NetworkPolicy演習に影響する可能性があります"
            echo "  有効化コマンド: minikube addons enable calico"
        fi
    fi
    echo
}

# Pod Security Standards確認
check_pod_security() {
    info "Pod Security Standards確認"
    echo "=================================="
    
    # Admission Controller確認
    if kubectl get --raw="/api/v1" | grep -q "admission"; then
        success "Admission Controller API利用可能"
    else
        warning "Admission Controller API確認エラー"
    fi
    
    # Pod Security Admission確認
    kubectl get pods -n kube-system | grep -i "admission" || warning "Pod Security Admission Controller未確認"
    echo
}

# セキュリティツール確認
check_security_tools() {
    info "セキュリティツール確認"
    echo "=================================="
    
    tools=(
        "kubectl:✅ インストール済み"
        "docker:Docker/コンテナランタイム"
        "minikube:ローカル開発環境"
        "helm:パッケージ管理"
        "falco:ランタイムセキュリティ"
        "trivy:脆弱性スキャナー"
        "kube-bench:CISベンチマーク"
    )
    
    for tool_info in "${tools[@]}"; do
        tool=$(echo "$tool_info" | cut -d: -f1)
        desc=$(echo "$tool_info" | cut -d: -f2)
        
        if command -v "$tool" &> /dev/null; then
            version=$($tool version 2>/dev/null | head -1 || echo "バージョン不明")
            success "$tool: $desc ($version)"
        else
            warning "$tool: 未インストール ($desc)"
        fi
    done
    echo
}

# リソース使用状況確認
check_resource_usage() {
    info "リソース使用状況確認"
    echo "=================================="
    
    echo "📊 ノードリソース使用状況:"
    kubectl top nodes 2>/dev/null || warning "Metrics Serverが利用できません (kubectl top nodes)"
    
    echo
    echo "📊 Pod リソース使用状況:"
    kubectl top pods --all-namespaces 2>/dev/null || warning "Metrics Serverが利用できません (kubectl top pods)"
    echo
}

# セキュリティ関連リソース確認
check_security_resources() {
    info "既存のセキュリティ関連リソース"
    echo "=================================="
    
    echo "🔐 ServiceAccounts:"
    kubectl get serviceaccounts --all-namespaces | head -10
    echo
    
    echo "🔒 Roles:"
    kubectl get roles --all-namespaces | head -10
    echo
    
    echo "🌐 NetworkPolicies:"
    kubectl get networkpolicies --all-namespaces || warning "NetworkPolicy未設定または取得エラー"
    echo
    
    echo "🔑 Secrets:"
    kubectl get secrets --all-namespaces | head -10
    echo
}

# 演習準備状況確認
check_exercise_readiness() {
    info "演習準備状況確認"
    echo "=================================="
    
    # Phase別ディレクトリ確認
    phases=("phase1-rbac" "phase2-pod-security" "phase3-network-policy" "phase4-secrets" "phase5-security-scan")
    
    for phase in "${phases[@]}"; do
        if [ -d "../$phase" ]; then
            success "$phase ディレクトリ存在"
        else
            warning "$phase ディレクトリ未作成"
        fi
    done
    echo
}

# 推奨事項表示
show_recommendations() {
    info "推奨事項とトラブルシューティング"
    echo "=================================="
    
    echo "📝 推奨事項:"
    echo "1. Metrics Serverを有効化してリソース監視を改善"
    echo "   minikube addons enable metrics-server"
    echo
    echo "2. NetworkPolicy演習のためのCalico有効化"
    echo "   minikube addons enable calico"
    echo
    echo "3. セキュリティツールのインストール (Phase 5で実行)"
    echo "   - Falco: https://falco.org/docs/getting-started/installation/"
    echo "   - Trivy: https://trivy.dev/latest/getting-started/installation/"
    echo "   - kube-bench: https://github.com/aquasecurity/kube-bench"
    echo
    echo "🔧 トラブルシューティング:"
    echo "- 権限エラー: kubectl auth can-i --list でユーザー権限確認"
    echo "- NetworkPolicy未動作: CNIプラグイン (Calico) の確認"
    echo "- Pod起動失敗: Pod Security Standards設定の確認"
    echo
    echo "📚 参考資料:"
    echo "- セキュリティガイド: ../../guides/13-kubernetes-security-comprehensive.md"
    echo "- AWS ECS比較: ../../guides/02-ecs-vs-kubernetes.md"
    echo
}

# メイン処理
main() {
    echo -e "${BLUE}🔍 Kubernetesセキュリティ演習環境チェック${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    check_cluster_info
    check_namespaces
    check_rbac_permissions
    check_network_policy_support
    check_pod_security
    check_security_tools
    check_resource_usage
    check_security_resources
    check_exercise_readiness
    show_recommendations
    
    echo -e "${GREEN}🎯 環境チェック完了！演習を開始できます。${NC}"
    echo "最初の演習: cd phase1-rbac && ./test-rbac.sh"
}

# スクリプト実行
main "$@"
