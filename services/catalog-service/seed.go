package main

import "log"

func migrate() {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS products (
			id               BIGSERIAL PRIMARY KEY,
			name             VARCHAR(160) NOT NULL,
			brand            VARCHAR(80)  NOT NULL DEFAULT '',
			category         VARCHAR(80)  NOT NULL,
			description      TEXT         NOT NULL DEFAULT '',
			price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
			compare_at_price NUMERIC(10,2),
			emoji            VARCHAR(16)  NOT NULL DEFAULT '📦',
			color            VARCHAR(16)  NOT NULL DEFAULT '#E8ECF5',
			image_url        TEXT         NOT NULL DEFAULT '',
			rating           NUMERIC(2,1) NOT NULL DEFAULT 0,
			review_count     INTEGER      NOT NULL DEFAULT 0,
			featured         BOOLEAN      NOT NULL DEFAULT FALSE,
			active           BOOLEAN      NOT NULL DEFAULT TRUE,
			created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`)
	if err != nil {
		log.Fatalf("migrate: %v", err)
	}
}

type seedRow struct {
	name, brand, category, description string
	price                              float64
	compareAt                          float64 // 0 = not on sale
	emoji, color                       string
	rating                             float64
	reviews                            int
	featured                           bool
}

// Product IDs are 1..24 in this order. inventory-service seeds stock for the same IDs.
var seedProducts = []seedRow{
	// Home
	{"Linen Throw Blanket", "Hearthwell", "Home", "Stonewashed European linen, breathable in summer and cosy in winter. 130 x 170 cm.", 64, 82, "🛋️", "#F3D9C4", 4.7, 312, true},
	{"Soy Wax Candle Trio", "Ember & Oak", "Home", "Three hand-poured candles: cedar, fig and sea salt. About 40 hours each.", 38, 0, "🕯️", "#F7E3A1", 4.6, 205, false},
	{"Arc Floor Lamp", "Lumen Studio", "Home", "Dimmable warm-white LED lamp with a weighted marble base and a 2 m reach.", 129, 159, "💡", "#E6DCF5", 4.5, 98, true},
	{"Woven Storage Basket", "Hearthwell", "Home", "Seagrass basket with cotton handles for blankets, toys or laundry.", 27, 0, "🧺", "#EBD9B8", 4.4, 143, false},
	// Kitchen
	{"Ceramic Pour-Over Set", "Kilnhouse", "Kitchen", "Hand-glazed dripper, carafe and two cups. Brews a clean, bright cup.", 46, 0, "☕", "#D5E8E0", 4.8, 421, true},
	{"Cast Iron Skillet 10in", "Foundry & Co", "Kitchen", "Pre-seasoned and oven safe. Gets better with every meal you cook.", 52, 65, "🍳", "#DADDE3", 4.9, 876, true},
	{"Bamboo Knife Block Set", "Kilnhouse", "Kitchen", "Five stainless steel knives in a self-sharpening bamboo block.", 89, 0, "🔪", "#E5E0C6", 4.5, 187, false},
	{"Glass Meal-Prep Containers", "Fresh Fold", "Kitchen", "Set of 8 leak-proof glass containers with snap lids. Microwave and freezer safe.", 34, 0, "🥗", "#D3EBCB", 4.6, 534, false},
	// Tech
	{"Wireless ANC Headphones", "Auralis", "Tech", "Active noise cancelling, 40-hour battery and multipoint Bluetooth pairing.", 149, 199, "🎧", "#CFE0FA", 4.6, 1290, true},
	{"Compact Mechanical Keyboard", "Keyline", "Tech", "75% layout, hot-swappable switches and a quiet gasket-mounted plate.", 84, 0, "⌨️", "#D9DEEA", 4.7, 642, false},
	{"20,000 mAh Power Bank", "Voltix", "Tech", "65 W USB-C fast charging. Powers a laptop and two phones at once.", 39, 0, "🔋", "#F9D5D0", 4.4, 719, false},
	{"Smart Fitness Band", "Pulse", "Tech", "Heart rate, sleep and workout tracking with a 14-day battery.", 59, 79, "⌚", "#CDEFF0", 4.3, 958, true},
	// Fashion
	{"Everyday Canvas Backpack", "Northfield", "Fashion", "Water-resistant waxed canvas with a padded 15 inch laptop sleeve.", 58, 0, "🎒", "#E9D3C2", 4.6, 388, false},
	{"Merino Crew Sweater", "Woolgather", "Fashion", "Fine-gauge merino wool that keeps its shape and never itches.", 96, 120, "🧶", "#F5D0DC", 4.7, 264, true},
	{"Polarized Aviator Sunglasses", "Solis", "Fashion", "Lightweight titanium frame with UV400 polarized lenses.", 72, 0, "🕶️", "#FBE9B0", 4.5, 301, false},
	{"Leather Card Wallet", "Northfield", "Fashion", "Slim vegetable-tanned leather wallet with RFID protection. Holds 8 cards.", 35, 0, "💳", "#D8C3AE", 4.6, 452, false},
	// Beauty
	{"Vitamin C Glow Serum", "Dewy", "Beauty", "15% vitamin C with hyaluronic acid. Brightens and evens skin tone.", 29, 0, "🧴", "#FCE0B8", 4.5, 1104, true},
	{"Mineral Sunscreen SPF 50", "Solis", "Beauty", "Reef-safe zinc formula with no white cast. Water resistant for 80 minutes.", 22, 0, "☀️", "#FFF0B3", 4.6, 790, false},
	{"Rosewater Face Mist", "Dewy", "Beauty", "Cooling rose and aloe mist to refresh skin or set makeup.", 16, 0, "🌹", "#F9D1DB", 4.3, 366, false},
	{"Clay Detox Mask", "Dewy", "Beauty", "Kaolin and bentonite clay that deep-cleans pores in ten minutes.", 24, 30, "🧖", "#D9E6D0", 4.4, 245, false},
	// Fitness
	{"Non-Slip Yoga Mat", "Flowform", "Fitness", "6 mm natural rubber mat with alignment lines and a carry strap.", 42, 55, "🧘", "#D6E5F7", 4.7, 673, true},
	{"Adjustable Dumbbell Pair", "Ironleaf", "Fitness", "Dial from 2 to 20 kg per hand. Replaces ten pairs of dumbbells.", 119, 0, "🏋️", "#DCDCE6", 4.6, 412, false},
	{"Insulated Steel Bottle 1L", "Trailhead", "Fitness", "Keeps drinks cold for 24 hours or hot for 12. Leak-proof lid.", 28, 0, "🥤", "#CBEBE5", 4.8, 1534, false},
	{"Resistance Band Set", "Flowform", "Fitness", "Five latex-free bands from light to extra heavy, with a travel pouch.", 19, 0, "🤸", "#F4D6C8", 4.4, 828, false},
}

func seed() {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count); err != nil {
		log.Fatalf("seed: %v", err)
	}
	if count > 0 {
		return
	}
	for i, p := range seedProducts {
		var compare any
		if p.compareAt > 0 {
			compare = p.compareAt
		}
		_, err := db.Exec(`
			INSERT INTO products (id, name, brand, category, description, price, compare_at_price, emoji, color, rating, review_count, featured)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			i+1, p.name, p.brand, p.category, p.description, p.price, compare, p.emoji, p.color, p.rating, p.reviews, p.featured)
		if err != nil {
			log.Fatalf("seed product %q: %v", p.name, err)
		}
	}
	// Explicit IDs were used, so move the sequence past them.
	if _, err := db.Exec(`SELECT setval(pg_get_serial_sequence('products','id'), (SELECT MAX(id) FROM products))`); err != nil {
		log.Fatalf("seed: %v", err)
	}
	log.Printf("seeded %d products", len(seedProducts))
}
