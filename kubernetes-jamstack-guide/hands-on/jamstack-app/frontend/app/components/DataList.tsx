import React, { useEffect, useState } from 'react';

// データリストコンポーネント
const DataList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // データを取得するための関数
  const fetchData = async () => {
    try {
      const response = await fetch('/api/data'); // APIエンドポイントからデータを取得
      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントがマウントされたときにデータを取得
  useEffect(() => {
    fetchData();
  }, []);

  // ローディング中の表示
  if (loading) {
    return <div>ローディング中...</div>;
  }

  // エラーが発生した場合の表示
  if (error) {
    return <div>{error}</div>;
  }

  // データリストの表示
  return (
    <ul>
      {data.map((item, index) => (
        <li key={index}>{item.name}</li> // データの各アイテムをリスト表示
      ))}
    </ul>
  );
};

export default DataList;