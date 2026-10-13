# Ayush Kitchen — single-restaurant ordering

Ayush Kitchen is a full-stack, mobile-first ordering application for one restaurant. Guests can scan a table QR code, browse and filter the menu, build one cart, choose UPI or Cash at Counter, place an order, and watch the kitchen status update live. Staff use a separate authenticated dashboard for order workflow, overview metrics, and table QR generation.

## Important Disclaimer
- This project is a demo/dummy site for development and learning purposes only.
- It does not provide real-world food ordering, payment, or delivery.
- It does not process real financial transactions.
- Do not use this project in production as-is.

## Tech Stack
- Frontend: semantic HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express, Socket.IO
- Persistence: SQLite via `better-sqlite3`
- Payments: UPI deep link with explicit customer confirmation; no false payment success
- Authentication: signed JWT admin sessions

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Open [http://localhost:3000](http://localhost:3000)

Default admin credentials are `admin@ayushkitchen.com` / `admin123`. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `PORT` environment variables before deployment.

## Main routes
- `/` — customer home, menu, cart, QR-aware checkout, and order tracking
- `/?table=12` — customer ordering flow pre-filled for Table 12
- `/admin/login` — staff login
- `/admin/dashboard` — live order management and today's overview
- `/api/admin/qr/12` — PNG QR code for Table 12

## Operational notes
- The first server start creates `restaurant.db` and seeds the initial menu.
- Menu and category administration endpoints can be extended behind the existing JWT middleware.
- UPI orders intentionally remain `pending` until staff verify payment using the dashboard; the browser never marks a payment as successful by itself.
- Socket.IO broadcasts order updates, while the customer tracking view also reconnects through the current page session.
