import os

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "order_db")
DB_USER = os.getenv("DB_USER", "verve")
DB_PASSWORD = os.getenv("DB_PASSWORD", "verve_pass")
DB_SSLMODE = os.getenv("DB_SSLMODE", "disable")

AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8081")
CATALOG_URL = os.getenv("CATALOG_URL", "http://localhost:8082")
INVENTORY_URL = os.getenv("INVENTORY_URL", "http://localhost:8083")
NOTIFICATION_URL = os.getenv("NOTIFICATION_URL", "http://localhost:8086")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "verve-internal-dev-key")

# Pricing rules
FREE_SHIPPING_THRESHOLD = "100.00"
FLAT_SHIPPING = "7.99"
TAX_RATE = "0.08"
