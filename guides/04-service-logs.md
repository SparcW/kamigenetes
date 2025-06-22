# サービスログ確認ガイド

## Kubernetesでサービス関連のログを確認する方法

### 重要な概念
- **サービス自体にはログがない**: Kubernetesのサービスはロードバランサーとして機能し、実際の処理は背後のPodで行われます
- **Pod のログを確認する**: サービスに関連する問題を調査するには、サービスが転送する先のPodのログを確認します

## 基本的なログ確認コマンド

### 1. 特定のPodのログを確認
```bash
# 基本的なログ確認
kubectl logs [Pod名]

# 例
kubectl logs nginx-deployment-8566fdf469-qwnlq
```

### 2. ラベルセレクターでPodを指定してログ確認
```bash
# ラベルでPodを選択してログを確認
kubectl logs -l app=nginx

# 複数の条件でフィルタリング
kubectl logs -l app=nginx,version=v1
```

### 3. リアルタイムでログを監視（follow）
```bash
# リアルタイムでログを監視
kubectl logs -f [Pod名]

# 例：nginxのログをリアルタイム監視
kubectl logs -f nginx-deployment-8566fdf469-qwnlq
```

### 4. 過去のログを確認
```bash
# 過去のコンテナのログを確認（Pod再起動後）
kubectl logs [Pod名] --previous

# 例
kubectl logs nginx-deployment-8566fdf469-qwnlq --previous
```

### 5. 複数コンテナがあるPodのログ確認
```bash
# 特定コンテナのログを確認
kubectl logs [Pod名] -c [コンテナ名]

# すべてのコンテナのログを確認
kubectl logs [Pod名] --all-containers=true
```

## サービス関連のトラブルシューティング

### 1. サービスに接続できない場合
```bash
# サービスの詳細情報を確認
kubectl describe service [サービス名]

# サービスのエンドポイントを確認
kubectl get endpoints [サービス名]

# 関連するPodの状態を確認
kubectl get pods -l [サービスのセレクター]

# Podのログを確認
kubectl logs -l [サービスのセレクター]
```

### 2. ログ出力オプション
```bash
# 最新の100行を表示
kubectl logs [Pod名] --tail=100

# 過去1時間のログを表示
kubectl logs [Pod名] --since=1h

# タイムスタンプ付きでログを表示
kubectl logs [Pod名] --timestamps=true

# 複数のオプションを組み合わせ
kubectl logs [Pod名] --tail=50 --since=30m --timestamps=true -f
```

## 実践例

### nginx-serviceのログを確認する手順

1. **サービスの詳細確認**
```bash
kubectl describe service nginx-service
```

2. **サービスのセレクターを確認**
```bash
kubectl get service nginx-service -o yaml | grep -A3 selector
```

3. **関連するPodを特定**
```bash
kubectl get pods -l app=nginx
```

4. **Podのログを確認**
```bash
kubectl logs -l app=nginx
```

5. **リアルタイム監視**
```bash
kubectl logs -l app=nginx -f
```

## AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes |
|------|---------|------------|
| ログ確認 | `aws logs tail` | `kubectl logs` |
| リアルタイム監視 | `--follow` オプション | `-f` オプション |
| サービスログ | サービス単位でログ確認可能 | Podのログを確認 |
| ログ集約 | CloudWatch Logs | 外部ツール（Fluentd、ELK等）|

## よく使用するログ確認パターン

### 1. サービス全体の健康状態チェック
```bash
# サービスのエンドポイント確認
kubectl get endpoints

# 全Podの状態確認
kubectl get pods -o wide

# 異常なPodのログ確認
kubectl logs [異常なPod名] --tail=100
```

### 2. パフォーマンス問題の調査
```bash
# リソース使用量確認
kubectl top pods

# 詳細なPod情報確認
kubectl describe pod [Pod名]

# ログでエラーパターンを検索
kubectl logs [Pod名] | grep -i error
```

### 3. デプロイメント後の動作確認
```bash
# 新しいPodのログを監視
kubectl logs -l app=[アプリ名] -f --since=0s

# ローリングアップデート中のログ確認
kubectl logs -l app=[アプリ名] --tail=20 --timestamps=true
```

## 注意点

1. **サービス≠Pod**: サービスはネットワークの抽象化であり、実際の処理はPodで行われる
2. **ログローテーション**: Podのログは自動的にローテーションされるため、古いログは失われる可能性がある
3. **複数Pod**: サービスが複数のPodにトラフィックを分散している場合、すべてのPodのログを確認する必要がある
4. **永続化**: 重要なログは外部ストレージに永続化することを推奨

## トラブルシューティングチェックリスト

- [ ] サービスの状態確認（`kubectl get services`）
- [ ] エンドポイントの確認（`kubectl get endpoints`）
- [ ] Podの状態確認（`kubectl get pods`）
- [ ] Podのログ確認（`kubectl logs`）
- [ ] サービスの設定確認（`kubectl describe service`）
- [ ] ネットワークポリシーの確認
- [ ] リソース制限の確認
