### 06-deployment.md

# アプリケーションのKubernetesへのデプロイ手順

このドキュメントでは、JAMStackアプリケーションをKubernetesにデプロイする手順を説明します。API、フロントエンド、データベースの各コンポーネントをそれぞれデプロイします。

## ステップ1: APIのデプロイ

1. **Dockerイメージのビルド**
   - `hands-on/jamstack-app/api`ディレクトリに移動し、Dockerイメージをビルドします。
   ```bash
   cd hands-on/jamstack-app/api
   docker build -t my-hono-api .
   ```

2. **Kubernetesにデプロイ**
   - APIのKubernetesリソースを適用します。
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

3. **デプロイ状況の確認**
   - デプロイが成功したか確認します。
   ```bash
   kubectl get pods
   kubectl get svc
   ```

## ステップ2: フロントエンドのデプロイ

1. **Dockerイメージのビルド**
   - `hands-on/jamstack-app/frontend`ディレクトリに移動し、Dockerイメージをビルドします。
   ```bash
   cd hands-on/jamstack-app/frontend
   docker build -t my-remix-app .
   ```

2. **Kubernetesにデプロイ**
   - フロントエンドのKubernetesリソースを適用します。
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

3. **デプロイ状況の確認**
   - デプロイが成功したか確認します。
   ```bash
   kubectl get pods
   kubectl get svc
   ```

## ステップ3: PostgreSQLのデプロイ

1. **Helmを使用してPostgreSQLをデプロイ**
   - PostgreSQLのHelmチャートを使用してデプロイします。
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install my-postgres bitnami/postgresql --set postgresqlPassword=mysecretpassword
   ```

2. **デプロイ状況の確認**
   - PostgreSQLのデプロイ状況を確認します。
   ```bash
   kubectl get pods
   ```

## ステップ4: アプリケーションへのアクセス

1. **KnativeサービスのURLを取得**
   - APIとフロントエンドのKnativeサービスのURLを取得します。
   ```bash
   kubectl get ksvc
   ```

2. **ブラウザでアプリケーションにアクセス**
   - 取得したURLを使用して、ブラウザでアプリケーションにアクセスします。

## まとめ

これで、JAMStackアプリケーションをKubernetesにデプロイする手順は完了です。各コンポーネントが正しくデプロイされ、相互に通信できることを確認してください。デプロイ後は、モニタリングやスケーリングの設定を行うことをお勧めします。