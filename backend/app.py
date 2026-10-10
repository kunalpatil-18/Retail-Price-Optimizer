from datetime import datetime, timezone
from pathlib import Path
import os, sqlite3, secrets, hashlib, hmac, csv, io, json
from functools import wraps
from flask import g
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
app = Flask(__name__)
# Local Vite may select a different port when 5173 is already occupied (for example 5176).
# Permit browser requests only from localhost/127.0.0.1 origins on local dev ports.
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                r"http://localhost:\d+",
                r"http://127\.0\.0\.1:\d+",
            ]
        }
    },
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
    max_age=600,
)
DB_PATH = BASE_DIR / "data" / "retail_optimizer.sqlite3"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240000).hex()
    return salt, digest


def verify_password(password, salt, expected):
    return hmac.compare_digest(password_hash(password, salt)[1], expected)


def init_db():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','retailer')), salt TEXT NOT NULL,
          password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sku TEXT NOT NULL, name TEXT NOT NULL, brand TEXT DEFAULT '', model TEXT DEFAULT '',
          category TEXT NOT NULL, current_price REAL NOT NULL CHECK(current_price > 0),
          unit_cost REAL NOT NULL CHECK(unit_cost >= 0), inventory REAL NOT NULL CHECK(inventory >= 0),
          min_margin_pct REAL NOT NULL DEFAULT 0, max_discount_pct REAL NOT NULL DEFAULT 30,
          region TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          UNIQUE(retailer_id, sku)
        );
        CREATE TABLE IF NOT EXISTS recommendations (
          id INTEGER PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          objective TEXT NOT NULL, current_price REAL NOT NULL, recommended_price REAL NOT NULL,
          predicted_demand REAL, expected_revenue REAL, expected_profit REAL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          reason TEXT NOT NULL, input_json TEXT NOT NULL, created_at TEXT NOT NULL,
          decided_at TEXT, decided_by INTEGER REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS sales_history (
          id INTEGER PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          sale_date TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity >= 0),
          unit_price REAL NOT NULL CHECK(unit_price > 0), region TEXT DEFAULT '', customer_type TEXT DEFAULT '',
          source_row TEXT DEFAULT '', imported_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS competitor_prices (
          id INTEGER PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          competitor TEXT NOT NULL, price REAL NOT NULL CHECK(price > 0), source_url TEXT NOT NULL,
          observed_at TEXT NOT NULL, match_notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'manual_verified'
        );
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY, retailer_id INTEGER, actor_id INTEGER, action TEXT NOT NULL,
          entity_type TEXT NOT NULL, entity_id TEXT, details_json TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(retailer_id);
        CREATE INDEX IF NOT EXISTS idx_recs_tenant ON recommendations(retailer_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_comp_tenant_product ON competitor_prices(retailer_id, product_id, observed_at);
        CREATE INDEX IF NOT EXISTS idx_sales_tenant_product ON sales_history(retailer_id, product_id, sale_date);
        """)

init_db()


def audit(action, entity_type, entity_id=None, details=None, retailer_id=None):
    actor = getattr(g, "user", None)
    with db() as con:
        con.execute("INSERT INTO audit_log(retailer_id,actor_id,action,entity_type,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
                    (retailer_id if retailer_id is not None else (actor["id"] if actor and actor["role"] == "retailer" else None),
                     actor["id"] if actor else None, action, entity_type, str(entity_id) if entity_id is not None else None,
                     json.dumps(details or {}, ensure_ascii=False), now_iso()))

@app.before_request
def authenticate_api():
    # CORS preflight must not require login.
    if request.method == "OPTIONS":
        return "", 204

    if (
        not request.path.startswith("/api/")
        or request.path in (
            "/api/health",
            "/api/auth/setup",
            "/api/auth/login",
        )
    ):
        return None
    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if not token:
        return jsonify({"error": "Login required."}), 401
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with db() as con:
        row = con.execute("SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND users.active=1", (token_hash,)).fetchone()
    if not row:
        return jsonify({"error": "Session expired or invalid. Please log in again."}), 401
    g.user = row
    return None

@app.post("/api/auth/setup")
def auth_setup():
    payload = request.get_json(force=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    password = str(payload.get("password", ""))
    display_name = str(payload.get("displayName", "Administrator")).strip() or "Administrator"
    if len(username) < 3 or len(password) < 12:
        return jsonify({"error": "Admin username must be at least 3 characters and password at least 12 characters."}), 400
    with db() as con:
        if con.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
            return jsonify({"error": "Initial setup is already complete. Ask an existing admin to manage accounts."}), 409
        salt, digest = password_hash(password)
        con.execute("INSERT INTO users(username,display_name,role,salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
                    (username, display_name, "admin", salt, digest, now_iso()))
    return jsonify({"message": "Admin account created. Sign in to continue."}), 201

@app.post("/api/auth/login")
def auth_login():
    payload = request.get_json(force=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    password = str(payload.get("password", ""))
    with db() as con:
        user = con.execute("SELECT * FROM users WHERE username=? AND active=1", (username,)).fetchone()
        if not user or not verify_password(password, user["salt"], user["password_hash"]):
            return jsonify({"error": "Invalid username or password."}), 401
        token = secrets.token_urlsafe(32)
        con.execute("INSERT INTO sessions(token_hash,user_id,created_at) VALUES(?,?,?)",
                    (hashlib.sha256(token.encode()).hexdigest(), user["id"], now_iso()))
    return jsonify({"token": token, "user": {"id": user["id"], "username": user["username"], "displayName": user["display_name"], "role": user["role"]}})

@app.post("/api/auth/logout")
def auth_logout():
    token = request.headers.get("Authorization", "")[7:].strip()
    with db() as con:
        con.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
    return jsonify({"message": "Logged out."})

@app.get("/api/me")
def auth_me():
    u = g.user
    return jsonify({"id": u["id"], "username": u["username"], "displayName": u["display_name"], "role": u["role"]})

@app.get("/api/admin/retailers")
def list_retailers():
    if g.user["role"] != "admin": return jsonify({"error": "Admin access required."}), 403
    with db() as con:
        rows = con.execute("SELECT u.id,u.username,u.display_name,u.active,u.created_at,COUNT(p.id) AS product_count FROM users u LEFT JOIN products p ON p.retailer_id=u.id WHERE u.role='retailer' GROUP BY u.id ORDER BY u.created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/admin/retailers")
def create_retailer():
    if g.user["role"] != "admin": return jsonify({"error": "Admin access required."}), 403
    payload = request.get_json(force=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    password = str(payload.get("password", ""))
    display_name = str(payload.get("displayName", "")).strip()
    if len(username) < 3 or len(password) < 12 or not display_name:
        return jsonify({"error": "Display name and username (3+ chars) are required; password must be at least 12 characters."}), 400
    salt, digest = password_hash(password)
    try:
        with db() as con:
            cur = con.execute("INSERT INTO users(username,display_name,role,salt,password_hash,created_at) VALUES(?,?,?,?,?,?)",
                              (username, display_name, "retailer", salt, digest, now_iso()))
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "That username already exists."}), 409
    audit("create", "retailer", user_id, {"username": username})
    return jsonify({"id": user_id, "username": username, "displayName": display_name}), 201

@app.patch("/api/admin/retailers/<int:retailer_id>")
def set_retailer_status(retailer_id):
    if g.user["role"] != "admin": return jsonify({"error": "Admin access required."}), 403
    payload = request.get_json(force=True) or {}
    if not isinstance(payload.get("active"), bool): return jsonify({"error": "active must be true or false."}), 400
    with db() as con:
        row = con.execute("SELECT id FROM users WHERE id=? AND role='retailer'", (retailer_id,)).fetchone()
        if not row: return jsonify({"error": "Retailer account not found."}), 404
        con.execute("UPDATE users SET active=? WHERE id=?", (1 if payload["active"] else 0, retailer_id))
        if not payload["active"]: con.execute("DELETE FROM sessions WHERE user_id=?", (retailer_id,))
    audit("activate" if payload["active"] else "deactivate", "retailer", retailer_id)
    return jsonify({"active": payload["active"]})

@app.get("/api/products")
def tenant_products():
    with db() as con:
        rows = con.execute("SELECT * FROM products WHERE retailer_id=? ORDER BY name", (g.user["id"],)).fetchall() if g.user["role"] == "retailer" else []
    return jsonify([product_json(r) for r in rows])

def product_json(r):
    return {"id": r["id"], "sku": r["sku"], "name": r["name"], "brand": r["brand"], "model": r["model"],
            "category": r["category"], "currentPrice": r["current_price"], "unitCost": r["unit_cost"],
            "inventory": r["inventory"], "minMarginPct": r["min_margin_pct"], "maxDiscountPct": r["max_discount_pct"], "region": r["region"]}

@app.post("/api/products")
def create_product():
    if g.user["role"] != "retailer": return jsonify({"error": "Only retailer accounts can add products."}), 403
    p = request.get_json(force=True) or {}
    try:
        sku, name, category = (str(p.get(k, "")).strip() for k in ("sku", "name", "category"))
        price, cost, stock = float(p.get("currentPrice")), float(p.get("unitCost")), float(p.get("inventory"))
        margin = float(p.get("minMarginPct", 0)); max_discount = float(p.get("maxDiscountPct", 30))
        if not sku or not name or not category or price <= 0 or cost < 0 or stock < 0 or not 0 <= margin <= 100 or not 0 <= max_discount <= 100:
            raise ValueError("Check required fields, prices, inventory and percentage limits.")
    except (TypeError, ValueError) as exc:
        return jsonify({"error": str(exc) or "Invalid product fields."}), 400
    try:
        with db() as con:
            cur = con.execute("INSERT INTO products(retailer_id,sku,name,brand,model,category,current_price,unit_cost,inventory,min_margin_pct,max_discount_pct,region,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (g.user["id"], sku, name, str(p.get("brand", "")).strip(), str(p.get("model", "")).strip(), category, price, cost, stock, margin, max_discount, str(p.get("region", "")).strip(), now_iso(), now_iso()))
            product_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "SKU already exists in your account."}), 409
    audit("create", "product", product_id, {"sku": sku}, g.user["id"])
    return jsonify({"id": product_id, "message": "Product added."}), 201

@app.patch("/api/products/<int:product_id>")
def update_product(product_id):
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    p = request.get_json(force=True) or {}
    allowed = {"name", "brand", "model", "category", "currentPrice", "unitCost", "inventory", "minMarginPct", "maxDiscountPct", "region"}
    with db() as con:
        row = con.execute("SELECT * FROM products WHERE id=? AND retailer_id=?", (product_id, g.user["id"])).fetchone()
        if not row: return jsonify({"error": "Product not found."}), 404
        values = {"name": row["name"], "brand": row["brand"], "model": row["model"], "category": row["category"], "currentPrice": row["current_price"], "unitCost": row["unit_cost"], "inventory": row["inventory"], "minMarginPct": row["min_margin_pct"], "maxDiscountPct": row["max_discount_pct"], "region": row["region"]}
        values.update({k: v for k, v in p.items() if k in allowed})
        try:
            price, cost, stock = float(values["currentPrice"]), float(values["unitCost"]), float(values["inventory"])
            margin, disc = float(values["minMarginPct"]), float(values["maxDiscountPct"])
            if not values["name"] or not values["category"] or price <= 0 or cost < 0 or stock < 0 or not 0 <= margin <= 100 or not 0 <= disc <= 100: raise ValueError()
        except (ValueError, TypeError): return jsonify({"error": "Invalid product values or business limits."}), 400
        con.execute("UPDATE products SET name=?,brand=?,model=?,category=?,current_price=?,unit_cost=?,inventory=?,min_margin_pct=?,max_discount_pct=?,region=?,updated_at=? WHERE id=? AND retailer_id=?",
          (values["name"], values["brand"], values["model"], values["category"], price, cost, stock, margin, disc, values["region"], now_iso(), product_id, g.user["id"]))
    audit("update", "product", product_id, {"fields": sorted(k for k in p if k in allowed)}, g.user["id"])
    return jsonify({"message": "Product updated."})

@app.post("/api/products/import")
def import_products_csv():
    if g.user["role"] != "retailer": return jsonify({"error": "Only retailer accounts can import products."}), 403
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename.lower().endswith(".csv"):
        return jsonify({"error": "Upload a CSV file. Excel files are not supported by this endpoint yet; save them as CSV first."}), 400
    try:
        text = uploaded.stream.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"sku", "name", "category", "currentPrice", "unitCost", "inventory"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            return jsonify({"error": "CSV columns required: sku,name,category,currentPrice,unitCost,inventory. Optional: brand,model,minMarginPct,maxDiscountPct,region."}), 400
        accepted, errors = 0, []
        with db() as con:
            for line, row in enumerate(reader, start=2):
                try:
                    price, cost, stock = float(row["currentPrice"]), float(row["unitCost"]), float(row["inventory"])
                    margin = float(row.get("minMarginPct") or 0); disc = float(row.get("maxDiscountPct") or 30)
                    if not row["sku"].strip() or not row["name"].strip() or not row["category"].strip() or price <= 0 or cost < 0 or stock < 0 or not 0 <= margin <= 100 or not 0 <= disc <= 100:
                        raise ValueError("missing required value or invalid numeric limit")
                    con.execute("INSERT INTO products(retailer_id,sku,name,brand,model,category,current_price,unit_cost,inventory,min_margin_pct,max_discount_pct,region,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (g.user["id"], row["sku"].strip(), row["name"].strip(), row.get("brand", "").strip(), row.get("model", "").strip(), row["category"].strip(), price, cost, stock, margin, disc, row.get("region", "").strip(), now_iso(), now_iso()))
                    accepted += 1
                except (ValueError, sqlite3.IntegrityError) as exc:
                    errors.append({"line": line, "sku": row.get("sku", ""), "error": str(exc)})
        audit("import", "products", None, {"accepted": accepted, "errors": len(errors)}, g.user["id"])
        return jsonify({"accepted": accepted, "errorCount": len(errors), "errors": errors[:100]}), 200
    except UnicodeDecodeError:
        return jsonify({"error": "CSV must be UTF-8 encoded."}), 400

@app.post("/api/sales/import")
def import_sales_csv():
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename.lower().endswith(".csv"):
        return jsonify({"error": "Upload a CSV file."}), 400
    try:
        reader = csv.DictReader(io.StringIO(uploaded.stream.read().decode("utf-8-sig")))
        required = {"sku", "date", "quantity", "unitPrice"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            return jsonify({"error": "Required CSV columns: sku,date,quantity,unitPrice. Optional: region,customerType."}), 400
        accepted, errors = 0, []
        with db() as con:
            sku_map = {r["sku"]: r["id"] for r in con.execute("SELECT id,sku FROM products WHERE retailer_id=?", (g.user["id"],)).fetchall()}
            for line, row in enumerate(reader, start=2):
                try:
                    sku = row["sku"].strip()
                    if sku not in sku_map: raise ValueError("SKU not found in this retailer's catalog")
                    qty, price = float(row["quantity"]), float(row["unitPrice"])
                    sale_date = row["date"].strip(); datetime.fromisoformat(sale_date[:10])
                    if qty < 0 or price <= 0: raise ValueError("quantity must be >= 0 and unitPrice > 0")
                    con.execute("INSERT INTO sales_history(retailer_id,product_id,sale_date,quantity,unit_price,region,customer_type,source_row,imported_at) VALUES(?,?,?,?,?,?,?,?,?)",
                      (g.user["id"], sku_map[sku], sale_date[:10], qty, price, row.get("region", "").strip(), row.get("customerType", "").strip(), str(line), now_iso()))
                    accepted += 1
                except (ValueError, KeyError, TypeError) as exc:
                    errors.append({"line": line, "sku": row.get("sku", ""), "error": str(exc)})
        audit("import", "sales_history", None, {"accepted": accepted, "errors": len(errors)}, g.user["id"])
        return jsonify({"accepted": accepted, "errorCount": len(errors), "errors": errors[:100]}), 200
    except UnicodeDecodeError:
        return jsonify({"error": "CSV must be UTF-8 encoded."}), 400

@app.get("/api/sales/summary")
def sales_summary():
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    with db() as con:
        row = con.execute("SELECT COUNT(*) AS records, COALESCE(SUM(quantity),0) AS units, COALESCE(SUM(quantity*unit_price),0) AS revenue FROM sales_history WHERE retailer_id=?", (g.user["id"],)).fetchone()
    return jsonify(dict(row))

@app.get("/api/analytics")
def tenant_analytics():
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    with db() as con:
        totals = con.execute("""SELECT COUNT(*) records, COALESCE(SUM(s.quantity),0) units,
          COALESCE(SUM(s.quantity*s.unit_price),0) revenue,
          COALESCE(SUM(s.quantity*(s.unit_price-p.unit_cost)),0) gross_profit
          FROM sales_history s JOIN products p ON p.id=s.product_id WHERE s.retailer_id=?""", (g.user["id"],)).fetchone()
        monthly = con.execute("""SELECT substr(sale_date,1,7) AS period, SUM(quantity) units,
          SUM(quantity*unit_price) revenue, SUM(quantity*(unit_price-p.unit_cost)) grossProfit
          FROM sales_history s JOIN products p ON p.id=s.product_id WHERE s.retailer_id=?
          GROUP BY substr(sale_date,1,7) ORDER BY period""", (g.user["id"],)).fetchall()
        categories = con.execute("""SELECT p.category name, SUM(s.quantity) units, SUM(s.quantity*s.unit_price) revenue
          FROM sales_history s JOIN products p ON p.id=s.product_id WHERE s.retailer_id=?
          GROUP BY p.category ORDER BY revenue DESC""", (g.user["id"],)).fetchall()
        top_products = con.execute("""SELECT p.sku,p.name,p.category,SUM(s.quantity) units,
          SUM(s.quantity*s.unit_price) revenue, AVG(s.unit_price) averagePrice
          FROM sales_history s JOIN products p ON p.id=s.product_id WHERE s.retailer_id=?
          GROUP BY p.id ORDER BY revenue DESC LIMIT 20""", (g.user["id"],)).fetchall()
    return jsonify({"totals":dict(totals),"monthly":[dict(r) for r in monthly],"categories":[dict(r) for r in categories],"topProducts":[dict(r) for r in top_products],"hasSalesData":totals["records"]>0})

@app.get("/api/inventory")
def tenant_inventory():
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    with db() as con:
        rows=con.execute("""SELECT p.*,COALESCE(SUM(s.quantity),0) sold_units,
          COALESCE(SUM(s.quantity*s.unit_price),0) sales_revenue
          FROM products p LEFT JOIN sales_history s ON s.product_id=p.id AND s.retailer_id=p.retailer_id
          WHERE p.retailer_id=? GROUP BY p.id ORDER BY p.name""",(g.user["id"],)).fetchall()
    return jsonify([dict(product_json(r),soldUnits=r["sold_units"],salesRevenue=r["sales_revenue"],stockStatus=("out" if r["inventory"]<=0 else "low" if r["inventory"]<=5 else "healthy")) for r in rows])

@app.get("/api/recommendations")
def list_recommendations():
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    with db() as con:
        rows = con.execute("SELECT r.*,p.sku,p.name AS product_name FROM recommendations r JOIN products p ON p.id=r.product_id WHERE r.retailer_id=? ORDER BY r.created_at DESC LIMIT 500", (g.user["id"],)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/recommendations/<int:recommendation_id>/decision")
def decide_recommendation(recommendation_id):
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    payload = request.get_json(force=True) or {}
    decision = payload.get("decision")
    if decision not in ("approved", "rejected"):
        return jsonify({"error": "Decision must be approved or rejected."}), 400
    with db() as con:
        row = con.execute("SELECT * FROM recommendations WHERE id=? AND retailer_id=?", (recommendation_id, g.user["id"])).fetchone()
        if not row: return jsonify({"error": "Recommendation not found."}), 404
        if row["status"] != "pending": return jsonify({"error": "This recommendation has already been decided."}), 409
        con.execute("UPDATE recommendations SET status=?,decided_at=?,decided_by=? WHERE id=?", (decision, now_iso(), g.user["id"], recommendation_id))
        if decision == "approved":
            con.execute("UPDATE products SET current_price=?,updated_at=? WHERE id=? AND retailer_id=?", (row["recommended_price"], now_iso(), row["product_id"], g.user["id"]))
    audit(decision, "recommendation", recommendation_id, {"price": row["recommended_price"]}, g.user["id"])
    return jsonify({"status": decision, "message": "Approval recorded. The local product record was updated; no external storefront price was changed." if decision == "approved" else "Recommendation rejected."})

@app.post("/api/products/<int:product_id>/competitor-prices")
def add_competitor_price(product_id):
    if g.user["role"] != "retailer": return jsonify({"error": "Retailer access required."}), 403
    p = request.get_json(force=True) or {}
    try:
        price = float(p.get("price")); competitor = str(p.get("competitor", "")).strip(); url = str(p.get("sourceUrl", "")).strip()
        if price <= 0 or not competitor or not url.startswith(("https://", "http://")): raise ValueError()
    except (TypeError, ValueError): return jsonify({"error": "Competitor, positive price and valid source URL are required."}), 400
    with db() as con:
        product = con.execute("SELECT id FROM products WHERE id=? AND retailer_id=?", (product_id, g.user["id"])).fetchone()
        if not product: return jsonify({"error": "Product not found."}), 404
        con.execute("INSERT INTO competitor_prices(retailer_id,product_id,competitor,price,source_url,observed_at,match_notes,status) VALUES(?,?,?,?,?,?,?,?)", (g.user["id"], product_id, competitor, price, url, p.get("observedAt") or now_iso(), str(p.get("matchNotes", "")), "manual_verified"))
    audit("add", "competitor_price", product_id, {"competitor": competitor, "price": price}, g.user["id"])
    return jsonify({"message": "Competitor price saved with source and timestamp."}), 201

@app.get("/api/audit-log")
def get_audit_log():
    if g.user["role"] != "admin": return jsonify({"error": "Admin access required."}), 403
    with db() as con:
        rows = con.execute("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 1000").fetchall()
    return jsonify([dict(r) for r in rows])

# No bundled sample catalog or sales data is used for retailer-facing decisions.
# Every retailer must import/create their own catalog and sales history.
PRODUCTS = []
PRODUCT_BY_NAME = {}
CATEGORIES = []
SALES = pd.DataFrame()
BASE_DEMAND = {}
# Transparent fallback assumptions only; these are not presented as trained elasticity.
ELASTICITY = {"Electronics": 1.6, "Accessories": 1.35, "Furniture": 1.25, "Office Supplies": 1.15}


def number(payload, key, default):
    value = payload.get(key, default)
    if value in (None, ""):
        return float(default)
    value = float(value)
    if not np.isfinite(value):
        raise ValueError(f"{key} must be a finite number")
    return value


def get_product(payload):
    name = payload.get("product") or payload.get("Product")
    requested_category = payload.get("category") or payload.get("Category")
    user = getattr(g, "user", None)
    if user and user["role"] == "retailer":
        product_id = payload.get("productId")
        with db() as con:
            if product_id:
                row = con.execute("SELECT * FROM products WHERE id=? AND retailer_id=?", (int(product_id), user["id"])).fetchone()
            else:
                row = con.execute("SELECT * FROM products WHERE name=? AND retailer_id=?", (name, user["id"])).fetchone()
        if not row:
            raise ValueError("Select a product from your own product catalog first.")
        product = {"id": row["id"], "sku": row["sku"], "name": row["name"], "brand": row["brand"], "model": row["model"], "category": row["category"], "currentPrice": row["current_price"], "basePrice": row["current_price"], "unitCost": row["unit_cost"], "inventory": row["inventory"], "minMarginPct": row["min_margin_pct"], "maxDiscountPct": row["max_discount_pct"]}
    else:
        product = None
    if not product:
        raise ValueError("Select a product from your own retailer catalog. Add a product before running this analysis.")
    if requested_category and requested_category != product["category"]:
        raise ValueError("Selected category does not match the product catalog.")
    return product


def normalize_discount(value):
    rate = float(value)
    if rate > 1:
        rate /= 100.0
    if rate < 0 or rate >= 1:
        raise ValueError("Discount must be from 0% up to (but not including) 100%.")
    return rate


def estimate_demand(product, price, payload, current_price):
    # Historical quantity is transaction-level; no daily forecast is implied.
    baseline = 0.0
    user = getattr(g, "user", None)
    segment = pd.DataFrame()
    if user and user["role"] == "retailer" and product.get("id"):
        with db() as con:
            tenant_rows = con.execute("SELECT quantity AS Quantity, region AS Region, customer_type AS CustomerType FROM sales_history WHERE retailer_id=? AND product_id=?", (user["id"], int(product["id"]))).fetchall()
        if tenant_rows:
            segment = pd.DataFrame([dict(r) for r in tenant_rows])
            baseline = max(0.0, float(segment["Quantity"].mean()))
    region = str(payload.get("region", "")).strip()
    customer_type = str(payload.get("customerType", "")).strip()
    if not segment.empty:
        if region and "Region" in segment:
            regional = segment[segment["Region"].astype(str).str.casefold().eq(region.casefold())]
            if len(regional) >= 5:
                baseline = float(regional["Quantity"].mean())
                segment = regional
        if customer_type and "CustomerType" in segment:
            typed = segment[segment["CustomerType"].astype(str).str.casefold().eq(customer_type.casefold())]
            if len(typed) >= 5:
                baseline = float(typed["Quantity"].mean())

    discount = normalize_discount(number(payload, "discount", 0))
    effective_price = max(price * (1.0 - discount), 0.01)
    current_effective_price = max(current_price * (1.0 - discount), 0.01)

    # Never use the bundled model or another retailer's/sample data as a retailer baseline.
    # Without this product's own sales history, return no fabricated demand forecast.
    if baseline <= 0:
        return 0.0

    elasticity = number(payload, "priceElasticity", ELASTICITY[product["category"]])
    if elasticity <= 0 or elasticity > 5:
        raise ValueError("priceElasticity must be greater than 0 and at most 5.")
    demand = baseline * (effective_price / current_effective_price) ** (-elasticity)

    competitor = number(payload, "competitorPrice", 0)
    if competitor > 0:
        # Transparent competitive-position scenario, not a learned competitor effect.
        sensitivity = number(payload, "competitorSensitivity", 0.35)
        if sensitivity < 0 or sensitivity > 2:
            raise ValueError("competitorSensitivity must be between 0 and 2.")
        ratio = price / competitor
        demand *= float(np.clip(np.exp(-sensitivity * (ratio - 1.0)), 0.5, 1.8))

    promotion = str(payload.get("promotion", "None")).strip().lower()
    if promotion not in ("", "none", "no promotion"):
        demand *= 1.05
    return max(0.0, float(demand))


@app.get("/api/health")
def health():
    with db() as con:
        retailer_count = con.execute("SELECT COUNT(*) FROM users WHERE role='retailer' AND active=1").fetchone()[0]
    return jsonify({"status": "ok", "dataPolicy": "tenant-owned records only; no sample sales/catalog used for retailer analytics", "activeRetailers": retailer_count})


@app.get("/api/catalog")
def catalog():
    if g.user["role"] == "retailer":
        with db() as con:
            rows = con.execute("SELECT * FROM products WHERE retailer_id=? ORDER BY name", (g.user["id"],)).fetchall()
        products = [{"id": str(r["id"]), "sku": r["sku"], "name": r["name"], "category": r["category"], "currentPrice": r["current_price"], "basePrice": r["current_price"], "unitCost": r["unit_cost"], "inventory": r["inventory"], "brand": r["brand"], "model": r["model"]} for r in rows]
    else:
        products = []
    categories = sorted({p["category"] for p in products})
    return jsonify({"categories": categories, "productsByCategory": {c: [p for p in products if p["category"] == c] for c in categories}})


@app.post("/api/optimize-price")
def optimize_price():
    try:
        payload = request.get_json(force=True) or {}
        product = get_product(payload)
        if g.user["role"] != "retailer": raise ValueError("Only retailer accounts can run optimization.")
        with db() as con:
            history_count = con.execute("SELECT COUNT(*) FROM sales_history WHERE retailer_id=? AND product_id=?", (g.user["id"], int(product["id"]))).fetchone()[0]
        if history_count < 5: raise ValueError("At least 5 sales records for this product are required before optimization. Import your own sales history first.")
        # Prices/cost/stock used for guardrails come from the authenticated tenant DB.
        current = float(product["currentPrice"])
        cost = float(product["unitCost"])
        stock = max(0.0, float(product["inventory"]))
        competitor = number(payload, "competitorPrice", 0)
        discount_rate = normalize_discount(number(payload, "discount", 0))
        if discount_rate * 100 > float(product.get("maxDiscountPct", 30)):
            raise ValueError("Requested discount exceeds this product's configured maximum discount.")
        minimum_allowed_price = cost / max(1e-9, 1.0 - float(product.get("minMarginPct", 0)) / 100.0)
        if current * (1.0 - discount_rate) < minimum_allowed_price:
            raise ValueError("Current effective price violates the product's minimum margin. Update product cost/price or reduce the discount first.")
        objective = str(payload.get("objective", "Demand")).strip().lower()
        if objective not in {"demand", "revenue", "profit"}:
            raise ValueError("Objective must be Demand, Revenue, or Profit.")
        if current <= 0 or cost < 0 or competitor < 0:
            raise ValueError("Current price must be > 0; cost and competitor price cannot be negative.")
        if stock <= 0:
            return jsonify({"error": "Inventory is zero. Replenish stock before optimizing price."}), 400

        # Bound price search to a sensible band around current/competitor prices.
        min_price = max(0.01, current * 0.70)
        max_price = current * 1.20
        if competitor > 0:
            min_price = min(min_price, competitor * 0.90)
            max_price = max(max_price, competitor * 1.05)
        # Do not evaluate candidates that fall below cost after discount.
        min_margin_pct = float(product.get("minMarginPct", 0) or 0)
        max_discount_pct = float(product.get("maxDiscountPct", 100) or 100)
        if discount_rate * 100 > max_discount_pct + 1e-9:
            raise ValueError(f"Discount exceeds this product's configured maximum of {max_discount_pct:.2f}%.")
        # Current product price is the list price; discount is applied once to get the effective price.
        minimum_effective_price = cost / max(1e-9, 1.0 - min_margin_pct / 100.0)
        minimum_list_price = minimum_effective_price / (1.0 - discount_rate)
        min_price = max(min_price, minimum_list_price)
        if max_price <= min_price:
            max_price = min_price * 1.05
        candidate_prices = np.unique(np.append(np.linspace(min_price, max_price, 61), current))
        results = []
        for price in candidate_prices:
            demand = estimate_demand(product, price, payload, current)
            fulfilled = min(demand, stock)
            effective_price = float(price) * (1.0 - discount_rate)
            results.append({
                "price": round(float(price), 2),
                "effectivePrice": round(effective_price, 2),
                "predictedDemand": round(demand, 2),
                "fulfilledUnits": round(fulfilled, 2),
                "expectedRevenue": round(effective_price * fulfilled, 2),
                "expectedProfit": round((effective_price - cost) * fulfilled, 2),
                "demandSource": ("tenant_sales_history_plus_explicit_price_response_and_competitor_scenario")
            })

        # Selling-through is the default priority. Inventory caps fulfilled sales.
        # For Demand objective, prefer lower feasible price when fulfilled demand ties.
        if objective == "demand":
            best = max(results, key=lambda r: (r["fulfilledUnits"], -r["price"]))
        else:
            metric = "expectedRevenue" if objective == "revenue" else "expectedProfit"
            best = max(results, key=lambda r: (r[metric], r["fulfilledUnits"], -r["price"]))

        current_demand = estimate_demand(product, current, payload, current)
        current_effective = current * (1.0 - discount_rate)
        current_fulfilled = min(current_demand, stock)
        if objective == "demand":
            selection_reason = "Maximizes expected fulfilled units; ties favor the lower price."
        elif objective == "revenue":
            selection_reason = "Maximizes expected revenue (effective selling price × fulfilled units)."
        else:
            selection_reason = "Maximizes expected profit ((effective selling price − unit cost) × fulfilled units)."
        diagnostics = {
            "selectionReason": selection_reason,
            "candidateCount": len(results), "minCandidatePrice": round(float(min_price), 2),
            "maxCandidatePrice": round(float(max_price), 2), "competitorPrice": competitor or None,
            "competitorPosition": ("below competitor" if competitor and best["price"] < competitor
                else "above competitor" if competitor and best["price"] > competitor
                else "at competitor" if competitor else "not supplied"),
            "elasticityAssumption": number(payload, "priceElasticity", ELASTICITY[product["category"]]),
            "demandSource": ("tenant sales-history baseline + explicit price-response scenario; competitor effect is heuristic"),
            "historicalBaselineQuantity": round(float(estimate_demand(product, current, payload, current)), 2),
            "demandHorizonWarning": "Historical quantity is transaction-level; this is a comparative scenario, not a daily forecast.",
            "currentPriceBelowCost": current_effective < cost,
            "inventoryConstraintApplied": True
        }
        recommendation_id = None
        if g.user["role"] == "retailer":
            with db() as con:
                tenant_product = con.execute("SELECT id FROM products WHERE retailer_id=? AND name=?", (g.user["id"], product["name"])).fetchone()
                if tenant_product:
                    cur = con.execute("INSERT INTO recommendations(retailer_id,product_id,objective,current_price,recommended_price,predicted_demand,expected_revenue,expected_profit,status,reason,input_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                        (g.user["id"], tenant_product["id"], objective.title(), current, best["price"], best["predictedDemand"], best["expectedRevenue"], best["expectedProfit"], "pending", selection_reason, json.dumps(payload), now_iso()))
                    recommendation_id = cur.lastrowid
            audit("recommend", "recommendation", recommendation_id, {"product": product["name"], "price": best["price"], "objective": objective.title()}, g.user["id"])
        return jsonify({
            "recommendationId": recommendation_id,
            "approvalRequired": g.user["role"] == "retailer",
            "category": product["category"], "product": product["name"],
            "model": ("tenant sales-history baseline + explicit price-response scenario; competitor effect is heuristic"),
            "objective": objective.title(), "currentPrice": round(current, 2),
            "currentPricePrediction": {"price": round(current, 2), "predictedDemand": round(current_demand, 2),
                "fulfilledUnits": round(current_fulfilled, 2), "expectedRevenue": round(current_effective * current_fulfilled, 2),
                "expectedProfit": round((current_effective - cost) * current_fulfilled, 2)},
            "recommendedPrice": best["price"], "predictedDemand": best["predictedDemand"],
            "expectedRevenue": best["expectedRevenue"], "expectedProfit": best["expectedProfit"],
            "candidates": results, "optimizationDiagnostics": diagnostics
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.post("/api/what-if")
def what_if():
    try:
        payload = request.get_json(force=True) or {}
        product = get_product(payload)
        if g.user["role"] != "retailer": raise ValueError("Only retailer accounts can run this analysis.")
        with db() as con:
            history_count = con.execute("SELECT COUNT(*) FROM sales_history WHERE retailer_id=? AND product_id=?", (g.user["id"], int(product["id"]))).fetchone()[0]
        if history_count < 5: raise ValueError("At least 5 sales records for this product are required before running a demand-based simulation. Import your own sales history first.")
        current = float(product["currentPrice"])
        scenario = number(payload, "scenarioPrice", current)
        if scenario <= 0: raise ValueError("Scenario price must be greater than zero.")
        discount = normalize_discount(number(payload, "discount", 0))
        if discount * 100 > float(product.get("maxDiscountPct", 30)):
            raise ValueError("Requested discount exceeds this product's configured maximum discount.")
        cost = float(product["unitCost"])
        min_price = cost / max(1e-9, 1.0 - float(product.get("minMarginPct", 0)) / 100.0)
        if scenario * (1.0 - discount) < min_price:
            raise ValueError("What-if effective price violates the product's minimum margin.")
        stock = max(0.0, float(product["inventory"]))
        cur_demand = estimate_demand(product, current, payload, current)
        new_demand = estimate_demand(product, scenario, payload, current)
        def row(price, demand):
            units = min(demand, stock)
            effective = price * (1-discount)
            return {"price": round(price, 2), "effectivePrice": round(effective, 2),
                    "predictedDemand": round(demand, 2), "fulfilledUnits": round(units, 2),
                    "expectedRevenue": round(effective*units, 2), "expectedProfit": round((effective-cost)*units, 2)}
        a, b = row(current, cur_demand), row(scenario, new_demand)
        return jsonify({"category": product["category"], "product": product["name"], "current": a, "scenario": b,
            "demandChange": round(b["predictedDemand"]-a["predictedDemand"], 2),
            "revenueChange": round(b["expectedRevenue"]-a["expectedRevenue"], 2),
            "profitChange": round(b["expectedProfit"]-a["expectedProfit"], 2)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
