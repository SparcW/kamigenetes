# 🌐 ステートレスアプリケーション - Webアプリのデプロイ

kubectl基本操作を習得した次のステップとして、実際のWebアプリケーションをKubernetesでデプロイします。AWS ECS経験者向けに、ECS ServiceからKubernetes DeploymentとServiceへの移行を実践的に学習します。

## 🎯 学習目標

このチュートリアルを完了すると、以下ができるようになります：
- Deploymentを使用したアプリケーションのデプロイ
- ServiceによるPodへのアクセス設定
- ReplicaSetによるスケーリング
- ローリングアップデートの実行
- AWS ECS ServiceとKubernetes Serviceの違いの理解

## 📋 前提条件

- [kubectl基本操作](./kubernetes-basics.md) チュートリアル完了
- Kubernetesクラスターが起動済み
- 基本的なYAML編集スキル

## 🚀 Step 1: シンプルなWebアプリのデプロイ

### 1.1 Deployment の作成

```yaml
# web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"
          limits:
            memory: "128Mi"
            cpu: "500m"
        env:
        - name: ENVIRONMENT
          value: "production"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 1.2 AWS ECS Task Definition との比較

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| **Task Definition** | Deployment | アプリケーションの実行仕様 |
| **Desired Count** | spec.replicas | 実行するインスタンス数 |
| **Container Definition** | spec.template.spec.containers | コンテナの設定 |
| **Health Check** | livenessProbe/readinessProbe | ヘルスチェック設定 |
| **CPU/Memory** | resources.requests/limits | リソース制限 |

### 1.3 デプロイと確認

```bash
# Deploymentの作成
kubectl apply -f web-deployment.yaml

# 作成状況の確認
kubectl get deployments
kubectl get replicasets
kubectl get pods

# 詳細な状態確認
kubectl describe deployment web-app

# ログの確認
kubectl logs -l app=web-app
```

## 🌐 Step 2: Service によるアクセス設定

### 2.1 ClusterIP Service の作成

```yaml
# web-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
  labels:
    app: web-app
spec:
  type: ClusterIP
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
```

```bash
# Serviceの作成
kubectl apply -f web-service.yaml

# Service確認
kubectl get services
kubectl describe service web-app-service

# エンドポイント確認
kubectl get endpoints web-app-service
```

### 2.2 NodePort Service でのテスト

```yaml
# web-service-nodeport.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-nodeport
spec:
  type: NodePort
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080
    protocol: TCP
```

```bash
# NodePort Serviceの作成
kubectl apply -f web-service-nodeport.yaml

# アクセステスト（minikube環境）
minikube service web-app-nodeport --url
curl $(minikube service web-app-nodeport --url)

# ポートフォワードでのテスト
kubectl port-forward service/web-app-service 8080:80
curl http://localhost:8080
```

## 📈 Step 3: スケーリングとアップデート

### 3.1 水平スケーリング

```bash
# レプリカ数の変更
kubectl scale deployment web-app --replicas=5

# スケーリング確認
kubectl get pods -l app=web-app
kubectl get deployment web-app

# 自動スケーリング（HPA）の設定
kubectl autoscale deployment web-app --cpu-percent=50 --min=1 --max=10

# HPA確認
kubectl get hpa
```

### 3.2 ローリングアップデート

```bash
# イメージの更新
kubectl set image deployment/web-app nginx=nginx:1.22

# アップデート状況の監視
kubectl rollout status deployment/web-app

# アップデート履歴の確認
kubectl rollout history deployment/web-app

# ロールバック（必要に応じて）
kubectl rollout undo deployment/web-app

# 特定のリビジョンへのロールバック
kubectl rollout undo deployment/web-app --to-revision=1
```

### 3.3 AWS ECS vs Kubernetes のデプロイ比較

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **更新方式** | Rolling Update | Rolling Update |
| **インスタンス管理** | Desired Count | Replicas |
| **ヘルスチェック** | ELB Health Check | Probes |
| **ロールバック** | 前タスク定義に戻す | kubectl rollout undo |
| **デプロイ戦略** | サービス設定 | Deployment戦略 |

## 🔧 Step 4: 設定の外部化

### 4.1 ConfigMap による設定管理

```yaml
# web-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  nginx.conf: |
    server {
        listen 80;
        server_name localhost;
        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
        }
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
  index.html: |
    <!DOCTYPE html>
    <html>
    <head><title>Kubernetes App</title></head>
    <body>
        <h1>Hello from Kubernetes!</h1>
        <p>Pod: $HOSTNAME</p>
        <p>Environment: $ENVIRONMENT</p>
    </body>
    </html>
```

### 4.2 ConfigMapを使用したDeployment

```yaml
# web-deployment-with-config.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-with-config
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app-with-config
  template:
    metadata:
      labels:
        app: web-app-with-config
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
        volumeMounts:
        - name: config-volume
          mountPath: /etc/nginx/conf.d
          subPath: nginx.conf
        - name: html-volume
          mountPath: /usr/share/nginx/html
          subPath: index.html
        env:
        - name: ENVIRONMENT
          value: "kubernetes"
      volumes:
      - name: config-volume
        configMap:
          name: web-config
          items:
          - key: nginx.conf
            path: default.conf
      - name: html-volume
        configMap:
          name: web-config
          items:
          - key: index.html
            path: index.html
```

## 🔍 Step 5: モニタリングとログ

### 5.1 リソース使用状況の確認

```bash
# リソース使用量の確認
kubectl top pods -l app=web-app
kubectl top nodes

# Pod詳細情報
kubectl describe pods -l app=web-app

# イベントの確認
kubectl get events --sort-by=.metadata.creationTimestamp
```

### 5.2 ログの監視

```bash
# 全Podのログを同時に確認
kubectl logs -l app=web-app --tail=100 -f

# 特定Podのログ
kubectl logs web-app-[tab補完] -f

# 前のコンテナのログ（再起動時）
kubectl logs web-app-[pod-id] --previous
```

## 🧪 実践演習

### 演習 1: カスタムWebアプリのデプロイ

```yaml
# custom-app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: custom-web-app
  template:
    metadata:
      labels:
        app: custom-web-app
    spec:
      containers:
      - name: app
        image: httpd:2.4
        ports:
        - containerPort: 80
        env:
        - name: APACHE_LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "32Mi"
            cpu: "100m"
          limits:
            memory: "64Mi"
            cpu: "200m"
```

### 演習 2: マルチコンテナPod

```yaml
# multi-container-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-container-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: multi-container-app
  template:
    metadata:
      labels:
        app: multi-container-app
    spec:
      containers:
      - name: web
        image: nginx:1.21
        ports:
        - containerPort: 80
        volumeMounts:
        - name: shared-volume
          mountPath: /usr/share/nginx/html
      - name: content-generator
        image: busybox:1.35
        command: ['sh', '-c']
        args:
        - while true; do
            echo "<h1>Generated at $(date)</h1>" > /shared/index.html;
            sleep 60;
          done
        volumeMounts:
        - name: shared-volume
          mountPath: /shared
      volumes:
      - name: shared-volume
        emptyDir: {}
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. Pod が Pending 状態
```bash
# リソース不足の確認
kubectl describe nodes
kubectl describe pod [pod-name]

# リソース要求の調整
# deployment.yaml の resources.requests を削減
```

#### 2. Service に接続できない
```bash
# サービスとエンドポイントの確認
kubectl get services
kubectl get endpoints [service-name]

# セレクターの確認
kubectl get pods --show-labels
# service.yaml の selector と pod の labels が一致しているか確認
```

#### 3. イメージプルエラー
```bash
# イメージ名の確認
kubectl describe pod [pod-name]

# ローカルでイメージプル確認
docker pull nginx:1.21
```

## 📚 学習チェック

以下の項目をすべて実行できたかチェックしてください：

- [ ] Deploymentを作成・デプロイできた
- [ ] Serviceを作成してPodにアクセスできた
- [ ] レプリカ数を変更（スケーリング）できた
- [ ] ローリングアップデートを実行できた
- [ ] ConfigMapを使用して設定を外部化できた
- [ ] kubectl logsでログを確認できた
- [ ] kubectl topでリソース使用量を確認できた
- [ ] トラブルシューティングを実践できた

## 🎯 理解度クイズ

1. AWS ECSのDesired CountはKubernetesの何に相当しますか？
2. ローリングアップデート中にロールバックするコマンドは？
3. ServiceのselectorとPodのlabelsが一致しない場合、何が起こりますか？

<details>
<summary>答えを見る</summary>

1. **spec.replicas**: Deploymentで指定するレプリカ数
2. **kubectl rollout undo deployment/[name]**
3. **Serviceがエンドポイントを見つけられず、トラフィックが転送されない**

</details>

## 🚀 次のステップ

ステートレスアプリケーションのデプロイお疲れさまでした！

次は **[ステートフルアプリケーション](./stateful-application.md)** で、データベースなどの永続データを扱うアプリケーションのデプロイ方法を学習しましょう。

---

**AWS ECS経験者向けポイント**:
- Deployment ≈ ECS Service だが、より柔軟な設定とライフサイクル管理
- Service ≈ ELB だが、クラスター内部の抽象化レイヤー
- ConfigMap ≈ Parameter Store だが、より直接的なファイル・環境変数注入
