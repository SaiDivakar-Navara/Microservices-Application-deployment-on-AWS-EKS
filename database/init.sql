-- Verve Market: one PostgreSQL server, one database per microservice.
-- Docker Compose runs this automatically on first start.
-- On Amazon RDS, run it once as the master user:
--   psql -h <rds-endpoint> -U postgres -f database/init.sql
-- Change the role password below before using it anywhere real.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'verve') THEN
    CREATE ROLE verve LOGIN PASSWORD 'verve_pass';
  END IF;
END
$$;

SELECT 'CREATE DATABASE auth_db OWNER verve'         WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth_db')\gexec
SELECT 'CREATE DATABASE catalog_db OWNER verve'      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'catalog_db')\gexec
SELECT 'CREATE DATABASE inventory_db OWNER verve'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inventory_db')\gexec
SELECT 'CREATE DATABASE order_db OWNER verve'        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_db')\gexec
SELECT 'CREATE DATABASE payment_db OWNER verve'      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payment_db')\gexec
SELECT 'CREATE DATABASE notification_db OWNER verve' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_db')\gexec
SELECT 'CREATE DATABASE analytics_db OWNER verve'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analytics_db')\gexec
