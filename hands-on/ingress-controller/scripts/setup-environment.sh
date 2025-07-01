#!/bin/bash

# Ingress Controller ハンズオン演習 - セットアップスクリプト
# このスクリプトは演習環境の初期セットアップを行います

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

# 使用方法の表示
usage() {
    echo "使用方法: $0 [nginx|traefik|istio|aws|all]"
    echo ""
    echo "オプション:"
    echo "  nginx     - NGINX Ingress Controllerのセットアップ"
    echo "  traefik   - Traefikのセットアップ"
    echo "  istio     - Istioのセットアップ"
    echo "  aws       - AWS Load Balancer Controllerのセットアップ"
    echo "  all       - 全Ingressコントローラーのセットアップ"
    echo "  clean     - 全リソースのクリーンアップ"
    echo ""
}

# 前提条件の確認
check_prerequisites() {
    info "前提条件の確認中..."
    
    # kubectl の確認
    if ! command -v kubectl &> /dev/null; then
        error "kubectl が見つかりません"
        exit 1
    fi
    
    # Kubernetes クラスターの接続確認
    if ! kubectl cluster-info &> /dev/null; then
        error "Kubernetesクラスターに接続できません"
        exit 1
    fi
    
    # helm の確認
    if ! command -v helm &> /dev/null; then
        warning "helm が見つかりません。一部の機能が利用できない可能性があります"
    fi
    
    success "前提条件の確認完了"
}

# サンプルアプリケーションのデプロイ
deploy_sample_apps() {
    info "サンプルアプリケーションのデプロイ中..."
    
    # サンプルアプリディレクトリの作成
    mkdir -p sample-apps
    
    # Webアプリケーション
    cat > sample-apps/webapp.yaml << 'EOF'
# Webapp Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: webapp
  labels:
    ingress-demo: "true"
---
# Webapp Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-deployment
  namespace: webapp
  labels:
    app: webapp
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
      version: v1
  template:
    metadata:
      labels:
        app: webapp
        version: v1
    spec:
      containers:
      - name: webapp
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: webapp-content
          mountPath: /usr/share/nginx/html
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
      volumes:
      - name: webapp-content
        configMap:
          name: webapp-content
---
# Webapp Service
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
  namespace: webapp
  labels:
    app: webapp
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 80
    name: http
  type: ClusterIP
---
# Webapp Content
apiVersion: v1
kind: ConfigMap
metadata:
  name: webapp-content
  namespace: webapp
data:
  index.html: |
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kubernetes Ingress Demo - WebApp</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 800px; margin: 0 auto; text-align: center; }
            .version { background: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; margin: 20px 0; }
            .links { margin: 30px 0; }
            .links a { color: #fff; text-decoration: none; margin: 0 10px; padding: 10px 20px; background: rgba(255,255,255,0.2); border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Kubernetes Ingress Controller Demo</h1>
            <div class="version">
                <h2>WebApp v1.0</h2>
                <p>Hostname: <span id="hostname"></span></p>
                <p>Timestamp: <span id="timestamp"></span></p>
            </div>
            <div class="links">
                <a href="/api/v1/health">API v1 Health</a>
                <a href="/api/v2/health">API v2 Health</a>
                <a href="/admin">Admin Panel</a>
            </div>
        </div>
        <script>
            document.getElementById('hostname').textContent = window.location.hostname;
            document.getElementById('timestamp').textContent = new Date().toISOString();
        </script>
    </body>
    </html>
EOF
    
    # APIアプリケーション
    cat > sample-apps/api.yaml << 'EOF'
# API Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: api
  labels:
    ingress-demo: "true"
---
# API v1 Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-v1-deployment
  namespace: api
  labels:
    app: api
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
      version: v1
  template:
    metadata:
      labels:
        app: api
        version: v1
    spec:
      containers:
      - name: api
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: api-content
          mountPath: /usr/share/nginx/html
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
      volumes:
      - name: api-content
        configMap:
          name: api-v1-content
---
# API v1 Service
apiVersion: v1
kind: Service
metadata:
  name: api-v1-service
  namespace: api
  labels:
    app: api
    version: v1
spec:
  selector:
    app: api
    version: v1
  ports:
  - port: 80
    targetPort: 80
    name: http
  type: ClusterIP
---
# API v1 Content
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-v1-content
  namespace: api
data:
  index.html: |
    {
      "version": "v1.0.0",
      "service": "api",
      "endpoints": [
        "/health",
        "/users",
        "/products"
      ],
      "timestamp": "2025-01-01T00:00:00Z"
    }
  health: |
    {
      "status": "healthy",
      "version": "v1.0.0",
      "timestamp": "2025-01-01T00:00:00Z"
    }
EOF
    
    # デプロイ実行
    kubectl apply -f sample-apps/webapp.yaml
    kubectl apply -f sample-apps/api.yaml
    
    # デプロイメント完了待機
    kubectl wait --for=condition=available --timeout=60s deployment/webapp-deployment -n webapp
    kubectl wait --for=condition=available --timeout=60s deployment/api-v1-deployment -n api
    
    success "サンプルアプリケーションのデプロイ完了"
}

# NGINX Ingress Controllerのセットアップ
setup_nginx() {
    info "NGINX Ingress Controllerのセットアップ中..."
    
    # Helmリポジトリの追加
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # NGINX Ingress Controllerのインストール
    helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.metrics.enabled=true \
        --set controller.metrics.serviceMonitor.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"=true \
        --set controller.podAnnotations."prometheus\.io/port"=10254 \
        --set controller.service.type=LoadBalancer \
        --wait
    
    success "NGINX Ingress Controllerのセットアップ完了"
}

# Traefikのセットアップ
setup_traefik() {
    info "Traefikのセットアップ中..."
    
    # Helmリポジトリの追加
    helm repo add traefik https://helm.traefik.io/traefik
    helm repo update
    
    # Traefikのインストール
    helm upgrade --install traefik traefik/traefik \
        --namespace traefik-system \
        --create-namespace \
        --set dashboard.enabled=true \
        --set dashboard.ingressRoute.enabled=true \
        --set metrics.prometheus.enabled=true \
        --set service.type=LoadBalancer \
        --wait
    
    success "Traefikのセットアップ完了"
}

# Istioのセットアップ
setup_istio() {
    info "Istioのセットアップ中..."
    
    # istioctl の確認
    if ! command -v istioctl &> /dev/null; then
        warning "istioctl が見つかりません。Istioをダウンロードします..."
        
        # Istioのダウンロード
        curl -L https://istio.io/downloadIstio | sh -
        
        # PATH設定の案内
        echo "以下のコマンドを実行してPATHを設定してください："
        echo "export PATH=\$PWD/istio-*/bin:\$PATH"
        
        warning "istioctl設定後、再度このスクリプトを実行してください"
        return 1
    fi
    
    # Istioのインストール
    istioctl install --set values.defaultRevision=default -y
    
    # アドオンのインストール
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.19/samples/addons/prometheus.yaml
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.19/samples/addons/grafana.yaml
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.19/samples/addons/jaeger.yaml
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.19/samples/addons/kiali.yaml
    
    # webapp名前空間にIstio注入ラベルを追加
    kubectl label namespace webapp istio-injection=enabled --overwrite
    kubectl label namespace api istio-injection=enabled --overwrite
    
    # Podの再作成
    kubectl rollout restart deployment -n webapp
    kubectl rollout restart deployment -n api
    
    success "Istioのセットアップ完了"
}

# AWS Load Balancer Controllerのセットアップ
setup_aws() {
    info "AWS Load Balancer Controllerのセットアップ中..."
    
    # AWS環境の確認
    if ! kubectl get nodes -o jsonpath='{.items[0].spec.providerID}' | grep -q aws; then
        warning "AWS環境ではないため、AWS Load Balancer Controllerをスキップします"
        return 0
    fi
    
    # Helmリポジトリの追加
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    # AWS Load Balancer Controllerのインストール
    # 注意: 実際の環境では適切なIAMロールとクラスター名を設定してください
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
        --namespace kube-system \
        --set clusterName=my-cluster \
        --set serviceAccount.create=true \
        --set serviceAccount.name=aws-load-balancer-controller \
        --wait
    
    success "AWS Load Balancer Controllerのセットアップ完了"
}

# 全リソースのクリーンアップ
cleanup_all() {
    info "全リソースのクリーンアップ中..."
    
    # Helmリリースの削除
    helm uninstall nginx-ingress -n ingress-nginx 2>/dev/null || true
    helm uninstall traefik -n traefik-system 2>/dev/null || true
    helm uninstall aws-load-balancer-controller -n kube-system 2>/dev/null || true
    
    # Istioの削除
    if command -v istioctl &> /dev/null; then
        istioctl uninstall --purge -y 2>/dev/null || true
    fi
    
    # 名前空間の削除
    kubectl delete namespace webapp api ingress-nginx traefik-system istio-system 2>/dev/null || true
    
    # サンプルアプリの削除
    rm -rf sample-apps/
    
    success "クリーンアップ完了"
}

# メイン実行部分
main() {
    echo "🚀 Kubernetes Ingress Controller ハンズオン演習セットアップ"
    echo "============================================="
    
    case "${1:-all}" in
        "nginx")
            check_prerequisites
            deploy_sample_apps
            setup_nginx
            ;;
        "traefik")
            check_prerequisites
            deploy_sample_apps
            setup_traefik
            ;;
        "istio")
            check_prerequisites
            deploy_sample_apps
            setup_istio
            ;;
        "aws")
            check_prerequisites
            deploy_sample_apps
            setup_aws
            ;;
        "all")
            check_prerequisites
            deploy_sample_apps
            setup_nginx
            setup_traefik
            setup_istio
            setup_aws
            ;;
        "clean")
            cleanup_all
            ;;
        *)
            usage
            exit 1
            ;;
    esac
    
    echo ""
    echo "============================================="
    success "セットアップが完了しました！"
    
    if [[ "${1:-all}" != "clean" ]]; then
        echo ""
        info "次のステップ:"
        echo "1. 各PhaseのREADMEを参照して演習を開始してください"
        echo "2. kubectl get pods -A でPodの状態を確認してください"
        echo "3. kubectl get ingress -A でIngressの状態を確認してください"
        echo ""
        info "便利なコマンド:"
        echo "- ./scripts/test-phase.sh <phase-number> : 特定Phaseのテスト"
        echo "- ./scripts/debug-ingress.sh : Ingressの状態確認"
        echo "- ./scripts/collect-logs.sh : ログの収集"
    fi
}

# スクリプト実行
main "$@"
