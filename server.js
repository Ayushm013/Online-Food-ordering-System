import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { Server } from "socket.io";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const SQL = await initSqlJs({ locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file) });
const databasePath = path.join(__dirname, "restaurant.db");
const database = fs.existsSync(databasePath) ? new SQL.Database(fs.readFileSync(databasePath)) : new SQL.Database();
const persist = () => fs.writeFileSync(databasePath, Buffer.from(database.export()));
const db = {
  pragma: () => {},
  exec: (sql) => { database.run(sql); persist(); },
  transaction: (callback) => (...args) => {
    const result = callback(...args);
    persist();
    return result;
  },
  prepare: (sql) => ({
    get: (...params) => {
      const statement = database.prepare(sql);
      statement.bind(params);
      const result = statement.step() ? statement.getAsObject() : undefined;
      statement.free();
      return result;
    },
    all: (...params) => {
      const statement = database.prepare(sql);
      statement.bind(params);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      statement.free();
      return rows;
    },
    run: (...params) => {
      const statement = database.prepare(sql);
      statement.bind(params);
      statement.step();
      statement.free();
      const lastInsertRowid = database.exec("SELECT last_insert_rowid() AS id")[0]?.values[0]?.[0];
      persist();
      return { changes: database.getRowsModified(), lastInsertRowid };
    }
  })
};
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@ayushkitchen.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(ADMIN_PASSWORD, 10);

db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL, image TEXT NOT NULL, dietary TEXT NOT NULL CHECK(dietary IN ('veg','nonveg')), popular INTEGER DEFAULT 0, available INTEGER DEFAULT 1, FOREIGN KEY(category_id) REFERENCES categories(id));
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, phone TEXT NOT NULL, table_number TEXT NOT NULL, instructions TEXT DEFAULT '', total INTEGER NOT NULL, payment_method TEXT NOT NULL CHECK(payment_method IN ('upi','cash')), payment_status TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, menu_item_id INTEGER NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL, item_instructions TEXT DEFAULT '', FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
`);

const seed = db.transaction(() => {
  if (db.prepare("SELECT COUNT(*) count FROM categories").get().count) return;
  const addCategory = db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)");
  const categories = ["Starters", "Main Course", "Biryani", "Chinese", "Snacks", "Beverages", "Desserts"];
  const ids = Object.fromEntries(categories.map((name, index) => [name, addCategory.run(name, index).lastInsertRowid]));
  const addItem = db.prepare("INSERT INTO menu_items (category_id,name,description,price,image,dietary,popular) VALUES (?,?,?,?,?,?,?)");
  [
    ["Paneer Tikka", "Char-grilled paneer, peppers and house spices", 180, "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=700&q=80", "veg", 1, "Starters"],
    ["Chicken Biryani", "Fragrant basmati rice layered with tender chicken", 260, "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?auto=format&fit=crop&w=700&q=80", "nonveg", 1, "Biryani"],
    ["Veg Biryani", "Aromatic rice with seasonal vegetables and saffron", 180, "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=700&q=80", "veg", 1, "Biryani"],
    ["Hakka Noodles", "Wok-tossed noodles, crisp vegetables and soy", 170, "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=700&q=80", "veg", 0, "Chinese"],
    ["Masala Dosa", "Crisp dosa with potato masala and chutneys", 140, "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=700&q=80", "veg", 1, "Main Course"],
    ["Chicken Tikka", "Smoky tandoor chicken in a creamy marinade", 240, "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=700&q=80", "nonveg", 0, "Starters"],
    ["Samosa", "Crisp pastry filled with spiced potato and peas", 80, "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80", "veg", 0, "Snacks"],
    ["Mango Lassi", "Chilled Alphonso mango yogurt drink", 110, "https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=700&q=80", "veg", 0, "Beverages"],
    ["Gulab Jamun", "Warm milk dumplings in cardamom syrup", 100, "https://images.unsplash.com/photo-1666190094764-4d7c6f5c7e7a?auto=format&fit=crop&w=700&q=80", "veg", 0, "Desserts"]
  ].forEach(([name, description, price, image, dietary, popular, category]) => addItem.run(ids[category], name, description, price, image, dietary, popular));
});
seed();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Admin authentication required" });
  }
}
function orderCode() {
  return `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 9)}`;
}
function publicOrder(orderId) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return null;
  return { ...order, items: db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId) };
}
function broadcast(orderId) {
  const order = publicOrder(orderId);
  io.emit("order:updated", order);
}

app.get("/api/restaurant", (_req, res) => res.json({
  name: "Ayush Kitchen", tagline: "Indian comfort food, made with heart", rating: 4.8, reviews: 1240,
  address: "24 MG Road, Bengaluru, Karnataka", phone: "+91 98765 43210", upiId: "ayushkitchen@upi",
  hours: "11:00 AM – 11:00 PM", open: true,
  cover: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=85"
}));
app.get("/api/menu", (_req, res) => res.json({
  categories: db.prepare("SELECT * FROM categories ORDER BY sort_order, name").all(),
  items: db.prepare("SELECT menu_items.*, categories.name category FROM menu_items JOIN categories ON categories.id = menu_items.category_id ORDER BY popular DESC, menu_items.id").all()
}));
app.post("/api/orders", (req, res) => {
  const { customerName, phone, tableNumber, instructions = "", paymentMethod, items } = req.body;
  if (!customerName?.trim() || !/^[0-9+ ()-]{8,}$/.test(phone || "") || !tableNumber?.trim() || !["upi", "cash"].includes(paymentMethod) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Please provide valid customer, table, payment, and cart details." });
  }
  const ids = items.map((item) => Number(item.id));
  const placeholders = ids.map(() => "?").join(",");
  const menuItems = db.prepare(`SELECT * FROM menu_items WHERE available = 1 AND id IN (${placeholders})`).all(...ids);
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const normalized = items.map((item) => ({ menu: byId.get(Number(item.id)), quantity: Math.max(1, Math.min(99, Number(item.quantity))), instructions: String(item.instructions || "").slice(0, 300) })).filter((item) => item.menu);
  if (!normalized.length) return res.status(400).json({ error: "No available menu items found." });
  const total = normalized.reduce((sum, item) => sum + item.menu.price * item.quantity, 0);
  const now = new Date().toISOString();
  const create = db.transaction(() => {
    const result = db.prepare("INSERT INTO orders (order_code,customer_name,phone,table_number,instructions,total,payment_method,payment_status,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(orderCode(), customerName.trim().slice(0, 100), phone.trim(), tableNumber.trim().slice(0, 20), String(instructions).slice(0, 500), total, paymentMethod, paymentMethod === "upi" ? "pending" : "pending", "placed", now);
    const add = db.prepare("INSERT INTO order_items (order_id,menu_item_id,name,price,quantity,item_instructions) VALUES (?,?,?,?,?,?)");
    normalized.forEach(({ menu, quantity, instructions: itemInstructions }) => add.run(result.lastInsertRowid, menu.id, menu.name, menu.price, quantity, itemInstructions));
    return result.lastInsertRowid;
  });
  const order = publicOrder(create());
  broadcast(order.id);
  res.status(201).json(order);
});
app.get("/api/orders/:code", (req, res) => {
  const order = db.prepare("SELECT id FROM orders WHERE order_code = ?").get(req.params.code);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(publicOrder(order.id));
});
app.post("/api/orders/:code/payment", (req, res) => {
  const order = db.prepare("SELECT id FROM orders WHERE order_code = ?").get(req.params.code);
  if (!order || order.payment_method !== "upi") return res.status(404).json({ error: "UPI order not found" });
  db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(order.id);
  broadcast(order.id);
  res.json(publicOrder(order.id));
});
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const valid = email === ADMIN_EMAIL && await bcrypt.compare(String(password || ""), ADMIN_PASSWORD_HASH);
  if (!valid) return res.status(401).json({ error: "Invalid admin credentials" });
  res.json({ token: jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "12h" }) });
});
app.get("/api/admin/orders", auth, (_req, res) => res.json(db.prepare("SELECT id FROM orders ORDER BY id DESC").all().map(({ id }) => publicOrder(id))));
app.get("/api/admin/menu", auth, (_req, res) => res.json({
  categories: db.prepare("SELECT * FROM categories ORDER BY sort_order, name").all(),
  items: db.prepare("SELECT menu_items.*, categories.name category FROM menu_items JOIN categories ON categories.id = menu_items.category_id ORDER BY popular DESC, menu_items.id").all()
}));
app.post("/api/admin/categories", auth, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Category name is required" });
  try {
    const result = db.prepare("INSERT INTO categories (name, sort_order) VALUES (?, COALESCE((SELECT MAX(sort_order) + 1 FROM categories), 0))").run(name);
    res.status(201).json(db.prepare("SELECT * FROM categories WHERE id = ?").get(result.lastInsertRowid));
  } catch {
    res.status(409).json({ error: "That category already exists" });
  }
});
app.post("/api/admin/menu-items", auth, (req, res) => {
  const { category_id, name, description, price, image, dietary } = req.body;
  if (!Number(category_id) || !String(name || "").trim() || !String(description || "").trim() || !Number(price) || !String(image || "").trim() || !["veg", "nonveg"].includes(dietary)) {
    return res.status(400).json({ error: "Please provide valid menu item details." });
  }
  const result = db.prepare("INSERT INTO menu_items (category_id, name, description, price, image, dietary, popular, available) VALUES (?, ?, ?, ?, ?, ?, 0, 1)").run(Number(category_id), String(name).trim().slice(0, 100), String(description).trim().slice(0, 500), Number(price), String(image).trim(), dietary);
  res.status(201).json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(result.lastInsertRowid));
});
app.patch("/api/admin/menu-items/:id", auth, (req, res) => {
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Menu item not found" });
  const updates = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim().slice(0, 100);
  if (req.body.description !== undefined) updates.description = String(req.body.description).trim().slice(0, 500);
  if (req.body.price !== undefined) updates.price = Number(req.body.price);
  if (req.body.image !== undefined) updates.image = String(req.body.image).trim();
  if (req.body.dietary !== undefined) updates.dietary = ["veg", "nonveg"].includes(req.body.dietary) ? req.body.dietary : item.dietary;
  if (req.body.available !== undefined) updates.available = Number(req.body.available) ? 1 : 0;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid updates provided." });
  const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE menu_items SET ${fields} WHERE id = ?`).run(...values, Number(req.params.id));
  res.json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(Number(req.params.id)));
});
app.delete("/api/admin/menu-items/:id", auth, (req, res) => {
  const result = db.prepare("DELETE FROM menu_items WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Menu item not found" });
  res.json({ success: true });
});
app.patch("/api/admin/orders/:id", auth, (req, res) => {
  const allowed = ["accepted", "preparing", "ready", "completed", "rejected"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid order status" });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(req.body.status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Order not found" });
  broadcast(Number(req.params.id));
  res.json(publicOrder(Number(req.params.id)));
});
app.delete("/api/admin/orders/:id", auth, (req, res) => {
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Order not found" });
  res.json({ success: true });
});
app.get("/api/admin/overview", auth, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const stats = db.prepare("SELECT COUNT(*) totalOrders, COALESCE(SUM(total),0) revenue, SUM(status IN ('placed','accepted')) pendingOrders, SUM(status = 'preparing') preparingOrders, SUM(status = 'completed') completedOrders, COALESCE(SUM(CASE WHEN payment_method='upi' AND payment_status='paid' THEN total ELSE 0 END),0) upiRevenue, SUM(payment_method='cash') cashOrders FROM orders WHERE substr(created_at,1,10)=?").get(today);
  res.json(stats);
});
app.get("/api/admin/qr/:table", async (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  const url = `${origin}/?table=${encodeURIComponent(req.params.table)}`;
  res.type("png").send(await QRCode.toBuffer(url, { width: 420, margin: 2, color: { dark: "#17151f", light: "#fffaf5" } }));
});

app.get("/admin/login", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin", "login.html")));
app.get("/admin/dashboard", (_req, res) => res.sendFile(path.join(__dirname, "public", "admin", "dashboard.html")));

io.on("connection", (socket) => socket.on("order:watch", (code) => {
  const order = db.prepare("SELECT id FROM orders WHERE order_code = ?").get(code);
  if (order) socket.join(`order:${order.id}`);
}));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
server.listen(PORT, () => console.log(`Ayush Kitchen running at http://localhost:${PORT}`));
