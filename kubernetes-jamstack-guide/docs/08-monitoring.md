### 08-monitoring.md

# モニタリングの設定方法

このドキュメントでは、Kubernetes環境におけるアプリケーションのモニタリングを設定する方法について説明します。モニタリングは、アプリケーションのパフォーマンスを把握し、問題を早期に発見するために重要です。ここでは、PrometheusとGrafanaを使用したモニタリングの設定手順を解説します。

## 1. Prometheusのインストール

Prometheusは、オープンソースのモニタリングおよびアラートツールです。KubernetesクラスターにPrometheusをインストールするには、以下の手順を実行します。

### 1.1 Helmのインストール

Helmを使用してPrometheusをインストールします。Helmがインストールされていない場合は、[Helmのインストールガイド](https://helm.sh/docs/intro/install/)を参照してください。

### 1.2 PrometheusのHelmチャートを追加

次に、PrometheusのHelmチャートを追加します。

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### 1.3 Prometheusのインストール

以下のコマンドを実行して、Prometheusをインストールします。

```bash
helm install prometheus prometheus-community/prometheus -f ./hands-on/jamstack-app/monitoring/prometheus/values.yaml
```

## 2. Grafanaのインストール

Grafanaは、データを視覚化するためのオープンソースのプラットフォームです。Prometheusからデータを取得し、ダッシュボードを作成するために使用します。

### 2.1 Grafanaのインストール

以下のコマンドを実行して、Grafanaをインストールします。

```bash
helm install grafana grafana/grafana -f ./hands-on/jamstack-app/monitoring/grafana/values.yaml
```

### 2.2 Grafanaへのアクセス

Grafanaがインストールされたら、以下のコマンドを実行して、GrafanaのサービスのURLを取得します。

```bash
kubectl get svc --namespace default -w
```

ブラウザで取得したURLにアクセスし、Grafanaのログイン画面を表示します。デフォルトのユーザー名は`admin`、パスワードは`admin`です。

## 3. ダッシュボードの設定

Grafanaにログインしたら、Prometheusをデータソースとして追加し、ダッシュボードを作成します。以下の手順でダッシュボードをインポートします。

### 3.1 ダッシュボードのインポート

1. Grafanaの左側のメニューから「+」をクリックし、「Import」を選択します。
2. `hands-on/jamstack-app/monitoring/grafana/dashboards/jamstack-dashboard.json`ファイルをアップロードします。
3. データソースとしてPrometheusを選択し、ダッシュボードをインポートします。

## 4. 監視の確認

ダッシュボードが正常にインポートされると、アプリケーションのパフォーマンスデータが表示されます。これにより、リクエスト数、エラーレート、レスポンスタイムなどのメトリクスをリアルタイムで監視できます。

## 5. まとめ

このガイドでは、Kubernetes環境におけるモニタリングの設定方法について説明しました。PrometheusとGrafanaを使用することで、アプリケーションのパフォーマンスを可視化し、問題を迅速に特定することができます。モニタリングは、アプリケーションの信頼性を向上させるために不可欠な要素です。