import { json, LoaderFunction } from 'remix';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import DataList from '../components/DataList';

export let loader: LoaderFunction = async () => {
  const res = await fetch('http://<your-knative-url>/api/data');
  const data = await res.json();
  return json(data);
};

export default function Index() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('http://<your-knative-url>/api/data');
      const result = await response.json();
      setData(result);
    };
    fetchData();
  }, []);

  return (
    <div>
      <Header />
      <h1>データ一覧</h1>
      <DataList data={data} />
    </div>
  );
}