#!/bin/bash

# Secrets管理とセキュリティテストスクリプト
# 機密データの適切な管理とセキュリティ検証

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

# Secrets作成テスト
test_secret_creation() {
    local secret_name="$1"
    local namespace="$2"
    local description="$3"
    
    info "Secret作成テスト: $description"
    
    if kubectl get secret "$secret_name" -n "$namespace" &> /dev/null; then
        success "  Secret '$secret_name' が存在します"
        
        # Secret詳細確認
        local secret_type=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.type}')
        local data_keys=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null | tr '\n' ' ' || echo "取得失敗")
        echo "    タイプ: $secret_type"
        echo "    データキー: $data_keys"
        return 0
    else
        error "  Secret '$secret_name' が存在しません"
        return 1
    fi
}

# Secret値の取得とデコードテスト
test_secret_decoding() {
    local secret_name="$1"
    local key="$2"
    local namespace="$3"
    local description="$4"
    
    info "Secret デコードテスト: $description"
    
    local encoded_value=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath="{.data.$key}" 2>/dev/null)
    if [[ -n "$encoded_value" ]]; then
        local decoded_value=$(echo "$encoded_value" | base64 -d 2>/dev/null || echo "デコードエラー")
        if [[ "$decoded_value" != "デコードエラー" ]]; then
            success "  キー '$key' のデコード成功"
            echo "    値の長さ: ${#decoded_value} 文字"
            # セキュリティのため、実際の値は表示しない
            echo "    先頭3文字: ${decoded_value:0:3}***"
            return 0
        else
            error "  キー '$key' のデコード失敗"
            return 1
        fi
    else
        error "  キー '$key' が存在しません"
        return 1
    fi
}

# Pod でのSecrets使用テスト
test_secret_usage_in_pod() {
    local pod_name="$1"
    local namespace="$2"
    local description="$3"
    
    info "Pod でのSecrets使用テスト: $description"
    
    # Pod存在確認
    if ! kubectl get pod "$pod_name" -n "$namespace" &> /dev/null; then
        warning "Pod '$pod_name' が存在しません"
        return 1
    fi
    
    # Pod Ready状態確認
    if ! kubectl wait --for=condition=Ready pod/"$pod_name" -n "$namespace" --timeout=30s &> /dev/null; then
        warning "Pod '$pod_name' がReady状態になりません"
        return 1
    fi
    
    # Volume Mount されたSecretsの確認
    info "  Volume Mount されたSecrets確認"
    if kubectl exec "$pod_name" -n "$namespace" -- ls /etc/secrets &> /dev/null; then
        local secret_files=$(kubectl exec "$pod_name" -n "$namespace" -- ls /etc/secrets 2>/dev/null | tr '\n' ' ')
        success "    Volume Mount: 成功"
        echo "      ファイル: $secret_files"
        
        # ファイル権限確認
        local file_perms=$(kubectl exec "$pod_name" -n "$namespace" -- ls -la /etc/secrets 2>/dev/null | head -3)
        echo "      権限: $file_perms"
    else
        warning "    Volume Mount: Secretsディレクトリが見つかりません"
    fi
    
    # 環境変数からのSecrets確認
    info "  環境変数でのSecrets確認"
    if kubectl exec "$pod_name" -n "$namespace" -- env | grep -E "(DB_|API_)" &> /dev/null; then
        success "    環境変数: Secrets設定済み"
        local env_vars=$(kubectl exec "$pod_name" -n "$namespace" -- env | grep -E "(DB_|API_)" | cut -d= -f1 | tr '\n' ' ')
        echo "      変数名: $env_vars"
    else
        warning "    環境変数: Secrets設定なし"
    fi
    
    echo
}

# RBAC権限テスト
test_secret_rbac() {
    local service_account="$1"
    local namespace="$2"
    local description="$3"
    
    info "Secret RBAC権限テスト: $description"
    
    # ServiceAccount存在確認
    if ! kubectl get serviceaccount "$service_account" -n "$namespace" &> /dev/null; then
        warning "ServiceAccount '$service_account' が存在しません"
        return 1
    fi
    
    # Secrets読み取り権限確認
    if kubectl auth can-i get secrets \
        --as="system:serviceaccount:$namespace:$service_account" \
        -n "$namespace" &> /dev/null; then
        success "  Secrets読み取り権限: あり"
    else
        warning "  Secrets読み取り権限: なし"
    fi
    
    # Secrets作成権限確認
    if kubectl auth can-i create secrets \
        --as="system:serviceaccount:$namespace:$service_account" \
        -n "$namespace" &> /dev/null; then
        warning "  Secrets作成権限: あり（セキュリティリスク）"
    else
        success "  Secrets作成権限: なし（適切）"
    fi
    
    # Secrets削除権限確認
    if kubectl auth can-i delete secrets \
        --as="system:serviceaccount:$namespace:$service_account" \
        -n "$namespace" &> /dev/null; then
        warning "  Secrets削除権限: あり（セキュリティリスク）"
    else
        success "  Secrets削除権限: なし（適切）"
    fi
    
    echo
}

# etcd暗号化確認（管理者権限が必要）
test_etcd_encryption() {
    info "etcd暗号化確認"
    
    # etcd暗号化設定確認（可能な場合のみ）
    if command -v etcdctl &> /dev/null; then
        info "  etcdctl利用可能 - 暗号化状態確認"
        
        # Secretsがetcd内で暗号化されているか確認
        local etcd_result=$(ETCDCTL_API=3 etcdctl get /registry/secrets/security-demo/app-secrets 2>/dev/null || echo "アクセスできません")
        if [[ "$etcd_result" == *"k8s:enc"* ]]; then
            success "    etcd内でSecrets暗号化済み"
        elif [[ "$etcd_result" == "アクセスできません" ]]; then
            info "    etcd直接アクセス不可（通常の状態）"
        else
            warning "    etcd内でSecrets未暗号化の可能性"
        fi
    else
        info "  etcdctl未利用可能 - 暗号化確認スキップ"
    fi
    
    # Kubernetes API経由でのSecret確認
    info "  Kubernetes API経由でのSecret確認"
    local api_result=$(kubectl get secret app-secrets -n security-demo -o yaml | grep -A 5 data: | head -10)
    if [[ -n "$api_result" ]]; then
        success "    API経由でSecrets取得可能（base64エンコード状態）"
    else
        warning "    API経由でSecrets取得不可"
    fi
    
    echo
}

# Secretsローテーションテスト
test_secret_rotation() {
    local namespace="$1"
    
    info "Secretsローテーションテスト"
    
    # テスト用Secret作成
    local test_secret="rotation-test-secret"
    info "  テスト用Secret作成"
    
    kubectl create secret generic "$test_secret" \
        --from-literal=password=old-password \
        -n "$namespace" &> /dev/null || true
    
    if kubectl get secret "$test_secret" -n "$namespace" &> /dev/null; then
        success "    テスト用Secret作成完了"
        
        # 元の値確認
        local old_value=$(kubectl get secret "$test_secret" -n "$namespace" -o jsonpath='{.data.password}' | base64 -d)
        echo "      元の値: ${old_value:0:3}***"
        
        # Secret更新
        info "  Secret値の更新"
        kubectl create secret generic "$test_secret" \
            --from-literal=password=new-password \
            --dry-run=client -o yaml | kubectl apply -f - &> /dev/null
        
        # 更新後の値確認
        local new_value=$(kubectl get secret "$test_secret" -n "$namespace" -o jsonpath='{.data.password}' | base64 -d)
        if [[ "$new_value" == "new-password" ]]; then
            success "    Secret値の更新成功"
            echo "      新しい値: ${new_value:0:3}***"
        else
            error "    Secret値の更新失敗"
        fi
        
        # クリーンアップ
        kubectl delete secret "$test_secret" -n "$namespace" &> /dev/null || true
        
    else
        error "    テスト用Secret作成失敗"
    fi
    
    echo
}

# Secretsセキュリティスキャン
test_security_scan() {
    local namespace="$1"
    
    info "Secretsセキュリティスキャン"
    
    # 弱いパスワードの検出
    info "  弱いパスワード検出"
    local weak_patterns=("password" "123456" "admin" "root" "test")
    local weak_found=false
    
    for secret in $(kubectl get secrets -n "$namespace" -o name); do
        local secret_name=$(echo "$secret" | cut -d/ -f2)
        for pattern in "${weak_patterns[@]}"; do
            local encoded_pattern=$(echo -n "$pattern" | base64)
            if kubectl get secret "$secret_name" -n "$namespace" -o yaml | grep -q "$encoded_pattern"; then
                warning "    弱いパスワード検出: $secret_name (パターン: $pattern)"
                weak_found=true
            fi
        done
    done
    
    if [[ "$weak_found" == "false" ]]; then
        success "    弱いパスワード未検出"
    fi
    
    # Secret名に機密情報が含まれていないか確認
    info "  Secret名のセキュリティ確認"
    local insecure_names=false
    for secret in $(kubectl get secrets -n "$namespace" --no-headers | awk '{print $1}'); do
        if [[ "$secret" =~ (password|key|token|secret) ]]; then
            info "    Secret名に機密情報キーワード: $secret"
        fi
    done
    
    # Secretsの作成日時確認（古いSecretsの検出）
    info "  古いSecretsの検出"
    local old_secrets=$(kubectl get secrets -n "$namespace" --sort-by=.metadata.creationTimestamp --no-headers | head -5)
    if [[ -n "$old_secrets" ]]; then
        success "    最古のSecrets確認完了"
        echo "$old_secrets" | while read line; do
            echo "      $line"
        done
    fi
    
    echo
}

# TLS証明書管理のテスト
test_tls_certificates() {
    info "TLS証明書管理演習のテスト"
    
    echo "1. TLS証明書マニフェストを適用..."
    kubectl apply -f 02-tls-certificates.yaml
    
    echo "2. 証明書生成Jobの状態を確認..."
    kubectl get jobs -n k8s-security-demo
    
    echo "3. TLS Secret の作成を確認..."
    sleep 15  # Jobの完了を待機
    if kubectl get secret sample-app-tls -n k8s-security-demo > /dev/null 2>&1; then
        success "TLS証明書のSecretが作成されました"
    else
        error "TLS証明書のSecretが作成されませんでした"
    fi
    
    echo "4. Nginx TLS Podの状態を確認..."
    kubectl get pods -n k8s-security-demo -l app=nginx-tls
    
    echo "5. TLSテストクライアントのログを確認..."
    sleep 20  # Podの起動を待機
    kubectl logs -n k8s-security-demo tls-test-client --tail=20 || warning "TLSテストクライアントのログを取得できませんでした"
}

# アプリケーションでのSecrets利用テスト
test_app_with_secrets() {
    info "アプリケーションSecrets利用演習のテスト"
    
    echo "1. アプリケーションマニフェストを適用..."
    kubectl apply -f 03-app-with-secrets.yaml
    
    echo "2. WebアプリDeploymentの状態を確認..."
    kubectl get deployment webapp-with-secrets -n k8s-security-demo
    
    echo "3. Webアプリの起動を待機..."
    if kubectl wait --for=condition=available --timeout=60s deployment/webapp-with-secrets -n k8s-security-demo; then
        success "Webアプリケーションが正常に起動しました"
    else
        error "Webアプリケーションの起動に失敗しました"
    fi
    
    echo "4. Webアプリのサービスを確認..."
    kubectl get service webapp-secrets-service -n k8s-security-demo
    
    echo "5. テストクライアントのログを確認..."
    sleep 15  # テストの実行を待機
    kubectl logs -n k8s-security-demo secrets-test-client --tail=30 || warning "テストクライアントのログを取得できませんでした"
}

# External Secrets演習のテスト
test_external_secrets() {
    info "External Secrets Operator演習のテスト"
    
    echo "1. External Secrets Operatorの確認..."
    if kubectl get crd externalsecrets.external-secrets.io > /dev/null 2>&1; then
        success "External Secrets Operator CRDが見つかりました"
        
        echo "2. External Secretsマニフェストを適用..."
        kubectl apply -f 04-external-secrets.yaml
        
        echo "3. SecretStoreの状態を確認..."
        kubectl get secretstore -n k8s-security-demo
        
        echo "4. ExternalSecretの状態を確認..."
        kubectl get externalsecret -n k8s-security-demo
        
        echo "5. テストPodのログを確認..."
        sleep 10
        kubectl logs -n k8s-security-demo external-secrets-test --tail=20 || warning "External Secretsテストログを取得できませんでした"
        
    else
        warning "External Secrets Operator CRDが見つかりません"
        echo "以下のコマンドでインストールしてください:"
        echo "helm repo add external-secrets https://charts.external-secrets.io"
        echo "helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace"
    fi
}

# AWS ECS vs Kubernetes比較表示
show_ecs_comparison() {
    info "AWS ECS vs Kubernetes Secrets管理比較"
    cat << 'EOF'
====================================================

🔄 機密データ管理の比較:

┌─────────────────────┬─────────────────────┬─────────────────────┐
│      項目           │      AWS ECS        │     Kubernetes      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 保存場所            │ Secrets Manager     │ etcd (暗号化)       │
│                     │ Parameter Store     │                     │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 注入方法            │ Task Definition     │ Volume Mount        │
│                     │ secrets/environment │ Environment Variable│
├─────────────────────┼─────────────────────┼─────────────────────┤
│ アクセス制御        │ IAM Policy          │ RBAC +              │
│                     │                     │ ServiceAccount      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 暗号化              │ AWS KMS             │ etcd encryption     │
│                     │                     │ at rest             │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ ローテーション      │ 自動                │ 手動 /              │
│                     │ (Lambda Function)   │ External Secrets    │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 監査               │ CloudTrail          │ Kubernetes          │
│                     │                     │ Audit Logs          │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ 料金               │ 使用量課金          │ クラスター内無料    │
└─────────────────────┴─────────────────────┴─────────────────────┘

📋 移行時の考慮点:
1. Secrets Manager → K8s Secrets変換
2. IAM Policy → RBAC設定
3. KMS Key → etcd encryption key
4. Lambda ローテーション → CronJob or External Secrets

💡 K8s Secrets のメリット:
- クラスター内での統一的な管理
- RBAC による細かいアクセス制御
- GitOps での宣言的管理
- 無料での利用

⚠️  K8s Secrets の制限:
- 自動ローテーション機能なし
- etcd のサイズ制限 (1MB/Secret)
- Base64エンコードのみ（暗号化ではない）
- 外部連携には追加ツールが必要

🔧 ハイブリッド構成推奨:
- 機密度の高いデータ: AWS Secrets Manager + External Secrets
- 設定データ: K8s ConfigMap
- 認証情報: K8s Secrets
- TLS証明書: cert-manager + K8s Secrets

EOF
}

# メイン処理
main() {
    echo -e "${BLUE}🔑 Kubernetes Secrets管理とセキュリティテスト${NC}"
    echo "AWS ECS管理者向けKubernetes学習プロジェクト"
    echo "================================================"
    echo
    
    NAMESPACE="security-demo"
    
    # 前提条件チェック
    info "前提条件をチェックしています..."
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' が存在しません。01-basic-secrets.yamlを先に適用してください。"
        exit 1
    fi
    
    # Secrets存在確認
    info "=== Secrets存在確認 ==="
    
    expected_secrets=(
        "app-secrets"
        "database-credentials"
        "external-service-keys"
        "tls-certificate"
        "docker-registry-secret"
        "financial-app-secrets"
    )
    
    for secret in "${expected_secrets[@]}"; do
        test_secret_creation "$secret" "$NAMESPACE" "$secret の確認"
    done
    echo
    
    # Secret値のデコードテスト
    info "=== Secret値デコードテスト ==="
    test_secret_decoding "app-secrets" "db-username" "$NAMESPACE" "データベースユーザー名"
    test_secret_decoding "app-secrets" "api-key" "$NAMESPACE" "APIキー"
    test_secret_decoding "database-credentials" "POSTGRES_USER" "$NAMESPACE" "PostgreSQLユーザー"
    test_secret_decoding "tls-certificate" "tls.crt" "$NAMESPACE" "TLS証明書"
    echo
    
    # RBAC権限テスト
    info "=== RBAC権限テスト ==="
    
    # テスト用ServiceAccount作成
    kubectl create serviceaccount secret-test-sa -n "$NAMESPACE" &> /dev/null || true
    
    test_secret_rbac "secret-test-sa" "$NAMESPACE" "テスト用ServiceAccount"
    test_secret_rbac "default" "$NAMESPACE" "デフォルトServiceAccount"
    echo
    
    # Pod でのSecrets使用テスト
    info "=== Pod でのSecrets使用テスト ==="
    
    # テスト用Pod作成
    kubectl apply -f - <<EOF > /dev/null 2>&1 || true
apiVersion: v1
kind: Pod
metadata:
  name: secret-test-pod
  namespace: $NAMESPACE
spec:
  serviceAccountName: secret-test-sa
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: test-container
    image: alpine:3.16
    command: ["sleep", "3600"]
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
    env:
    - name: DB_USERNAME
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: db-username
    - name: API_KEY
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: api-key
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secrets
      readOnly: true
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: secret-volume
    secret:
      secretName: app-secrets
      defaultMode: 0400
  - name: tmp
    emptyDir: {}
  restartPolicy: Never
EOF
    
    # Pod Ready待機
    kubectl wait --for=condition=Ready pod/secret-test-pod -n "$NAMESPACE" --timeout=60s &> /dev/null || warning "テスト用Pod準備に時間がかかっています"
    
    test_secret_usage_in_pod "secret-test-pod" "$NAMESPACE" "テスト用Pod"
    
    # etcd暗号化確認
    info "=== etcd暗号化確認 ==="
    test_etcd_encryption
    
    # Secretsローテーションテスト
    info "=== Secretsローテーションテスト ==="
    test_secret_rotation "$NAMESPACE"
    
    # セキュリティスキャン
    info "=== Secretsセキュリティスキャン ==="
    test_security_scan "$NAMESPACE"
    
    # TLS証明書確認
    info "=== TLS証明書確認 ==="
    if kubectl get secret tls-certificate -n "$NAMESPACE" &> /dev/null; then
        info "  TLS証明書詳細確認"
        
        # 証明書の有効期限確認
        local cert_data=$(kubectl get secret tls-certificate -n "$NAMESPACE" -o jsonpath='{.data.tls\.crt}' | base64 -d)
        if command -v openssl &> /dev/null; then
            local cert_info=$(echo "$cert_data" | openssl x509 -text -noout 2>/dev/null | grep -E "(Subject:|Not After :)" || echo "証明書解析エラー")
            success "    証明書情報取得成功"
            echo "$cert_info"
        else
            info "    openssl未利用可能 - 証明書詳細確認スキップ"
        fi
    fi
    echo
    
    # External Secrets 設定例表示
    info "=== External Secrets設定例 ==="
    cat << 'EOF'
# AWS Secrets Manager連携例
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: aws-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-secrets-from-aws
    creationPolicy: Owner
  data:
  - secretKey: db-password
    remoteRef:
      key: prod/db/password
      
# HashiCorp Vault連携例
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vault-secret
spec:
  refreshInterval: 30m
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets-from-vault
  data:
  - secretKey: api-key
    remoteRef:
      key: secret/data/api
      property: key
EOF
    echo
    
    # AWS ECS比較
    show_ecs_comparison
    
    # ベストプラクティス表示
    info "=== Secretsベストプラクティス ==="
    cat << 'EOF'
🔐 Secrets管理のベストプラクティス:

1. 作成時:
   ✅ kubectl create secret --from-file 使用
   ✅ YAML ファイルはGitにCommitしない
   ✅ base64エンコードを正確に行う
   ❌ 履歴に機密情報を残さない

2. 使用時:
   ✅ Volume Mount優先（環境変数より安全）
   ✅ readOnly: true で読み取り専用
   ✅ defaultMode: 0400 で権限制限
   ❌ 複数のSecretsを1つにまとめない

3. 運用時:
   ✅ 定期的なローテーション
   ✅ RBAC による最小権限
   ✅ 監査ログの確認
   ❌ 本番環境でのSecrets値表示

4. セキュリティ:
   ✅ etcd暗号化の有効化
   ✅ NetworkPolicy での通信制限
   ✅ 外部ツール(Vault/External Secrets)検討
   ❌ 弱いパスワードの使用
EOF
    echo
    
    # 次のステップ
    info "=== 次のステップ ==="
    echo "✅ Kubernetes Secrets の管理と使用方法を確認しました"
    echo "📝 Phase 5: セキュリティスキャンと監査に進んでください"
    echo "   cd ../phase5-security-scan"
    echo
    echo "🔧 有用なコマンド:"
    echo "- kubectl get secrets -o wide"
    echo "- kubectl describe secret <secret-name>"
    echo "- kubectl create secret generic --help"
    echo
    echo "🔒 セキュリティ強化:"
    echo "- External Secrets Operator のインストール検討"
    echo "- HashiCorp Vault との連携検討"
    echo "- 定期的なSecretsローテーション計画"
    echo
    
    # クリーンアップオプション
    if [[ "${1:-}" == "--cleanup" ]]; then
        info "Secrets演習リソースをクリーンアップしています..."
        kubectl delete pod secret-test-pod -n "$NAMESPACE" --ignore-not-found=true
        kubectl delete serviceaccount secret-test-sa -n "$NAMESPACE" --ignore-not-found=true
        success "クリーンアップ完了"
    fi
}

# 引数処理
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "使用方法: $0 [--cleanup] [--help]"
    echo "  --cleanup: テスト用リソースをクリーンアップ"
    echo "  --help:    このヘルプメッセージを表示"
    exit 0
fi

# スクリプト実行
main "$@"
