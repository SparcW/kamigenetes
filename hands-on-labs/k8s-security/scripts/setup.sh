#!/bin/bash

# Kubernetesセキュリティ演習環境セットアップスクリプト
# AWS ECS管理者向けKubernetes学習環境

set -euo pipefail

echo "🔐 Kubernetesセキュリティ演習環境をセットアップしています..."

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# エラーハンドリング
error_exit() {
    echo -e "${RED}❌ エラー: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 前提条件チェック
check_prerequisites() {
    info "前提条件をチェックしています..."
    
    # kubectl の確認
    if ! command -v kubectl &> /dev/null; then
        error_exit "kubectl がインストールされていません"
    fi
    
    # minikube の確認
    if ! command -v minikube &> /dev/null; then
        warning "minikube がインストールされていません。ローカル環境での演習には推奨されます"
    fi
    
    # Kubernetes クラスターの確認
    if ! kubectl cluster-info &> /dev/null; then
        error_exit "Kubernetesクラスターに接続できません。'kubectl cluster-info' を確認してください"
    fi
    
    success "前提条件チェック完了"
}

# セキュリティ演習用Namespaceの作成
create_namespaces() {
    info "セキュリティ演習用Namespaceを作成しています..."
    
    # 演習用Namespace
    kubectl apply -f - <<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  name: security-demo
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: Namespace
metadata:
  name: frontend
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: Namespace
metadata:
  name: backend
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: Namespace
metadata:
  name: database
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
EOF
    
    success "Namespace作成完了"
}

# セキュリティツールのインストール確認
check_security_tools() {
    info "セキュリティツールの確認..."
    
    # Falco (Runtime Security)
    if ! command -v falco &> /dev/null; then
        warning "Falco がインストールされていません。Phase 5で手動インストールします"
    fi
    
    # Trivy (Vulnerability Scanner)
    if ! command -v trivy &> /dev/null; then
        warning "Trivy がインストールされていません。Phase 5で手動インストールします"
    fi
    
    # kube-bench (CIS Benchmark)
    if ! command -v kube-bench &> /dev/null; then
        warning "kube-bench がインストールされていません。Phase 5で手動インストールします"
    fi
    
    success "セキュリティツールチェック完了"
}

# NetworkPolicy サポートの確認とCNI設定
setup_network_policy() {
    info "NetworkPolicy サポートを確認しています..."
    
    # minikube の場合、Calico アドオンを有効化
    if command -v minikube &> /dev/null && minikube status &> /dev/null; then
        info "minikube環境でCalico CNIを有効化しています..."
        minikube addons enable calico || warning "Calico有効化に失敗。NetworkPolicy演習が制限される可能性があります"
        success "Calico CNI有効化完了"
    else
        warning "minikube以外の環境です。NetworkPolicy サポートがあることを確認してください"
    fi
}

# 演習用サンプルアプリのイメージ準備
prepare_sample_images() {
    info "演習用サンプルアプリのイメージを準備しています..."
    
    # minikube の場合、Docker環境を設定
    if command -v minikube &> /dev/null && minikube status &> /dev/null; then
        eval $(minikube docker-env) || warning "minikube Docker環境の設定に失敗"
    fi
    
    success "サンプルイメージ準備完了"
}

# 権限確認
check_permissions() {
    info "現在のユーザー権限を確認しています..."
    
    # 基本的な権限チェック
    if kubectl auth can-i create pods --all-namespaces &> /dev/null; then
        success "Pod作成権限あり"
    else
        warning "Pod作成権限が制限されています"
    fi
    
    if kubectl auth can-i create serviceaccounts --all-namespaces &> /dev/null; then
        success "ServiceAccount作成権限あり"
    else
        warning "ServiceAccount作成権限が制限されています"
    fi
    
    if kubectl auth can-i create roles --all-namespaces &> /dev/null; then
        success "Role作成権限あり"
    else
        warning "Role作成権限が制限されています。RBAC演習が制限される可能性があります"
    fi
}

# セットアップ完了メッセージ
show_completion_message() {
    echo
    echo "🎉 セットアップが完了しました！"
    echo
    echo "📋 次のステップ:"
    echo "1. 環境チェック: ./scripts/check-environment.sh"
    echo "2. Phase 1開始: cd phase1-rbac && ./test-rbac.sh"
    echo
    echo "📚 参考資料:"
    echo "- 理論学習: ../../guides/13-kubernetes-security-comprehensive.md"
    echo "- AWS ECS比較: ../../guides/02-ecs-vs-kubernetes.md"
    echo
    echo "🔗 有用なコマンド:"
    echo "- kubectl get namespaces"
    echo "- kubectl auth can-i --list"
    echo "- kubectl get networkpolicies --all-namespaces"
    echo
}

# メイン処理
main() {
    echo -e "${BLUE}🔐 Kubernetesセキュリティ演習環境セットアップ${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    check_prerequisites
    create_namespaces
    setup_network_policy
    check_security_tools
    prepare_sample_images
    check_permissions
    
    show_completion_message
}

# スクリプト実行
main "$@"
