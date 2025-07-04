import { Exam, ExamQuestion } from '../types/exam';

// Kubernetes基本概念の試験問題
const basicKubernetesQuestions: ExamQuestion[] = [
  {
    id: 'q1',
    type: 'multiple_choice',
    question: 'Kubernetesクラスターの最小単位は何ですか？',
    options: ['Pod', 'Container', 'Node', 'Service'],
    correctAnswer: 'Pod',
    explanation: 'Podは1つ以上のコンテナをまとめた、Kubernetesにおけるデプロイメントとスケールの最小単位です。',
    points: 10,
    difficulty: 1,
    tags: ['Pod', 'Basic']
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    question: 'Pod内のコンテナ間でリソースを共有するものはどれですか？（複数選択）',
    options: ['ネットワーク', 'ストレージ', 'プロセス空間', 'ユーザー空間'],
    correctAnswer: ['ネットワーク', 'ストレージ'],
    explanation: 'Pod内のコンテナは同じネットワーク空間とストレージボリュームを共有しますが、プロセス空間とユーザー空間は独立しています。',
    points: 15,
    difficulty: 2,
    tags: ['Pod', 'Network', 'Storage']
  },
  {
    id: 'q3',
    type: 'kubectl_command',
    question: 'nginx という名前のPodを作成し、nginx:latest イメージを使用するkubectlコマンドを記述してください。',
    correctAnswer: 'kubectl run nginx --image=nginx:latest',
    explanation: 'kubectl runコマンドを使用してPodを作成できます。--imageオプションでコンテナイメージを指定します。',
    points: 20,
    difficulty: 2,
    tags: ['kubectl', 'Pod', 'Commands']
  }
];

// YAML生成の試験問題
const yamlGenerationQuestions: ExamQuestion[] = [
  {
    id: 'q4',
    type: 'yaml_generation',
    question: 'nginx:latest イメージを使用し、3つのレプリカを持つDeploymentのYAMLを作成してください。Deployment名は "nginx-deployment" とします。',
    correctAnswer: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80`,
    explanation: 'Deploymentは指定された数のPodレプリカを管理するKubernetesオブジェクトです。selectorとtemplate.metadata.labelsが一致している必要があります。',
    points: 25,
    difficulty: 3,
    tags: ['Deployment', 'YAML', 'Replica']
  },
  {
    id: 'q5',
    type: 'yaml_generation',
    question: 'nginx-deployment をClusterIP Serviceで公開するYAMLを作成してください。Service名は "nginx-service"、ポート80で公開します。',
    correctAnswer: `apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP`,
    explanation: 'ServiceはPodへのネットワークアクセスを提供します。selectorでDeploymentのPodを選択し、portでサービスポートを指定します。',
    points: 25,
    difficulty: 3,
    tags: ['Service', 'YAML', 'ClusterIP']
  }
];

// 実践的なkubectlコマンドの試験問題
const practicalKubectlQuestions: ExamQuestion[] = [
  {
    id: 'q6',
    type: 'kubectl_command',
    question: '全てのnamespaceで実行中のPodを一覧表示するkubectlコマンドを記述してください。',
    correctAnswer: 'kubectl get pods --all-namespaces',
    explanation: '--all-namespacesオプションを使用すると、すべてのネームスペースのリソースを表示できます。',
    points: 15,
    difficulty: 2,
    tags: ['kubectl', 'Pod', 'Namespace']
  },
  {
    id: 'q7',
    type: 'kubectl_command',
    question: 'nginx-deployment を5つのレプリカにスケールするkubectlコマンドを記述してください。',
    correctAnswer: 'kubectl scale deployment nginx-deployment --replicas=5',
    explanation: 'kubectl scaleコマンドを使用してDeploymentのレプリカ数を変更できます。',
    points: 20,
    difficulty: 2,
    tags: ['kubectl', 'Scale', 'Deployment']
  }
];

// サンプル試験データ
export const sampleExams: Exam[] = [
  {
    id: 'exam-1',
    title: 'Kubernetes基本概念',
    description: 'KubernetesのPod、Service、Deploymentなどの基本概念を学習する試験です。',
    category: 'concept',
    difficulty: 1,
    timeLimit: 30,
    passingScore: 70,
    questions: basicKubernetesQuestions,
    prerequisites: [],
    tags: ['基本', 'Pod', 'Service', 'Deployment'],
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  },
  {
    id: 'exam-2',
    title: 'YAML設定作成',
    description: 'Kubernetes YAMLマニフェストファイルの作成スキルを評価する試験です。',
    category: 'yaml',
    difficulty: 3,
    timeLimit: 45,
    passingScore: 80,
    questions: yamlGenerationQuestions,
    prerequisites: ['exam-1'],
    tags: ['YAML', 'Deployment', 'Service', '設定'],
    isActive: true,
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02')
  },
  {
    id: 'exam-3',
    title: 'kubectl実践コマンド',
    description: 'kubectlコマンドを使用したKubernetesクラスター操作の実践的な試験です。',
    category: 'practical',
    difficulty: 2,
    timeLimit: 25,
    passingScore: 75,
    questions: practicalKubectlQuestions,
    prerequisites: ['exam-1'],
    tags: ['kubectl', 'コマンド', '実践'],
    isActive: true,
    createdAt: new Date('2025-01-03'),
    updatedAt: new Date('2025-01-03')
  },
  {
    id: 'exam-4',
    title: 'Kubernetes総合演習',
    description: 'Kubernetes全般の知識を統合的に評価する上級者向け試験です。',
    category: 'practical',
    difficulty: 4,
    timeLimit: 60,
    passingScore: 85,
    questions: [...basicKubernetesQuestions, ...yamlGenerationQuestions, ...practicalKubectlQuestions],
    prerequisites: ['exam-1', 'exam-2', 'exam-3'],
    tags: ['総合', '上級', 'YAML', 'kubectl'],
    isActive: true,
    createdAt: new Date('2025-01-04'),
    updatedAt: new Date('2025-01-04')
  }
];

// AWS ECSとKubernetesの比較問題
const ecsVsKubernetesQuestions: ExamQuestion[] = [
  {
    id: 'q8',
    type: 'multiple_choice',
    question: 'AWS ECSのTaskDefinitionに相当するKubernetesのオブジェクトはどれですか？',
    options: ['Pod', 'Deployment', 'Service', 'ConfigMap'],
    correctAnswer: 'Pod',
    explanation: 'ECSのTaskDefinitionはコンテナの実行仕様を定義し、KubernetesのPodマニフェストと類似の役割を果たします。',
    points: 15,
    difficulty: 2,
    tags: ['ECS', 'Comparison', 'Pod']
  },
  {
    id: 'q9',
    type: 'multiple_choice',
    question: 'AWS ECSのServiceに最も近いKubernetesの機能の組み合わせはどれですか？',
    options: [
      'Pod + Service',
      'Deployment + Service',
      'ReplicaSet + Service',
      'StatefulSet + Service'
    ],
    correctAnswer: 'Deployment + Service',
    explanation: 'ECSのServiceは指定された数のTaskを維持し、ロードバランシングを提供します。これはKubernetesのDeployment（レプリカ管理）+ Service（ロードバランシング）の組み合わせに相当します。',
    points: 20,
    difficulty: 3,
    tags: ['ECS', 'Comparison', 'Deployment', 'Service']
  }
];

// ECS移行者向けの特別な試験
export const ecsTransitionExam: Exam = {
  id: 'exam-ecs-transition',
  title: 'AWS ECS → Kubernetes移行',
  description: 'AWS ECS管理者がKubernetesに移行する際の重要な概念対比と実践的な知識を評価します。',
  category: 'concept',
  difficulty: 3,
  timeLimit: 40,
  passingScore: 80,
  questions: [...ecsVsKubernetesQuestions, ...basicKubernetesQuestions.slice(0, 2)],
  prerequisites: [],
  tags: ['ECS', '移行', '比較', 'AWS'],
  isActive: true,
  createdAt: new Date('2025-01-05'),
  updatedAt: new Date('2025-01-05')
};

// 完全な試験リストにECS移行試験を追加
sampleExams.push(ecsTransitionExam);
