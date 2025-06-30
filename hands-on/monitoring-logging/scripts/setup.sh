#!/bin/bash

# setup.sh - Kubernetesモニタリング・ロギング学習環境セットアップスクリプト

set -e

# 色付きメッセージ関数
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# バナー表示
cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║        Kubernetesモニタリング・ロギング学習環境構築        ║
║                    セットアップスクリプト                    ║
╚══════════════════════════════════════════════════════════════╝
EOF

print_info "環境セットアップを開始します..."

# 必要なツールの確認
print_info "必要なツールの確認..."

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 インストール済み ($(command -v $1))"
        return 0
    else
        print_error "$1 がインストールされていません"
        return 1
    fi
}

MISSING_TOOLS=0

# kubectl確認
if ! check_command kubectl; then
    MISSING_TOOLS=1
    print_info "kubectl インストール: https://kubernetes.io/docs/tasks/tools/"
fi

# docker確認
if ! check_command docker; then
    MISSING_TOOLS=1
    print_info "Docker インストール: https://docs.docker.com/get-docker/"
fi

# helm確認（オプショナル）
if ! check_command helm; then
    print_warning "Helm が見つかりません（Phase 4で必要）"
    print_info "Helm インストール: https://helm.sh/docs/intro/install/"
fi

# jq確認（オプショナル）
if ! check_command jq; then
    print_warning "jq が見つかりません（JSON解析で便利）"
    print_info "jq インストール: https://stedolan.github.io/jq/download/"
fi

if [ $MISSING_TOOLS -eq 1 ]; then
    print_error "必須ツールが不足しています。上記URLを参照してインストールしてください。"
    exit 1
fi

# Kubernetesクラスター接続確認
print_info "Kubernetesクラスター接続確認..."
if kubectl cluster-info &> /dev/null; then
    CLUSTER_INFO=$(kubectl cluster-info | head -1)
    print_success "Kubernetesクラスターに接続済み"
    print_info "クラスター情報: $CLUSTER_INFO"
    
    # ノード情報表示
    NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
    print_info "ノード数: $NODE_COUNT"
    kubectl get nodes -o wide
else
    print_error "Kubernetesクラスターに接続できません"
    print_info "以下のいずれかでクラスターを準備してください:"
    print_info "  - Minikube: minikube start"
    print_info "  - Kind: kind create cluster"
    print_info "  - Docker Desktop: Kubernetesを有効化"
    print_info "  - 外部クラスター: kubeconfigを設定"
    exit 1
fi

# リソース要件確認
print_info "クラスターリソース確認..."
TOTAL_CPU=$(kubectl top nodes 2>/dev/null | tail -n +2 | awk '{sum += substr($3, 1, length($3)-1)} END {print sum}' || echo "0")
TOTAL_MEMORY=$(kubectl top nodes 2>/dev/null | tail -n +2 | awk '{
    mem=$5; 
    if(mem ~ /Gi$/) sum += substr(mem, 1, length(mem)-2) * 1024; 
    else if(mem ~ /Mi$/) sum += substr(mem, 1, length(mem)-2);
    } END {print sum}' || echo "0")

if [ "$TOTAL_CPU" -eq 0 ] || [ "$TOTAL_MEMORY" -eq 0 ]; then
    print_warning "Metrics Serverが利用できません（kubectl top が使用不可）"
    print_info "Phase 4で Metrics Server をセットアップします"
else
    print_info "使用中リソース: CPU ${TOTAL_CPU}m, Memory ${TOTAL_MEMORY}Mi"
fi

# 推奨リソース確認
print_info "推奨リソース要件:"
print_info "  - CPU: 4コア以上"
print_info "  - Memory: 8GB以上"
print_info "  - ストレージ: 20GB以上の空き容量"

# ネームスペース準備
print_info "学習用ネームスペースの準備..."

NAMESPACES=("monitoring-app" "logging" "monitoring")

for ns in "${NAMESPACES[@]}"; do
    if kubectl get namespace $ns &> /dev/null; then
        print_warning "ネームスペース '$ns' は既に存在します"
    else
        kubectl create namespace $ns
        print_success "ネームスペース '$ns' を作成しました"
    fi
done

# ラベル付け
kubectl label namespace monitoring-app monitoring=enabled --overwrite
kubectl label namespace logging monitoring=enabled --overwrite  
kubectl label namespace monitoring monitoring=enabled --overwrite

print_success "ネームスペースの準備完了"

# Dockerイメージの事前準備
print_info "必要なDockerイメージの確認..."

IMAGES=(
    "busybox:latest"
    "postgres:13"
    "redis:6-alpine"
    "node:16-alpine"
    "nginx:1.21-alpine"
)

for image in "${IMAGES[@]}"; do
    print_info "イメージ確認: $image"
    if docker pull $image &> /dev/null; then
        print_success "$image 取得完了"
    else
        print_warning "$image の取得に失敗（後で再試行されます）"
    fi
done

# Phase 2のアプリケーションイメージビルド（オプション）
if [ -f "../phase2-sample-app/app/Dockerfile" ]; then
    print_info "サンプルアプリケーションイメージのビルド..."
    cd ../phase2-sample-app/app
    if docker build -t monitoring-webapp:v1 . &> /dev/null; then
        print_success "monitoring-webapp:v1 ビルド完了"
    else
        print_warning "アプリケーションイメージビルドに失敗（Phase 2で再試行可能）"
    fi
    cd - > /dev/null
fi

# 設定確認
print_info "設定確認とテスト..."

# 基本的なPodテスト
TEST_POD_NAME="setup-test-pod"
kubectl run $TEST_POD_NAME --image=busybox --restart=Never --rm -i --tty=false -- echo "Hello Kubernetes" &> /dev/null
if [ $? -eq 0 ]; then
    print_success "Pod作成・実行テスト成功"
else
    print_error "Pod作成・実行テストに失敗"
fi

# ストレージクラス確認
print_info "利用可能なStorageClass:"
kubectl get storageclass
DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
if [ -n "$DEFAULT_SC" ]; then
    print_success "デフォルトStorageClass: $DEFAULT_SC"
else
    print_warning "デフォルトStorageClassが設定されていません"
fi

# 学習ガイド表示
print_success "セットアップ完了！"
echo ""
print_info "次のステップ:"
print_info "1. Phase 1から学習を開始:"
print_info "   cd phase1-basic-logging"
print_info "   cat README.md"
print_info ""
print_info "2. 各Phaseの学習順序:"
print_info "   Phase 1: 基本ログ操作マスター (60-90分)"
print_info "   Phase 2: サンプルアプリケーション (90-120分)"
print_info "   Phase 3: クラスターレベルロギング (120-150分)"
print_info "   Phase 4: Prometheusモニタリング (120-150分)"
print_info "   Phase 5: アラート・トラブルシューティング (90-120分)"
print_info ""
print_info "3. 困った時は:"
print_info "   ./scripts/check-cluster.sh  # クラスター状態確認"
print_info "   ./scripts/cleanup.sh        # 環境クリーンアップ"
print_info "   docs/troubleshooting.md     # トラブルシューティング"

echo ""
print_success "Kubernetesモニタリング・ロギング学習の準備が完了しました！"
print_info "Happy Learning! 🚀"
