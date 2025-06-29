module.exports = {
  // Remixのアプリケーションの設定
  appDirectory: "app", // アプリケーションのディレクトリ
  assetsBuildDirectory: "public/build", // ビルドされたアセットの出力先
  publicPath: "/build/", // 公開パス
  ignoredRouteFiles: ["**/.*"], // 無視するルートファイル
  // 環境変数の設定
  serverBuildPath: "build/index.js", // サーバービルドの出力先
  // その他の設定
  devServerPort: 8002, // 開発サーバーのポート
};