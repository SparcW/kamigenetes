import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎓 チーム学習プラットフォーム</h1>
      <p>Kubernetes学習管理システムのフロントエンドが正常に起動しました。</p>
      <div style={{ marginTop: '20px' }}>
        <h2>📊 システム状況</h2>
        <ul>
          <li>✅ フロントエンド (React + Vite)</li>
          <li>🔗 バックエンドAPI接続テスト中...</li>
          <li>🗄️ データベース接続確認中...</li>
        </ul>
      </div>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <strong>開発環境情報:</strong>
        <br />
        フロントエンド: http://localhost:3000
        <br />
        バックエンドAPI: http://localhost:3001
        <br />
        PostgreSQL: localhost:5432
        <br />
        Redis: localhost:6379
      </div>
    </div>
  );
};

export default App;
