#!/bin/bash

# check-cluster.sh - Kubernetesクラスター状態確認スクリプト

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
║            Kubernetesクラスター状態確認スクリプト            ║
╚══════════════════════════════════════════════════════════════╝
EOF

print_info "クラスター状態確認を開始します..."

# Kubernetesクラスター基本情報
print_info "=== Kubernetesクラスター基本情報 ==="
if kubectl cluster-info &> /dev/null; then
    kubectl cluster-info
    echo ""
    
    # バージョン情報
    print_info "Kubernetesバージョン:"
    kubectl version --short 2>/dev/null || kubectl version --client
    echo ""
else
    print_error "Kubernetesクラスターに接続できません"
    exit 1
fi

# ノード情報
print_info "=== ノード情報 ==="
kubectl get nodes -o wide
echo ""

# ノード状態詳細
print_info "ノード状態詳細:"
kubectl describe nodes | grep -E "(Name:|Roles:|Taints:|Conditions:)" | head -20
echo ""

# リソース使用状況
print_info "=== リソース使用状況 ==="
if kubectl top nodes &> /dev/null; then
    print_success "Metrics Server が利用可能です"
    kubectl top nodes
    echo ""
    
    print_info "Pod別リソース使用量 (TOP 10):"
    kubectl top pods --all-namespaces --sort-by=cpu | head -11
    echo ""
else
    print_warning "Metrics Server が利用できません"
    print_info "kubectl top コマンドが使用できません"
    echo ""
fi

# ネームスペース情報
print_info "=== ネームスペース情報 ==="
kubectl get namespaces
echo ""

# 学習用ネームスペースの詳細
LEARNING_NAMESPACES=("monitoring-app" "logging" "monitoring")
for ns in "${LEARNING_NAMESPACES[@]}"; do
    if kubectl get namespace $ns &> /dev/null; then
        print_success "学習用ネームスペース '$ns' 存在確認"
        PODS=$(kubectl get pods -n $ns --no-headers 2>/dev/null | wc -l)
        print_info "  Pod数: $PODS"
    else
        print_warning "学習用ネームスペース '$ns' が存在しません"
        print_info "  作成コマンド: kubectl create namespace $ns"
    fi
done
echo ""

# ストレージクラス
print_info "=== ストレージクラス ==="
kubectl get storageclass
echo ""

DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
if [ -n "$DEFAULT_SC" ]; then
    print_success "デフォルトStorageClass: $DEFAULT_SC"
else
    print_warning "デフォルトStorageClassが設定されていません"
fi
echo ""

# PersistentVolume情報
print_info "=== PersistentVolume情報 ==="
PV_COUNT=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
if [ $PV_COUNT -gt 0 ]; then
    kubectl get pv
else
    print_info "PersistentVolumeはありません"
fi
echo ""

# 現在稼働中のPod一覧
print_info "=== 稼働中Pod一覧 ==="
kubectl get pods --all-namespaces -o wide | grep -v "kube-system\|kube-public\|kube-node-lease" || print_info "ユーザーPodはありません"
echo ""

# サービス一覧
print_info "=== サービス一覧 ==="
kubectl get services --all-namespaces | grep -v "kube-system\|kube-public" || print_info "ユーザーサービスはありません"
echo ""

# イベント履歴（直近10件）
print_info "=== 最近のイベント ==="
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | tail -10
echo ""

# リソース制限・要求確認
print_info "=== リソース制限・要求確認 ==="
print_info "CPU・メモリ制限が設定されているPod:"
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.spec.containers[*].resources}{"\n"}{end}' | grep -v "{}" | head -5 || print_info "制限設定なし"
echo ""

# ネットワークポリシー
print_info "=== ネットワークポリシー ==="
NP_COUNT=$(kubectl get networkpolicy --all-namespaces --no-headers 2>/dev/null | wc -l)
if [ $NP_COUNT -gt 0 ]; then
    kubectl get networkpolicy --all-namespaces
else
    print_info "ネットワークポリシーはありません"
fi
echo ""

# 学習フェーズ別チェック
print_info "=== 学習フェーズ別状態確認 ==="

# Phase 1関連
PHASE1_PODS=$(kubectl get pods --all-namespaces -l phase=basic-logging --no-headers 2>/dev/null | wc -l)
if [ $PHASE1_PODS -gt 0 ]; then
    print_success "Phase 1 (基本ログ操作) - アクティブなPod: $PHASE1_PODS個"
else
    print_info "Phase 1 (基本ログ操作) - アクティブなPodなし"
fi

# Phase 2関連
PHASE2_PODS=$(kubectl get pods -n monitoring-app --no-headers 2>/dev/null | wc -l)
if [ $PHASE2_PODS -gt 0 ]; then
    print_success "Phase 2 (サンプルアプリ) - monitoring-app namespace: $PHASE2_PODS個のPod"
else
    print_info "Phase 2 (サンプルアプリ) - monitoring-app namespaceにPodなし"
fi

# Phase 3関連 (EFK)
EFK_PODS=$(kubectl get pods -n logging --no-headers 2>/dev/null | wc -l)
if [ $EFK_PODS -gt 0 ]; then
    print_success "Phase 3 (EFKスタック) - logging namespace: $EFK_PODS個のPod"
else
    print_info "Phase 3 (EFKスタック) - logging namespaceにPodなし"
fi

# Phase 4関連 (Prometheus/Grafana)
MONITORING_PODS=$(kubectl get pods -n monitoring --no-headers 2>/dev/null | wc -l)
if [ $MONITORING_PODS -gt 0 ]; then
    print_success "Phase 4 (Prometheus/Grafana) - monitoring namespace: $MONITORING_PODS個のPod"
else
    print_info "Phase 4 (Prometheus/Grafana) - monitoring namespaceにPodなし"
fi

echo ""

# 推奨事項とトラブルシューティング
print_info "=== 推奨事項 ==="

# CPU・メモリチェック
if command -v free &> /dev/null; then
    TOTAL_MEMORY=$(free -m | awk 'NR==2{printf "%d", $2}')
    if [ $TOTAL_MEMORY -lt 8192 ]; then
        print_warning "システムメモリが8GB未満です ($((TOTAL_MEMORY))MB)"
        print_info "  推奨: 8GB以上のメモリ"
    else
        print_success "十分なメモリがあります ($((TOTAL_MEMORY))MB)"
    fi
fi

# ディスク容量チェック
if command -v df &> /dev/null; then
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 80 ]; then
        print_warning "ディスク使用率が高いです (${DISK_USAGE}%)"
        print_info "  推奨: 20GB以上の空き容量"
    else
        print_success "十分なディスク容量があります (使用率: ${DISK_USAGE}%)"
    fi
fi

echo ""
print_info "=== 次のアクション ==="
print_info "1. 環境が正常でない場合:"
print_info "   ./scripts/cleanup.sh   # 環境をクリーンアップ"
print_info "   ./scripts/setup.sh     # 再セットアップ"
print_info ""
print_info "2. 学習を始める場合:"
print_info "   cd phase1-basic-logging"
print_info "   cat README.md"
print_info ""
print_info "3. 問題が発生した場合:"
print_info "   docs/troubleshooting.md を確認"

print_success "クラスター状態確認完了"
