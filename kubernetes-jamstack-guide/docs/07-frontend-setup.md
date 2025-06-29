### 07-frontend-setup.md

# フロントエンドのセットアップ手順

このドキュメントでは、Remixを使用したフロントエンドのセットアップ手順を説明します。フロントエンドはAPIと連携し、ユーザーインターフェースを提供します。

## ステップ 1: Remix プロジェクトの初期化

1. **Remix プロジェクトを作成する**
   ```bash
   cd hands-on/jamstack-app/frontend
   npx create-remix@latest
   ```

2. **プロジェクトの設定**
   - プロンプトに従って、プロジェクトの設定を行います。必要に応じて、TypeScriptを選択してください。

## ステップ 2: APIとの接続設定

1. **APIエンドポイントの設定**
   - `app/routes/_index.tsx`ファイルを開き、APIからデータを取得するためのローダー関数を追加します。
   ```tsx
   import { json, LoaderFunction } from 'remix';

   export let loader: LoaderFunction = async () => {
     const res = await fetch('http://<your-knative-url>/api/data');
     const data = await res.json();
     return json(data);
   };

   export default function Index() {
     // データを表示するためのコンポーネントをここに実装します
   }
   ```

## ステップ 3: コンポーネントの作成

1. **データリストコンポーネントの作成**
   - `app/components/DataList.tsx`を作成し、APIから取得したデータを表示するためのコンポーネントを実装します。
   ```tsx
   import React from 'react';

   const DataList = ({ data }) => {
     return (
       <ul>
         {data.map(item => (
           <li key={item.id}>{item.name}</li>
         ))}
       </ul>
     );
   };

   export default DataList;
   ```

2. **ヘッダーコンポーネントの作成**
   - `app/components/Header.tsx`を作成し、アプリケーションのヘッダーを定義します。
   ```tsx
   import React from 'react';

   const Header = () => {
     return (
       <header>
         <h1>JAMStack アプリケーション</h1>
       </header>
     );
   };

   export default Header;
   ```

## ステップ 4: アプリケーションのルートコンポーネントの設定

1. **ルートコンポーネントの編集**
   - `app/root.tsx`を開き、ヘッダーとデータリストを組み合わせて表示します。
   ```tsx
   import { Outlet } from 'remix';
   import Header from './components/Header';
   import DataList from './components/DataList';

   export default function App() {
     return (
       <div>
         <Header />
         <Outlet />
       </div>
     );
   }
   ```

## ステップ 5: アプリケーションの実行

1. **アプリケーションを起動する**
   ```bash
   npm run dev
   ```

2. **ブラウザでアプリケーションにアクセス**
   - `http://localhost:3000`にアクセスし、アプリケーションが正しく動作していることを確認します。

## 結論

これで、Remixを使用したフロントエンドのセットアップが完了しました。APIと連携し、データを表示する基本的な構造が整いました。今後は、スタイリングや追加機能の実装を行っていくことができます。