import React, { useState, useEffect } from 'react';

interface ApiStatus {
  backend: 'connected' | 'disconnected' | 'loading';
  database: 'connected' | 'disconnected' | 'loading'; 
  redis: 'connected' | 'disconnected' | 'loading';
}

const App: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    backend: 'loading',
    database: 'loading',
    redis: 'loading'
  });

  useEffect(() => {
    // バックエンドAPI接続テスト
    const testBackendConnection = async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          const data = await response.json();
          setApiStatus(prev => ({ ...prev, backend: 'connected' }));
          console.log('Backend API connected:', data);
        } else {
          setApiStatus(prev => ({ ...prev, backend: 'disconnected' }));
        }
      } catch (error) {
        console.error('Backend API connection failed:', error);
        setApiStatus(prev => ({ ...prev, backend: 'disconnected' }));
      }
    };

    testBackendConnection();
    
    // 5秒ごとに接続テスト
    const interval = setInterval(testBackendConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'disconnected': return '❌';
      case 'loading': return '⏳';
      default: return '❓';
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎓 チーム学習プラットフォーム</h1>
      <p>Kubernetes学習管理システムのフロントエンドが正常に起動しました。</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>📊 システム状況</h2>
        <ul style={{ fontSize: '16px', lineHeight: '1.6' }}>
          <li>{getStatusIcon(apiStatus.backend)} フロントエンド (React + Vite) - 稼働中</li>
          <li>{getStatusIcon(apiStatus.backend)} バックエンドAPI - {apiStatus.backend}</li>
          <li>{getStatusIcon(apiStatus.database)} データベース (PostgreSQL) - {apiStatus.database}</li>
          <li>{getStatusIcon(apiStatus.redis)} キャッシュ (Redis) - {apiStatus.redis}</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '1px solid #0066cc' }}>
        <h3>🔗 API接続テスト</h3>
        <p><strong>バックエンドAPI:</strong> {apiStatus.backend === 'connected' ? '✅ 接続成功' : '❌ 接続失敗 - APIサーバーを確認してください'}</p>
        {apiStatus.backend === 'connected' && (
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={() => window.open('http://localhost:3001/api', '_blank')}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#0066cc', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              API情報を表示
            </button>
          </div>
        )}
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
        <br />
        <br />
        <strong>観測可能性スタック:</strong>
        <br />
        Prometheus: http://localhost:9090
        <br />
        Grafana: http://localhost:3100
        <br />
        Elasticsearch: http://localhost:9200
        <br />
        Kibana: http://localhost:5601
      </div>
    </div>
  );
};

export default App;
