### 03-kubernetes-setup.md

# Kubernetesクラスターのセットアップ手順

このドキュメントでは、Kubernetesクラスターのセットアップ手順を詳述します。AWS EKSやGKEなどのクラウドプロバイダーを使用する場合や、ローカル環境でMinikubeを使用する場合の手順を説明します。

## 1. Kubernetesクラスターの作成

### Minikubeを使用する場合

1. **Minikubeのインストール**
   - Minikubeをインストールするには、公式の[Minikubeインストールガイド](https://minikube.sigs.k8s.io/docs/start/)を参照してください。

2. **Minikubeの起動**
   - 以下のコマンドを実行して、Minikubeクラスターを起動します。
     ```bash
     minikube start
     ```

3. **クラスターの状態確認**
   - クラスターが正常に起動したか確認するために、次のコマンドを実行します。
     ```bash
     kubectl cluster-info
     ```

### AWS EKSを使用する場合

1. **AWS CLIのインストール**
   - AWS CLIをインストールし、設定を行います。詳細は[AWS CLIのインストールガイド](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)を参照してください。

2. **EKSクラスターの作成**
   - EKSクラスターを作成するために、以下のコマンドを実行します。
     ```bash
     aws eks create-cluster --name my-cluster --role-arn arn:aws:iam::123456789012:role/EKS-ClusterRole --resources-vpc-config subnetIds=subnet-12345678,subnet-87654321
     ```

3. **kubectlの設定**
   - EKSクラスターに接続するために、kubectlの設定を行います。
     ```bash
     aws eks update-kubeconfig --name my-cluster
     ```

4. **クラスターの状態確認**
   - クラスターが正常に作成されたか確認するために、次のコマンドを実行します。
     ```bash
     kubectl get svc
     ```

## 2. Knativeのインストール

1. **Knativeのインストール**
   - Knativeをインストールするには、公式の[Knativeインストールガイド](https://knative.dev/docs/install/)を参照してください。

2. **Knativeの確認**
   - Knativeが正しくインストールされたか確認するために、次のコマンドを実行します。
     ```bash
     kubectl get pods --namespace knative-serving
     ```

## 3. まとめ

これでKubernetesクラスターのセットアップが完了しました。次のステップでは、PostgreSQLのセットアップに進みます。