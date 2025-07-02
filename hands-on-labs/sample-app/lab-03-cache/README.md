# Lab 3: キャッシュ層のデプロイ

## 概要

このラボでは、Redisキャッシュサーバーをデプロイし、Kubernetesでのステートレスサービスの管理について学習します。AWS ECS + ElastiCacheとの違いを理解しながら、内部サービス間通信とパフォーマンス最適化について実践します。

## 学習目標

このラボを完了すると、以下ができるようになります：

- [ ] ステートレスサービス（Redis）をDeploymentでデプロイする
- [ ] 複数レプリカでの負荷分散を設定する
- [ ] サービス間通信でキャッシュを活用する
- [ ] メモリ制限とリソース管理を適用する
- [ ] Redis接続の監視とパフォーマンステストを実行する

## AWS ECS + ElastiCacheとの比較

| 機能 | AWS ECS + ElastiCache | Kubernetes |
|------|----------------------|------------|
| **キャッシュサービス** | ElastiCache Redis | Pod内Redis |
| **スケーリング** | ElastiCacheの設定 | Deployment replicas |
| **可用性** | Multi-AZ | 複数レプリカ + アンチアフィニティ |
| **接続管理** | エンドポイント | Service |
| **監視** | CloudWatch | kubectl + メトリクス |
| **設定管理** | Parameter Group | ConfigMap |
| **バックアップ** | 自動スナップショット | 手動またはOperator |

## 前提条件

- [Lab 1: ネームスペースとリソース管理](../lab-01-namespace/README.md)が完了していること
- [Lab 2: データベース層のデプロイ](../lab-02-database/README.md)が完了していること
- `sample-app` ネームスペースと関連リソースが作成済みであること

## 手順

### ステップ 1: RedisのDeployment作成

```bash
# Redisのデプロイメントファイルを確認
cat ../kubernetes/redis/redis-deployment.yaml
```

**redis-deployment.yaml の内容:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-deployment
  namespace: sample-app
  labels:
    app: sample-app
    component: redis
    tier: cache
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sample-app
      component: redis
  template:
    metadata:
      labels:
        app: sample-app
        component: redis
        tier: cache
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: component
                  operator: In
                  values:
                  - redis
              topologyKey: kubernetes.io/hostname
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --maxmemory
        - 128mb
        - --maxmemory-policy
        - allkeys-lru
        - --save
        - ""
        - --appendonly
        - "no"
        env:
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: REDIS_PORT
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: redis-config
          mountPath: /usr/local/etc/redis/redis.conf
          subPath: redis.conf
      volumes:
      - name: redis-config
        configMap:
          name: redis-config
```

まず、Redis設定用のConfigMapを作成します：

```bash
# Redis設定用ConfigMapを作成
kubectl create configmap redis-config -n sample-app \
  --from-literal=redis.conf="
bind 0.0.0.0
port 6379
timeout 0
tcp-keepalive 0
loglevel notice
databases 16
save \"\"
stop-writes-on-bgsave-error no
maxmemory 100mb
maxmemory-policy allkeys-lru
"

# ConfigMapの確認
kubectl get configmap redis-config -n sample-app -o yaml
```

Redisデプロイメントを作成します：

```bash
# Redisデプロイメントの作成
kubectl apply -f ../kubernetes/redis/redis-deployment.yaml

# デプロイ状況の確認
kubectl get deployments -n sample-app -l component=redis

# Podの状態確認
kubectl get pods -n sample-app -l component=redis -o wide

# Pod分散の確認（アンチアフィニティ効果）
kubectl get pods -n sample-app -l component=redis -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName
```

**AWS ECS管理者向け解説**:
- ECSのサービス + タスク定義に相当
- アンチアフィニティでPodを異なるノードに分散配置
- ElastiCacheと異なり、設定をConfigMapで管理

### ステップ 2: RedisのService作成

```bash
# Redisサービスファイルの確認
cat ../kubernetes/redis/redis-service.yaml
```

**redis-service.yaml の内容:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: sample-app
  labels:
    app: sample-app
    component: redis
    tier: cache
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
    protocol: TCP
    name: redis
  selector:
    app: sample-app
    component: redis
  sessionAffinity: None
```

Serviceを作成します：

```bash
# Redisサービスの作成
kubectl apply -f ../kubernetes/redis/redis-service.yaml

# サービスの確認
kubectl get services -n sample-app -l component=redis

# サービスの詳細確認
kubectl describe service redis-service -n sample-app

# エンドポイントの確認
kubectl get endpoints redis-service -n sample-app
```

**AWS ECS管理者向け解説**:
- ECSのService DiscoveryやALBに相当
- 複数のRedisPod間で自動的に負荷分散
- sessionAffinityはNoneで完全にランダム

### ステップ 3: Redis接続テストと動作確認

```bash
# Redis Podが完全に起動するまで待機
kubectl wait --for=condition=ready pod -l component=redis -n sample-app --timeout=300s

# Redis接続テスト（直接Pod接続）
REDIS_POD=$(kubectl get pods -n sample-app -l component=redis -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli ping

# Redis情報確認
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli info server

# 基本的なRedis操作テスト
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli set test "Hello Redis"
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli get test
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli del test
```

### ステップ 4: Service経由での接続テスト

```bash
# テスト用Podを起動してService経由で接続
kubectl run redis-client --image=redis:7-alpine --rm -it --restart=Never -n sample-app -- sh

# Pod内で以下のコマンドを実行:
# redis-cli -h redis-service -p 6379 ping
# redis-cli -h redis-service -p 6379 info replication
# redis-cli -h redis-service -p 6379 set service-test "Connected via Service"
# redis-cli -h redis-service -p 6379 get service-test
# exit
```

### ステップ 5: 負荷分散の確認

複数のRedisインスタンス間での負荷分散を確認します：

```bash
# 各Redis Podにユニークなデータを設定
REDIS_PODS=($(kubectl get pods -n sample-app -l component=redis -o jsonpath='{.items[*].metadata.name}'))

for i in "${!REDIS_PODS[@]}"; do
  POD=${REDIS_PODS[$i]}
  echo "Setting data in Pod $POD"
  kubectl exec -n sample-app $POD -- redis-cli set "pod-id" "$POD"
  kubectl exec -n sample-app $POD -- redis-cli set "instance-$i" "data-from-pod-$i"
done

# Service経由での接続で、どのPodに接続されているか確認
for i in {1..10}; do
  echo "Connection $i:"
  kubectl run temp-client-$i --image=redis:7-alpine --rm --restart=Never -n sample-app -- redis-cli -h redis-service get pod-id
done
```

### ステップ 6: パフォーマンステストとモニタリング

```bash
# Redis性能テスト
kubectl run redis-benchmark --image=redis:7-alpine --rm -it --restart=Never -n sample-app -- redis-benchmark -h redis-service -p 6379 -n 1000 -c 10

# メモリ使用量の監視
kubectl top pod -n sample-app -l component=redis

# Redis統計情報の確認
kubectl exec -n sample-app $REDIS_POD -- redis-cli info memory
kubectl exec -n sample-app $REDIS_POD -- redis-cli info stats

# 詳細なパフォーマンス監視
kubectl exec -n sample-app $REDIS_POD -- redis-cli monitor &
MONITOR_PID=$!

# テストデータの投入
kubectl run load-test --image=redis:7-alpine --rm --restart=Never -n sample-app -- sh -c "
for i in \$(seq 1 50); do
  redis-cli -h redis-service set test-key-\$i \"test-value-\$i\"
  redis-cli -h redis-service get test-key-\$i
done
"

# モニタリング停止
kill $MONITOR_PID 2>/dev/null || true
```

### ステップ 7: スケーリングテスト

```bash
# 現在のレプリカ数確認
kubectl get deployment redis-deployment -n sample-app

# スケールアウト（3レプリカに増加）
kubectl scale deployment redis-deployment -n sample-app --replicas=3

# スケーリング状況の監視
kubectl get pods -n sample-app -l component=redis -w &
WATCH_PID=$!

# スケーリング完了まで待機
kubectl wait --for=condition=ready pod -l component=redis -n sample-app --timeout=300s

# 監視停止
kill $WATCH_PID 2>/dev/null || true

# 新しいエンドポイントの確認
kubectl get endpoints redis-service -n sample-app

# スケールイン（元の2レプリカに戻す）
kubectl scale deployment redis-deployment -n sample-app --replicas=2

# スケールイン完了確認
kubectl get pods -n sample-app -l component=redis
```

**AWS ECS管理者向け解説**:
- ECSのサービス更新でタスク数を変更するのと同等
- Kubernetesでは即座にService Endpointsが更新される
- 負荷分散は自動的に新しいPodを含める

### ステップ 8: 障害復旧テスト

```bash
# 現在のPod状態確認
kubectl get pods -n sample-app -l component=redis

# 1つのPodを削除（障害をシミュレート）
REDIS_POD_TO_DELETE=$(kubectl get pods -n sample-app -l component=redis -o jsonpath='{.items[0].metadata.name}')
echo "Deleting pod: $REDIS_POD_TO_DELETE"
kubectl delete pod $REDIS_POD_TO_DELETE -n sample-app

# 自動復旧の監視
kubectl get pods -n sample-app -l component=redis -w &
WATCH_PID=$!

# 復旧完了まで待機
kubectl wait --for=condition=ready pod -l component=redis -n sample-app --timeout=300s

# 監視停止
kill $WATCH_PID 2>/dev/null || true

# 復旧後のサービス可用性確認
kubectl run recovery-test --image=redis:7-alpine --rm --restart=Never -n sample-app -- redis-cli -h redis-service ping

echo "Recovery test completed successfully"
```

## 運用監視とメンテナンス

### Redis監視コマンド

```bash
# リアルタイム監視ダッシュボード
kubectl exec -n sample-app -it $REDIS_POD -- redis-cli --latency

# Redis設定の確認
kubectl exec -n sample-app $REDIS_POD -- redis-cli config get "*"

# 接続状況の確認
kubectl exec -n sample-app $REDIS_POD -- redis-cli info clients

# メモリ使用量詳細
kubectl exec -n sample-app $REDIS_POD -- redis-cli info memory

# レプリケーション状況（今回は単独インスタンスのため無し）
kubectl exec -n sample-app $REDIS_POD -- redis-cli info replication
```

### ログとトラブルシューティング

```bash
# Redis Podのログ確認
kubectl logs -n sample-app -l component=redis --tail=50

# 全Redis Podのログを並列確認
kubectl logs -n sample-app -l component=redis --tail=20 -f

# 特定Podの詳細状態
kubectl describe pod -n sample-app $REDIS_POD

# Serviceのトラブルシューティング
kubectl describe service redis-service -n sample-app
```

## 動作確認チェックリスト

以下のすべてが正常に動作することを確認してください：

```bash
# 1. Deploymentの状態確認
echo "=== Redis Deployment Status ==="
kubectl get deployment redis-deployment -n sample-app

# 2. Pod状態確認
echo "=== Redis Pods Status ==="
kubectl get pods -n sample-app -l component=redis

# 3. Service状態確認
echo "=== Redis Service Status ==="
kubectl get service redis-service -n sample-app

# 4. Redis接続確認
echo "=== Redis Connection Test ==="
kubectl run connection-test --image=redis:7-alpine --rm --restart=Never -n sample-app -- redis-cli -h redis-service ping

# 5. データ読み書きテスト
echo "=== Redis Data Test ==="
kubectl run data-test --image=redis:7-alpine --rm --restart=Never -n sample-app -- sh -c "
redis-cli -h redis-service set test-key 'test-value'
redis-cli -h redis-service get test-key
redis-cli -h redis-service del test-key
"

# 6. パフォーマンステスト
echo "=== Redis Performance Test ==="
kubectl run perf-test --image=redis:7-alpine --rm --restart=Never -n sample-app -- redis-benchmark -h redis-service -n 100 -q

# 7. リソース使用量確認
echo "=== Resource Usage ==="
kubectl top pod -n sample-app -l component=redis
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. PodがCrashLoopBackOffになる

```bash
# Pod状態の詳細確認
kubectl describe pod -n sample-app -l component=redis

# Redis設定の問題確認
kubectl logs -n sample-app -l component=redis --previous

# メモリ制限の確認
kubectl describe pod -n sample-app -l component=redis | grep -A 5 "Limits"
```

#### 2. Service経由で接続できない

```bash
# Service Endpointsの確認
kubectl get endpoints redis-service -n sample-app

# Podのラベル確認
kubectl get pods -n sample-app -l component=redis --show-labels

# ネットワーク接続テスト
kubectl run network-test --image=busybox --rm -it --restart=Never -n sample-app -- sh
# 内部で: telnet redis-service 6379
```

#### 3. メモリ不足でPodが停止する

```bash
# メモリ使用量の確認
kubectl top pod -n sample-app -l component=redis

# リソース制限の調整
kubectl patch deployment redis-deployment -n sample-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"redis","resources":{"limits":{"memory":"256Mi"}}}]}}}}'

# 変更後の確認
kubectl get deployment redis-deployment -n sample-app -o yaml | grep -A 10 resources
```

## 学習ポイント

### AWS ECS + ElastiCacheとKubernetesの比較

1. **管理責任**
   - ECS + ElastiCache: AWSがキャッシュ管理
   - K8s: 自分でRedisインスタンスを管理

2. **スケーリング**
   - ElastiCache: ノードグループ追加/削除
   - K8s: レプリカ数の調整

3. **高可用性**
   - ElastiCache: Multi-AZ、フェイルオーバー
   - K8s: Pod分散、自動復旧

4. **監視**
   - ElastiCache: CloudWatch統合
   - K8s: 手動監視、サードパーティーツール

## 次のステップ

このラボで学習した内容：
- ✅ ステートレスサービスのDeployment
- ✅ 複数レプリカでの負荷分散
- ✅ Service経由の内部通信
- ✅ リソース制限とパフォーマンス監視
- ✅ 自動スケーリングと障害復旧

次は[Lab 4: Webアプリケーション層のデプロイ](../lab-04-webapp/README.md)で、フロントエンドアプリケーションの外部公開について学習します。

## 関連ドキュメント

- [Deployments詳細ガイド](../../../docs/tutorials/deployments/README.md)
- [Services とネットワーキング](../../../docs/tutorials/services/README.md)
- [Pod Affinity/Anti-affinity](../../../docs/concepts/scheduling.md)
- [リソース管理とモニタリング](../../../docs/tutorials/monitoring/README.md)
