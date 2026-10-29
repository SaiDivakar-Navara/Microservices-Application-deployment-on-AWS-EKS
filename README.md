# Verve Market

An online store built as **7 microservices in 7 languages**, one PostgreSQL database per service, and a React storefront. It is designed to be run with Docker Compose first and then deployed to **AWS EKS**.

Shoppers can browse and search products, check stock, add to a cart, check out with a card or UPI, track orders and get notifications. Admins get a dashboard with sales, funnel and stock numbers, plus order, product and inventory management.

| | |
|---|---|
| Frontend | React 18, Vite, React Router, served by Nginx |
| Services | Java, Go, Node.js, Python, C#, Ruby, PHP |
| Data | PostgreSQL 16 (Amazon RDS in AWS), 7 databases on one server |
| Packaging | One Dockerfile per service, one `docker-compose.yml` |

---

## Contents

1. [Architecture](#architecture)
2. [Quick start with Docker Compose](#quick-start-with-docker-compose)
3. [Try it out](#try-it-out)
4. [How a purchase flows through the services](#how-a-purchase-flows-through-the-services)
5. [Configuration](#configuration)
6. [API reference](#api-reference)
7. [Running a service without Docker](#running-a-service-without-docker)
8. [Project structure](#project-structure)
9. [Deploying to AWS EKS](#deploying-to-aws-eks)
10. [Troubleshooting](#troubleshooting)

---

## Architecture

```text
                            Browser
                               |
        Docker Compose: Nginx  |  EKS: ALB Ingress (path rules)
                               |
        +----------------------+-------------------------+
        | /                                              | /api/<service>/...
        v                                                v
  React frontend (Nginx)      +------------------------------------------+
                              |  auth :8081   catalog :8082              |
                              |  Java         Go                         |
                              |  inventory :8083   order :8084           |
                              |  Node.js           Python                |
                              |  payment :8085   notification :8086      |
                              |  C#              Ruby                    |
                              |  analytics :8087                         |
                              |  PHP                                     |
                              +--------------------+---------------------+
                                                   |
                                  PostgreSQL (Amazon RDS in AWS)
   auth_db  catalog_db  inventory_db  order_db  payment_db  notification_db  analytics_db

   Calls between services
     order        -> auth, catalog, inventory, notification
     payment      -> auth, order, inventory, notification
     analytics    -> auth, order, payment, catalog, inventory
     catalog, inventory, notification -> auth (to check admin or signed-in users)
```

### Services

| Service | Language | Port | Database | What it owns |
|---|---|---|---|---|
| `auth-service` | Java 21, Spring Boot | 8081 | `auth_db` | Accounts, passwords (BCrypt), sign-in sessions. Every other service asks it "who owns this token?" |
| `catalog-service` | Go 1.22 | 8082 | `catalog_db` | Products, categories, search, filters, sorting. Admin create, edit and hide |
| `inventory-service` | Node.js 22, Express 5 | 8083 | `inventory_db` | Stock levels and reservations (reserve, commit, release) |
| `order-service` | Python 3.12, FastAPI | 8084 | `order_db` | Orders, line items, pricing, shipping and tax, order lifecycle |
| `payment-service` | C#, ASP.NET Core 8 | 8085 | `payment_db` | Payment attempts against a simulated gateway |
| `notification-service` | Ruby 3.4, Sinatra | 8086 | `notification_db` | In-app notifications for order and payment events |
| `analytics-service` | PHP 8.3 | 8087 | `analytics_db` | Storefront events and the admin dashboard numbers |
| `frontend` | React + Nginx | 80 (8080 on your machine) | none | The storefront and the admin area |

Each service has its own database and never reads another service's tables. They talk over HTTP only.

### Design decisions worth knowing

- **Every service serves its routes under `/api/<service>`**, for example `/api/orders/12`. The same URL works in Vite dev, Docker Compose and behind an ALB, so the Ingress needs plain path rules and **no URL rewriting**.
- **Same configuration contract in every language**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`, plus the peer URLs. One ConfigMap and one Secret cover the whole platform.
- **`DB_SSLMODE=require` turns on TLS** for RDS; `disable` (the default) is for a local container.
- **Stock is reserved when an order is created** and committed when it is paid, or released when it is cancelled. Two shoppers cannot buy the last unit.
- **Prices always come from the catalog**, never from the browser.
- **Service-to-service endpoints** (reserve stock, mark an order paid, create a notification) require the `X-Internal-Key` header. They are reachable through the ingress path but useless without the key.
- **Every error is JSON** shaped `{"error": "message"}`, whatever the language.
- **Startup is forgiving**: each service retries its database connection for about a minute, so start order does not matter.

---

## Quick start with Docker Compose

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

The first build downloads dependencies for seven languages, so allow a few minutes. Then open **http://localhost:8080**.

```bash
docker compose ps                    # all containers should be running
docker compose logs -f order-service # follow one service
docker compose down                  # stop (keeps the data)
docker compose down -v               # stop and delete the data
```

The databases are created from `database/init.sql`, and every service creates its own tables and seed data on first start. The stack exposes ports 8081 to 8087 so you can call a service directly:

```bash
curl http://localhost:8082/api/catalog/products?category=Kitchen
curl http://localhost:8083/api/inventory/3
```

---

## Try it out

### Demo accounts

| Account | Email | Password |
|---|---|---|
| Shopper | `shopper@verve.shop` | `Shopper@123` |
| Admin | `admin@verve.shop` | `Admin@123` |

Set `SEED_DEMO_USERS=false` on `auth-service` to skip creating them. You can also register your own account on the sign-in page.

### Test payments

No real money moves. The payment service simulates a gateway:

| Method | Input | Result |
|---|---|---|
| Card | `4242 4242 4242 4242` (any expiry and CVV) | Succeeds |
| Card | number ending `0002` | Declined |
| Card | number ending `9995` | Insufficient funds |
| UPI | `sam@upi` | Succeeds |
| UPI | any ID containing `fail` | Declined |

### A five-minute tour

1. Open the store, search for "lamp" and open **Arc Floor Lamp**. It shows a low-stock warning because only 6 are seeded.
2. Add two products to the cart and sign in as the shopper.
3. Check out. Continue to payment, and note that the items are now **reserved** (look at `/api/inventory/3`).
4. Pay with a card ending `0002` to see a decline, then with `4242 4242 4242 4242`.
5. Open **My orders** and the bell icon for the notifications created by the order and payment services.
6. Sign out, sign in as the admin and open **Admin**. Mark the order as shipped, then check the dashboard.
7. Open **Service status** in the footer to see the health of all seven services.

---

## How a purchase flows through the services

```text
Browser            order            catalog     inventory      payment        notification
  | place order      |                  |            |             |                |
  |----------------->| who is this? (auth)           |             |                |
  |                  |--- price each item ->         |             |                |
  |                  |--- reserve stock ------------>|             |                |
  |                  |--- "order placed" -------------------------------------------->|
  |<-- order #12 ----|                                                              |
  |                                                                                 |
  | pay order #12 --------------------------------------------->|                  |
  |                  |<-- load order (owner check) --------------|                  |
  |                  |<-- mark paid -----------------------------|                  |
  |                  |                  |  commit reservation <--|                  |
  |                  |                  |            |           |--- "paid" ------>|
  |<-- payment ok ---------------------------------------------|                   |
```

If a payment succeeds but the order update fails, the payment service answers 502 and the next "Pay" press finishes the job instead of charging twice. Cancelling an unpaid order releases the reservation.

---

## Configuration

All services read their settings from environment variables. `docker-compose.yml` already sets them.

### Shared by every service that uses a database

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` | `localhost` | Postgres host (the RDS endpoint in AWS) |
| `DB_PORT` | `5432` | |
| `DB_NAME` | the service's own database | `auth_db`, `catalog_db`, ... |
| `DB_USER` | `verve` | |
| `DB_PASSWORD` | `verve_pass` | **Change this outside local development** |
| `DB_SSLMODE` | `disable` | Use `require` for Amazon RDS |

### Service-to-service

| Variable | Default | Used by |
|---|---|---|
| `INTERNAL_API_KEY` | `verve-internal-dev-key` | All services. **Must be the same everywhere, and secret in real deployments** |
| `AUTH_URL` | `http://localhost:8081` | catalog, inventory, order, payment, notification, analytics |
| `CATALOG_URL` | `http://localhost:8082` | order, analytics |
| `INVENTORY_URL` | `http://localhost:8083` | order, payment, analytics |
| `ORDER_URL` | `http://localhost:8084` | payment, analytics |
| `PAYMENT_URL` | `http://localhost:8085` | analytics |
| `NOTIFICATION_URL` | `http://localhost:8086` | order, payment |
| `PORT` | the service's port | All services |
| `SEED_DEMO_USERS` | `true` | auth |

Pricing rules live in `services/order-service/app/config.py` (free shipping from $100, otherwise $7.99, 8% tax). The cart in `frontend/src/context/CartContext.jsx` mirrors them so totals match.

---

## API reference

All paths are public URLs. "Signed in" means an `Authorization: Bearer <token>` header from `/api/auth/login`. Every service also answers `GET /health` and `GET /api/<service>/health`.

### Auth (`/api/auth`)

| Method and path | Access | Description |
|---|---|---|
| `POST /register` | public | `{name, email, password}` returns `{token, user}` |
| `POST /login` | public | `{email, password}` returns `{token, user}` |
| `GET /me` | signed in | The current user |
| `POST /logout` | signed in | Ends the session |

### Catalog (`/api/catalog`)

| Method and path | Access | Description |
|---|---|---|
| `GET /products` | public | Query: `q`, `category`, `min`, `max`, `sort` (`price_asc`, `price_desc`, `rating`, `popular`, `newest`), `featured`, `on_sale`, `limit`. `all=true` adds hidden products (admin) |
| `GET /products/{id}` | public | One product |
| `GET /categories` | public | Categories with product counts |
| `POST /products`, `PUT /products/{id}`, `DELETE /products/{id}` | admin | Create, edit, hide (delete hides the product so old orders stay intact) |

### Inventory (`/api/inventory`)

| Method and path | Access | Description |
|---|---|---|
| `GET /` and `GET /{productId}` | public | `quantity`, `reserved`, `available`, `status` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) |
| `PUT /{productId}` | admin | `{quantity, reorder_level?}` sets the on-hand quantity |
| `POST /reservations` | internal | `{order_id, items:[{product_id, quantity}]}`, 409 with `shortages` when stock is short |
| `POST /reservations/{orderId}/commit` | internal | Turns a reservation into a sale |
| `POST /reservations/{orderId}/release` | internal | Returns reserved units to stock |

### Orders (`/api/orders`)

| Method and path | Access | Description |
|---|---|---|
| `POST /` | signed in | `{items:[{product_id, quantity}], shipping_address}` creates an order in `PENDING_PAYMENT` and reserves stock |
| `GET /` | signed in | Your orders. Admins can add `?all=true` and `status=` |
| `GET /{id}` | owner or admin | One order with items |
| `POST /{id}/cancel` | owner or admin | Only while awaiting payment |
| `PATCH /{id}/status` | admin | `{status: "SHIPPED"}` then `"DELIVERED"` |
| `POST /{id}/mark-paid` | internal | Called by payment-service |

Order statuses: `PENDING_PAYMENT`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`. Interactive docs: `/api/orders/docs`.

### Payments (`/api/payments`)

| Method and path | Access | Description |
|---|---|---|
| `POST /` | signed in | `{order_id, method: "CARD"\|"UPI", card_number?, upi_id?}`. 201 on success, 402 when declined |
| `GET /` | signed in | Your payments. Admins can add `?all=true`; `order_id=` filters |

### Notifications (`/api/notifications`)

| Method and path | Access | Description |
|---|---|---|
| `GET /` | signed in | Your latest 50 notifications |
| `POST /{id}/read`, `POST /read-all` | signed in | Mark as read |
| `POST /` | internal | Create a notification |

### Analytics (`/api/analytics`)

| Method and path | Access | Description |
|---|---|---|
| `POST /events` | public | `{type, product_id?, session_id?}` where type is `product_view`, `add_to_cart`, `checkout_started` or `search` |
| `GET /summary` | admin | Revenue, orders by status, sales per day, top products, categories, low stock, funnel, payment success rate |

---

## Running a service without Docker

Start Postgres and create the databases first:

```bash
docker run -d --name verve-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
psql -h localhost -U postgres -f database/init.sql
```

The defaults point at `localhost`, so each service runs with no extra settings:

| Service | Command (from the service folder) |
|---|---|
| auth | `mvn spring-boot:run` |
| catalog | `go run .` |
| inventory | `npm ci && npm start` |
| order | `pip install -r requirements.txt && uvicorn app.main:app --port 8084` |
| payment | `dotnet run` |
| notification | `bundle install && ruby app.rb` |
| analytics | `php -S 0.0.0.0:8087 index.php` (needs `pdo_pgsql` and `curl`) |
| frontend | `npm ci && npm run dev` (http://localhost:5173, proxies `/api/*` to the services) |

Set `API_HOST` when the services run elsewhere, for example `API_HOST=192.168.1.20 npm run dev`.

---

## Project structure

```text
verve-market/
├── docker-compose.yml          Whole platform: Postgres, 7 services, frontend
├── database/
│   └── init.sql                Creates the role and the 7 databases
├── frontend/                   React storefront and admin area
│   ├── src/
│   │   ├── api/                fetch client and one function per endpoint
│   │   ├── components/         header, product card, payment panel, ...
│   │   ├── context/            auth, cart, toasts
│   │   ├── pages/              storefront pages; admin/ holds the admin area
│   │   ├── lib/                formatting, data hooks, event tracking
│   │   └── styles/             design tokens and CSS
│   ├── nginx.conf              Static hosting (used on EKS)
│   ├── nginx.compose.conf      Same plus /api proxying (used by Compose)
│   └── Dockerfile
└── services/
    ├── auth-service/           Java: controller, error handler, DB initializer
    ├── catalog-service/        Go: handlers, product queries, seed data
    ├── inventory-service/      Node.js: routes, reservations, database helpers
    ├── order-service/          Python: routes, clients for other services, schema
    ├── payment-service/        C#: minimal API, store, peer clients
    ├── notification-service/   Ruby: one Sinatra app
    └── analytics-service/      PHP: router, events, summary builder
```

---

## Deploying to AWS EKS

This repository does not include Kubernetes manifests, so you can write them yourself as practice. This section lists everything those manifests need.

### 1. Build and push the images

Create eight ECR repositories (one per service plus the frontend), then:

```bash
AWS_REGION=ap-south-1
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY=$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY

for svc in auth catalog inventory order payment notification analytics; do
  docker build -t $REGISTRY/$svc-service:1.0 services/$svc-service
  docker push $REGISTRY/$svc-service:1.0
done
docker build -t $REGISTRY/verve-frontend:1.0 frontend
docker push $REGISTRY/verve-frontend:1.0
```

Build with `--platform linux/amd64` if you are on an Apple Silicon machine and your nodes are x86.

### 2. Database on Amazon RDS

1. Create one PostgreSQL 16 instance in the same VPC as the cluster and allow the node security group on port 5432.
2. Run `database/init.sql` once as the master user. It creates the `verve` role and the 7 databases. Edit the password in that file first.
3. Services create their own tables and seed data on first start.

### 3. What each workload needs

| Workload | Container port | Probe path | Notes |
|---|---|---|---|
| auth-service | 8081 | `/health` | Set `SEED_DEMO_USERS=false` for anything public |
| catalog-service | 8082 | `/health` | |
| inventory-service | 8083 | `/health` | |
| order-service | 8084 | `/health` | |
| payment-service | 8085 | `/health` | |
| notification-service | 8086 | `/health` | |
| analytics-service | 8087 | `/health` | |
| frontend | 80 | `/healthz` | Uses `nginx.conf`, which serves static files only |

- Create a `ClusterIP` Service per workload. Use these Service names so the peer URLs below work: `auth-service`, `catalog-service`, `inventory-service`, `order-service`, `payment-service`, `notification-service`, `analytics-service`, `frontend`.
- **ConfigMap** values: `DB_HOST` (RDS endpoint), `DB_PORT`, `DB_USER`, `DB_SSLMODE=require`, and the peer URLs, for example `AUTH_URL=http://auth-service:8081` (same for `CATALOG_URL`, `INVENTORY_URL`, `ORDER_URL`, `PAYMENT_URL`, `NOTIFICATION_URL`).
- **Secret** values: `DB_PASSWORD` and `INTERNAL_API_KEY`.
- **Per workload**: `DB_NAME` (`auth_db`, `catalog_db`, ...). The frontend needs no environment variables.
- Start with 1 replica each. Services are stateless, so they scale horizontally. Sessions are stored in `auth_db`.

### 4. Ingress with the AWS Load Balancer Controller

Because every service already serves `/api/<service>`, one Ingress with plain `Prefix` rules is enough:

| Path prefix | Service | Port |
|---|---|---|
| `/api/auth` | auth-service | 8081 |
| `/api/catalog` | catalog-service | 8082 |
| `/api/inventory` | inventory-service | 8083 |
| `/api/orders` | order-service | 8084 |
| `/api/payments` | payment-service | 8085 |
| `/api/notifications` | notification-service | 8086 |
| `/api/analytics` | analytics-service | 8087 |
| `/` | frontend | 80 |

Useful annotations: `alb.ingress.kubernetes.io/scheme: internet-facing`, `target-type: ip`, and per-service health checks with `alb.ingress.kubernetes.io/healthcheck-path` set to `/health` (the frontend uses `/healthz`).

### 5. Check the deployment

- `https://<alb-dns>/status` shows all seven services as up, using the same `/api/<service>/health` routes the app uses.
- Sign in as the admin and open the dashboard: it only loads when order, payment, catalog and inventory are all reachable from the analytics pod, so it is a good end-to-end check.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| A service restarts repeatedly | It cannot reach Postgres. Check `DB_HOST`, the password, and `DB_SSLMODE=require` on RDS |
| Checkout says "a required service is unavailable" | `order-service` cannot reach `catalog-service`, `inventory-service` or `auth-service`. Check the `*_URL` variables |
| 403 `internal endpoint` in service logs | `INTERNAL_API_KEY` differs between services |
| Dashboard fails to load | `analytics-service` needs `ORDER_URL`, `PAYMENT_URL`, `CATALOG_URL` and `INVENTORY_URL` |
| Stock looks wrong after resetting only some databases | Reservations are tied to order IDs. Reset `order_db` and `inventory_db` together |
| ALB targets unhealthy | Health check path must be `/health` (`/healthz` for the frontend), and the security group must allow the ALB to reach the pods |
| Blank page after refresh on a deep link | The frontend must be served by the provided `nginx.conf` so unknown paths fall back to `index.html` |

---

## Notes

- This is a demo store. The payment gateway is simulated and no card data is stored; only the last four digits of a card are kept.
- Product pictures are emoji on coloured tiles so the project has no external image dependencies. Add an image URL to a product in the admin area to replace the emoji.
