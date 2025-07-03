team-learning-platform/
├── README.md                     # このファイル - システム設計書
├── docker-compose.yml           # 開発環境用Docker構成
├── kubernetes/                  # Kubernetes マニフェスト
│   ├── namespace.yaml
│   ├── postgresql/
│   ├── redis/
│   └── app/
├── backend/                     # Node.js + Express バックエンド
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts            # アプリケーションエントリーポイント
│   │   ├── config/             # 設定ファイル
│   │   ├── middleware/         # Express ミドルウェア
│   │   ├── models/             # Prisma モデル
│   │   ├── controllers/        # API コントローラー
│   │   ├── services/           # ビジネスロジック
│   │   ├── routes/             # API ルート定義
│   │   ├── utils/              # ユーティリティ関数
│   │   └── types/              # TypeScript 型定義
│   ├── prisma/                 # データベーススキーマ
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── tests/                  # テストファイル
├── frontend/                   # React フロントエンド
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/         # React コンポーネント
│   │   ├── pages/              # ページコンポーネント
│   │   ├── hooks/              # カスタムフック
│   │   ├── services/           # API クライアント
│   │   ├── store/              # 状態管理 (Redux Toolkit)
│   │   ├── utils/              # ユーティリティ
│   │   └── types/              # 型定義
│   └── tests/
├── docs/                       # プロジェクトドキュメント
│   ├── api/                    # API ドキュメント
│   ├── deployment/             # デプロイメントガイド
│   └── development/            # 開発ガイド
└── scripts/                    # デプロイ・セットアップスクリプト
    ├── setup.sh
    ├── deploy.sh
    └── seed-data.sh
