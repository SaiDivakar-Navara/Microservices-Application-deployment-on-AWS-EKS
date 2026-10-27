Polyglot Commerce Platform
Complete Project + DevOps Deployment Steps

Docker  Docker Compose  Amazon ECR  Amazon EKS  Amazon RDS PostgreSQL 
Kubernetes  AWS Load Balancer Controller  ALB/Ingress  React + Nginx


1.	Project Overview
Polyglot Commerce is a microservices-based e-commerce application with seven backend services and a React frontend. Each backend uses a different technology, while the application is containerized with Docker and deployed on AWS EKS.
Auth	Java 21 + Spring Boot		8081		auth_db Catalog	Go	8082	catalog_db Inventory	Node.js + Express	8083	inventory_db Order	Python + FastAPI	8084	order_db Payment	C# + ASP.NET Core	8085	payment_db Notification Ruby + Sinatra	8086	notification_db Analytics	PHP	8087	analytics_db Frontend	React + Vite + Nginx 80

2.	Prepare the Server
sudo apt update sudo apt upgrade -y
sudo apt install -y docker.io
sudo systemctl enable --now docker docker --version

sudo apt install -y docker-compose-v2 docker compose version

sudo apt install -y openjdk-21-jdk java -version
javac -version

git clone https://github.com/<source-owner>/7-Microservice-Project.git cd 7-Microservice-Project

3.	Build the Auth Service
cd services/auth-service
mvn clean package -DskipTests cd ../..

docker build -t auth-service:1.0 services/auth-service
Auth uses Java 21 and Spring Boot. Its container exposes port 8081 and starts the generated JAR.

4.	Create Dockerfiles
Create one Dockerfile for every backend and one for the frontend. The frontend uses a multi-stage Node build and serves the production React build with Nginx.
# Frontend
FROM node:22-alpine AS build WORKDIR /app
COPY package*.json ./ RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html COPY nginx.conf /etc/nginx/conf.d/default.conf EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
Backend Dockerfiles used in this deployment: Go 1.22 builder + Debian slim; Node 22 Alpine; Python 3.12 slim; .NET 8 SDK/runtime; Ruby 3.4 Bookworm; PHP 8.3 CLI with PostgreSQL/cURL extensions; and Eclipse Temurin Java 21.
 
5.	Docker Compose Local Deployment
docker compose build docker compose up -d docker compose ps

curl http://localhost:8081/health curl http://localhost:8082/health curl http://localhost:8083/health curl http://localhost:8084/health curl http://localhost:8085/health curl http://localhost:8086/health curl http://localhost:8087/health

# Frontend
# http://localhost:8080

docker compose logs -f docker compose down
PostgreSQL is run as a Compose container for local testing. The seven application databases are created from database/bootstrap.sql.
6.	AWS CLI and IAM
aws sts get-caller-identity aws configure get region
The deployment used an EC2 IAM role for AWS authentication. Static AWS credentials should never be committed to GitHub.
7.	Amazon ECR
aws ecr create-repository --repository-name auth-service --region ap-south-1 aws ecr create-repository --repository-name catalog-service --region ap-south-1
aws ecr create-repository --repository-name inventory-service --region ap-south-1 aws ecr create-repository --repository-name order-service --region ap-south-1
aws ecr create-repository --repository-name payment-service --region ap-south-1
aws ecr create-repository --repository-name notification-service --region ap-south-1 aws ecr create-repository --repository-name analytics-service --region ap-south-1
aws ecr create-repository --repository-name polyglot-commerce-frontend --region ap-south-1

aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.am
Build, tag and push all eight images. The frontend deployment used image tag 2.0 and the inventory service used tag 3.0 after its RDS SSL connection was corrected.
8.	Create the EKS Cluster
eksctl create cluster \
--name polyglot-commerce \
--region ap-south-1 \
--nodes 2 \
--node-type t3.medium \
--nodes-min 2 \
--nodes-max 3

kubectl cluster-info kubectl get nodes

kubectl create namespace polyglot-commerce kubectl get namespace polyglot-commerce

9.	Create Amazon RDS PostgreSQL
Create PostgreSQL RDS in the same VPC as the EKS worker nodes. Configure the RDS security group to allow TCP 5432 from the EKS node security group.
kubectl run psql-test --rm -it --image=postgres:16 -- \ psql -h <RDS_ENDPOINT> -U <RDS_MASTER_USER> -d postgres
CREATE ROLE microapp LOGIN PASSWORD '<APP_DB_PASSWORD>';
CREATE DATABASE auth_db OWNER microapp; CREATE DATABASE catalog_db OWNER microapp; CREATE DATABASE inventory_db OWNER microapp; CREATE DATABASE order_db OWNER microapp;
 
CREATE DATABASE payment_db OWNER microapp; CREATE DATABASE notification_db OWNER microapp; CREATE DATABASE analytics_db OWNER microapp;
The deployed RDS instance used seven separate databases and the application role microapp. Do not publish the real password.
10.	Kubernetes Secrets
kubectl create secret generic postgres-secret \
-n polyglot-commerce \
--from-literal=DB_USER='microapp' \
--from-literal=DB_PASSWORD='<APP_DB_PASSWORD>' \
--from-literal=DB_HOST='<RDS_ENDPOINT>' \
--from-literal=DB_PORT='5432'
For services that require complete DSNs, create a separate postgres-app-secret with keys such as CATALOG_DB_DSN, ORDER_DB_DSN, PAYMENT_DB_URL and NOTIFICATION_DB_URL. Reference them using secretKeyRef. Do not commit the real Secret manifest.
11.	Deploy the Backend Services
kubectl apply -f k8s/auth.yaml kubectl apply -f k8s/catalog.yaml kubectl apply -f k8s/inventory.yaml kubectl apply -f k8s/order.yaml kubectl apply -f k8s/payment.yaml
kubectl apply -f k8s/notification.yaml kubectl apply -f k8s/analytics.yaml

kubectl get pods -n polyglot-commerce kubectl get svc -n polyglot-commerce
Services are ClusterIP services and communicate internally using names such as catalog-service:8082 and inventory-service:8083.
12.	Health Checks and Inventory SSL
# Health endpoint
curl http://localhost:<PORT>/health

# Inventory Node.js connection pattern const pool = new Pool({
host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 5432),
database: process.env.DB_NAME || "inventory_db", user: process.env.DB_USER || "microapp",
password: process.env.DB_PASSWORD || "<PASSWORD>", ssl: { rejectUnauthorized: false }
});
Kubernetes readiness and liveness probes check /health. For production, prefer proper RDS certificate validation instead of disabling certificate verification.
13.	Deploy the Frontend
kubectl apply -f k8s/frontend.yaml
kubectl get deployment frontend -n polyglot-commerce kubectl get pods -n polyglot-commerce -l app=frontend
The frontend Service remains ClusterIP because a single AWS ALB/Ingress is used as the public entry point.

14.	AWS Load Balancer Controller
eksctl utils associate-iam-oidc-provider \
--cluster polyglot-commerce \
--region ap-south-1 \
--approve

helm repo add eks https://aws.github.io/eks-charts helm repo update
Download the official AWS Load Balancer Controller IAM policy, create the IAM policy, and attach it to the Kubernetes service account with eksctl.
 
eksctl create iamserviceaccount \
--cluster polyglot-commerce \
--region ap-south-1 \
--namespace kube-system \
--name aws-load-balancer-controller \
--attach-policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy \
--override-existing-serviceaccounts \
--approve

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
-n kube-system \
--set clusterName=polyglot-commerce \
--set serviceAccount.create=false \
--set serviceAccount.name=aws-load-balancer-controller \
--set region=ap-south-1 \
--set vpcId=<EKS_VPC_ID>

kubectl get pods -n kube-system | grep aws-load-balancer-controller

15.	Kubernetes Ingress and ALB
kubectl apply -f k8s/ingress.yaml kubectl get ingress -n polyglot-commerce
Ingress uses an internet-facing ALB, IP target type, HTTP port 80, and the alb ingress class. The root path routes to the frontend; /api/* paths route to backend ClusterIP services.
16.	API Path Rewrites
The frontend calls paths such as /api/auth/auth/login while the Auth service expects /auth/login. AWS Load Balancer Controller URL rewrite transforms solve this mismatch.
alb.ingress.kubernetes.io/transforms.auth-service: > [
{
"type": "url-rewrite", "urlRewriteConfig": {
"rewrites": [
{
"regex": "^/api/auth/auth/(.+)$", "replace": "/auth/$1"
}
]
}
}
]
Equivalent rewrites were configured for Catalog, Inventory, Order, Payment, Notification and Analytics: /api//(.+)  /$1.

17.	End-to-End Testing
kubectl get pods -n polyglot-commerce kubectl get svc -n polyglot-commerce kubectl get ingress -n polyglot-commerce

curl -i -X POST http://<ALB_DNS>/api/auth/auth/login \
-H "Content-Type: application/json" \
-d '{"email":"<DEMO_EMAIL>","password":"<DEMO_PASSWORD>"}'
Open the ALB DNS name in a browser. Verify frontend loading, login, catalog products, inventory, orders, payments, notifications and analytics. Use browser Network tools and kubectl logs when debugging API failures.
18.	Troubleshooting
ECR 403: refresh ECR login with aws ecr get-login-password. RDS connection failure: verify VPC, subnet/security group and TCP 5432. Ingress 404: compare frontend paths to backend endpoints and verify rewrite transforms. Pod not ready: check kubectl describe pod and kubectl logs. ALB not created: inspect AWS Load Balancer Controller logs, IAM policy, VPC/subnet tags and Ingress annotations.
19.	GitHub Cleanup and Push
git status git remote -v
 
# Recommended .gitignore entries
.env
.env.*
*.pem
*.key
.aws/ node_modules/ target/
dist/ build/
 pycache /
.pytest_cache/
*.bak
*.zip
*.log

git add . git status
git commit -m "Add Docker, Kubernetes and AWS deployment configuration"
git remote set-url origin https://github.com/<YOUR_USER>/<YOUR_REPOSITORY>.git git push -u origin main
Never commit AWS access keys, secret keys, production database passwords or actual Kubernetes Secret manifests. Temporary installers, backups and build artifacts should also stay out of Git.
20.	Final Checklist
•	All 7 backend services and the React frontend build successfully.
•	Docker Compose runs the complete application locally.
•	All service images are stored in Amazon ECR.
•	EKS cluster and worker nodes are healthy.
•	RDS PostgreSQL is reachable from EKS and contains seven databases.
•	Kubernetes Deployments, ClusterIP Services, Secrets and probes are configured.
•	AWS Load Balancer Controller is running.
•	ALB/Ingress exposes the frontend and API routes.
•	Required URL rewrites work.
•	GitHub contains source code, Dockerfiles, Compose, Kubernetes and deployment documentation without AWS credentials or production secrets.

Project flow: GitHub  Docker  ECR  EKS  RDS  Kubernetes Services  Ingress  ALB 
Users
