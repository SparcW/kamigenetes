#!/bin/bash
# Kubernetes学習ワークスペース - Markdown Server デプロイスクリプト

set -e

# 色付きログ用関数
log_info() {
    echo -e "\033[0;36m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

log_warning() {
    echo -e "\033[0;33m[WARNING]\033[0m $1"
}

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/k8s"

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェックしています..."
    
    # kubectl コマンドの確認
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl コマンドが見つかりません"
        exit 1
    fi
    
    # minikube の確認
    if ! command -v minikube &> /dev/null; then
        log_error "minikube コマンドが見つかりません"
        exit 1
    fi
    
    # minikube の状態確認
    if ! minikube status &> /dev/null; then
        log_warning "minikube が起動していません。起動しますか？ (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            log_info "minikube を起動しています..."
            minikube start
        else
            log_error "minikube が必要です"
            exit 1
        fi
    fi
    
    # Docker環境の確認
    if ! command -v docker &> /dev/null; then
        log_error "Docker コマンドが見つかりません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# Dockerイメージをビルド
build_docker_image() {
    log_info "Dockerイメージをビルドしています..."
    
    # minikube Docker環境を使用
    eval $(minikube docker-env)
    
    # イメージビルド
    docker build -t k8s-markdown-server:latest "${SCRIPT_DIR}"
    
    if [ $? -eq 0 ]; then
        log_success "Dockerイメージビルド完了"
    else
        log_error "Dockerイメージビルドに失敗しました"
        exit 1
    fi
}

# Kubernetesリソースのデプロイ
deploy_kubernetes_resources() {
    log_info "Kubernetesリソースをデプロイしています..."
    
    # ネームスペース作成
    log_info "ネームスペースを作成しています..."
    kubectl apply -f "${K8S_DIR}/namespace.yaml"
    
    # ConfigMap適用
    log_info "ConfigMapを適用しています..."
    kubectl apply -f "${K8S_DIR}/configmap.yaml"
    
    # Deployment適用
    log_info "Deploymentを適用しています..."
    kubectl apply -f "${K8S_DIR}/deployment.yaml"
    
    # Service適用
    log_info "Serviceを適用しています..."
    kubectl apply -f "${K8S_DIR}/service.yaml"
    
    log_success "Kubernetesリソースデプロイ完了"
}

# デプロイメント状態確認
check_deployment_status() {
    log_info "デプロイメント状態を確認しています..."
    
    # Pod起動待機
    log_info "Podの起動を待機しています..."
    kubectl wait --for=condition=available --timeout=300s deployment/markdown-server -n k8s-docs
    
    # Pod状態確認
    log_info "Pod状態:"
    kubectl get pods -n k8s-docs -l app=markdown-server
    
    # Service状態確認
    log_info "Service状態:"
    kubectl get svc -n k8s-docs
    
    log_success "デプロイメント状態確認完了"
}

# サービスURLを取得して表示
get_service_url() {
    log_info "サービスURLを取得しています..."
    
    # minikube service URLを取得
    SERVICE_URL=$(minikube service markdown-server-service --url -n k8s-docs)
    
    if [ -n "$SERVICE_URL" ]; then
        log_success "📖 Kubernetes学習ドキュメントサーバーが利用可能です"
        echo ""
        echo "🌐 アクセスURL: $SERVICE_URL"
        echo "📁 ドキュメントパス: <path-to->/kamigenates/docs"
        echo "📊 機能: Markdown表示 + Mermaid図表サポート"
        echo ""
        log_info "ブラウザでアクセスしてください"
    else
        log_error "サービスURLの取得に失敗しました"
    fi
}

# クリーンアップ関数
cleanup() {
    log_warning "リソースをクリーンアップしますか？ (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "リソースをクリーンアップしています..."
        kubectl delete namespace k8s-docs --ignore-not-found=true
        log_success "クリーンアップ完了"
    fi
}

# ヘルプ表示
show_help() {
    cat << EOF
Kubernetes学習ワークスペース - Markdown Server デプロイスクリプト

使用方法:
    $0 [COMMAND]

コマンド:
    deploy      全体デプロイ（デフォルト）
    build       Dockerイメージビルドのみ
    apply       Kubernetesリソース適用のみ
    status      デプロイメント状態確認
    url         サービスURL表示
    cleanup     リソース削除
    help        このヘルプを表示

例:
    $0                  # 全体デプロイ
    $0 deploy           # 全体デプロイ
    $0 build            # イメージビルドのみ
    $0 cleanup          # リソース削除

EOF
}

# メイン処理
main() {
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            build_docker_image
            deploy_kubernetes_resources
            check_deployment_status
            get_service_url
            ;;
        "build")
            check_prerequisites
            build_docker_image
            ;;
        "apply")
            check_prerequisites
            deploy_kubernetes_resources
            ;;
        "status")
            check_deployment_status
            ;;
        "url")
            get_service_url
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "無効なコマンド: $1"
            show_help
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"
