# Kubernetesモニタリング・ロギング 参考資料集

## 公式ドキュメント

### Kubernetes公式
- [ロギングアーキテクチャ](https://kubernetes.io/ja/docs/concepts/cluster-administration/logging/)
- [システムログ](https://kubernetes.io/ja/docs/concepts/cluster-administration/system-logs/)
- [モニタリング](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-usage-monitoring/)
- [デバッグとトラブルシューティング](https://kubernetes.io/docs/tasks/debug-application-cluster/)

### kubectl Reference
- [kubectl logs](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#logs)
- [kubectl top](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#top)
- [kubectl describe](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#describe)

## オープンソースツール

### ロギング
- [Fluentd](https://docs.fluentd.org/)
- [Fluent Bit](https://docs.fluentbit.io/)
- [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Logstash](https://www.elastic.co/guide/en/logstash/current/index.html)

### モニタリング
- [Prometheus](https://prometheus.io/docs/)
- [Grafana](https://grafana.com/docs/)
- [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Prometheus Operator](https://prometheus-operator.dev/)

### Node.js関連
- [Winston](https://github.com/winstonjs/winston) - ログライブラリ
- [prom-client](https://github.com/siimon/prom-client) - Prometheusクライアント

## AWS EKS関連

### AWS公式ドキュメント
- [Amazon EKS ユーザーガイド](https://docs.aws.amazon.com/eks/latest/userguide/)
- [CloudWatch Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)

### EKS特有の設定
- [ALB Ingress Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.4/)
- [EBS CSI Driver](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [EFS CSI Driver](https://docs.aws.amazon.com/eks/latest/userguide/efs-csi.html)

## ベストプラクティス

### セキュリティ
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

### パフォーマンス
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Vertical Pod Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)

## 学習リソース

### 書籍
- "Kubernetes完全ガイド" - 青山真也
- "Prometheus監視実践ガイド" - Brian Brazil
- "Effective Logging" - 実践的ログ活用術

### オンラインコース
- [Kubernetes基礎](https://kubernetes.io/training/)
- [Cloud Native Computing Foundation (CNCF) Training](https://www.cncf.io/certification/training/)

### コミュニティ
- [Kubernetes Slack](https://kubernetes.slack.com/)
- [Prometheus Community](https://prometheus.io/community/)
- [Grafana Community](https://community.grafana.com/)

## ツールとユーティリティ

### CLI Tools
```bash
# kubectl プラグイン
kubectl krew install ctx ns top logs tail

# ログ解析
jq           # JSON処理
grep         # パターンマッチング
awk          # テキスト処理
sed          # ストリームエディタ

# モニタリング
htop         # システムモニタリング
ncdu         # ディスク使用量
iftop        # ネットワーク監視
```

### Visual Studio Code 拡張機能
- Kubernetes
- YAML
- Docker
- Prometheus
- JSON

## 実践的なコマンド集

### ログ関連
```bash
# 基本的なログ確認
kubectl logs <pod-name> -f --tail=100

# エラーログの抽出
kubectl logs <pod-name> | grep -i error

# JSON形式ログの解析
kubectl logs <pod-name> | jq '.level,.message'

# 複数Podのログ確認
kubectl logs -l app=myapp --prefix=true

# 前のコンテナインスタンスのログ
kubectl logs <pod-name> --previous
```

### モニタリング関連
```bash
# リソース使用量確認
kubectl top nodes
kubectl top pods --all-namespaces

# Pod詳細情報
kubectl describe pod <pod-name>

# イベント確認
kubectl get events --sort-by='.lastTimestamp'

# メトリクス確認
curl http://localhost:9090/metrics
```

### トラブルシューティング関連
```bash
# Pod状態確認
kubectl get pods -o wide

# Pod内でのコマンド実行
kubectl exec -it <pod-name> -- /bin/bash

# ポートフォワード
kubectl port-forward <pod-name> 8080:80

# 設定確認
kubectl get configmap <name> -o yaml
kubectl get secret <name> -o yaml
```

## よくある問題と解決方法

### ログが表示されない
1. Pod状態確認: `kubectl get pods`
2. イベント確認: `kubectl describe pod <name>`
3. kubeletログ確認: `journalctl -u kubelet`

### メトリクスが収集されない
1. Metrics Server確認: `kubectl get pods -n kube-system`
2. ServiceMonitor確認: `kubectl get servicemonitor`
3. Prometheusターゲット確認: Prometheus UI

### ストレージ問題
1. PVC状態確認: `kubectl get pvc`
2. StorageClass確認: `kubectl get storageclass`
3. ディスク容量確認: `df -h`

## パフォーマンス最適化

### ログ最適化
- 構造化ログの使用
- ログレベルの適切な設定
- ログローテーションの実装
- 外部ストレージへのアーカイブ

### メトリクス最適化
- 適切なラベル設計
- カーディナリティの制御
- 保存期間の設定
- アラートルールの最適化

## 本番運用チェックリスト

### セキュリティ
- [ ] RBAC設定
- [ ] Network Policy設定
- [ ] Secret暗号化
- [ ] Pod Security Policy/Standards

### 可用性
- [ ] レプリカ設定
- [ ] ヘルスチェック設定
- [ ] リソース制限設定
- [ ] バックアップ戦略

### モニタリング
- [ ] SLI/SLO定義
- [ ] アラート設定
- [ ] ダッシュボード作成
- [ ] 障害対応手順

### ログ管理
- [ ] ログ保存期間設定
- [ ] ログ容量監視
- [ ] ログアーカイブ戦略
- [ ] セキュリティログ監査

## 関連技術とエコシステム

### Service Mesh
- Istio
- Linkerd
- Consul Connect

### GitOps
- ArgoCD
- Flux
- Jenkins X

### CI/CD
- Jenkins
- GitLab CI/CD
- GitHub Actions
- Tekton

---

この参考資料は継続的に更新されます。最新の情報については公式ドキュメントを参照してください。
