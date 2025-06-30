# Phase 1: 基本ログ操作マスター

## 学習目標

- kubectl logs の各種オプションを完全にマスターする
- ログフィルタリングとgrep技術を習得する
- マルチコンテナPodのログ取得方法を理解する
- ログローテーションとストレージ制限を学ぶ

## 演習時間: 60-90分

---

## 演習1: 基本的なログ取得

### 1.1 シンプルなログ出力Pod

```bash
# 演習用Podを作成
kubectl apply -f exercises/01-simple-logger.yaml

# Podの起動確認
kubectl get pods -l app=simple-logger

# 基本的なログ確認
kubectl logs simple-logger

# 質問: ログに何が出力されているか説明してください
```

### 1.2 kubectl logs オプション習得

```bash
# リアルタイムでログをフォロー
kubectl logs -f simple-logger

# 最新20行のみ表示
kubectl logs --tail=20 simple-logger

# タイムスタンプ付きで表示
kubectl logs --timestamps simple-logger

# 過去1時間のログのみ
kubectl logs --since=1h simple-logger

# 特定時刻以降のログ
kubectl logs --since-time="2024-01-01T10:00:00Z" simple-logger
```

### **演習課題1**: 上記のオプションを組み合わせて、「最新10行をタイムスタンプ付きでリアルタイムフォロー」するコマンドを作成してください。

---

## 演習2: マルチコンテナPodのログ操作

### 2.1 マルチコンテナPodの作成

```bash
# マルチコンテナPodを作成
kubectl apply -f exercises/02-multi-container.yaml

# Pod内のコンテナ一覧確認
kubectl describe pod multi-logger

# 各コンテナのログを個別に確認
kubectl logs multi-logger -c app-container
kubectl logs multi-logger -c sidecar-container
```

### 2.2 すべてのコンテナのログを同時監視

```bash
# 全コンテナのログを同時表示（Kubernetes 1.14+）
kubectl logs multi-logger --all-containers=true

# 複数ターミナルで同時監視
# ターミナル1:
kubectl logs -f multi-logger -c app-container

# ターミナル2:
kubectl logs -f multi-logger -c sidecar-container
```

### **演習課題2**: マルチコンテナPodで、片方のコンテナがクラッシュした場合のログ調査手順を説明してください。

---

## 演習3: Deploymentとラベルセレクターを使用したログ操作

### 3.1 Deploymentのログ確認

```bash
# Deploymentを作成
kubectl apply -f exercises/03-deployment-logger.yaml

# Deploymentの状態確認
kubectl get deployment web-logger
kubectl get pods -l app=web-logger

# Deployment全体のログ表示
kubectl logs deployment/web-logger

# 特定のPodのみ選択してログ表示
kubectl logs -l app=web-logger --tail=50
```

### 3.2 複数Podのログ同時監視

```bash
# 全Podのログをリアルタイム監視
kubectl logs -f -l app=web-logger

# レプリカ数を増やして動作確認
kubectl scale deployment web-logger --replicas=3
kubectl logs -l app=web-logger --prefix=true
```

### **演習課題3**: 3つのレプリカが動作している状態で、特定のPodのみのログをフィルタリングする方法を考えてください。

---

## 演習4: ログフィルタリングとgrep技術

### 4.1 エラーログの抽出

```bash
# エラーログ出力Podを作成
kubectl apply -f exercises/04-error-logger.yaml

# エラーレベルのログのみ抽出
kubectl logs error-logger | grep -i error

# 複数パターンでフィルタリング
kubectl logs error-logger | grep -E "(error|warning|fatal)"

# エラーの前後3行も表示
kubectl logs error-logger | grep -A 3 -B 3 -i error
```

### 4.2 JSON形式ログの解析

```bash
# JSON形式ログを出力するPodを作成
kubectl apply -f exercises/05-json-logger.yaml

# jqを使用したJSONログ解析
kubectl logs json-logger | jq '.level'
kubectl logs json-logger | jq 'select(.level=="error")'
kubectl logs json-logger | jq '.timestamp + " " + .message'
```

### **演習課題4**: 過去10分間のエラーログから、特定のエラーコード（例：500）を含むエントリの数をカウントするワンライナーコマンドを作成してください。

---

## 演習5: ログローテーションとストレージ制限

### 5.1 大量ログ出力Podの作成

```bash
# 大量ログ出力Podを作成
kubectl apply -f exercises/06-heavy-logger.yaml

# ログファイルサイズの確認（ノードにSSHが必要）
# ノード上での確認方法を学習
kubectl describe pod heavy-logger | grep Node:

# Podのログ出力状況監視
watch kubectl logs --tail=1 heavy-logger
```

### 5.2 ログローテーション設定の確認

```bash
# kubeletの設定確認
kubectl get node -o yaml | grep -A 10 -B 10 "containerLogMaxSize"

# 実際のログファイル確認（可能な場合）
# ノード上で：
# ls -la /var/log/containers/
# ls -la /var/lib/docker/containers/
```

### **演習課題5**: 本番環境でログが大量に出力される場合の対策を3つ以上提案してください。

---

## 演習6: 前のコンテナインスタンスのログ確認

### 6.1 クラッシュするPodの作成

```bash
# 意図的にクラッシュするPodを作成
kubectl apply -f exercises/07-crash-logger.yaml

# Podの状態確認（RestartCountに注目）
kubectl get pods crash-logger

# 現在のコンテナのログ
kubectl logs crash-logger

# 前のコンテナインスタンスのログ
kubectl logs crash-logger --previous
```

### 6.2 再起動パターンの分析

```bash
# Pod再起動の詳細情報
kubectl describe pod crash-logger

# イベント履歴の確認
kubectl get events --field-selector involvedObject.name=crash-logger

# 複数回の再起動ログ履歴（--previousは直前のみ）
# 複数回の履歴は別途ログ収集システムが必要
```

### **演習課題6**: Podが繰り返しクラッシュしている場合の詳細な調査手順を段階的に説明してください。

---

## 演習7: ネームスペース間のログ操作

### 7.1 複数ネームスペースでのログ運用

```bash
# ネームスペース作成とPod展開
kubectl create namespace logging-demo
kubectl apply -f exercises/08-namespace-logger.yaml

# 特定ネームスペースのログ確認
kubectl logs -n logging-demo namespace-logger

# 全ネームスペースのPodログ一覧
kubectl get pods --all-namespaces
kubectl logs -n logging-demo deployment/namespace-app
```

### 7.2 クロスネームスペースログ監視

```bash
# 複数ネームスペースのログを同時監視
# ターミナル1:
kubectl logs -f -n default deployment/web-logger

# ターミナル2:
kubectl logs -f -n logging-demo deployment/namespace-app

# 全ネームスペースのイベント監視
kubectl get events --all-namespaces --watch
```

---

## 実践チャレンジ

### チャレンジ1: ログ調査スクリプト作成

以下の機能を持つbashスクリプト `log-analyzer.sh` を作成してください：

1. 引数でアプリケーション名（ラベル）を受け取る
2. そのアプリケーションの全Podのエラーログを抽出
3. エラーの頻度を集計して表示
4. 最新のエラー5件を詳細表示

### チャレンジ2: ログ監視ダッシュボード

kubectl logsとterminal toolsを組み合わせて、複数アプリケーションのログを同時監視するセットアップを作成してください。

### チャレンジ3: 障害調査シナリオ

exercises/99-failure-scenario.yaml を実行して発生する問題を、kubectl logsを使って調査し、根本原因を特定してください。

---

## 解答例

演習課題の解答例は `solutions/` ディレクトリにあります。自分で試した後に確認してください。

---

## 次のステップ

Phase 1を完了したら、Phase 2（サンプルアプリケーション展開）に進んでください。
構造化ログと実際のWebアプリケーションでのログ実装を学習します。
