#!/bin/bash

# AWS Load Balancer Controller テストスクリプト
# このスクリプトはAWS EKS環境でのALB統合をテストします

set -e

echo "🚀 AWS Load Balancer Controller テスト開始"
echo "=============================================="

# 色付きログ用関数
log_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

log_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # kubectl チェック
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl が見つかりません"
        exit 1
    fi
    
    # AWS CLI チェック
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI が見つかりません"
        exit 1
    fi
    
    # EKS接続確認
    if ! kubectl get nodes &> /dev/null; then
        log_error "EKSクラスターに接続できません"
        exit 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証が設定されていません"
        exit 1
    fi
    
    log_success "前提条件OK"
}

# AWS Load Balancer Controller状態確認
check_aws_lb_controller() {
    log_info "AWS Load Balancer Controller状態を確認中..."
    
    # Controller Pod状態確認
    if kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller &> /dev/null; then
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=aws-load-balancer-controller -n kube-system --timeout=300s
        log_success "AWS Load Balancer Controller が正常に動作中"
    else
        log_warning "AWS Load Balancer Controller が見つかりません"
        echo "以下のコマンドでインストールしてください:"
        echo "helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system --set clusterName=my-cluster"
    fi
    
    # IngressClass確認
    if kubectl get ingressclass alb &> /dev/null; then
        log_success "ALB IngressClass設定確認"
    else
        log_error "ALB IngressClass が見つかりません"
    fi
}

# サンプルアプリケーション状態確認
check_sample_apps() {
    log_info "サンプルアプリケーション状態を確認中..."
    
    # Namespace確認
    if ! kubectl get namespace webapp &> /dev/null; then
        log_warning "webappネームスペースが見つかりません"
        return 1
    fi
    
    # Pod状態確認
    kubectl wait --for=condition=ready pod -l app=webapp-frontend -n webapp --timeout=300s
    kubectl wait --for=condition=ready pod -l app=api-backend,version=v1 -n webapp --timeout=300s
    kubectl wait --for=condition=ready pod -l app=api-backend,version=v2 -n webapp --timeout=300s
    
    # Service確認
    kubectl get services -n webapp
    
    log_success "サンプルアプリケーションが正常に動作中"
}

# Ingress設定確認
check_ingress_configuration() {
    log_info "Ingress設定を確認中..."
    
    # Ingress一覧表示
    kubectl get ingress -n webapp
    
    # ALB作成状況確認
    if kubectl get ingress webapp-alb-ingress -n webapp &> /dev/null; then
        INGRESS_STATUS=$(kubectl get ingress webapp-alb-ingress -n webapp -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
        if [ ! -z "$INGRESS_STATUS" ]; then
            log_success "ALB作成完了: $INGRESS_STATUS"
            export ALB_HOSTNAME="$INGRESS_STATUS"
        else
            log_warning "ALB作成中です。しばらく待ってから再確認してください。"
        fi
    else
        log_error "webapp-alb-ingress が見つかりません"
    fi
    
    # Ingress詳細確認
    kubectl describe ingress webapp-alb-ingress -n webapp
}

# AWS ALB詳細情報確認
check_aws_alb_details() {
    log_info "AWS ALB詳細情報を確認中..."
    
    # ALB一覧取得
    ALB_ARNS=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `eks-webapp`) || contains(Tags[?Key==`kubernetes.io/cluster/my-cluster`].Value, `owned`)].LoadBalancerArn' --output text)
    
    if [ ! -z "$ALB_ARNS" ]; then
        log_success "ALB詳細情報:"
        for ALB_ARN in $ALB_ARNS; do
            aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].[LoadBalancerName,DNSName,State.Code,Type]' --output table
        done
        
        # Target Group確認
        log_info "Target Group状況:"
        aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[*].[TargetGroupName,HealthCheckPath,HealthyThresholdCount,UnhealthyThresholdCount]' --output table
        
        # Target Health確認
        TG_ARNS=$(aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[*].TargetGroupArn' --output text)
        for TG_ARN in $TG_ARNS; do
            log_info "Target Group Health ($TG_ARN):"
            aws elbv2 describe-target-health --target-group-arn $TG_ARN --output table
        done
    else
        log_warning "EKS関連のALBが見つかりません"
    fi
}

# DNS設定確認
check_dns_configuration() {
    log_info "DNS設定を確認中..."
    
    if [ ! -z "$ALB_HOSTNAME" ]; then
        # DNS解決確認
        if nslookup $ALB_HOSTNAME &> /dev/null; then
            log_success "DNS解決成功: $ALB_HOSTNAME"
            
            # IPアドレス取得
            ALB_IPS=$(dig +short $ALB_HOSTNAME)
            log_info "ALB IPアドレス: $ALB_IPS"
        else
            log_warning "DNS解決に失敗しました"
        fi
    fi
}

# HTTP/HTTPS テスト
test_http_endpoints() {
    log_info "HTTPエンドポイントをテスト中..."
    
    if [ -z "$ALB_HOSTNAME" ]; then
        log_warning "ALB ホスト名が設定されていません。テストをスキップします。"
        return 1
    fi
    
    # フロントエンドテスト
    log_info "フロントエンドアクセステスト..."
    if curl -s --connect-timeout 10 "http://$ALB_HOSTNAME" | grep -q "AWS EKS + Application Load Balancer"; then
        log_success "フロントエンドアクセス成功"
    else
        log_error "フロントエンドアクセス失敗"
    fi
    
    # API v1テスト
    log_info "API v1アクセステスト..."
    if curl -s --connect-timeout 10 "http://$ALB_HOSTNAME/api/v1" | grep -q "v1.0"; then
        log_success "API v1アクセス成功"
    else
        log_error "API v1アクセス失敗"
    fi
    
    # API v2テスト  
    log_info "API v2アクセステスト..."
    if curl -s --connect-timeout 10 "http://$ALB_HOSTNAME/api/v2" | grep -q "v2.0"; then
        log_success "API v2アクセス成功"
    else
        log_error "API v2アクセス失敗"
    fi
}

# ヘルスチェック確認
test_health_checks() {
    log_info "ヘルスチェックを確認中..."
    
    if [ ! -z "$ALB_HOSTNAME" ]; then
        # ヘルスチェックエンドポイントテスト
        if curl -s --connect-timeout 10 "http://$ALB_HOSTNAME/" > /dev/null; then
            log_success "ヘルスチェック成功"
        else
            log_error "ヘルスチェック失敗"
        fi
    fi
}

# ロードバランシングテスト
test_load_balancing() {
    log_info "ロードバランシングをテスト中..."
    
    if [ -z "$ALB_HOSTNAME" ]; then
        log_warning "ALB ホスト名が設定されていません。テストをスキップします。"
        return 1
    fi
    
    log_info "複数のリクエストを送信してロードバランシングを確認..."
    
    # 複数回リクエストを送信
    declare -A responses
    for i in {1..10}; do
        RESPONSE=$(curl -s --connect-timeout 5 "http://$ALB_HOSTNAME/api/v1" | grep -o '"hostname":"[^"]*"' | cut -d'"' -f4)
        if [ ! -z "$RESPONSE" ]; then
            responses["$RESPONSE"]=$((responses["$RESPONSE"] + 1))
        fi
        sleep 0.1
    done
    
    # 結果表示
    log_info "ロードバランシング結果:"
    for hostname in "${!responses[@]}"; do
        echo "  $hostname: ${responses[$hostname]} requests"
    done
    
    if [ ${#responses[@]} -gt 1 ]; then
        log_success "ロードバランシングが正常に動作"
    else
        log_warning "ロードバランシングが検出されませんでした"
    fi
}

# Auto Scaling テスト
test_auto_scaling() {
    log_info "Auto Scalingをテスト中..."
    
    # HPA状態確認
    if kubectl get hpa -n webapp &> /dev/null; then
        kubectl get hpa -n webapp
        log_success "HPA設定確認完了"
    else
        log_warning "HPA が設定されていません"
    fi
    
    # Pod数確認
    CURRENT_REPLICAS=$(kubectl get deployment webapp-frontend -n webapp -o jsonpath='{.status.replicas}')
    log_info "現在のPod数: $CURRENT_REPLICAS"
}

# AWS料金確認
check_aws_costs() {
    log_info "AWS料金情報を確認中..."
    
    # ALB料金情報
    echo "💰 ALB料金情報:"
    echo "  - 固定費: $16.20/月 (0.0225/hour)"
    echo "  - LCU費: $5.76/月/LCU (0.008/hour/LCU)"
    echo "  - データ処理: 料金詳細はAWS料金計算機で確認"
    
    # EKS料金情報
    echo "💰 EKS料金情報:"
    echo "  - コントロールプレーン: $72/月"
    echo "  - ワーカーノード: EC2インスタンス料金"
    echo "  - Fargate: vCPU/メモリ時間課金"
}

# セキュリティ設定確認
check_security_configuration() {
    log_info "セキュリティ設定を確認中..."
    
    # ServiceAccount確認
    if kubectl get serviceaccount aws-load-balancer-controller -n kube-system &> /dev/null; then
        SA_ROLE=$(kubectl get serviceaccount aws-load-balancer-controller -n kube-system -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}')
        if [ ! -z "$SA_ROLE" ]; then
            log_success "IRSA設定確認: $SA_ROLE"
        else
            log_warning "IRSA設定が見つかりません"
        fi
    fi
    
    # SecurityGroup確認
    if [ ! -z "$ALB_ARNS" ]; then
        for ALB_ARN in $ALB_ARNS; do
            SECURITY_GROUPS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].SecurityGroups' --output text)
            log_info "ALB Security Groups: $SECURITY_GROUPS"
        done
    fi
}

# メトリクス確認
check_metrics() {
    log_info "メトリクスを確認中..."
    
    # CloudWatch メトリクス確認
    if [ ! -z "$ALB_ARNS" ]; then
        ALB_NAME=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].LoadBalancerName' --output text)
        
        # 最近のRequestCount確認
        REQUEST_COUNT=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/ApplicationELB \
            --metric-name RequestCount \
            --dimensions Name=LoadBalancer,Value="app/${ALB_NAME}/${ALB_ARN##*/}" \
            --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 300 \
            --statistics Sum \
            --query 'Datapoints[*].Sum' \
            --output text 2>/dev/null)
        
        if [ ! -z "$REQUEST_COUNT" ]; then
            log_success "CloudWatch メトリクス取得成功"
            echo "  過去1時間のリクエスト数: $REQUEST_COUNT"
        else
            log_info "CloudWatch メトリクスデータがありません（ALB作成直後のため）"
        fi
    fi
}

# AWS ECS比較表示
show_ecs_comparison() {
    log_info "AWS ECS vs EKS 比較"
    echo "=================================================="
    echo ""
    echo "| 項目                | ECS              | EKS + ALB Controller |"
    echo "|-------------------|------------------|---------------------|"
    echo "| ロードバランサー      | ALB直接設定       | Ingress YAML       |"
    echo "| サービス発見         | Service Discovery | Kubernetes Service  |"
    echo "| Auto Scaling      | ECS Auto Scaling | HPA + CA           |"
    echo "| 設定管理           | JSON/CloudFormation | YAML/Helm       |"
    echo "| 運用コスト          | 低               | 中                 |"
    echo "| ベンダーロックイン    | 高               | 低                 |"
    echo "| 学習コスト          | 低               | 中〜高              |"
    echo ""
}

# レポート生成
generate_report() {
    log_info "テストレポートを生成中..."
    
    REPORT_FILE="aws-lb-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "AWS Load Balancer Controller テストレポート"
        echo "============================================"
        echo "実行日時: $(date)"
        echo "ALB ホスト名: ${ALB_HOSTNAME:-'未設定'}"
        echo ""
        echo "## テスト結果サマリー"
        echo "- ALB作成: $([ ! -z "$ALB_HOSTNAME" ] && echo "成功" || echo "失敗")"
        echo "- HTTP アクセス: $(curl -s --connect-timeout 5 "http://$ALB_HOSTNAME" > /dev/null && echo "成功" || echo "失敗")"
        echo "- API v1: $(curl -s --connect-timeout 5 "http://$ALB_HOSTNAME/api/v1" > /dev/null && echo "成功" || echo "失敗")"
        echo "- API v2: $(curl -s --connect-timeout 5 "http://$ALB_HOSTNAME/api/v2" > /dev/null && echo "成功" || echo "失敗")"
        echo ""
        echo "## AWS リソース情報"
        kubectl get ingress -n webapp
        echo ""
        echo "## 推奨事項"
        echo "- SSL証明書の設定（ACM）"
        echo "- Route 53でのDNS設定"
        echo "- CloudWatch アラーム設定"
        echo "- AWS WAF統合"
        echo "- Cost Explorer でのコスト監視"
    } > "$REPORT_FILE"
    
    log_success "レポート生成完了: $REPORT_FILE"
}

# メイン実行
main() {
    echo "AWS Load Balancer Controller 総合テスト"
    echo "======================================="
    
    check_prerequisites
    check_aws_lb_controller  
    check_sample_apps
    check_ingress_configuration
    check_aws_alb_details
    check_dns_configuration
    
    echo ""
    echo "🧪 機能テスト開始"
    echo "=================="
    
    test_http_endpoints
    test_health_checks
    test_load_balancing
    test_auto_scaling
    check_aws_costs
    check_security_configuration
    check_metrics
    
    echo ""
    echo "📊 比較情報"
    echo "============"
    show_ecs_comparison
    
    echo ""
    echo "✅ テスト完了"
    echo "============="
    
    generate_report
    
    echo ""
    echo "📋 テスト結果まとめ:"
    echo "  - ALB エンドポイント: ${ALB_HOSTNAME:-'設定中'}"
    echo "  - フロントエンド: http://${ALB_HOSTNAME:-'ALB_HOSTNAME'}"
    echo "  - API v1: http://${ALB_HOSTNAME:-'ALB_HOSTNAME'}/api/v1"
    echo "  - API v2: http://${ALB_HOSTNAME:-'ALB_HOSTNAME'}/api/v2"
    echo ""
    echo "🔍 追加確認事項:"
    echo "  - AWS管理コンソールでALB詳細確認"
    echo "  - CloudWatch メトリクスとログ確認"
    echo "  - Route 53 レコード設定"
    echo "  - ACM証明書関連付け"
    echo "  - WAF/Shield設定検討"
    echo ""
    echo "📚 参考資料:"
    echo "  - AWS Load Balancer Controller: https://kubernetes-sigs.github.io/aws-load-balancer-controller/"
    echo "  - EKS ユーザーガイド: https://docs.aws.amazon.com/eks/"
    echo "  - AWS Well-Architected: https://aws.amazon.com/architecture/well-architected/"
}

# スクリプト実行
main "$@"
