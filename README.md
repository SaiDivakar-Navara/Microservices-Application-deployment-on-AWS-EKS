# 🚀 Polyglot Commerce Platform

A production-style **microservices-based e-commerce application** built using multiple programming languages and deployed on **AWS EKS** using Docker, Amazon ECR, Amazon RDS PostgreSQL, Kubernetes, and the AWS Load Balancer Controller.

This project demonstrates how a polyglot microservices application can be containerized, deployed, connected through Kubernetes service discovery, and exposed to the internet using an AWS Application Load Balancer.

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat&logo=amazonaws&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## 📖 Table of Contents

- [🚀 Polyglot Commerce Platform](#-polyglot-commerce-platform)
  - [📖 Table of Contents](#-table-of-contents)
  - [🏗️ Architecture](#️-architecture)
  - [📸 Screenshots](#-screenshots)
    - [Frontend — Microservice Control Center](#frontend--microservice-control-center)
    - [Infrastructure — AWS EKS Deployment](#infrastructure--aws-eks-deployment)
  - [🌍 Live Deployment Details](#-live-deployment-details)
    - [Application Access](#application-access)
    - [EKS Cluster](#eks-cluster)
    - [EC2 Worker Nodes](#ec2-worker-nodes)
    - [Amazon RDS (PostgreSQL)](#amazon-rds-postgresql)
    - [Amazon ECR — Repository URIs](#amazon-ecr--repository-uris)
    - [Kubernetes Pods (namespace: `polyglot-commerce`)](#kubernetes-pods-namespace-polyglot-commerce)
  - [📌 Project Overview](#-project-overview)
    - [Backend Services](#backend-services)
  - [🛠️ Technology Stack](#️-technology-stack)
  - [🔄 Application Flow](#-application-flow)
  - [🔗 Microservice Communication](#-microservice-communication)
  - [🗄️ Database Architecture](#️-database-architecture)
  - [🐳 Docker Architecture](#-docker-architecture)
  - [🐋 Running Locally with Docker Compose](#-running-locally-with-docker-compose)
  - [☁️ AWS Deployment Architecture](#️-aws-deployment-architecture)
  - [📦 Amazon ECR](#-amazon-ecr)
  - [☸️ Kubernetes Deployment](#️-kubernetes-deployment)
  - [🔐 Kubernetes Secrets](#-kubernetes-secrets)
  - [❤️ Health Checks](#️-health-checks)
  - [🌐 AWS Load Balancer Controller](#-aws-load-balancer-controller)
  - [🔀 API Routing](#-api-routing)
  - [📁 Project Structure](#-project-structure)
  - [🧪 Testing](#-testing)
  - [🔑 Demo Account](#-demo-account)
  - [🚀 Deployment Workflow](#-deployment-workflow)
  - [🎯 Key DevOps Concepts Demonstrated](#-key-devops-concepts-demonstrated)
  - [📌 Future Improvements](#-future-improvements)
  - [👨‍💻 Author](#-author)
  - [⭐ Support](#-support)

---

## 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │        Users         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   AWS ALB / Ingress  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    React Frontend    │
                         │       + Nginx        │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
          │    Auth     │    │   Catalog   │    │  Inventory  │
          │ Java/Spring │    │     Go      │    │   Node.js   │
          │    8081     │    │    8082     │    │    8083     │
          └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
          │    Order    │    │   Payment   │    │Notification │
          │   Python    │    │     C#      │    │    Ruby     │
          │    8084     │    │    8085     │    │    8086     │
          └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │   Analytics   │
                            │      PHP      │
                            │     8087      │
                            └───────┬───────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     Amazon RDS       │
                         │     PostgreSQL       │
                         │                      │
                         │    7 Separate DBs    │
                         └─────────────────────┘
```

---

## 📸 Screenshots

### Frontend — Microservice Control Center

| Overview Dashboard | Product Catalog |
|---|---|
| ![Overview](docs/screenshots/01-overview-dashboard.png) | ![Catalog](docs/screenshots/02-catalog-service.png) |

| Orders & Cart | Notifications |
|---|---|
| ![Orders & Cart](docs/screenshots/03-orders-cart.png) | ![Notifications](docs/screenshots/04-notifications-1.png) |

| Payment Ledger | Live Analytics |
|---|---|
| ![Payments](docs/screenshots/05-payments-ledger.png) | ![Analytics](docs/screenshots/07-analytics-dashboard.png) |

The dashboard ties together the full order lifecycle end to end — adding items to cart via the **Python (FastAPI) Order Service**, capturing payment via the **C# (ASP.NET Core) Payment Service**, firing a notification via the **Ruby (Sinatra) Notification Service**, and rolling everything up into the **PHP Analytics Service**.

### Infrastructure — AWS EKS Deployment

| Kubernetes Pods (all 8 services running) | EKS Cluster |
|---|---|
| ![kubectl get pods](docs/screenshots/08-kubectl-get-pods.png) | ![EKS Cluster](docs/screenshots/09-eks-cluster.png) |

| EC2 Worker Nodes | Amazon RDS PostgreSQL |
|---|---|
| ![EC2 Instances](docs/screenshots/10-ec2-instances.png) | ![RDS PostgreSQL](docs/screenshots/11-rds-postgres.png) |

**Amazon ECR — Private Repositories**

![ECR Repositories](docs/screenshots/12-ecr-repositories.png)

All 7 microservices plus the frontend are pushed as separate images to Amazon ECR, deployed as independent Kubernetes Deployments on EKS, and exposed through an AWS Application Load Balancer via Ingress.

> 📁 To render these images on GitHub, add the `docs/screenshots/` folder (included in this download) to your repository root, next to `README.md`.

---

## 🌍 Live Deployment Details

The platform is currently deployed and running on **Amazon EKS** in the `ap-south-1` (Mumbai) region.

### Application Access

| Item | Value |
|---|---|
| Frontend URL (ALB) | `k8s-polyglot-polyglot-9fb4fb3dd5-2002075130.ap-south-1.elb.amazonaws.com` |
| Demo login | `koshalkarma@gmail.com` |

### EKS Cluster

| Item | Value |
|---|---|
| Cluster name | `polyglot-commerce` |
| Kubernetes version | `1.34` |
| Region | Asia Pacific (Mumbai) — `ap-south-1` |
| Cluster ARN | `arn:aws:eks:ap-south-1:249123960212:cluster/polyglot-commerce` |
| API server endpoint | `https://0889CCEA8F8B16FF27F08CA17FC7F545.gr7.ap-south-1.eks.amazonaws.com` |
| OIDC provider | `oidc.eks.ap-south-1.amazonaws.com/id/0889CCEA8F8B16FF27F08CA17FC7F545` |
| Cluster IAM role | `arn:aws:iam::249123960212:role/eksctl-polyglot-cluster-ServiceRole-kaZbNgGRjqw6` |

### EC2 Worker Nodes

| Instance | Type | AZ | Status |
|---|---|---|---|
| `i-08d301ff871884ed6` | c7i-flex.large | ap-south-1a | Running |
| `i-0dee39ca533ab6a60` | m7i-flex.large | ap-south-1c | Running |
| `i-0a378eb41eb251199` | c7i-flex.large | ap-south-1c | Running |

### Amazon RDS (PostgreSQL)

| Item | Value |
|---|---|
| DB identifier | `polyglot-postgres` |
| Engine | PostgreSQL |
| Instance class | `db.t3.micro` |
| Endpoint | `polyglot-postgres.cdcm0s2ye4a1.ap-south-1.rds.amazonaws.com` |
| Port | `5432` |

### Amazon ECR — Repository URIs

| Repository | URI |
|---|---|
| auth-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/auth-service` |
| catalog-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/catalog-service` |
| inventory-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/inventory-service` |
| order-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/order-service` |
| payment-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/payment-service` |
| notification-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/notification-service` |
| analytics-service | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/analytics-service` |
| polyglot-commerce-frontend | `249123960212.dkr.ecr.ap-south-1.amazonaws.com/polyglot-commerce-frontend` |

### Kubernetes Pods (namespace: `polyglot-commerce`)

```text
NAME                                    READY   STATUS    RESTARTS   AGE
analytics-service-54d4c57db9-5qcbl      1/1     Running   0          60m
auth-service-7bb4fb44df-5pz9s           1/1     Running   0          155m
catalog-service-74f6657859-2ww2w        1/1     Running   0          146m
frontend-858557c86d-p8qjj               1/1     Running   0          55m
inventory-service-6bf694d97b-l5xp5      1/1     Running   0          80m
notification-service-6569cf5757-hl69t   1/1     Running   0          61m
order-service-857ff7b654-npvc5          1/1     Running   0          66m
payment-service-6486dc8c95-kqwrs        1/1     Running   0          63m
```

> ⚠️ **Note:** This is a personal demo/learning deployment. The AWS Account ID, endpoints, and cluster identifiers above are exposed here for transparency and portfolio purposes. If you fork or redeploy this project, replace these with your own resource identifiers, keep credentials out of source control, and avoid using a long-lived personal AWS account ID in a public production setup.

---

## 📌 Project Overview

This project is a **polyglot e-commerce platform** consisting of **7 backend microservices** and a **React frontend**.

Each backend service is implemented using a different technology to demonstrate a real-world polyglot microservices architecture. The application is containerized using Docker and deployed to an **AWS EKS** Kubernetes cluster.

### Backend Services

| Service | Technology | Port | Database |
|---|---|---|---|
| Auth Service | Java 21 + Spring Boot | 8081 | `auth_db` |
| Catalog Service | Go | 8082 | `catalog_db` |
| Inventory Service | Node.js + Express | 8083 | `inventory_db` |
| Order Service | Python + FastAPI | 8084 | `order_db` |
| Payment Service | C# + ASP.NET Core | 8085 | `payment_db` |
| Notification Service | Ruby + Sinatra | 8086 | `notification_db` |
| Analytics Service | PHP | 8087 | `analytics_db` |
| Frontend | React + Vite + Nginx | 80 | — |

---

## 🛠️ Technology Stack

**Application**
- Java 21, Spring Boot
- Go
- Node.js, Express.js
- Python, FastAPI
- C#, ASP.NET Core
- Ruby, Sinatra
- PHP
- React, Vite, Nginx

**Containerization**
- Docker
- Docker Compose

**AWS**
- Amazon ECR
- Amazon EKS
- Amazon RDS (PostgreSQL)
- AWS IAM
- IAM Roles for Service Accounts (IRSA)
- AWS Load Balancer Controller
- Application Load Balancer

**Kubernetes**
- Deployments
- Services
- ConfigMaps / environment variables
- Kubernetes Secrets
- Readiness & Liveness Probes
- Ingress
- ClusterIP Services

---

## 🔄 Application Flow

A typical request flows through the following path:

```text
User
  │
  ▼
AWS Application Load Balancer
  │
  ▼
Kubernetes Ingress
  │
  ├── /                    → Frontend
  ├── /api/auth             → Auth Service
  ├── /api/catalog          → Catalog Service
  ├── /api/inventory        → Inventory Service
  ├── /api/orders           → Order Service
  ├── /api/payments         → Payment Service
  ├── /api/notifications    → Notification Service
  └── /api/analytics        → Analytics Service
```

Backend services communicate with each other using Kubernetes internal DNS, e.g.:

```text
Order Service
  ├── Catalog Service
  ├── Inventory Service
  └── Notification Service
```

---

## 🔗 Microservice Communication

**Order Service**
```text
Order
 ├── Catalog
 ├── Inventory
 └── Notification
```

**Payment Service**
```text
Payment
 ├── Order
 ├── Inventory
 └── Notification
```

**Analytics Service**
```text
Analytics
 ├── Catalog
 ├── Inventory
 ├── Order
 └── Payment
```

---

## 🗄️ Database Architecture

The application uses **Amazon RDS PostgreSQL** in the AWS deployment. Each microservice has its own database, following the **database-per-service** pattern for logical data separation:

```text
PostgreSQL
│
├── auth_db
├── catalog_db
├── inventory_db
├── order_db
├── payment_db
├── notification_db
└── analytics_db
```

---

## 🐳 Docker Architecture

Every backend service has its own `Dockerfile`:

```text
services/
├── auth-service/
│   └── Dockerfile
├── catalog-service/
│   └── Dockerfile
├── inventory-service/
│   └── Dockerfile
├── order-service/
│   └── Dockerfile
├── payment-service/
│   └── Dockerfile
├── notification-service/
│   └── Dockerfile
└── analytics-service/
    └── Dockerfile
```

The frontend is also containerized using a **multi-stage build**:

```text
frontend/
├── Dockerfile
└── nginx.conf
```

```text
React Source → Node.js Build Stage → Production Build → Nginx Container
```

---

## 🐋 Running Locally with Docker Compose

Make sure Docker and Docker Compose are installed.

**1. Clone the repository**
```bash
git clone https://github.com/koshalcloud/7-Microservice-Project.git
cd 7-Microservice-Project
```

**2. Start the complete application**
```bash
docker compose up -d --build
```

**3. Check running containers**
```bash
docker compose ps
```

**4. View logs**
```bash
docker compose logs -f
```

**5. Stop the application**
```bash
docker compose down
```

The frontend can then be accessed at:
```text
http://localhost:8080
```

---

## ☁️ AWS Deployment Architecture

```text
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │     AWS ALB      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Kubernetes     │
              │     Ingress      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Amazon EKS     │
              │     Cluster      │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       Frontend    Microservices   Services
                       │
                       ▼
              ┌─────────────────┐
              │   Amazon RDS     │
              │   PostgreSQL     │
              └─────────────────┘
```

---

## 📦 Amazon ECR

Each service is stored as a separate Docker image in Amazon ECR:

```text
Amazon ECR
│
├── auth-service
├── catalog-service
├── inventory-service
├── order-service
├── payment-service
├── notification-service
├── analytics-service
└── polyglot-commerce-frontend
```

**Example image URI:**
```text
<aws-account-id>.dkr.ecr.<region>.amazonaws.com/auth-service:1.0
```

---

## ☸️ Kubernetes Deployment

Kubernetes manifests are available inside `k8s/`:

```text
k8s/
├── auth.yaml
├── catalog.yaml
├── inventory.yaml
├── order.yaml
├── payment.yaml
├── notification.yaml
├── analytics.yaml
├── frontend.yaml
└── ingress.yaml
```

Each backend service is deployed as:

```text
Deployment → Pods → ClusterIP Service
```

---

## 🔐 Kubernetes Secrets

Database credentials are provided to Kubernetes workloads using Secrets, e.g.:

```text
postgres-app-secret
```

> ⚠️ **Sensitive database credentials should never be committed to source control.**
> For production environments, credentials should be managed using a proper secret-management solution (e.g. AWS Secrets Manager / External Secrets Operator) and rotated regularly.

---

## ❤️ Health Checks

Every backend service exposes a health endpoint:

```text
/health
```

Kubernetes uses **readiness** and **liveness** probes to monitor service health:

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8081

livenessProbe:
  httpGet:
    path: /health
    port: 8081
```

This helps Kubernetes determine:
- Whether a Pod is ready to receive traffic
- Whether a container is healthy
- When a container should be restarted

---

## 🌐 AWS Load Balancer Controller

The project uses the **AWS Load Balancer Controller** to integrate Kubernetes Ingress with an AWS Application Load Balancer:

```text
Internet
   │
   ▼
AWS Application Load Balancer
   │
   ▼
Kubernetes Ingress
   │
   ├── Frontend
   ├── Auth
   ├── Catalog
   ├── Inventory
   ├── Orders
   ├── Payments
   ├── Notifications
   └── Analytics
```

Backend services remain internal, exposed only via Kubernetes `ClusterIP` Services.

---

## 🔀 API Routing

The ALB Ingress routes requests based on URL path:

| Path | Service |
|---|---|
| `/api/auth/*` | Auth Service |
| `/api/catalog/*` | Catalog Service |
| `/api/inventory/*` | Inventory Service |
| `/api/orders/*` | Order Service |
| `/api/payments/*` | Payment Service |
| `/api/notifications/*` | Notification Service |
| `/api/analytics/*` | Analytics Service |
| `/` | Frontend |

The AWS Load Balancer Controller's URL rewrite functionality is used where required to map frontend API paths to backend endpoints.

---

## 📁 Project Structure

```text
7-Microservice-Project/
│
├── database/
│   └── bootstrap.sql
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
│
├── services/
│   ├── auth-service/
│   ├── catalog-service/
│   ├── inventory-service/
│   ├── order-service/
│   ├── payment-service/
│   ├── notification-service/
│   └── analytics-service/
│
├── k8s/
│   ├── auth.yaml
│   ├── catalog.yaml
│   ├── inventory.yaml
│   ├── order.yaml
│   ├── payment.yaml
│   ├── notification.yaml
│   ├── analytics.yaml
│   ├── frontend.yaml
│   └── ingress.yaml
│
├── docs/
├── scripts/
├── docker-compose.yml
├── ARCHITECTURE.md
├── PROJECT-STRUCTURE.txt
├── Steps.md
└── README.md
```

---

## 🧪 Testing

**Health endpoints (local):**
```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
curl http://localhost:8085/health
curl http://localhost:8086/health
curl http://localhost:8087/health
```

**Kubernetes:**
```bash
kubectl get pods -n polyglot-commerce
kubectl get services -n polyglot-commerce
kubectl get ingress -n polyglot-commerce
```

**Application logs:**
```bash
kubectl logs deployment/auth-service -n polyglot-commerce
```

---

## 🔑 Demo Account

For local/demo testing only:

```text
Email: admin@devopsshack.com
Password: admin123
```

> ⚠️ **Change these demo credentials before using the application in any real production environment.**

---

## 🚀 Deployment Workflow

```text
Developer
    │
    ▼
GitHub
    │
    ▼
Docker Build
    │
    ▼
Amazon ECR
    │
    ▼
Amazon EKS
    │
    ├── Kubernetes Deployments
    ├── Kubernetes Services
    ├── Kubernetes Secrets
    └── Kubernetes Ingress
              │
              ▼
       AWS Load Balancer
              │
              ▼
            Users

EKS ───────────────► Amazon RDS PostgreSQL
```

---

## 🎯 Key DevOps Concepts Demonstrated

- Microservices architecture
- Polyglot application development
- Docker containerization & multi-stage builds
- Docker Compose
- Amazon ECR & Amazon EKS
- Kubernetes Deployments, Services, Secrets
- Kubernetes health probes (readiness/liveness)
- Kubernetes Ingress
- AWS Load Balancer Controller & Application Load Balancer
- Amazon RDS PostgreSQL
- IAM & IAM Roles for Service Accounts (IRSA)
- Kubernetes service discovery & internal microservice communication
- API routing
- Containerized frontend deployment
- Cloud-native application deployment

---

## 📌 Future Improvements

- [ ] Horizontal Pod Autoscaler (HPA)
- [ ] CPU / memory resource requests & limits
- [ ] HTTPS with AWS Certificate Manager (ACM)
- [ ] Route 53 custom domain
- [ ] External Secrets / AWS Secrets Manager integration
- [ ] CloudWatch monitoring
- [ ] Centralized logging
- [ ] Prometheus and Grafana
- [ ] CI/CD using GitHub Actions
- [ ] Rolling deployment strategies
- [ ] Network policies
- [ ] Pod disruption budgets
- [ ] Automated database migrations

---

## 👨‍💻 Author

**SAI DIVAKAR**
Cloud / DevOps Project

---

## ⭐ Support

If you find this project useful, please give the repository a ⭐ and feel free to explore the architecture and deployment configuration.

> **Note:** For security, the actual RDS endpoint, AWS Account ID, and production credentials have been intentionally excluded from this README, since this is a public repository.
