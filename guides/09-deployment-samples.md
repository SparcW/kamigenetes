# Kubernetes Deployment サンプル集

## 概要

様々なアプリケーションタイプのDeploymentサンプルを通じて、実際のワークロードをKubernetesで実行する方法を学習します。AWS ECSタスク定義からKubernetes Deploymentへの移行パターンも含めて解説します。

## 1. Webアプリケーション（Node.js + Express）

### AWS ECS タスク定義例（参考）
```json
{
  "family": "nodejs-app",
  "containerDefinitions": [
    {
      "name": "nodejs-app",
      "image": "node:18-alpine",
      "memory": 512,
      "cpu": 256,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

### Kubernetes Deployment版
```yaml
# nodejs-app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
  labels:
    app: nodejs-app
    tier: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs-app
  template:
    metadata:
      labels:
        app: nodejs-app
        tier: frontend
    spec:
      containers:
      - name: nodejs-app
        image: node:18-alpine
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        # アプリケーションファイルをボリュームマウント
        command: ["/bin/sh"]
        args:
        - -c
        - |
          cat << 'EOF' > /app/server.js
          const express = require('express');
          const app = express();
          const port = process.env.PORT || 3000;
          
          app.get('/', (req, res) => {
            res.json({
              message: 'Hello from Node.js on Kubernetes!',
              hostname: require('os').hostname(),
              timestamp: new Date().toISOString()
            });
          });
          
          app.get('/health', (req, res) => {
            res.json({ status: 'healthy' });
          });
          
          app.listen(port, '0.0.0.0', () => {
            console.log(`Server running on port ${port}`);
          });
          EOF
          
          cd /app && npm init -y && npm install express
          node server.js
        # ヘルスチェック設定
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        # リソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# Service定義
apiVersion: v1
kind: Service
metadata:
  name: nodejs-app-service
  labels:
    app: nodejs-app
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  selector:
    app: nodejs-app
```

## 2. データベースアプリケーション（PostgreSQL）

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-db
  labels:
    app: postgres-db
    component: database
spec:
  replicas: 1                    # データベースは通常単一インスタンス
  selector:
    matchLabels:
      app: postgres-db
  template:
    metadata:
      labels:
        app: postgres-db
        component: database
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: "sampledb"
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
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        # 永続化ボリュームマウント
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        # ヘルスチェック（PostgreSQL専用）
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
        # リソース設定
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
            
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: postgres-config
        configMap:
          name: postgres-config

---
# PostgreSQL専用のSecret
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
data:
  username: cG9zdGdyZXM=        # base64: postgres
  password: cGFzc3dvcmQxMjM=    # base64: password123

---
# PostgreSQL設定用ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  postgresql.conf: |
    # PostgreSQL設定
    listen_addresses = '*'
    max_connections = 100
    shared_buffers = 128MB
    effective_cache_size = 256MB
    work_mem = 4MB
    maintenance_work_mem = 64MB
    
---
# 永続化ボリューム要求
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard

---
# データベースサービス
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  labels:
    app: postgres-db
spec:
  type: ClusterIP               # 内部アクセスのみ
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
  selector:
    app: postgres-db
```

## 3. Redis キャッシュサーバー

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-cache
  labels:
    app: redis-cache
    component: cache
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis-cache
  template:
    metadata:
      labels:
        app: redis-cache
        component: cache
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: redis
        command: ["redis-server"]
        args: ["/etc/redis/redis.conf"]
        # Redis設定ファイルをマウント
        volumeMounts:
        - name: redis-config
          mountPath: /etc/redis
        - name: redis-data
          mountPath: /data
        # ヘルスチェック
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
        # リソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
            
      volumes:
      - name: redis-config
        configMap:
          name: redis-config
      - name: redis-data
        emptyDir: {}              # 一時的なキャッシュデータ

---
# Redis設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    # Redis設定
    bind 0.0.0.0
    protected-mode no
    port 6379
    timeout 0
    tcp-keepalive 300
    maxmemory 256mb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000

---
# Redisサービス
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  labels:
    app: redis-cache
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
    protocol: TCP
  selector:
    app: redis-cache
```

## 4. Python Flask アプリケーション

```yaml
# flask-app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flask-app
  labels:
    app: flask-app
    tier: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flask-app
  template:
    metadata:
      labels:
        app: flask-app
        tier: backend
    spec:
      containers:
      - name: flask-app
        image: python:3.11-slim
        ports:
        - containerPort: 5000
          name: http
        env:
        - name: FLASK_APP
          value: "app.py"
        - name: FLASK_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        # アプリケーションコードの作成とサーバー起動
        command: ["/bin/bash"]
        args:
        - -c
        - |
          # 必要なパッケージをインストール
          pip install flask psycopg2-binary redis
          
          # Flaskアプリケーションを作成
          cat << 'EOF' > /app/app.py
          from flask import Flask, jsonify, request
          import os
          import redis
          import psycopg2
          import socket
          from datetime import datetime
          
          app = Flask(__name__)
          
          # Redis接続
          try:
              redis_client = redis.Redis(host='redis-service', port=6379, decode_responses=True)
              redis_available = True
          except:
              redis_available = False
          
          @app.route('/')
          def hello():
              return jsonify({
                  'message': 'Hello from Flask on Kubernetes!',
                  'hostname': socket.gethostname(),
                  'timestamp': datetime.now().isoformat(),
                  'redis_available': redis_available
              })
          
          @app.route('/health')
          def health():
              return jsonify({'status': 'healthy'})
          
          @app.route('/cache/<key>')
          def get_cache(key):
              if not redis_available:
                  return jsonify({'error': 'Redis not available'}), 503
              
              value = redis_client.get(key)
              return jsonify({'key': key, 'value': value})
          
          @app.route('/cache/<key>', methods=['POST'])
          def set_cache(key):
              if not redis_available:
                  return jsonify({'error': 'Redis not available'}), 503
              
              value = request.json.get('value')
              redis_client.set(key, value, ex=3600)  # 1時間で期限切れ
              return jsonify({'key': key, 'value': value, 'status': 'cached'})
          
          if __name__ == '__main__':
              app.run(host='0.0.0.0', port=5000)
          EOF
          
          cd /app
          python app.py
        # ヘルスチェック
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
        # リソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# Flask用のSecret
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  database-url: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0Bwb3N0Z3Jlcy1zZXJ2aWNlOjU0MzIvZGI=  # base64エンコード

---
# Flaskサービス
apiVersion: v1
kind: Service
metadata:
  name: flask-service
  labels:
    app: flask-app
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 5000
    protocol: TCP
  selector:
    app: flask-app
```

## 5. NGINX リバースプロキシ

```yaml
# nginx-proxy-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-proxy
  labels:
    app: nginx-proxy
    component: proxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-proxy
  template:
    metadata:
      labels:
        app: nginx-proxy
        component: proxy
    spec:
      containers:
      - name: nginx
        image: nginx:1.25-alpine
        ports:
        - containerPort: 80
          name: http
        - containerPort: 443
          name: https
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d
        - name: nginx-html
          mountPath: /usr/share/nginx/html
        # ヘルスチェック
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        # リソース制限
        resources:
          requests:
            memory: "128Mi"
            cpu: "250m"
          limits:
            memory: "256Mi"
            cpu: "500m"
            
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-config
      - name: nginx-html
        configMap:
          name: nginx-html

---
# NGINX設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  default.conf: |
    upstream flask_backend {
        server flask-service:80;
    }
    
    upstream nodejs_backend {
        server nodejs-app-service:80;
    }
    
    server {
        listen 80;
        server_name _;
        
        # ヘルスチェックエンドポイント
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
        
        # Flask APIへのプロキシ
        location /api/ {
            proxy_pass http://flask_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Node.js appへのプロキシ
        location /app/ {
            proxy_pass http://nodejs_backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # 静的ファイル
        location / {
            root /usr/share/nginx/html;
            index index.html;
        }
    }

---
# 静的HTMLコンテンツ
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-html
data:
  index.html: |
    <!DOCTYPE html>
    <html>
    <head>
        <title>Kubernetes Multi-App Demo</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .service { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; }
            button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #005a87; }
            .result { background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 3px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Kubernetes Multi-Application Demo</h1>
            <p>このページは複数のマイクロサービスをNGINXプロキシ経由で統合しています。</p>
            
            <div class="service">
                <h3>📱 Node.js Service</h3>
                <button onclick="testNodejs()">Node.js API をテスト</button>
                <div id="nodejs-result" class="result" style="display:none;"></div>
            </div>
            
            <div class="service">
                <h3>🐍 Flask Service</h3>
                <button onclick="testFlask()">Flask API をテスト</button>
                <div id="flask-result" class="result" style="display:none;"></div>
            </div>
            
            <div class="service">
                <h3>📦 Redis Cache Test</h3>
                <button onclick="testCache()">キャッシュをテスト</button>
                <div id="cache-result" class="result" style="display:none;"></div>
            </div>
        </div>
        
        <script>
            async function testNodejs() {
                try {
                    const response = await fetch('/app/');
                    const data = await response.json();
                    document.getElementById('nodejs-result').innerHTML = 
                        `<strong>✅ Node.js Response:</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`;
                    document.getElementById('nodejs-result').style.display = 'block';
                } catch (error) {
                    document.getElementById('nodejs-result').innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
                    document.getElementById('nodejs-result').style.display = 'block';
                }
            }
            
            async function testFlask() {
                try {
                    const response = await fetch('/api/');
                    const data = await response.json();
                    document.getElementById('flask-result').innerHTML = 
                        `<strong>✅ Flask Response:</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`;
                    document.getElementById('flask-result').style.display = 'block';
                } catch (error) {
                    document.getElementById('flask-result').innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
                    document.getElementById('flask-result').style.display = 'block';
                }
            }
            
            async function testCache() {
                try {
                    // キャッシュにデータを設定
                    await fetch('/api/cache/test-key', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({value: 'Hello from Redis!'})
                    });
                    
                    // キャッシュからデータを取得
                    const response = await fetch('/api/cache/test-key');
                    const data = await response.json();
                    document.getElementById('cache-result').innerHTML = 
                        `<strong>✅ Cache Response:</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`;
                    document.getElementById('cache-result').style.display = 'block';
                } catch (error) {
                    document.getElementById('cache-result').innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
                    document.getElementById('cache-result').style.display = 'block';
                }
            }
        </script>
    </body>
    </html>

---
# NGINXサービス
apiVersion: v1
kind: Service
metadata:
  name: nginx-proxy-service
  labels:
    app: nginx-proxy
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  - port: 443
    targetPort: 443
    protocol: TCP
    name: https
  selector:
    app: nginx-proxy
```

## 6. バッチ処理アプリケーション（CronJob）

```yaml
# batch-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: data-processor
  labels:
    app: data-processor
    component: batch
spec:
  schedule: "*/5 * * * *"         # 5分ごとに実行
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: data-processor
            component: batch
        spec:
          containers:
          - name: processor
            image: python:3.11-slim
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: BATCH_SIZE
              value: "100"
            command: ["/bin/bash"]
            args:
            - -c
            - |
              pip install psycopg2-binary redis
              
              cat << 'EOF' > /app/processor.py
              import os
              import time
              import psycopg2
              import redis
              from datetime import datetime
              
              def process_data():
                  print(f"[{datetime.now()}] データ処理バッチを開始します...")
                  
                  # Redisからキューのデータを処理（例）
                  try:
                      r = redis.Redis(host='redis-service', port=6379, decode_responses=True)
                      
                      # サンプルデータを処理
                      for i in range(int(os.getenv('BATCH_SIZE', '10'))):
                          key = f"batch_data_{i}"
                          value = f"processed_at_{datetime.now().isoformat()}"
                          r.set(key, value, ex=300)  # 5分で期限切れ
                          print(f"処理済み: {key} = {value}")
                          
                      print(f"✅ バッチ処理が完了しました（{os.getenv('BATCH_SIZE', '10')}件）")
                      
                  except Exception as e:
                      print(f"❌ エラー: {e}")
                      exit(1)
              
              if __name__ == "__main__":
                  process_data()
              EOF
              
              cd /app
              python processor.py
            # リソース制限
            resources:
              requests:
                memory: "128Mi"
                cpu: "100m"
              limits:
                memory: "256Mi"
                cpu: "200m"
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

## 7. ワーカープロセス（Deployment）

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: background-worker
  labels:
    app: background-worker
    component: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: background-worker
  template:
    metadata:
      labels:
        app: background-worker
        component: worker
    spec:
      containers:
      - name: worker
        image: python:3.11-slim
        env:
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        command: ["/bin/bash"]
        args:
        - -c
        - |
          pip install redis
          
          cat << 'EOF' > /app/worker.py
          import os
          import time
          import redis
          import json
          from datetime import datetime
          
          def worker_process():
              worker_id = os.getenv('WORKER_ID', 'unknown')
              redis_url = os.getenv('REDIS_URL', 'redis://redis-service:6379')
              
              print(f"🔧 ワーカー {worker_id} を開始します...")
              
              r = redis.Redis.from_url(redis_url, decode_responses=True)
              
              while True:
                  try:
                      # キューからジョブを取得（ブロッキング）
                      job_data = r.blpop('job_queue', timeout=30)
                      
                      if job_data:
                          queue_name, job_json = job_data
                          job = json.loads(job_json)
                          
                          print(f"📋 [{worker_id}] ジョブを処理中: {job}")
                          
                          # ジョブ処理のシミュレーション
                          time.sleep(job.get('duration', 5))
                          
                          # 結果をRedisに保存
                          result = {
                              'job_id': job.get('id'),
                              'worker_id': worker_id,
                              'completed_at': datetime.now().isoformat(),
                              'status': 'completed'
                          }
                          
                          r.set(f"result:{job.get('id')}", json.dumps(result), ex=3600)
                          print(f"✅ [{worker_id}] ジョブ完了: {job.get('id')}")
                      else:
                          print(f"⏰ [{worker_id}] ジョブ待機中...")
                          
                  except Exception as e:
                      print(f"❌ [{worker_id}] エラー: {e}")
                      time.sleep(5)
          
          if __name__ == "__main__":
              worker_process()
          EOF
          
          cd /app
          python worker.py
        # ヘルスチェック（カスタムスクリプト）
        livenessProbe:
          exec:
            command:
            - /bin/bash
            - -c
            - "ps aux | grep python | grep -v grep"
          initialDelaySeconds: 60
          periodSeconds: 30
        # リソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 統合デプロイスクリプト

```bash
#!/bin/bash
# deploy-all.sh - 全アプリケーションをデプロイするスクリプト

set -e

echo "🚀 Multi-Application Deployment を開始します..."

# 1. データベースとキャッシュを最初にデプロイ
echo "📊 データベースとキャッシュをデプロイ中..."
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml

# データベースの起動を待機
echo "⏳ データベースの起動を待機中..."
kubectl wait --for=condition=ready pod -l app=postgres-db --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis-cache --timeout=300s

# 2. バックエンドアプリケーションをデプロイ
echo "🐍 バックエンドアプリケーションをデプロイ中..."
kubectl apply -f flask-app-deployment.yaml
kubectl apply -f nodejs-app-deployment.yaml

# バックエンドの起動を待機
echo "⏳ バックエンドアプリケーションの起動を待機中..."
kubectl wait --for=condition=ready pod -l app=flask-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=nodejs-app --timeout=300s

# 3. プロキシとワーカーをデプロイ
echo "🔄 プロキシとワーカーをデプロイ中..."
kubectl apply -f nginx-proxy-deployment.yaml
kubectl apply -f worker-deployment.yaml
kubectl apply -f batch-cronjob.yaml

# 最終確認
echo "✅ デプロイメント完了！"
echo "📋 デプロイされたリソース:"
kubectl get deployments,services,cronjobs
echo ""
echo "🌐 アクセス方法:"
echo "LoadBalancerのExternal IPを確認してください:"
kubectl get services nginx-proxy-service
```

## 監視とトラブルシューティング

```bash
# 全体的な状態確認
kubectl get all

# 特定のアプリケーションの詳細確認
kubectl describe deployment flask-app
kubectl logs -l app=flask-app -f

# リソース使用量確認
kubectl top pods
kubectl top nodes

# ネットワーク接続テスト
kubectl run test-pod --image=busybox --rm -it -- sh
# Pod内で: wget -O- http://flask-service/health
```

## まとめ

1. **多様なアプリケーションパターン**: Web、データベース、キャッシュ、バッチ、ワーカーの実装例
2. **AWS ECS対応**: タスク定義からDeploymentへの移行パターン
3. **ベストプラクティス**: リソース制限、ヘルスチェック、設定管理
4. **統合アーキテクチャ**: 複数サービス間の連携とプロキシ設定
5. **運用考慮**: 監視、ログ、トラブルシューティング手法
