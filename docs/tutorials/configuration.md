# ⚙️ 設定管理 - ConfigMapとSecretの活用

このチュートリアルでは、KubernetesにおけるConfigMapとSecretを使用した設定管理の方法を学習します。AWS ECS経験者向けに、Parameter StoreやSecrets Managerとの比較を交えて解説します。

## 🎯 学習目標

- **ConfigMap**: 非機密設定情報の管理と活用
- **Secret**: 機密情報の安全な取り扱い
- **環境変数**: 設定の注入方法
- **ファイルマウント**: 設定ファイルとしての活用

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 移行のポイント |
|------|---------|------------|---------------|
| **非機密設定** | Parameter Store | ConfigMap | YAML定義での一元管理 |
| **機密情報** | Secrets Manager | Secret | Base64エンコーディング |
| **環境変数** | Task Definition | env/envFrom | より柔軟な注入方法 |
| **設定ファイル** | S3 + initContainer | volumeMount | 宣言的なファイル配置 |

## 🗂️ 1. ConfigMap の基本概念

### ConfigMap の作成方法

#### YAML ファイルから作成

```yaml
# app-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  # キー: 値のペア
  database_host: "postgres-service"
  database_port: "5432"
  database_name: "myapp"
  log_level: "info"
  max_connections: "100"
  timeout: "30s"
  
  # 設定ファイル
  app.properties: |
    server.port=8080
    server.servlet.context-path=/api
    
    # Database settings
    spring.datasource.url=jdbc:postgresql://postgres-service:5432/myapp
    spring.datasource.driver-class-name=org.postgresql.Driver
    
    # Logging
    logging.level.root=INFO
    logging.level.com.myapp=DEBUG
    
  nginx.conf: |
    upstream backend {
        server api-service:8080;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
```

#### コマンドラインから作成

```bash
# リテラル値から作成
kubectl create configmap app-config \
  --from-literal=database_host=postgres-service \
  --from-literal=database_port=5432 \
  --from-literal=log_level=info

# ファイルから作成
kubectl create configmap nginx-config \
  --from-file=nginx.conf=./nginx.conf

# ディレクトリから作成
kubectl create configmap app-configs \
  --from-file=./config-files/

# 環境ファイルから作成
kubectl create configmap env-config \
  --from-env-file=.env
```

### ConfigMap の使用方法

#### 環境変数として使用

```yaml
# deployment-with-configmap.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
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
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        # 方法1: 個別の値を環境変数として使用
        env:
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database_host
        - name: DATABASE_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database_port
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: log_level
        
        # 方法2: ConfigMap全体を環境変数として使用
        envFrom:
        - configMapRef:
            name: app-config
```

#### ボリュームとしてマウント

```yaml
# deployment-with-volume.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-proxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-proxy
  template:
    metadata:
      labels:
        app: nginx-proxy
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
        
        # ConfigMapをファイルとしてマウント
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
          readOnly: true
        - name: app-properties
          mountPath: /app/config
          readOnly: true
          
      volumes:
      # ConfigMap全体をマウント
      - name: nginx-config
        configMap:
          name: app-config
          items:
          - key: nginx.conf
            path: default.conf
      
      # 特定のキーのみをマウント
      - name: app-properties
        configMap:
          name: app-config
          items:
          - key: app.properties
            path: application.properties
```

## 🔐 2. Secret の管理

### Secret の作成方法

#### YAML ファイルから作成

```yaml
# app-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: default
type: Opaque
data:
  # Base64エンコードされた値
  username: cG9zdGdyZXM=  # postgres
  password: bXlzZWNyZXRwYXNzd29yZA==  # mysecretpassword
  api-key: YWJjZGVmZ2hpamtsbW5vcA==  # abcdefghijklmnop
  
stringData:
  # プレーンテキスト（自動的にBase64エンコードされる）
  database-url: "postgresql://postgres:mysecretpassword@postgres-service:5432/myapp"
  jwt-secret: "my-super-secret-jwt-key"
```

#### コマンドラインから作成

```bash
# リテラル値から作成
kubectl create secret generic app-secrets \
  --from-literal=username=postgres \
  --from-literal=password=mysecretpassword \
  --from-literal=api-key=abcdefghijklmnop

# ファイルから作成
kubectl create secret generic tls-certs \
  --from-file=tls.crt=./server.crt \
  --from-file=tls.key=./server.key

# TLS Secret
kubectl create secret tls tls-secret \
  --cert=./server.crt \
  --key=./server.key

# Docker registry認証
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myemail@example.com
```

### Secret の使用方法

#### 環境変数として使用

```yaml
# deployment-with-secrets.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api
        image: myapi:latest
        ports:
        - containerPort: 8080
        
        # 個別のSecret値を環境変数として使用
        env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: password
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: api-key
        
        # Secret全体を環境変数として使用
        envFrom:
        - secretRef:
            name: app-secrets
```

#### ボリュームとしてマウント

```yaml
# deployment-with-secret-volume.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secure-app
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      containers:
      - name: app
        image: myapp:latest
        
        volumeMounts:
        # TLS証明書をファイルとしてマウント
        - name: tls-certs
          mountPath: /etc/tls
          readOnly: true
        
        # アプリケーション設定をファイルとしてマウント
        - name: app-secrets
          mountPath: /etc/secrets
          readOnly: true
          
      volumes:
      - name: tls-certs
        secret:
          secretName: tls-secret
          defaultMode: 0400  # ファイル権限設定
      
      - name: app-secrets
        secret:
          secretName: app-secrets
          items:
          - key: database-url
            path: database.conf
          - key: jwt-secret
            path: jwt.key
```

## 🏗️ 3. 実践的な設定管理パターン

### 環境別設定の管理

```yaml
# base-config.yaml (共通設定)
apiVersion: v1
kind: ConfigMap
metadata:
  name: base-config
data:
  log_format: "json"
  health_check_path: "/health"
  metrics_port: "9090"
---
# development-config.yaml (開発環境)
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-config
  namespace: development
data:
  environment: "development"
  database_host: "postgres-dev"
  log_level: "debug"
  replicas: "1"
---
# production-config.yaml (本番環境)
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-config
  namespace: production
data:
  environment: "production"
  database_host: "postgres-prod"
  log_level: "warn"
  replicas: "3"
```

### 複数設定ソースの組み合わせ

```yaml
# multi-config-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: complex-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: complex-app
  template:
    metadata:
      labels:
        app: complex-app
    spec:
      containers:
      - name: app
        image: complexapp:latest
        
        # 複数のConfigMapとSecretを組み合わせ
        env:
        # 基本設定
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: base-config
              key: log_level
        
        # 機密情報
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: password
        
        # 計算値
        - name: FULL_DATABASE_URL
          value: "postgresql://$(DB_USERNAME):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)"
        
        envFrom:
        # 環境固有設定
        - configMapRef:
            name: env-config
        # 共通設定
        - configMapRef:
            name: base-config
        # 機密情報
        - secretRef:
            name: app-secrets
        
        volumeMounts:
        # 設定ファイル
        - name: app-config
          mountPath: /app/config
        # TLS証明書
        - name: tls-config
          mountPath: /app/tls
          
      volumes:
      - name: app-config
        projected:
          sources:
          - configMap:
              name: base-config
          - configMap:
              name: env-config
          - secret:
              name: app-config-secret
      
      - name: tls-config
        secret:
          secretName: tls-secrets
```

## 🔄 4. 動的設定更新

### ConfigMap の更新と反映

```yaml
# configmap-with-reload.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dynamic-config
data:
  app.yaml: |
    server:
      port: 8080
      max_connections: 100
    
    features:
      feature_a: true
      feature_b: false
    
    cache:
      ttl: 3600
      max_size: 1000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dynamic-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dynamic-app
  template:
    metadata:
      labels:
        app: dynamic-app
      annotations:
        # ConfigMapの変更を検知するためのチェックサム
        configmap/checksum: sha256sum-of-configmap
    spec:
      containers:
      - name: app
        image: dynamic-app:latest
        
        # 設定ファイルの監視
        volumeMounts:
        - name: config
          mountPath: /app/config
          
        # 設定リロード用のシグナル
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "kill -USR1 1"]
              
      volumes:
      - name: config
        configMap:
          name: dynamic-config
```

### 設定の Hot Reload 実装

```bash
# ConfigMap更新スクリプト
#!/bin/bash

# ConfigMapを更新
kubectl patch configmap dynamic-config \
  --patch '{"data":{"app.yaml":"server:\n  port: 8080\n  max_connections: 200\nfeatures:\n  feature_a: true\n  feature_b: true"}}'

# Deploymentを再起動（ConfigMapの変更を反映）
kubectl rollout restart deployment/dynamic-app

# ロールアウト状況の確認
kubectl rollout status deployment/dynamic-app
```

## 🧪 実践演習

### 演習1: 基本的なConfigMapとSecret

1. **ConfigMapの作成と使用**
   ```bash
   # ディレクトリ作成
   mkdir -p config-lab
   cd config-lab
   
   # ConfigMap作成
   kubectl create configmap webapp-config \
     --from-literal=database_url=postgres://localhost:5432/myapp \
     --from-literal=cache_size=100 \
     --from-literal=log_level=info
   
   # 確認
   kubectl get configmap webapp-config -o yaml
   ```

2. **Secretの作成と使用**
   ```bash
   # Secret作成
   kubectl create secret generic webapp-secrets \
     --from-literal=db_password=mysecretpassword \
     --from-literal=api_key=abc123def456
   
   # 確認
   kubectl get secret webapp-secrets -o yaml
   ```

### 演習2: 設定ファイルの管理

1. **設定ファイルの作成**
   ```bash
   # Nginxの設定ファイル
   cat > nginx.conf << 'EOF'
   server {
       listen 80;
       location / {
           proxy_pass http://backend:8080;
           proxy_set_header Host $host;
       }
   }
   EOF
   
   # ConfigMapとして作成
   kubectl create configmap nginx-config --from-file=nginx.conf
   ```

2. **マルチファイル設定**
   ```bash
   # 複数の設定ファイル
   mkdir config-files
   echo "debug=true" > config-files/app.properties
   echo "timeout=30" > config-files/database.properties
   
   kubectl create configmap multi-config --from-file=config-files/
   ```

### 演習3: 環境別設定の実装

```yaml
# kustomization.yaml で環境別管理
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- base-deployment.yaml

configMapGenerator:
- name: env-config
  literals:
  - ENVIRONMENT=development
  - DEBUG=true
  - LOG_LEVEL=debug

secretGenerator:
- name: env-secrets
  literals:
  - DB_PASSWORD=dev-password
  - API_KEY=dev-api-key
```

## 🎯 ベストプラクティス

### セキュリティ

- **Secret管理**: 
  - Base64は暗号化ではない（注意）
  - 外部Secret管理システム（Vault、AWS Secrets Manager）の使用検討
  - 最小権限の原則

- **アクセス制御**:
  ```yaml
  # RBAC での Secret アクセス制限
  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    name: secret-reader
  rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]
    resourceNames: ["app-secrets"]  # 特定のSecretのみ
  ```

### 運用

- **設定の階層化**: 
  - 共通設定 → 環境固有設定 → アプリケーション固有設定
  
- **変更管理**:
  - ConfigMapの変更履歴管理
  - 段階的なロールアウト
  
- **監視**:
  - 設定の一貫性チェック
  - 機密情報の漏洩監視

### パフォーマンス

- **リソース制限**: 大きすぎるConfigMapは避ける（1MB以下推奨）
- **キャッシュ戦略**: 頻繁に変更される設定の適切な管理
- **マウント方式**: 用途に応じたenvかvolumeの選択

## 🚨 トラブルシューティング

### よくある問題

1. **ConfigMapが反映されない**
   ```bash
   # Podの再起動確認
   kubectl rollout restart deployment/myapp
   
   # マウントされた設定確認
   kubectl exec -it myapp-xxx -- cat /app/config/app.properties
   ```

2. **Secretの文字化け**
   ```bash
   # Base64デコード確認
   kubectl get secret app-secrets -o jsonpath='{.data.password}' | base64 -d
   ```

3. **環境変数の上書き**
   ```bash
   # 環境変数の優先順序確認
   kubectl exec -it myapp-xxx -- printenv | grep DATABASE
   ```

## 📚 参考リソース

- **[ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)**
- **[Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)**
- **[Managing Resources](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/)**
- **[External Secrets Operator](https://external-secrets.io/)**

---

**次のステップ**: [セキュリティ実装](./security.md) → [実践タスク](../tasks/) → [ハンズオンラボ](../../hands-on-labs/)
