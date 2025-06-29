### 05-api-development.md

# API開発

このドキュメントでは、Honoフレームワークを使用してKubernetes上でAPIを開発する手順を解説します。APIは、フロントエンドアプリケーションとデータベースとの間のインターフェースとして機能します。

## 1. Honoフレームワークの概要

Honoは、軽量で高速なAPIフレームワークであり、TypeScriptでの開発をサポートしています。簡単にルーティングやミドルウェアの設定ができるため、APIの開発に適しています。

## 2. プロジェクトのセットアップ

### 2.1 ディレクトリ構造

以下のようにディレクトリを構成します。

```
hands-on/
└── jamstack-app/
    ├── api/
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── routes/
    │   │   │   ├── data.ts
    │   │   │   └── health.ts
    │   │   ├── database/
    │   │   │   └── connection.ts
    │   │   └── types/
    │   │       └── index.ts
    │   ├── k8s/
    │   │   ├── deployment.yaml
    │   │   ├── service.yaml
    │   │   ├── configmap.yaml
    │   │   └── secret.yaml
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── README.md
```

### 2.2 必要なパッケージのインストール

以下のコマンドを実行して、必要なパッケージをインストールします。

```bash
cd hands-on/jamstack-app/api
npm init -y
npm install hono pg typescript ts-node @types/node --save
```

## 3. APIの実装

### 3.1 エントリーポイントの作成

`src/index.ts`ファイルを作成し、以下のコードを追加します。

```typescript
import { Hono } from 'hono';
import { Client } from 'pg';

const app = new Hono();

const client = new Client({
  user: 'postgres',
  host: 'my-postgres.default.svc.cluster.local',
  database: 'postgres',
  password: 'mysecretpassword',
  port: 5432,
});

client.connect();

app.get('/api/data', async (c) => {
  const res = await client.query('SELECT * FROM my_table');
  return c.json(res.rows);
});

app.post('/api/data', async (c) => {
  const { name } = await c.req.json();
  await client.query('INSERT INTO my_table(name) VALUES($1)', [name]);
  return c.text('データが挿入されました');
});

export default app;
```

### 3.2 ルートの作成

`src/routes/data.ts`と`src/routes/health.ts`を作成し、それぞれのAPIエンドポイントを定義します。

#### `src/routes/data.ts`

```typescript
import { Hono } from 'hono';
import { Client } from 'pg';

const app = new Hono();
const client = new Client(/* PostgreSQL接続設定 */);

app.get('/api/data', async (c) => {
  const res = await client.query('SELECT * FROM my_table');
  return c.json(res.rows);
});

app.post('/api/data', async (c) => {
  const { name } = await c.req.json();
  await client.query('INSERT INTO my_table(name) VALUES($1)', [name]);
  return c.text('データが挿入されました');
});

export default app;
```

#### `src/routes/health.ts`

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/health', (c) => {
  return c.json({ status: 'OK' });
});

export default app;
```

### 4. Dockerfileの作成

`Dockerfile`を作成し、以下の内容を追加します。

```dockerfile
FROM node:14

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["ts-node", "src/index.ts"]
```

## 5. Kubernetesへのデプロイ

### 5.1 Kubernetesマニフェストの作成

`k8s/deployment.yaml`と`k8s/service.yaml`を作成し、APIをKubernetesにデプロイします。

#### `k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hono-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hono-api
  template:
    metadata:
      labels:
        app: hono-api
    spec:
      containers:
        - name: hono-api
          image: my-hono-api
          ports:
            - containerPort: 3000
```

#### `k8s/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hono-api
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
  selector:
    app: hono-api
```

### 6. まとめ

このドキュメントでは、Honoフレームワークを使用してKubernetes上でAPIを開発する手順を説明しました。これにより、フロントエンドアプリケーションとデータベースとの間のインターフェースを構築することができます。次のステップでは、アプリケーションをKubernetesにデプロイし、フロントエンドとの統合を行います。