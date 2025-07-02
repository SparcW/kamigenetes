# Gateway API Phase 1 トラブルシューティング

このドキュメントでは、Gateway API Phase 1で発生する可能性のある問題と解決策を説明します。

## 一般的な問題

### 1. Gateway API CRDがインストールされていない

**症状**:
```bash
$ kubectl apply -f manifests/01-gatewayclass.yaml
error validating data: ValidationError(GatewayClass): unknown object type "GatewayClass"
```

**原因**: Gateway API CRDがクラスターにインストールされていない

**解決策**:
```bash
# Gateway API CRDをインストール
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v0.8.1/standard-install.yaml

# CRDの確認
kubectl get crd | grep gateway.networking.k8s.io
```

### 2. GatewayClassが正常に動作しない

**症状**:
```bash
$ kubectl get gatewayclass
NAME                  CONTROLLER                              ACCEPTED   AGE
nginx-gateway-class   k8s.nginx.org/nginx-gateway-controller  False      5m
```

**原因**: 
- Gateway Controllerがインストールされていない
- ControllerNameが正しくない

**デバッグ手順**:
```bash
# GatewayClassの詳細確認
kubectl describe gatewayclass nginx-gateway-class

# Gateway Controllerの確認
kubectl get pods -n nginx-gateway
kubectl logs -n nginx-gateway deployment/nginx-gateway-controller
```

**解決策**:
```bash
# デモ用NGINXコントローラーの再インストール
kubectl delete deployment nginx-gateway-controller -n nginx-gateway
./scripts/setup.sh  # セットアップスクリプトを再実行
```

### 3. Gatewayが準備完了にならない

**症状**:
```bash
$ kubectl get gateway -n gateway-api-system
NAME             CLASS                 ADDRESS   PROGRAMMED   AGE
basic-gateway   nginx-gateway-class             False        10m
```

**原因**:
- Gateway Controllerの問題
- リスナー設定の問題
- 証明書の問題

**デバッグ手順**:
```bash
# Gatewayの詳細状態確認
kubectl describe gateway basic-gateway -n gateway-api-system

# イベント確認
kubectl get events -n gateway-api-system --sort-by='.lastTimestamp'

# Controller ログ確認
kubectl logs -n nginx-gateway deployment/nginx-gateway-controller
```

**解決策**:
```yaml
# シンプルなGateway設定でテスト
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: simple-gateway
  namespace: gateway-api-system
spec:
  gatewayClassName: nginx-gateway-class
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    allowedRoutes:
      namespaces:
        from: All
```

### 4. HTTPRouteがトラフィックを受信しない

**症状**:
- HTTPRouteは作成されているが、アプリケーションにアクセスできない
- 404エラーが発生する

**原因**:
- HTTPRouteの設定ミス
- ReferenceGrantの不足
- Serviceの問題

**デバッグ手順**:
```bash
# HTTPRouteの状態確認
kubectl get httproute -n sample-apps
kubectl describe httproute frontend-route -n sample-apps

# ReferenceGrantの確認
kubectl get referencegrant -n sample-apps
kubectl describe referencegrant gateway-to-sample-apps -n sample-apps

# Serviceとエンドポイント確認
kubectl get service -n sample-apps
kubectl get endpoints -n sample-apps
```

**解決策**:
```bash
# Serviceが正常に動作しているかテスト
kubectl run test-pod --image=curlimages/curl -it --rm -- sh
# Pod内で実行
curl http://frontend-service.sample-apps.svc.cluster.local

# ReferenceGrantが正しく設定されているか確認
kubectl apply -f manifests/04-httproute.yaml
```

### 5. ポートフォワードが失敗する

**症状**:
```bash
$ kubectl port-forward service/nginx-gateway-controller 8080:80 -n nginx-gateway
error: unable to forward port because pod is not running. Current status=Pending
```

**原因**:
- Podが起動していない
- サービスが存在しない
- ポートの競合

**デバッグ手順**:
```bash
# Pod状態確認
kubectl get pods -n nginx-gateway
kubectl describe pod -n nginx-gateway -l app.kubernetes.io/name=nginx-gateway-controller

# サービス確認
kubectl get service -n nginx-gateway
kubectl describe service nginx-gateway-controller -n nginx-gateway

# ポート使用状況確認
netstat -tlnp | grep :8080
```

**解決策**:
```bash
# 別のポートを使用
kubectl port-forward service/nginx-gateway-controller 8081:80 -n nginx-gateway

# 直接Podへのポートフォワード
POD_NAME=$(kubectl get pods -n nginx-gateway -l app.kubernetes.io/name=nginx-gateway-controller -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward pod/$POD_NAME 8080:80 -n nginx-gateway
```

## アプリケーション固有の問題

### 6. サンプルアプリケーションが起動しない

**症状**:
```bash
$ kubectl get pods -n sample-apps
NAME                            READY   STATUS    RESTARTS   AGE
frontend-app-xxx-xxx           0/1     Pending   0          5m
api-app-xxx-xxx                0/1     Pending   0          5m
```

**原因**:
- リソース不足
- イメージの取得失敗
- 設定の問題

**デバッグ手順**:
```bash
# Pod詳細確認
kubectl describe pod -n sample-apps -l app=frontend
kubectl describe pod -n sample-apps -l app=api

# ノードリソース確認
kubectl top nodes
kubectl describe nodes
```

**解決策**:
```bash
# リソース要求を下げる
kubectl patch deployment frontend-app -n sample-apps -p '{"spec":{"template":{"spec":{"containers":[{"name":"nginx","resources":{"requests":{"memory":"32Mi","cpu":"25m"}}}]}}}}'

# イメージを明示的にpull
kubectl debug deployment/frontend-app -n sample-apps --image=nginx:1.21 --attach=false
```

### 7. API エンドポイントが応答しない

**症状**:
- フロントエンドは表示されるが、APIエンドポイント（/api/health、/api/info）が404エラー

**原因**:
- NGINX設定の問題
- HTTPRouteのURL書き換え設定の問題

**デバッグ手順**:
```bash
# API Pod内で直接テスト
kubectl exec -it deployment/api-app -n sample-apps -- curl http://localhost/health

# ConfigMapの確認
kubectl get configmap api-nginx-config -n sample-apps -o yaml
```

**解決策**:
```bash
# NGINX設定を確認・修正
kubectl edit configmap api-nginx-config -n sample-apps

# Podを再起動
kubectl rollout restart deployment/api-app -n sample-apps
```

## 証明書とTLSの問題

### 8. HTTPS接続が失敗する

**症状**:
- HTTP接続は成功するが、HTTPS接続が失敗する
- 証明書エラーが発生する

**原因**:
- 自己署名証明書の使用
- ホスト名の不一致
- 証明書の設定ミス

**デバッグ手順**:
```bash
# 証明書の確認
kubectl get secret basic-gateway-tls -n gateway-api-system -o yaml

# TLS設定の確認
kubectl describe gateway basic-gateway -n gateway-api-system | grep -A 10 "tls:"

# 証明書の詳細確認
kubectl get secret basic-gateway-tls -n gateway-api-system -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout
```

**解決策**:
```bash
# curl で証明書検証をスキップしてテスト
curl -k https://frontend.local:8443/

# Hostヘッダーを明示的に設定
curl -k -H "Host: frontend.local" https://localhost:8443/
```

## パフォーマンスと負荷の問題

### 9. 高負荷時の応答が遅い

**症状**:
- 低負荷時は正常だが、負荷が増加すると応答が遅くなる

**デバッグ手順**:
```bash
# リソース使用率確認
kubectl top pods -n sample-apps
kubectl top pods -n nginx-gateway

# Gateway Controller設定確認
kubectl get configmap nginx-gateway-config -n nginx-gateway -o yaml

# コネクション数確認
kubectl exec -n nginx-gateway deployment/nginx-gateway-controller -- ss -tuln
```

**解決策**:
```yaml
# Gateway Controller のリソース増加
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# レプリカ数の増加
spec:
  replicas: 3
```

## デバッグ用のコマンド集

### 基本的な状況確認
```bash
# すべてのGateway APIリソース確認
kubectl get gatewayclass,gateway,httproute -A

# 詳細状態確認
kubectl describe gatewayclass nginx-gateway-class
kubectl describe gateway basic-gateway -n gateway-api-system
kubectl describe httproute -n sample-apps

# イベント確認
kubectl get events -A --sort-by='.lastTimestamp' | grep -i gateway

# ログ確認
kubectl logs -n nginx-gateway deployment/nginx-gateway-controller
kubectl logs -n sample-apps deployment/frontend-app
kubectl logs -n sample-apps deployment/api-app
```

### ネットワーク接続テスト
```bash
# クラスター内テスト
kubectl run debug-pod --image=curlimages/curl -it --rm -- sh

# Pod内で実行（Hostヘッダー付き）
curl -H "Host: frontend.local" http://nginx-gateway-controller.nginx-gateway.svc.cluster.local/
curl -H "Host: api.local" http://nginx-gateway-controller.nginx-gateway.svc.cluster.local/api/health

# DNS解決確認
nslookup frontend-service.sample-apps.svc.cluster.local
nslookup nginx-gateway-controller.nginx-gateway.svc.cluster.local
```

### 設定確認用スクリプト
```bash
#!/bin/bash
# debug-check.sh

echo "=== Gateway API リソース状況 ==="
kubectl get gatewayclass,gateway,httproute -A -o wide

echo "=== Pod状況 ==="
kubectl get pods -n nginx-gateway -o wide
kubectl get pods -n sample-apps -o wide

echo "=== Service状況 ==="
kubectl get service -n nginx-gateway
kubectl get service -n sample-apps

echo "=== イベント（最新10件） ==="
kubectl get events -A --sort-by='.lastTimestamp' | tail -10

echo "=== Gateway詳細 ==="
kubectl describe gateway basic-gateway -n gateway-api-system
```

## 予防策とベストプラクティス

### 1. リソース監視
```yaml
# ResourceQuotaの設定
apiVersion: v1
kind: ResourceQuota
metadata:
  name: gateway-api-quota
  namespace: sample-apps
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 2Gi
    limits.cpu: "2"
    limits.memory: 4Gi
```

### 2. ヘルスチェックの設定
```yaml
# Readiness/Liveness Probeの追加
containers:
- name: nginx
  image: nginx:1.21
  readinessProbe:
    httpGet:
      path: /health
      port: 80
    initialDelaySeconds: 5
    periodSeconds: 10
  livenessProbe:
    httpGet:
      path: /health
      port: 80
    initialDelaySeconds: 30
    periodSeconds: 30
```

### 3. ログレベルの調整
```yaml
# デバッグ用のログ設定
data:
  config.yaml: |
    logging:
      level: debug  # 本番では info
    observability:
      metrics:
        enabled: true
```

## サポートが必要な場合

### 1. 情報収集
```bash
# サポート用の情報収集スクリプト
./scripts/collect-debug-info.sh > gateway-api-debug.log
```

### 2. 最小再現環境の作成
```bash
# 最小構成でのテスト
kubectl apply -f manifests/01-gatewayclass.yaml
kubectl apply -f manifests/02-gateway.yaml
# 問題の切り分け
```

### 3. コミュニティリソース
- [Gateway API GitHub](https://github.com/kubernetes-sigs/gateway-api)
- [Kubernetes Slack #gateway-api](https://kubernetes.slack.com/channels/gateway-api)
- [Gateway API Documentation](https://gateway-api.sigs.k8s.io/)

このトラブルシューティングガイドを使用して、Gateway API Phase 1の問題を効率的に解決してください。
