#!/bin/bash

# Gateway API Phase 1 セットアップスクリプト
# 基本的なGateway API環境のセットアップを行います

set -e

echo "🚀 Gateway API Phase 1 セットアップを開始します..."

# 色付きの出力用関数
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# 前提条件の確認
check_prerequisites() {
    print_status "前提条件を確認中..."
    
    # kubectl の確認
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl が見つかりません。Kubernetesクライアントをインストールしてください。"
        exit 1
    fi
    
    # Kubernetesクラスターへの接続確認
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Kubernetesクラスターに接続できません。kubeconfig を確認してください。"
        exit 1
    fi
    
    print_success "前提条件の確認が完了しました"
}

# Gateway API CRDのインストール
install_gateway_api_crds() {
    print_status "Gateway API CRDをインストール中..."
    
    # Gateway API CRDが既にインストールされているかチェック
    if kubectl get crd gatewayclasses.gateway.networking.k8s.io &> /dev/null; then
        print_warning "Gateway API CRDは既にインストールされています"
    else
        # Gateway API CRDをインストール
        kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v0.8.1/standard-install.yaml
        print_success "Gateway API CRDのインストールが完了しました"
    fi
    
    # CRDが利用可能になるまで待機
    print_status "Gateway API CRDが利用可能になるまで待機中..."
    kubectl wait --for condition=established --timeout=60s crd/gatewayclasses.gateway.networking.k8s.io
    kubectl wait --for condition=established --timeout=60s crd/gateways.gateway.networking.k8s.io
    kubectl wait --for condition=established --timeout=60s crd/httproutes.gateway.networking.k8s.io
    print_success "Gateway API CRDが利用可能になりました"
}

# NGINX Gateway Controllerのインストール（デモ用）
install_nginx_gateway_controller() {
    print_status "NGINX Gateway Controller（デモ用）をインストール中..."
    
    # NGINX Gateway Controllerの名前空間作成
    kubectl create namespace nginx-gateway || echo "namespace nginx-gateway already exists"
    
    # デモ用のシンプルなNGINX Gatewayコントローラーをデプロイ
    # 注意: これは本番用ではありません。本番では適切なGateway Controllerを使用してください。
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-gateway-controller
  namespace: nginx-gateway
  labels:
    app.kubernetes.io/name: nginx-gateway-controller
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: nginx-gateway-controller
  template:
    metadata:
      labels:
        app.kubernetes.io/name: nginx-gateway-controller
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
        - containerPort: 443
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-gateway-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-gateway-config
  namespace: nginx-gateway
data:
  nginx.conf: |
    events {
        worker_connections 1024;
    }
    http {
        include /etc/nginx/mime.types;
        default_type application/octet-stream;
        
        log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                        '\$status \$body_bytes_sent "\$http_referer" '
                        '"\$http_user_agent" "\$http_x_forwarded_for"';
        
        access_log /var/log/nginx/access.log main;
        
        # デモ用の設定
        server {
            listen 80 default_server;
            server_name _;
            
            location / {
                return 200 'NGINX Gateway Controller - Demo Mode\n';
                add_header Content-Type text/plain;
            }
            
            location /health {
                return 200 'OK\n';
                add_header Content-Type text/plain;
            }
        }
    }
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-gateway-controller
  namespace: nginx-gateway
spec:
  selector:
    app.kubernetes.io/name: nginx-gateway-controller
  ports:
  - name: http
    port: 80
    targetPort: 80
  - name: https
    port: 443
    targetPort: 443
  type: LoadBalancer
EOF
    
    print_success "NGINX Gateway Controller（デモ用）のインストールが完了しました"
}

# Phase 1リソースのデプロイ
deploy_phase1_resources() {
    print_status "Phase 1リソースをデプロイ中..."
    
    local MANIFEST_DIR="../manifests"
    
    # GatewayClassの作成
    print_status "GatewayClassを作成中..."
    kubectl apply -f "$MANIFEST_DIR/01-gatewayclass.yaml"
    
    # Gatewayの作成
    print_status "Gatewayを作成中..."
    kubectl apply -f "$MANIFEST_DIR/02-gateway.yaml"
    
    # サンプルアプリケーションのデプロイ
    print_status "サンプルアプリケーションをデプロイ中..."
    kubectl apply -f "$MANIFEST_DIR/03-sample-app.yaml"
    
    # HTTPRouteの作成
    print_status "HTTPRouteを作成中..."
    kubectl apply -f "$MANIFEST_DIR/04-httproute.yaml"
    
    print_success "Phase 1リソースのデプロイが完了しました"
}

# リソースの準備状況確認
wait_for_resources() {
    print_status "リソースの準備状況を確認中..."
    
    # Gatewayの準備完了を待機
    print_status "Gatewayの準備完了を待機中..."
    kubectl wait --for=condition=Programmed --timeout=300s gateway/basic-gateway -n gateway-api-system
    
    # サンプルアプリケーションの準備完了を待機
    print_status "サンプルアプリケーションの準備完了を待機中..."
    kubectl wait --for=condition=available --timeout=300s deployment/frontend-app -n sample-apps
    kubectl wait --for=condition=available --timeout=300s deployment/api-app -n sample-apps
    
    print_success "すべてのリソースが準備完了しました"
}

# セットアップ状況の表示
show_setup_status() {
    print_status "セットアップ状況を表示中..."
    
    echo ""
    echo "🎯 Gateway API Phase 1 セットアップ完了"
    echo "=================================================="
    
    echo ""
    echo "📋 GatewayClass状況:"
    kubectl get gatewayclass -o wide
    
    echo ""
    echo "🚪 Gateway状況:"
    kubectl get gateway -n gateway-api-system -o wide
    
    echo ""
    echo "🛣️  HTTPRoute状況:"
    kubectl get httproute -n sample-apps -o wide
    
    echo ""
    echo "🏗️  サンプルアプリケーション状況:"
    kubectl get pods -n sample-apps -o wide
    kubectl get services -n sample-apps -o wide
    
    echo ""
    echo "🔍 アクセス情報:"
    echo "  HTTP: http://localhost (ポート転送が必要)"
    echo "  HTTPS: https://frontend.local (ポート転送が必要)"
    echo ""
    echo "📝 次のステップ:"
    echo "  1. ./test.sh を実行してテストを開始"
    echo "  2. kubectl port-forward でアクセス設定"
    echo "  3. Phase 2への移行準備"
    echo ""
}

# メイン実行
main() {
    check_prerequisites
    install_gateway_api_crds
    install_nginx_gateway_controller
    deploy_phase1_resources
    wait_for_resources
    show_setup_status
    
    print_success "🎉 Gateway API Phase 1 セットアップが正常に完了しました！"
}

# エラーハンドリング
trap 'print_error "セットアップ中にエラーが発生しました。ログを確認してください。"; exit 1' ERR

# スクリプト実行
main "$@"
