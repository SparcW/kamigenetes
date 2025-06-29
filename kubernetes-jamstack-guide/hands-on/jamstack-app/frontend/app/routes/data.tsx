import { useEffect, useState } from 'react';
import { json } from 'remix';
import DataList from '../components/DataList';

export const loader = async () => {
  const response = await fetch('http://<your-knative-url>/api/data');
  if (!response.ok) {
    throw new Response('データの取得に失敗しました', { status: response.status });
  }
  const data = await response.json();
  return json(data);
};

export default function DataPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/api/data');
      const result = await response.json();
      setData(result);
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1>データ一覧</h1>
      <DataList data={data} />
    </div>
  );
}