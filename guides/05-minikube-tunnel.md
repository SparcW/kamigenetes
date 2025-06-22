# Minikube Tunnel 運用ガイド

## minikube tunnel の動作パターン

### 正常な動作状態
```bash
$ minikube tunnel
✅ Tunnel successfully started

📌 NOTE: Please do not close this terminal as this process must stay alive for the tunnel to be accessible ...

🏃  Starting tunnel for service nginx-service.
```

**重要**: この状態でプロンプトが返ってこないのは正常です！

## 動作確認方法

### 1. 別ターミナルでサービス状態確認
```bash
kubectl get services
# EXTERNAL-IP が 127.0.0.1 になっていることを確認
```

### 2. サービスへのアクセステスト
```bash
# HTTP サービスの場合
curl http://127.0.0.1

# HTTPS サービスの場合
curl https://127.0.0.1

# 特定ポートを指定
curl http://127.0.0.1:8080
```

### 3. ブラウザでのアクセス
```
http://127.0.0.1
```

## トンネル管理

### 開始
```bash
# フォアグラウンドで実行（推奨）
minikube tunnel

# バックグラウンドで実行
minikube tunnel > /dev/null 2>&1 &
```

### 停止
```bash
# フォアグラウンドプロセスの場合
Ctrl + C

# バックグラウンドプロセスの場合
pkill -f "minikube tunnel"
```

### 状態確認
```bash
# トンネルの状態確認
minikube tunnel --help

# プロセス確認
ps aux | grep "minikube tunnel"
```

## トラブルシューティング

### 1. 権限エラーが発生する場合
```bash
# sudo で実行
sudo minikube tunnel
```

### 2. ポートが使用中の場合
```bash
# 使用中のポートを確認
netstat -tulpn | grep :80

# プロセスを終了
sudo kill -9 [PID]
```

### 3. トンネルが応答しない場合
```bash
# トンネルを停止
minikube tunnel --cleanup

# 再起動
minikube tunnel
```

## AWS ECSとの比較

| 項目 | AWS ECS | Minikube + tunnel |
|------|---------|-------------------|
| LoadBalancer | ALB/NLB自動作成 | tunnel で localhost 経由 |
| EXTERNAL-IP | AWS が自動割り当て | 127.0.0.1 固定 |
| 運用 | 自動管理 | 手動でトンネル維持 |
| コスト | 従量課金 | 無料（ローカル） |

## 実践的な使い方

### 開発環境での典型的なワークフロー
```bash
# 1. Minikube 起動
minikube start

# 2. アプリケーションデプロイ
kubectl apply -f deployment.yaml

# 3. LoadBalancer サービス作成
kubectl apply -f service.yaml

# 4. トンネル開始（別ターミナルで）
minikube tunnel

# 5. 開発・テスト作業
curl http://127.0.0.1
# ブラウザで http://127.0.0.1 を開く

# 6. 作業終了時
# トンネル停止: Ctrl+C
# Minikube 停止: minikube stop
```

### 複数サービスでの使用
```bash
# 全てのLoadBalancerサービスが同時に利用可能
kubectl get services
# nginx-service    LoadBalancer   10.105.135.181   127.0.0.1   80:32473/TCP
# api-service      LoadBalancer   10.105.200.100   127.0.0.1   8080:30500/TCP

# アクセス方法
curl http://127.0.0.1       # nginx (port 80)
curl http://127.0.0.1:8080  # api (port 8080)
```

## 注意点

1. **単一トンネル**: 一度に一つの `minikube tunnel` のみ実行可能
2. **ポート競合**: 複数のサービスが同じポートを使用する場合は設定変更が必要
3. **終了忘れ**: トンネルプロセスの終了を忘れずに
4. **権限**: 場合によってはsudo権限が必要

## よくある質問

**Q: プロンプトが返ってこないのは正常？**
A: はい、正常です。トンネルを維持するために継続実行されます。

**Q: バックグラウンドで実行できる？**
A: 可能ですが、フォアグラウンド実行を推奨します。

**Q: 他の人からアクセスできる？**
A: デフォルトでは localhost のみ。外部アクセスには追加設定が必要です。

**Q: 本番環境でも使用できる？**
A: いいえ、開発・テスト環境専用です。本番環境では適切なLoadBalancerを使用してください。
