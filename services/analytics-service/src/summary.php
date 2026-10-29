<?php
declare(strict_types=1);

const REVENUE_STATUSES = ['PAID', 'SHIPPED', 'DELIVERED'];
const DAYS = 14;

function build_summary(): array
{
    $orders = fetch_list('order-service', env('ORDER_URL', 'http://localhost:8084') . '/api/orders?all=true');
    $products = fetch_list('catalog-service', env('CATALOG_URL', 'http://localhost:8082') . '/api/catalog/products?all=true');
    $stock = fetch_list('inventory-service', env('INVENTORY_URL', 'http://localhost:8083') . '/api/inventory');
    $payments = fetch_list('payment-service', env('PAYMENT_URL', 'http://localhost:8085') . '/api/payments?all=true');

    $catalog = [];
    foreach ($products as $p) {
        $catalog[(int)$p['id']] = $p;
    }

    // ----- orders -----
    $byStatus = ['PENDING_PAYMENT' => 0, 'PAID' => 0, 'SHIPPED' => 0, 'DELIVERED' => 0, 'CANCELLED' => 0];
    $days = [];
    for ($i = DAYS - 1; $i >= 0; $i--) {
        $days[gmdate('Y-m-d', time() - $i * 86400)] = ['revenue' => 0.0, 'orders' => 0];
    }
    $revenue = 0.0;
    $unitsSold = 0;
    $paidOrders = 0;
    $customers = [];
    $perProduct = [];
    $perCategory = [];

    foreach ($orders as $order) {
        $status = (string)$order['status'];
        $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;
        if (!in_array($status, REVENUE_STATUSES, true)) {
            continue;
        }

        $total = (float)$order['total'];
        $revenue += $total;
        $paidOrders++;
        $customers[(string)$order['user_email']] = true;

        $day = (new DateTimeImmutable((string)$order['created_at']))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d');
        if (isset($days[$day])) {
            $days[$day]['revenue'] += $total;
            $days[$day]['orders']++;
        }

        foreach ($order['items'] as $item) {
            $pid = (int)$item['product_id'];
            $perProduct[$pid] ??= [
                'product_id' => $pid, 'name' => $item['name'], 'emoji' => $item['emoji'], 'units' => 0, 'revenue' => 0.0,
            ];
            $perProduct[$pid]['units'] += (int)$item['quantity'];
            $perProduct[$pid]['revenue'] += (float)$item['line_total'];
            $unitsSold += (int)$item['quantity'];

            $category = (string)($item['category'] ?: 'Other');
            $perCategory[$category] = ($perCategory[$category] ?? 0.0) + (float)$item['line_total'];
        }
    }

    usort($perProduct, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
    arsort($perCategory);

    $salesByDay = [];
    foreach ($days as $date => $row) {
        $salesByDay[] = ['date' => $date, 'revenue' => round($row['revenue'], 2), 'orders' => $row['orders']];
    }
    $categoryRevenue = [];
    foreach ($perCategory as $name => $amount) {
        $categoryRevenue[] = ['category' => $name, 'revenue' => round($amount, 2)];
    }

    // ----- stock -----
    $lowStock = [];
    foreach ($stock as $row) {
        if ($row['status'] === 'IN_STOCK') {
            continue;
        }
        $product = $catalog[(int)$row['product_id']] ?? null;
        $lowStock[] = [
            'product_id' => (int)$row['product_id'],
            'name' => $product['name'] ?? ('Product ' . $row['product_id']),
            'emoji' => $product['emoji'] ?? '📦',
            'available' => (int)$row['available'],
            'status' => $row['status'],
        ];
    }
    usort($lowStock, fn($a, $b) => $a['available'] <=> $b['available']);

    // ----- storefront funnel (events recorded by this service) -----
    $counts = db()->query("SELECT type, COUNT(*) AS n FROM events WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY type")
        ->fetchAll(PDO::FETCH_KEY_PAIR);

    $topViewed = [];
    $views = db()->query("
        SELECT product_id, COUNT(*) AS views FROM events
        WHERE type = 'product_view' AND product_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY product_id ORDER BY views DESC LIMIT 5
    ")->fetchAll();
    foreach ($views as $row) {
        $product = $catalog[(int)$row['product_id']] ?? null;
        $topViewed[] = [
            'product_id' => (int)$row['product_id'],
            'name' => $product['name'] ?? ('Product ' . $row['product_id']),
            'emoji' => $product['emoji'] ?? '📦',
            'views' => (int)$row['views'],
        ];
    }

    // ----- payments -----
    $succeeded = count(array_filter($payments, fn($p) => $p['status'] === 'SUCCEEDED'));
    $failed = count($payments) - $succeeded;

    return [
        'generated_at' => gmdate('c'),
        'totals' => [
            'revenue' => round($revenue, 2),
            'orders' => count($orders),
            'paid_orders' => $paidOrders,
            'average_order_value' => $paidOrders > 0 ? round($revenue / $paidOrders, 2) : 0.0,
            'units_sold' => $unitsSold,
            'customers' => count($customers),
        ],
        'orders_by_status' => $byStatus,
        'sales_by_day' => $salesByDay,
        'top_products' => array_slice($perProduct, 0, 5),
        'category_revenue' => $categoryRevenue,
        'low_stock' => $lowStock,
        'funnel' => [
            'product_views' => (int)($counts['product_view'] ?? 0),
            'add_to_cart' => (int)($counts['add_to_cart'] ?? 0),
            'checkout_started' => (int)($counts['checkout_started'] ?? 0),
            'orders_placed' => count($orders),
            'orders_paid' => $paidOrders,
        ],
        'top_viewed' => $topViewed,
        'payments' => [
            'succeeded' => $succeeded,
            'failed' => $failed,
            'success_rate' => count($payments) > 0 ? round($succeeded / count($payments) * 100, 1) : 0.0,
        ],
    ];
}
