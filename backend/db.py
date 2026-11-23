import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.environ.get("SQLITE_DB_PATH", str(DATA_DIR / "navabazaar.db"))).resolve()
LEGACY_JSON_PATH = DATA_DIR / "store.json"

PROMO_CODES: Dict[str, Dict[str, Any]] = {
    "NAVA10": {"discountPercent": 10, "maxDiscount": 2000, "label": "10% off up to ₹2,000"},
    "WELCOME500": {"discountPercent": 5, "maxDiscount": 500, "label": "5% off up to ₹500"},
}

STAGE_SEQUENCE: List[str] = [
    "Order Confirmed",
    "Packed at Hub",
    "In Transit",
    "Out for Delivery",
    "Delivered",
]

SORT_SQL_MAP: Dict[str, str] = {
    "featured": "sort_order ASC",
    "price_asc": "price ASC, sort_order ASC",
    "price_desc": "price DESC, sort_order ASC",
    "rating_desc": "rating DESC, review_count DESC",
    "discount_desc": "CAST(mrp - price AS REAL) / NULLIF(mrp, 0) DESC, sort_order ASC",
}

SEED_PRODUCTS: List[Dict[str, Any]] = [
    {
        "id": "prod-anc-headphones",
        "slug": "auralis-anc-studio-headphones",
        "name": "Auralis ANC Studio Wireless Headphones",
        "brand": "Auralis",
        "category": "Audio",
        "price": 14999,
        "mrp": 19999,
        "rating": 4.8,
        "reviewCount": 1420,
        "inStock": True,
        "stockCount": 24,
        "image": "/src/assets/images/prod_anc_headphones_1795429367667.jpg",
        "tagline": "Hybrid 42dB active noise cancellation with 45-hour battery life",
        "description": (
            "Engineered with 40mm custom beryllium-coated drivers and dual-chip adaptive noise "
            "cancellation for studio-grade clarity during flights, commutes, and focused work."
        ),
        "variants": ["Matte Obsidian", "Warm Stone"],
        "highlights": [
            "42dB adaptive hybrid active noise cancellation",
            "45 hours playback with ANC on, USB-C fast charge",
            "Multipoint Bluetooth 5.3 with lossless USB-C audio",
            "Memory-protein ear cushions with anodized aluminum yoke",
        ],
        "warranty": "2 Year Manufacturer Warranty",
        "seller": "Auralis Official Store",
        "deliveryDays": 2,
        "sortOrder": 1,
        "reviews": [
            {
                "id": "rev-1",
                "author": "Rohan Kulkarni",
                "city": "Pune",
                "rating": 5,
                "title": "Clean sound signature and silent flights",
                "comment": "Took these on a Bengaluru to Delhi flight and the cabin hum vanished completely. Cushion comfort stays great for 4+ hours.",
                "date": "14 Nov 2026",
                "verified": True,
            },
            {
                "id": "rev-2",
                "author": "Meera Nair",
                "city": "Kochi",
                "rating": 5,
                "title": "Multipoint switching works seamlessly",
                "comment": "Switches between my laptop call and phone effortlessly without dropping audio.",
                "date": "09 Nov 2026",
                "verified": True,
            },
        ],
    },
    {
        "id": "prod-titanium-watch",
        "slug": "kronos-titanium-smartwatch-s4",
        "name": "Kronos Titanium Smartwatch Series 4",
        "brand": "Kronos",
        "category": "Electronics",
        "price": 24499,
        "mrp": 29999,
        "rating": 4.7,
        "reviewCount": 892,
        "inStock": True,
        "stockCount": 16,
        "image": "/src/assets/images/prod_titanium_smartwatch_1795429369062.jpg",
        "tagline": "Grade-5 brushed titanium case with sapphire glass and dual-band GPS",
        "description": (
            "Built for endurance athletes and everyday precision. Features continuous heart-rate "
            "variability tracking, offline topographic maps, and 10-day battery endurance."
        ),
        "variants": ["Slate Woven Strap", "Obsidian Fluoroelastomer"],
        "highlights": [
            "45mm Grade-5 brushed titanium bezel with sapphire crystal",
            "Dual-frequency L1+L5 GPS with 5ATM water resistance",
            "10-day typical battery life and 30-min rapid magnetic charge",
            "AMOLED always-on display with 2,000 nits peak brightness",
        ],
        "warranty": "1 Year Kronos India Care",
        "seller": "Kronos Authorized Retail",
        "deliveryDays": 2,
        "sortOrder": 2,
        "reviews": [
            {
                "id": "rev-3",
                "author": "Vikramaditya Sen",
                "city": "Bengaluru",
                "rating": 5,
                "title": "Feels like a real mechanical timepiece",
                "comment": "Zero plastic feel. The woven slate strap dries quickly after morning runs.",
                "date": "18 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-mech-keyboard",
        "slug": "keyforge-75-cnc-mechanical-keyboard",
        "name": "Keyforge 75% CNC Mechanical Keyboard",
        "brand": "Keyforge",
        "category": "Electronics",
        "price": 8499,
        "mrp": 10999,
        "rating": 4.9,
        "reviewCount": 634,
        "inStock": True,
        "stockCount": 31,
        "image": "/src/assets/images/prod_mech_keyboard_1795429367532.jpg",
        "tagline": "Gasket-mounted aluminum chassis with hot-swappable tactile switches",
        "description": (
            "Precision-milled aluminum 75% mechanical keyboard with tri-mode wireless connectivity, "
            "PBT double-shot keycaps, and a knurled rotary volume encoder."
        ),
        "variants": ["Cream / Slate Tactile", "Cream / Slate Linear"],
        "highlights": [
            "CNC machined 6063 aluminum top and bottom housing",
            "Tri-mode connectivity: 2.4GHz dongle, Bluetooth 5.1, USB-C",
            "Hot-swappable 5-pin PCB with pre-lubed stabilizers",
            "QMK & VIA programmable keymap and 4,000mAh battery",
        ],
        "warranty": "1 Year Replacement Warranty",
        "seller": "Keyforge Peripherals",
        "deliveryDays": 3,
        "sortOrder": 3,
        "reviews": [
            {
                "id": "rev-4",
                "author": "Ananya Deshmukh",
                "city": "Hyderabad",
                "rating": 5,
                "title": "Deep thocky acoustics out of the box",
                "comment": "No pinging or rattle on the spacebar. The coiled cable and rotary knob make my desk setup feel complete.",
                "date": "12 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-mirrorless-camera",
        "slug": "fujifilm-xt4-mirrorless-prime-kit",
        "name": "Fujifilm X-T4 Mirrorless Kit (35mm f/1.4)",
        "brand": "Fujifilm",
        "category": "Electronics",
        "price": 118999,
        "mrp": 134999,
        "rating": 4.9,
        "reviewCount": 418,
        "inStock": True,
        "stockCount": 5,
        "image": "/src/assets/images/prod_mirrorless_camera_1795429367956.jpg",
        "tagline": "26.1MP X-Trans CMOS 4 sensor with 5-axis IBIS and classic dials",
        "description": (
            "A creator-grade weather-sealed mirrorless camera paired with a bright 35mm prime lens. "
            "Captures 4K/60p 10-bit video and iconic film simulations straight out of camera."
        ),
        "variants": ["Silver Body + 35mm Kit", "Body Only"],
        "highlights": [
            "26.1MP APS-C X-Trans BSI CMOS 4 sensor",
            "6.5-stop 5-axis in-body image stabilization (IBIS)",
            "Dedicated shutter speed, ISO, and exposure compensation dials",
            "Dual UHS-II SD card slots with weather-sealed magnesium body",
        ],
        "warranty": "2 Year Fujifilm India Warranty",
        "seller": "Optica Pro India",
        "deliveryDays": 3,
        "sortOrder": 4,
        "reviews": [
            {
                "id": "rev-5",
                "author": "Kabir Malhotra",
                "city": "Mumbai",
                "rating": 5,
                "title": "Tactile dials make photography joyful",
                "comment": "Sharp prime lens rendering and zero motion blur even at 1/15s handheld.",
                "date": "05 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-gooseneck-kettle",
        "slug": "baristacraft-gooseneck-electric-kettle",
        "name": "BaristaCraft Gooseneck Electric Kettle",
        "brand": "BaristaCraft",
        "category": "Home & Living",
        "price": 4299,
        "mrp": 5499,
        "rating": 4.6,
        "reviewCount": 1105,
        "inStock": True,
        "stockCount": 42,
        "image": "/src/assets/images/prod_gooseneck_kettle_1795429367943.jpg",
        "tagline": "PID variable temperature control with solid walnut handle",
        "description": (
            "Designed for precision pour-over coffee and specialty loose-leaf tea. Heats 900ml of "
            "water to your exact degree with a counterbalanced walnut grip."
        ),
        "variants": ["Matte Black / Walnut", "Brushed Steel / Walnut"],
        "highlights": [
            "1200W rapid boil with degree-by-degree PID control (40°C–100°C)",
            "304 food-grade stainless steel body with precision pour spout",
            "60-minute hold mode and built-in brew stopwatch",
            "Ergonomic solid walnut wood handle and lid finial",
        ],
        "warranty": "2 Year Domestic Warranty",
        "seller": "BaristaCraft Studio",
        "deliveryDays": 2,
        "sortOrder": 5,
        "reviews": [
            {
                "id": "rev-6",
                "author": "Siddharth Joshi",
                "city": "Jaipur",
                "rating": 5,
                "title": "Steady pour rate for V60 mornings",
                "comment": "Holds 93°C consistently and looks sculpted on the kitchen counter.",
                "date": "19 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-commuter-backpack",
        "slug": "arden-canvas-leather-commuter-pack",
        "name": "Arden Canvas & Leather Commuter Pack",
        "brand": "Arden",
        "category": "Fashion",
        "price": 5499,
        "mrp": 6999,
        "rating": 4.7,
        "reviewCount": 745,
        "inStock": True,
        "stockCount": 19,
        "image": "/src/assets/images/prod_commuter_backpack_1795429368554.jpg",
        "tagline": "Water-resistant waxed canvas with full-grain cognac leather trim",
        "description": (
            "Tailored 22L daily carry built to protect a 16-inch laptop alongside travel essentials. "
            "Combines heavy-duty YKK metal zippers with vegetable-tanned leather reinforcement."
        ),
        "variants": ["Slate & Cognac (22L)", "Charcoal & Espresso (22L)"],
        "highlights": [
            "Suspended micro-fleece 16\" laptop compartment",
            "16oz water-repellent waxed cotton canvas",
            "Full-grain vegetable-tanned leather base and grab handle",
            "Luggage pass-through strap and hidden passport pocket",
        ],
        "warranty": "3 Year Craftsmanship Guarantee",
        "seller": "Arden Leather Goods",
        "deliveryDays": 3,
        "sortOrder": 6,
        "reviews": [
            {
                "id": "rev-7",
                "author": "Neha Sharma",
                "city": "Gurugram",
                "rating": 5,
                "title": "Stands upright on its own",
                "comment": "The leather base gives it structure so it never slumps beside my desk. Easily holds laptop, charger pouch, and lunch.",
                "date": "16 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-knit-sneakers",
        "slug": "velox-stride-knit-running-sneakers",
        "name": "Velox Stride Knit Running Sneakers",
        "brand": "Velox",
        "category": "Fashion",
        "price": 4799,
        "mrp": 6499,
        "rating": 4.5,
        "reviewCount": 1890,
        "inStock": True,
        "stockCount": 54,
        "image": "/src/assets/images/prod_knit_sneakers_1795429367916.jpg",
        "tagline": "Breathable engineered knit upper with nitrogen-infused foam sole",
        "description": (
            "Featherweight daily trainers engineered for warm-weather road mileage and all-day urban "
            "walking. Responsive dual-density midsole absorbs heel impact cleanly."
        ),
        "variants": [
            "UK 7 / Chalk Slate",
            "UK 8 / Chalk Slate",
            "UK 9 / Chalk Slate",
            "UK 10 / Chalk Slate",
        ],
        "highlights": [
            "Single-piece 3D breathable engineered knit upper",
            "Nitrogen-infused EVA midsole with 8mm heel-to-toe drop",
            "High-abrasion carbon rubber outsole grip",
            "238g ultralight weight (UK 8)",
        ],
        "warranty": "6 Month Sole & Stitching Warranty",
        "seller": "Velox Performance India",
        "deliveryDays": 2,
        "sortOrder": 7,
        "reviews": [
            {
                "id": "rev-8",
                "author": "Arjun Verma",
                "city": "Chandigarh",
                "rating": 4,
                "title": "Very airy for humid runs",
                "comment": "True to UK size and super breathable. Cushioning hits the sweet spot between soft and responsive.",
                "date": "11 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-architect-lamp",
        "slug": "lumenarc-articulating-led-desk-lamp",
        "name": "LumenArc Articulating LED Desk Lamp",
        "brand": "LumenArc",
        "category": "Home & Living",
        "price": 6299,
        "mrp": 7999,
        "rating": 4.8,
        "reviewCount": 512,
        "inStock": True,
        "stockCount": 14,
        "image": "/src/assets/images/prod_architect_lamp_1795429367874.jpg",
        "tagline": "CRI 97+ glare-free architectural task light with stepless dimming",
        "description": (
            "Counter-balanced brushed aluminum cantilever arm puts crisp, flicker-free illumination "
            "exactly where you work or sketch, with adjustable 2700K–5500K color temperature."
        ),
        "variants": ["Brushed Aluminum / Matte White"],
        "highlights": [
            "High-CRI (97+) eye-care LED array with zero flicker",
            "3-axis precision springless friction hinges",
            "Touch-capacitive inline dimmer & color temperature memory",
            "Weighted machined steel base with silicone pad",
        ],
        "warranty": "3 Year Lighting Warranty",
        "seller": "LumenArc Lighting",
        "deliveryDays": 4,
        "sortOrder": 8,
        "reviews": [
            {
                "id": "rev-9",
                "author": "Priya Menon",
                "city": "Chennai",
                "rating": 5,
                "title": "Zero glare on glossy displays",
                "comment": "The asymmetric optics keep light on my notebook and off my monitor.",
                "date": "07 Nov 2026",
                "verified": True,
            }
        ],
    },
    {
        "id": "prod-wireless-speaker",
        "slug": "kinetic-360-acoustic-wireless-speaker",
        "name": "Kinetic 360 Acoustic Wireless Speaker",
        "brand": "Kinetic",
        "category": "Audio",
        "price": 9999,
        "mrp": 12499,
        "rating": 4.6,
        "reviewCount": 960,
        "inStock": False,
        "stockCount": 0,
        "image": "/src/assets/images/prod_wireless_speaker_1795429368437.jpg",
        "tagline": "360-degree omnidirectional room-filling sound in woven charcoal",
        "description": (
            "Acoustic-weave cylindrical wireless speaker combining a custom downward-firing woofer "
            "and dual silk-dome tweeters for balanced spatial sound anywhere in the room."
        ),
        "variants": ["Charcoal / Brushed Aluminum"],
        "highlights": [
            "360-degree acoustic waveguide with 45W RMS output",
            "Wi-Fi AirPlay, Spotify Connect & Bluetooth 5.3",
            "Machined anodized aluminum top capacitive ring",
            "14-hour portable battery mode with USB-C PD charging",
        ],
        "warranty": "1 Year Kinetic India Warranty",
        "seller": "Kinetic Acoustics",
        "deliveryDays": 3,
        "sortOrder": 9,
        "reviews": [
            {
                "id": "rev-10",
                "author": "Devansh Patel",
                "city": "Ahmedabad",
                "rating": 5,
                "title": "Clean bass without muddiness",
                "comment": "Fills my living room evenly regardless of where you sit.",
                "date": "02 Nov 2026",
                "verified": True,
            }
        ],
    },
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def hash_password(password: str, salt_hex: str) -> str:
    dk = hashlib.scrypt(
        password.encode("utf-8"),
        salt=bytes.fromhex(salt_hex),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    )
    return dk.hex()


def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    candidate = hash_password(password, salt_hex)
    return hmac.compare_digest(candidate, expected_hash_hex)


def init_db() -> None:
    conn = get_connection()
    try:
        with conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    brand TEXT NOT NULL,
                    category TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    mrp INTEGER NOT NULL,
                    rating REAL NOT NULL,
                    review_count INTEGER NOT NULL,
                    in_stock INTEGER NOT NULL,
                    stock_count INTEGER NOT NULL,
                    image TEXT NOT NULL,
                    tagline TEXT NOT NULL,
                    description TEXT NOT NULL,
                    variants_json TEXT NOT NULL,
                    highlights_json TEXT NOT NULL,
                    warranty TEXT NOT NULL,
                    seller TEXT NOT NULL,
                    delivery_days INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS product_reviews (
                    id TEXT PRIMARY KEY,
                    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    author TEXT NOT NULL,
                    city TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    comment TEXT NOT NULL,
                    review_date TEXT NOT NULL,
                    verified INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    phone TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS addresses (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    street TEXT NOT NULL,
                    city TEXT NOT NULL,
                    state TEXT NOT NULL,
                    pin_code TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS wishlist_items (
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, product_id)
                );

                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    tracking_number TEXT NOT NULL UNIQUE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    customer_name TEXT NOT NULL,
                    shipping_address_json TEXT NOT NULL,
                    subtotal INTEGER NOT NULL,
                    discount INTEGER NOT NULL,
                    shipping_fee INTEGER NOT NULL,
                    total INTEGER NOT NULL,
                    promo_code TEXT,
                    payment_method TEXT NOT NULL,
                    payment_summary TEXT NOT NULL,
                    payment_status TEXT NOT NULL,
                    order_status TEXT NOT NULL,
                    courier_name TEXT NOT NULL,
                    estimated_delivery TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    product_id TEXT NOT NULL REFERENCES products(id),
                    name TEXT NOT NULL,
                    brand TEXT NOT NULL,
                    image TEXT NOT NULL,
                    variant TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    unit_price INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS order_milestones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                    step_index INTEGER NOT NULL,
                    stage TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    location TEXT NOT NULL,
                    timestamp TEXT,
                    completed INTEGER NOT NULL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
                CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
                CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);
                CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
                """
            )

            # Seed catalog products and reviews idempotently
            for p in SEED_PRODUCTS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO products (
                        id, slug, name, brand, category, price, mrp, rating, review_count,
                        in_stock, stock_count, image, tagline, description, variants_json,
                        highlights_json, warranty, seller, delivery_days, sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        p["id"],
                        p["slug"],
                        p["name"],
                        p["brand"],
                        p["category"],
                        p["price"],
                        p["mrp"],
                        p["rating"],
                        p["reviewCount"],
                        1 if p["inStock"] else 0,
                        p["stockCount"],
                        p["image"],
                        p["tagline"],
                        p["description"],
                        json.dumps(p["variants"]),
                        json.dumps(p["highlights"]),
                        p["warranty"],
                        p["seller"],
                        p["deliveryDays"],
                        p["sortOrder"],
                    ),
                )
                for rev in p["reviews"]:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO product_reviews (
                            id, product_id, author, city, rating, title, comment, review_date, verified
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            rev["id"],
                            p["id"],
                            rev["author"],
                            rev["city"],
                            rev["rating"],
                            rev["title"],
                            rev["comment"],
                            rev["date"],
                            1 if rev["verified"] else 0,
                        ),
                    )

            # Seed showcase demo user (for foreign-key integrity on NB-DEMO-2026) and demo order
            demo_user_id = "demo-showcase-owner"
            demo_salt = secrets.token_hex(16)
            demo_hash = hash_password(secrets.token_hex(24), demo_salt)
            conn.execute(
                """
                INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    demo_user_id,
                    "Aarav Mehta",
                    "demo-showcase@navabazaar.internal",
                    "9820012345",
                    demo_hash,
                    demo_salt,
                    utc_now_iso(),
                ),
            )

            existing_demo_order = conn.execute(
                "SELECT id FROM orders WHERE tracking_number = ?",
                ("NB-DEMO-2026",),
            ).fetchone()

            if not existing_demo_order:
                now = datetime.now(timezone.utc)
                t1 = (now - timedelta(hours=36)).isoformat().replace("+00:00", "Z")
                t2 = (now - timedelta(hours=24)).isoformat().replace("+00:00", "Z")
                t3 = (now - timedelta(hours=8)).isoformat().replace("+00:00", "Z")
                est_date = (now + timedelta(days=1)).strftime("%d %b %Y")
                demo_addr = {
                    "id": "addr-demo",
                    "label": "Home",
                    "fullName": "Aarav Mehta",
                    "phone": "9820012345",
                    "street": "14th Main, Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pinCode": "560038",
                }
                conn.execute(
                    """
                    INSERT INTO orders (
                        id, tracking_number, user_id, customer_name, shipping_address_json,
                        subtotal, discount, shipping_fee, total, promo_code,
                        payment_method, payment_summary, payment_status, order_status,
                        courier_name, estimated_delivery, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "ord-demo-2026",
                        "NB-DEMO-2026",
                        demo_user_id,
                        "Aarav Mehta",
                        json.dumps(demo_addr),
                        14999,
                        1500,
                        0,
                        13499,
                        "NAVA10",
                        "upi",
                        "Demo UPI (aarav@okicici)",
                        "Demo Paid",
                        "In Transit",
                        "BlueDart Express Surface",
                        est_date,
                        t1,
                        t3,
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO order_items (
                        order_id, product_id, name, brand, image, variant, quantity, unit_price
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "ord-demo-2026",
                        "prod-anc-headphones",
                        "Auralis ANC Studio Wireless Headphones",
                        "Auralis",
                        "/src/assets/images/prod_anc_headphones_1795429367667.jpg",
                        "Matte Obsidian",
                        1,
                        14999,
                    ),
                )
                demo_milestones = [
                    (
                        0,
                        "Order Confirmed",
                        "Order Confirmed",
                        "Payment verified and order invoice generated.",
                        "NavaBazaar Order Desk",
                        t1,
                        1,
                    ),
                    (
                        1,
                        "Packed at Hub",
                        "Packed at Fulfillment Hub",
                        "Items quality-checked, sealed, and assigned airway bill.",
                        "Bhiwandi Fulfillment Center, MH",
                        t2,
                        1,
                    ),
                    (
                        2,
                        "In Transit",
                        "In Transit to Destination City",
                        "Shipment arrived at Bengaluru sorting facility.",
                        "Bengaluru Nelamangala Hub, KA",
                        t3,
                        1,
                    ),
                    (
                        3,
                        "Out for Delivery",
                        "Out for Delivery",
                        "Courier partner will be assigned for doorstep delivery.",
                        "Bengaluru Indiranagar Dispatch",
                        None,
                        0,
                    ),
                    (
                        4,
                        "Delivered",
                        "Delivered",
                        "Package delivered and signed at destination address.",
                        "Bengaluru",
                        None,
                        0,
                    ),
                ]
                for step_idx, stage, title, desc, loc, ts, done in demo_milestones:
                    conn.execute(
                        """
                        INSERT INTO order_milestones (
                            order_id, step_index, stage, title, description, location, timestamp, completed
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        ("ord-demo-2026", step_idx, stage, title, desc, loc, ts, done),
                    )

            # One-time migration from legacy store.json if it exists
            _migrate_legacy_json(conn)
    finally:
        conn.close()


def _migrate_legacy_json(conn: sqlite3.Connection) -> None:
    if not LEGACY_JSON_PATH.exists():
        return
    try:
        raw = json.loads(LEGACY_JSON_PATH.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(raw, dict):
        return

    for u in raw.get("users", []) or []:
        if not isinstance(u, dict) or not u.get("id") or not u.get("email"):
            continue
        conn.execute(
            """
            INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(u["id"]),
                str(u.get("name", "")),
                str(u["email"]).lower(),
                str(u.get("phone", "")),
                str(u.get("passwordHash", "")),
                str(u.get("salt", "")),
                str(u.get("createdAt", utc_now_iso())),
            ),
        )
        for addr in u.get("addresses", []) or []:
            if not isinstance(addr, dict) or not addr.get("id"):
                continue
            conn.execute(
                """
                INSERT OR IGNORE INTO addresses (
                    id, user_id, label, full_name, phone, street, city, state, pin_code, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(addr["id"]),
                    str(u["id"]),
                    str(addr.get("label", "Home")),
                    str(addr.get("fullName", "")),
                    str(addr.get("phone", "")),
                    str(addr.get("street", "")),
                    str(addr.get("city", "")),
                    str(addr.get("state", "")),
                    str(addr.get("pinCode", "")),
                    utc_now_iso(),
                ),
            )
        for prod_id in u.get("wishlist", []) or []:
            conn.execute(
                """
                INSERT OR IGNORE INTO wishlist_items (user_id, product_id, created_at)
                VALUES (?, ?, ?)
                """,
                (str(u["id"]), str(prod_id), utc_now_iso()),
            )

    for ord_data in raw.get("orders", []) or []:
        if not isinstance(ord_data, dict) or not ord_data.get("id"):
            continue
        exists = conn.execute(
            "SELECT id FROM orders WHERE id = ? OR tracking_number = ?",
            (str(ord_data["id"]), str(ord_data.get("trackingNumber", ""))),
        ).fetchone()
        if exists:
            continue
        user_exists = conn.execute(
            "SELECT id FROM users WHERE id = ?", (str(ord_data.get("userId", "")),)
        ).fetchone()
        if not user_exists:
            continue
        conn.execute(
            """
            INSERT INTO orders (
                id, tracking_number, user_id, customer_name, shipping_address_json,
                subtotal, discount, shipping_fee, total, promo_code,
                payment_method, payment_summary, payment_status, order_status,
                courier_name, estimated_delivery, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(ord_data["id"]),
                str(ord_data["trackingNumber"]),
                str(ord_data["userId"]),
                str(ord_data.get("customerName", "")),
                json.dumps(ord_data.get("shippingAddress", {})),
                int(ord_data.get("subtotal", 0)),
                int(ord_data.get("discount", 0)),
                int(ord_data.get("shippingFee", 0)),
                int(ord_data.get("total", 0)),
                ord_data.get("promoCode"),
                str(ord_data.get("paymentMethod", "upi")),
                str(ord_data.get("paymentSummary", "Demo Checkout")),
                str(ord_data.get("paymentStatus", "Demo Paid")),
                str(ord_data.get("orderStatus", "Order Confirmed")),
                str(ord_data.get("courierName", "Delhivery Air Express")),
                str(ord_data.get("estimatedDelivery", "")),
                str(ord_data.get("createdAt", utc_now_iso())),
                str(ord_data.get("updatedAt", utc_now_iso())),
            ),
        )
        for item in ord_data.get("items", []) or []:
            conn.execute(
                """
                INSERT INTO order_items (
                    order_id, product_id, name, brand, image, variant, quantity, unit_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(ord_data["id"]),
                    str(item["productId"]),
                    str(item["name"]),
                    str(item["brand"]),
                    str(item["image"]),
                    str(item["variant"]),
                    int(item["quantity"]),
                    int(item["unitPrice"]),
                ),
            )
        for idx, step in enumerate(ord_data.get("timeline", []) or []):
            conn.execute(
                """
                INSERT INTO order_milestones (
                    order_id, step_index, stage, title, description, location, timestamp, completed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(ord_data["id"]),
                    idx,
                    str(step["stage"]),
                    str(step["title"]),
                    str(step["description"]),
                    str(step["location"]),
                    step.get("timestamp"),
                    1 if step.get("completed") else 0,
                ),
            )


def _row_to_product(conn: sqlite3.Connection, row: sqlite3.Row) -> Dict[str, Any]:
    review_rows = conn.execute(
        """
        SELECT id, author, city, rating, title, comment, review_date, verified
        FROM product_reviews
        WHERE product_id = ?
        ORDER BY id ASC
        """,
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "brand": row["brand"],
        "category": row["category"],
        "price": row["price"],
        "mrp": row["mrp"],
        "rating": row["rating"],
        "reviewCount": row["review_count"],
        "inStock": bool(row["in_stock"]),
        "stockCount": row["stock_count"],
        "image": row["image"],
        "tagline": row["tagline"],
        "description": row["description"],
        "variants": json.loads(row["variants_json"]),
        "highlights": json.loads(row["highlights_json"]),
        "warranty": row["warranty"],
        "seller": row["seller"],
        "deliveryDays": row["delivery_days"],
        "reviews": [
            {
                "id": r["id"],
                "author": r["author"],
                "city": r["city"],
                "rating": r["rating"],
                "title": r["title"],
                "comment": r["comment"],
                "date": r["review_date"],
                "verified": bool(r["verified"]),
            }
            for r in review_rows
        ],
    }


def query_products(
    q: str = "",
    category: str = "",
    brands: Optional[List[str]] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_rating: float = 0.0,
    in_stock_only: bool = False,
    sort: str = "featured",
) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        clauses: List[str] = []
        params: List[Any] = []

        if q:
            like = f"%{q.lower()}%"
            clauses.append(
                "(LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(category) LIKE ? "
                "OR LOWER(tagline) LIKE ? OR LOWER(description) LIKE ?)"
            )
            params.extend([like, like, like, like, like])

        if category and category != "All":
            clauses.append("category = ?")
            params.append(category)

        if brands:
            placeholders = ",".join("?" for _ in brands)
            clauses.append(f"brand IN ({placeholders})")
            params.extend(brands)

        if min_price is not None:
            clauses.append("price >= ?")
            params.append(min_price)

        if max_price is not None:
            clauses.append("price <= ?")
            params.append(max_price)

        if min_rating > 0:
            clauses.append("rating >= ?")
            params.append(min_rating)

        if in_stock_only:
            clauses.append("in_stock = 1")

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        order_sql = SORT_SQL_MAP.get(sort, SORT_SQL_MAP["featured"])
        sql = f"SELECT * FROM products {where_sql} ORDER BY {order_sql}"
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_product(conn, row) for row in rows]
    finally:
        conn.close()


def get_product_by_id_or_slug(identifier: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM products WHERE id = ? OR slug = ?",
            (identifier, identifier),
        ).fetchone()
        return _row_to_product(conn, row) if row else None
    finally:
        conn.close()


def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        user = conn.execute(
            "SELECT id, name, email, phone, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not user:
            return None

        addr_rows = conn.execute(
            """
            SELECT id, label, full_name, phone, street, city, state, pin_code
            FROM addresses
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()

        wish_rows = conn.execute(
            "SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()

        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "addresses": [
                {
                    "id": a["id"],
                    "label": a["label"],
                    "fullName": a["full_name"],
                    "phone": a["phone"],
                    "street": a["street"],
                    "city": a["city"],
                    "state": a["state"],
                    "pinCode": a["pin_code"],
                }
                for a in addr_rows
            ],
            "wishlist": [w["product_id"] for w in wish_rows],
            "createdAt": user["created_at"],
        }
    finally:
        conn.close()


def register_user(name: str, email: str, phone: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    conn = get_connection()
    try:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            return None, "An account with this email already exists. Please sign in."

        user_id = f"usr_{secrets.token_hex(8)}"
        salt = secrets.token_hex(16)
        pw_hash = hash_password(password, salt)
        created_at = utc_now_iso()

        with conn:
            conn.execute(
                """
                INSERT INTO users (id, name, email, phone, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, name, email, phone, pw_hash, salt, created_at),
            )
        return get_user_profile(user_id), None
    finally:
        conn.close()


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, password_hash, salt FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if not row:
            return None
        if not verify_password(password, row["salt"], row["password_hash"]):
            return None
        return get_user_profile(row["id"])
    finally:
        conn.close()


def add_user_address(
    user_id: str,
    label: str,
    full_name: str,
    phone: str,
    street: str,
    city: str,
    state: str,
    pin_code: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    conn = get_connection()
    try:
        addr_id = f"addr_{secrets.token_hex(6)}"
        created_at = utc_now_iso()
        with conn:
            conn.execute(
                """
                INSERT INTO addresses (
                    id, user_id, label, full_name, phone, street, city, state, pin_code, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (addr_id, user_id, label, full_name, phone, street, city, state, pin_code, created_at),
            )
            # Keep most recent 8 addresses per user
            old_rows = conn.execute(
                "SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 8",
                (user_id,),
            ).fetchall()
            for r in old_rows:
                conn.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", (r["id"], user_id))

        profile = get_user_profile(user_id)
        addr = {
            "id": addr_id,
            "label": label,
            "fullName": full_name,
            "phone": phone,
            "street": street,
            "city": city,
            "state": state,
            "pinCode": pin_code,
        }
        return profile, addr
    finally:
        conn.close()


def delete_user_address(user_id: str, address_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                "DELETE FROM addresses WHERE id = ? AND user_id = ?",
                (address_id, user_id),
            )
        return get_user_profile(user_id)
    finally:
        conn.close()


def toggle_wishlist(user_id: str, product_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    conn = get_connection()
    try:
        prod = conn.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
        if not prod:
            return None, "Invalid product."

        with conn:
            existing = conn.execute(
                "SELECT 1 FROM wishlist_items WHERE user_id = ? AND product_id = ?",
                (user_id, product_id),
            ).fetchone()
            if existing:
                conn.execute(
                    "DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?",
                    (user_id, product_id),
                )
            else:
                conn.execute(
                    "INSERT INTO wishlist_items (user_id, product_id, created_at) VALUES (?, ?, ?)",
                    (user_id, product_id, utc_now_iso()),
                )
        return get_user_profile(user_id), None
    finally:
        conn.close()


def _hydrate_order(conn: sqlite3.Connection, row: sqlite3.Row) -> Dict[str, Any]:
    item_rows = conn.execute(
        """
        SELECT product_id, name, brand, image, variant, quantity, unit_price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
        """,
        (row["id"],),
    ).fetchall()

    milestone_rows = conn.execute(
        """
        SELECT stage, title, description, location, timestamp, completed
        FROM order_milestones
        WHERE order_id = ?
        ORDER BY step_index ASC
        """,
        (row["id"],),
    ).fetchall()

    return {
        "id": row["id"],
        "trackingNumber": row["tracking_number"],
        "userId": row["user_id"],
        "customerName": row["customer_name"],
        "shippingAddress": json.loads(row["shipping_address_json"]),
        "items": [
            {
                "productId": i["product_id"],
                "name": i["name"],
                "brand": i["brand"],
                "image": i["image"],
                "variant": i["variant"],
                "quantity": i["quantity"],
                "unitPrice": i["unit_price"],
            }
            for i in item_rows
        ],
        "subtotal": row["subtotal"],
        "discount": row["discount"],
        "shippingFee": row["shipping_fee"],
        "total": row["total"],
        "promoCode": row["promo_code"],
        "paymentMethod": row["payment_method"],
        "paymentSummary": row["payment_summary"],
        "paymentStatus": row["payment_status"],
        "orderStatus": row["order_status"],
        "courierName": row["courier_name"],
        "estimatedDelivery": row["estimated_delivery"],
        "timeline": [
            {
                "stage": m["stage"],
                "title": m["title"],
                "description": m["description"],
                "location": m["location"],
                "timestamp": m["timestamp"],
                "completed": bool(m["completed"]),
            }
            for m in milestone_rows
        ],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def get_orders_for_user(user_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return [_hydrate_order(conn, row) for row in rows]
    finally:
        conn.close()


def create_order(
    user_id: str,
    raw_items: List[Dict[str, Any]],
    address: Dict[str, str],
    payment_method: str,
    payment_summary: str,
    promo_code: str = "",
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    conn = get_connection()
    try:
        order_items: List[Dict[str, Any]] = []
        subtotal = 0
        max_delivery_days = 3

        for entry in raw_items:
            product_id = str(entry.get("productId", "")).strip()[:60]
            variant = str(entry.get("variant", "")).strip()[:60]
            try:
                quantity = int(entry.get("quantity", 0))
            except (TypeError, ValueError):
                return None, "Invalid item quantity."

            if quantity < 1 or quantity > 10:
                return None, "Invalid item quantity."

            prod_row = conn.execute(
                "SELECT * FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()

            if not prod_row or not bool(prod_row["in_stock"]):
                name = prod_row["name"] if prod_row else product_id
                return None, f'Item "{name}" is currently unavailable.'

            variants = json.loads(prod_row["variants_json"])
            chosen_variant = variant if variant in variants else variants[0]

            unit_price = int(prod_row["price"])
            subtotal += unit_price * quantity
            max_delivery_days = max(max_delivery_days, int(prod_row["delivery_days"]))

            order_items.append(
                {
                    "productId": prod_row["id"],
                    "name": prod_row["name"],
                    "brand": prod_row["brand"],
                    "image": prod_row["image"],
                    "variant": chosen_variant,
                    "quantity": quantity,
                    "unitPrice": unit_price,
                }
            )

        discount = 0
        applied_promo: Optional[str] = None
        promo_key = promo_code.strip().upper()
        if promo_key and promo_key in PROMO_CODES:
            rule = PROMO_CODES[promo_key]
            discount = min(round((subtotal * rule["discountPercent"]) / 100), rule["maxDiscount"])
            applied_promo = promo_key

        shipping_fee = 0 if subtotal >= 999 else 79
        total = max(0, subtotal - discount + shipping_fee)
        created_at = utc_now_iso()
        est_date = (datetime.now(timezone.utc) + timedelta(days=max_delivery_days)).strftime("%d %b %Y")

        order_id = f"ord_{secrets.token_hex(6)}"
        tracking_number = f"NB-{secrets.randbelow(900000) + 100000}"
        payment_status = "Cash on Delivery" if payment_method == "cod" else "Demo Paid"

        city = address["city"]
        milestones = [
            (
                0,
                "Order Confirmed",
                "Order Confirmed",
                "Payment verified and order invoice generated.",
                "NavaBazaar Order Desk",
                created_at,
                1,
            ),
            (
                1,
                "Packed at Hub",
                "Packed at Fulfillment Hub",
                "Items quality-checked, sealed, and assigned airway bill.",
                "Bhiwandi Fulfillment Center, MH",
                None,
                0,
            ),
            (
                2,
                "In Transit",
                "In Transit to Destination City",
                f"Shipment departed regional line-haul towards {city}.",
                f"Regional Air Hub -> {city}",
                None,
                0,
            ),
            (
                3,
                "Out for Delivery",
                "Out for Delivery",
                "Courier partner has picked up your parcel for doorstep delivery.",
                f"{city} Local Dispatch",
                None,
                0,
            ),
            (
                4,
                "Delivered",
                "Delivered",
                "Package delivered and signed at destination address.",
                city,
                None,
                0,
            ),
        ]

        addr_id = str(address.get("id") or f"addr_{secrets.token_hex(4)}")
        clean_addr = {
            "id": addr_id,
            "label": address.get("label", "Home"),
            "fullName": address["fullName"],
            "phone": address["phone"],
            "street": address["street"],
            "city": address["city"],
            "state": address["state"],
            "pinCode": address["pinCode"],
        }

        with conn:
            conn.execute(
                """
                INSERT INTO orders (
                    id, tracking_number, user_id, customer_name, shipping_address_json,
                    subtotal, discount, shipping_fee, total, promo_code,
                    payment_method, payment_summary, payment_status, order_status,
                    courier_name, estimated_delivery, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    tracking_number,
                    user_id,
                    clean_addr["fullName"],
                    json.dumps(clean_addr),
                    subtotal,
                    discount,
                    shipping_fee,
                    total,
                    applied_promo,
                    payment_method,
                    payment_summary,
                    payment_status,
                    "Order Confirmed",
                    "Delhivery Air Express",
                    est_date,
                    created_at,
                    created_at,
                ),
            )

            for item in order_items:
                conn.execute(
                    """
                    INSERT INTO order_items (
                        order_id, product_id, name, brand, image, variant, quantity, unit_price
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        item["productId"],
                        item["name"],
                        item["brand"],
                        item["image"],
                        item["variant"],
                        item["quantity"],
                        item["unitPrice"],
                    ),
                )

            for step_idx, stage, title, desc, loc, ts, done in milestones:
                conn.execute(
                    """
                    INSERT INTO order_milestones (
                        order_id, step_index, stage, title, description, location, timestamp, completed
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (order_id, step_idx, stage, title, desc, loc, ts, done),
                )

            # Save address to user's saved addresses if new
            existing_addr = conn.execute(
                """
                SELECT id FROM addresses
                WHERE user_id = ? AND LOWER(street) = LOWER(?) AND pin_code = ?
                """,
                (user_id, clean_addr["street"], clean_addr["pinCode"]),
            ).fetchone()
            if not existing_addr:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO addresses (
                        id, user_id, label, full_name, phone, street, city, state, pin_code, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        clean_addr["id"],
                        user_id,
                        clean_addr["label"],
                        clean_addr["fullName"],
                        clean_addr["phone"],
                        clean_addr["street"],
                        clean_addr["city"],
                        clean_addr["state"],
                        clean_addr["pinCode"],
                        created_at,
                    ),
                )

        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return (_hydrate_order(conn, row) if row else None), None
    finally:
        conn.close()


def get_tracking_by_number(tracking_number: str, auth_user_id: Optional[str]) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM orders WHERE UPPER(tracking_number) = UPPER(?)",
            (tracking_number,),
        ).fetchone()
        if not row:
            return None

        order = _hydrate_order(conn, row)
        is_owner = bool(auth_user_id and auth_user_id == order["userId"])
        addr = order["shippingAddress"]
        tracking: Dict[str, Any] = {
            "trackingNumber": order["trackingNumber"],
            "orderStatus": order["orderStatus"],
            "courierName": order["courierName"],
            "estimatedDelivery": order["estimatedDelivery"],
            "destinationCity": f"{addr.get('city', '')}, {addr.get('state', '')}",
            "itemCount": sum(i["quantity"] for i in order["items"]),
            "itemNames": [f"{i['name']} ({i['variant']})" for i in order["items"]],
            "timeline": order["timeline"],
            "createdAt": order["createdAt"],
            "isOwner": is_owner,
        }
        if is_owner:
            tracking["order"] = order
        return tracking
    finally:
        conn.close()


def advance_order_stage(order_id: str, user_id: str) -> Tuple[Optional[Dict[str, Any]], int, Optional[str]]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return None, 404, "Order not found."
        if row["user_id"] != user_id:
            return None, 403, "You do not have permission to update this order."

        current_stage = row["order_status"]
        if current_stage not in STAGE_SEQUENCE:
            return _hydrate_order(conn, row), 200, None

        idx = STAGE_SEQUENCE.index(current_stage)
        if idx >= len(STAGE_SEQUENCE) - 1:
            return _hydrate_order(conn, row), 200, None

        next_stage = STAGE_SEQUENCE[idx + 1]
        now_iso = utc_now_iso()

        with conn:
            conn.execute(
                "UPDATE orders SET order_status = ?, updated_at = ? WHERE id = ?",
                (next_stage, now_iso, order_id),
            )
            conn.execute(
                """
                UPDATE order_milestones
                SET completed = 1,
                    timestamp = COALESCE(timestamp, ?)
                WHERE order_id = ? AND step_index <= ?
                """,
                (now_iso, order_id, idx + 1),
            )

        updated_row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return (_hydrate_order(conn, updated_row) if updated_row else None), 200, None
    finally:
        conn.close()
