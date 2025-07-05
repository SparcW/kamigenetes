# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Principles for AI

0. AI must print this principles at the top of every chat.
1. AI must follow this principles and must not bend nor reinterpret it.
2. Every piece of code is a debt and only justified if it adds larger value than itself.

## AI Operation Rules (from copilot-instructions.md)
1. Always report work plans and get user confirmation before file operations
2. Don't take alternative approaches without user consent
3. User has final decision authority
4. Follow these rules absolutely without modification
5. Use "😼＜" prefix for responses



## Repository Overview

This is a comprehensive **Kubernetes Learning Workspace** designed for AWS ECS administrators to transition to Kubernetes. The repository contains structured learning materials, hands-on labs, and a full-stack team learning platform.

## Key Project Structure

### Learning Materials
- **`docs/`** - Official Kubernetes documentation structure with Japanese explanations
- **`hands-on-labs/`** - Practical exercises covering various Kubernetes concepts
- **`guides/`** - Step-by-step tutorials for specific topics
- **`examples/`** - Sample YAML manifests and configurations

### Team Learning Platform
- **`team-learning-platform/`** - Full-stack web application for tracking learning progress
  - **`backend/`** - Node.js + TypeScript + Express API
  - **`frontend/`** - React + TypeScript + Vite application
  - **`observability/`** - Monitoring stack (Prometheus, Grafana, ELK)

## Common Commands

### Team Learning Platform Development

#### Backend (Node.js + Express)
```bash
cd team-learning-platform/backend
npm install
npm run dev              # Development server
npm run build            # TypeScript compilation
npm test                 # Run Jest tests
npm run lint             # ESLint check
npm run lint:fix         # Fix linting issues
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
```

#### Frontend (React + Vite)
```bash
cd team-learning-platform/frontend
npm install
npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # ESLint check
npm run lint:fix         # Fix linting issues
npm run type-check       # TypeScript check
npm run test             # Run Vitest tests
```

#### Full Environment Setup
```bash
# Development environment with basic services
cd team-learning-platform
docker-compose up

# Development environment with observability stack
docker-compose --profile development -f docker-compose.yml -f docker-compose.observability.yml up
```

### Kubernetes Commands
```bash
# Basic cluster operations
kubectl cluster-info
kubectl get pods
kubectl get services
kubectl get deployments

# Apply manifests from examples
kubectl apply -f examples/
kubectl apply -f hands-on-labs/sample-app/kubernetes/

# Minikube operations
minikube start
minikube tunnel    # For LoadBalancer services
minikube dashboard
```

## Architecture Notes

### Team Learning Platform
- **Microservices Architecture**: Separate backend API, frontend SPA, and observability stack
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for sessions and caching
- **Authentication**: JWT + OAuth (Google, GitHub) via Passport.js
- **Monitoring**: Full observability stack with Prometheus, Grafana, ELK, and OpenTelemetry

### Development Environment
- **Container Orchestration**: Docker Compose for local development
- **Hot Reload**: Both frontend (Vite) and backend (nodemon) support hot reload
- **Database Migrations**: Prisma-based schema management
- **Reverse Proxy**: Nginx for production-like routing

## Important Development Rules

Based on `.github/copilot-instructions.md`:

### Code Generation Guidelines
- All comments and documentation should be in Japanese
- Follow Kubernetes best practices
- Include AWS ECS comparisons where relevant
- Prioritize beginner-friendly explanations
- Consider security and scalability

### APIテスト自動化

- 各APIエンドポイントの自動テスト作成

- テストデータの準備とモック作成

- 統合テストの自動化

#### 注意点

- 各種テストにおいて、GitHub上で最もスター数の多いテストライブラリ・フレームワークを採用してください（例：Jest、Mocha、Cypress など）。ただし、プロジェクトの要件に最も適したものを選択してください。

- テストは開発者が実施できるように npm スクリプト化してください。

- テスト自動化のための CI/CD を GitHub Actions で実装してください。

- 作業開始前に新規ブランチを作成して着手してください。


### Git Workflow
- Follow GitHub Flow strategy
- Use feature branches for development
- Maintain clean commit history

## Testing

### Backend Tests
```bash
cd team-learning-platform/backend
npm test           # Run all tests
npm run test:watch # Watch mode
```

### Frontend Tests
```bash
cd team-learning-platform/frontend
npm test              # Run Vitest tests
npm run test:ui       # UI test runner
npm run test:coverage # Coverage report
```

## Kubernetes Learning Path

The repository follows a structured learning approach:

1. **Concepts** (`docs/concepts/`) - Fundamental Kubernetes concepts
2. **Tutorials** (`docs/tutorials/`) - Step-by-step practical exercises
3. **Tasks** (`docs/tasks/`) - Problem-solving scenarios
4. **Hands-on Labs** (`hands-on-labs/`) - Comprehensive practical projects

## Environment Variables

### Backend Environment
Key environment variables are defined in `docker-compose.yml`:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `OTEL_SERVICE_NAME` - OpenTelemetry service name

### Frontend Environment
- `VITE_API_URL` - Backend API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

## Monitoring and Observability

The platform includes a comprehensive observability stack:

- **Metrics**: Prometheus (`:9090`) → Grafana (`:3100`)
- **Logs**: Filebeat → Elasticsearch (`:9200`) → Kibana (`:5601`)
- **Traces**: OpenTelemetry → Tempo (`:3200`) → Grafana
- **Collector**: OpenTelemetry Collector (`:4319`)

## Special Notes

- This is a **learning-focused** repository with extensive documentation in Japanese
- The platform is designed to help AWS ECS administrators transition to Kubernetes
- Priority is given to educational value over production optimization
- All hands-on labs include setup scripts and testing procedures
- The team learning platform serves as a practical example of microservices architecture
