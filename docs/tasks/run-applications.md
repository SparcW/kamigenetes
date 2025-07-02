# 🚀 アプリケーション実行 - デプロイメント戦略

このタスクガイドでは、Kubernetesにおけるアプリケーションの実行とデプロイメント戦略を解説します。AWS ECS経験者向けに、Service更新やBlue/Greenデプロイとの比較を交えながら、Rolling Update、Canaryデプロイ、Blue/Green戦略の実践的な実装方法を説明します。

## 🎯 対象タスク

- **デプロイメント戦略**: Rolling Update、Blue/Green、Canary
- **アプリケーションライフサイクル**: 起動、更新、停止、ロールバック
- **スケーリング**: 水平・垂直スケーリング、オートスケーリング
- **高可用性**: 複数AZ展開、障害対応

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 実装のポイント |
|------|---------|------------|---------------|
| **デプロイ戦略** | Rolling Update | 複数戦略選択可能 | より柔軟な戦略実装 |
| **スケーリング** | Auto Scaling | HPA/VPA | メトリクス種類が豊富 |
| **ロールバック** | Previous Revision | 履歴管理機能 | きめ細かいバージョン管理 |
| **AZ展開** | Availability Zone | Node Affinity | ノード配置制御 |

## 🎨 1. デプロイメント戦略の実装

### Rolling Update（ローリング更新）

```yaml
# rolling-update-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-application
  labels:
    app: web-application
    version: v1.0.0
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 2    # 同時に停止可能なPod数
      maxSurge: 2          # 同時に追加可能なPod数
  selector:
    matchLabels:
      app: web-application
  template:
    metadata:
      labels:
        app: web-application
        version: v1.0.0
    spec:
      containers:
      - name: web
        image: web-app:v1.0.0
        ports:
        - containerPort: 8080
        
        # 重要: 適切なヘルスチェック設定
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Graceful shutdown設定
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        env:
        - name: APP_VERSION
          value: "v1.0.0"
        - name: SHUTDOWN_TIMEOUT
          value: "30"
      
      # Graceful shutdown設定
      terminationGracePeriodSeconds: 45
---
apiVersion: v1
kind: Service
metadata:
  name: web-application-service
  labels:
    app: web-application
spec:
  selector:
    app: web-application
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
  type: ClusterIP
```

### Blue/Green デプロイメント

```yaml
# blue-green-deployment.yaml
# Blue環境（現在の本番環境）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-blue
  labels:
    app: web-app
    version: blue
    environment: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
      version: blue
  template:
    metadata:
      labels:
        app: web-app
        version: blue
        environment: production
    spec:
      containers:
      - name: web
        image: web-app:v1.0.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# Green環境（新バージョン）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-green
  labels:
    app: web-app
    version: green
    environment: staging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
      version: green
  template:
    metadata:
      labels:
        app: web-app
        version: green
        environment: staging
    spec:
      containers:
      - name: web
        image: web-app:v1.1.0  # 新バージョン
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# 本番サービス（Blue環境に向いている）
apiVersion: v1
kind: Service
metadata:
  name: web-app-production
  labels:
    environment: production
spec:
  selector:
    app: web-app
    version: blue  # 最初はBlue環境
  ports:
  - port: 80
    targetPort: 8080
---
# テスト用サービス（Green環境）
apiVersion: v1
kind: Service
metadata:
  name: web-app-staging
  labels:
    environment: staging
spec:
  selector:
    app: web-app
    version: green
  ports:
  - port: 80
    targetPort: 8080
```

```bash
# Blue/Green デプロイメント実行手順

# 1. Green環境のデプロイ
kubectl apply -f blue-green-deployment.yaml

# 2. Green環境の動作確認
kubectl get pods -l version=green
kubectl port-forward service/web-app-staging 8080:80
# http://localhost:8080 でテスト

# 3. 本番トラフィックをGreenに切り替え
kubectl patch service web-app-production -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 切り替え確認
kubectl get service web-app-production -o yaml | grep -A 5 selector

# 5. 問題なければBlue環境を削除
kubectl delete deployment web-app-blue

# 6. ロールバックが必要な場合
kubectl patch service web-app-production -p '{"spec":{"selector":{"version":"blue"}}}'
```

### Canary デプロイメント

```yaml
# canary-deployment.yaml
# メイン（安定版）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-stable
  labels:
    app: web-app
    version: stable
spec:
  replicas: 9  # 90%のトラフィック
  selector:
    matchLabels:
      app: web-app
      version: stable
  template:
    metadata:
      labels:
        app: web-app
        version: stable
    spec:
      containers:
      - name: web
        image: web-app:v1.0.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# Canary（新バージョン）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-canary
  labels:
    app: web-app
    version: canary
spec:
  replicas: 1  # 10%のトラフィック
  selector:
    matchLabels:
      app: web-app
      version: canary
  template:
    metadata:
      labels:
        app: web-app
        version: canary
    spec:
      containers:
      - name: web
        image: web-app:v1.1.0  # 新バージョン
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# Service（両バージョンに負荷分散）
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
spec:
  selector:
    app: web-app  # versionラベルは指定しない
  ports:
  - port: 80
    targetPort: 8080
```

```bash
# Canary デプロイメント段階的展開

# フェーズ1: 10% Canary
kubectl apply -f canary-deployment.yaml
kubectl scale deployment web-app-stable --replicas=9
kubectl scale deployment web-app-canary --replicas=1

# メトリクス監視（エラー率、レイテンシー等）
kubectl top pods -l app=web-app

# フェーズ2: 25% Canary（問題なければ）
kubectl scale deployment web-app-stable --replicas=6
kubectl scale deployment web-app-canary --replicas=2

# フェーズ3: 50% Canary
kubectl scale deployment web-app-stable --replicas=5
kubectl scale deployment web-app-canary --replicas=5

# フェーズ4: 100% Canary（完全移行）
kubectl scale deployment web-app-stable --replicas=0
kubectl scale deployment web-app-canary --replicas=10

# 完了後: 安定版の更新
kubectl set image deployment/web-app-stable web=web-app:v1.1.0
kubectl scale deployment web-app-stable --replicas=10
kubectl delete deployment web-app-canary
```

## 📈 2. オートスケーリング

### Horizontal Pod Autoscaler (HPA)

```yaml
# hpa-setup.yaml
# Metrics Server（必要に応じて）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metrics-server
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: metrics-server
  template:
    metadata:
      labels:
        k8s-app: metrics-server
    spec:
      containers:
      - name: metrics-server
        image: k8s.gcr.io/metrics-server/metrics-server:latest
        args:
        - --cert-dir=/tmp
        - --secure-port=4443
        - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
        - --kubelet-use-node-status-port
        - --metric-resolution=15s
        - --kubelet-insecure-tls  # 開発環境のみ
        resources:
          requests:
            cpu: 100m
            memory: 200Mi
---
# HPA設定
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-application
  minReplicas: 2
  maxReplicas: 20
  metrics:
  # CPU使用率ベース
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  # メモリ使用率ベース
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  # カスタムメトリクス（リクエスト数）
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  
  # スケーリング動作の調整
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
```

### Vertical Pod Autoscaler (VPA)

```yaml
# vpa-setup.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-application
  updatePolicy:
    updateMode: "Auto"  # Auto, Recreation, Initial, Off
  resourcePolicy:
    containerPolicies:
    - containerName: web
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 1000m
        memory: 1Gi
      controlledResources: ["cpu", "memory"]
      controlledValues: RequestsAndLimits
```

### Cluster Autoscaler

```yaml
# cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/my-cluster
        - --balance-similar-node-groups
        - --scale-down-enabled=true
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
        - --scale-down-utilization-threshold=0.5
        env:
        - name: AWS_REGION
          value: us-west-2
```

## 🏗️ 3. 高可用性デプロイメント

### マルチAZ展開

```yaml
# multi-az-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ha-web-application
  labels:
    app: ha-web-application
spec:
  replicas: 6
  selector:
    matchLabels:
      app: ha-web-application
  template:
    metadata:
      labels:
        app: ha-web-application
    spec:
      # Pod Anti-Affinity（同じノードに配置しない）
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - ha-web-application
              topologyKey: kubernetes.io/hostname
        
        # Node Affinity（複数AZに分散）
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 50
            preference:
              matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values:
                - us-west-2a
                - us-west-2b
                - us-west-2c
      
      containers:
      - name: web
        image: ha-web-app:v1.0.0
        ports:
        - containerPort: 8080
        
        # リソース制限（重要）
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # ヘルスチェック
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
      
      # 優雅な停止
      terminationGracePeriodSeconds: 30
---
# Pod Disruption Budget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ha-web-application-pdb
spec:
  minAvailable: 3  # 最低3個のPodは稼働維持
  selector:
    matchLabels:
      app: ha-web-application
```

### データベース高可用性

```yaml
# ha-database.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-ha
spec:
  serviceName: postgres-ha-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres-ha
  template:
    metadata:
      labels:
        app: postgres-ha
    spec:
      # 各AZに分散配置
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - postgres-ha
            topologyKey: topology.kubernetes.io/zone
      
      initContainers:
      - name: postgres-init
        image: postgres:15
        command:
        - bash
        - -c
        - |
          if [ "$HOSTNAME" = "postgres-ha-0" ]; then
            echo "primary" > /shared/role
          else
            echo "replica" > /shared/role
          fi
        volumeMounts:
        - name: shared-data
          mountPath: /shared
      
      containers:
      - name: postgres
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "myapp"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: shared-data
          mountPath: /shared
        
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      
      volumes:
      - name: shared-data
        emptyDir: {}
  
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: gp3
      resources:
        requests:
          storage: 100Gi
```

## 🔄 4. CI/CD統合

### GitOps with ArgoCD

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web-application
  namespace: argocd
  labels:
    app: web-application
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/k8s-manifests
    targetRevision: main
    path: applications/web-app
    helm:
      valueFiles:
      - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
    - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
---
# Multi-Environment Strategy
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: web-application-set
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - cluster: development
        url: https://dev-cluster.example.com
        namespace: development
        valueFile: values-dev.yaml
      - cluster: staging
        url: https://staging-cluster.example.com
        namespace: staging
        valueFile: values-staging.yaml
      - cluster: production
        url: https://prod-cluster.example.com
        namespace: production
        valueFile: values-prod.yaml
  template:
    metadata:
      name: 'web-app-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/k8s-manifests
        targetRevision: main
        path: applications/web-app
        helm:
          valueFiles:
          - '{{valueFile}}'
      destination:
        server: '{{url}}'
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

## 🧪 実践演習

### 演習1: Rolling Update

```bash
# 初期デプロイ
kubectl apply -f rolling-update-deployment.yaml

# イメージ更新
kubectl set image deployment/web-application web=web-app:v1.1.0

# 更新プロセス監視
kubectl rollout status deployment/web-application -w

# 履歴確認
kubectl rollout history deployment/web-application

# ロールバック
kubectl rollout undo deployment/web-application
```

### 演習2: Canary デプロイ

```bash
# Canaryデプロイ実行
kubectl apply -f canary-deployment.yaml

# トラフィック分散確認
for i in {1..20}; do
  kubectl exec -it deploy/test-client -- curl -s web-app-service/version
done

# 段階的拡張
kubectl scale deployment web-app-canary --replicas=3
kubectl scale deployment web-app-stable --replicas=7
```

### 演習3: オートスケーリング

```bash
# HPA設定
kubectl apply -f hpa-setup.yaml

# 負荷テスト
kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- /bin/sh
# while true; do wget -q -O- http://web-application-service; done

# スケーリング確認
kubectl get hpa web-app-hpa -w
kubectl get pods -l app=web-application -w
```

## 🎯 ベストプラクティス

### デプロイメント設計

1. **適切な戦略選択**
   - **Rolling Update**: 通常のアプリケーション更新
   - **Blue/Green**: ダウンタイム回避が重要
   - **Canary**: リスク最小化が重要

2. **ヘルスチェック設定**
   ```yaml
   readinessProbe:
     httpGet:
       path: /health/ready
       port: 8080
     initialDelaySeconds: 10
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 3
   ```

3. **リソース制限**
   ```yaml
   resources:
     requests:
       memory: "256Mi"
       cpu: "200m"
     limits:
       memory: "512Mi"
       cpu: "500m"
   ```

### 運用考慮事項

1. **監視とアラート**
   - デプロイメントの進行状況
   - アプリケーションメトリクス
   - エラー率の監視

2. **ロールバック準備**
   - 自動ロールバック条件
   - 手動ロールバック手順
   - データベース変更の考慮

## 🚨 トラブルシューティング

### よくある問題

1. **デプロイメントが進まない**
   ```bash
   # Pod状態確認
   kubectl get pods -l app=web-application
   kubectl describe pod <pod-name>
   
   # イベント確認
   kubectl get events --sort-by=.metadata.creationTimestamp
   ```

2. **ヘルスチェック失敗**
   ```bash
   # ヘルスチェックエンドポイント確認
   kubectl port-forward pod/<pod-name> 8080:8080
   curl http://localhost:8080/health
   
   # ログ確認
   kubectl logs <pod-name>
   ```

3. **リソース不足**
   ```bash
   # ノードリソース確認
   kubectl top nodes
   kubectl describe node <node-name>
   
   # Pod リソース確認
   kubectl top pods
   ```

## 📚 参考リソース

- **[Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)**
- **[Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)**
- **[Vertical Pod Autoscaling](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)**
- **[ArgoCD](https://argo-cd.readthedocs.io/)**

---

**関連タスク**: [オブジェクト管理](./manage-objects.md) → [ネットワーキング](./networking.md) → [監視・ログ](./monitoring-logging.md)
