# Application Features Guide

## Sign In Page (`signin.html`)

### Features
- **Sign-In Form** — Authenticates existing users against `localStorage` accounts
- **Navigation Link** — Link to the registration page for new users

### Form Fields
1. **Email** *(Required)*
   - Must match the pattern: letters, numbers, and `% . + _ -` before the `@` symbol
   - Example: `user@example.com`

2. **Password** *(Required)*
   - Minimum 5 characters

### Behaviors
- Valid credentials set the `activeAccount` key in `localStorage` and redirect to `dashboard.html`
- Invalid credentials show an alert with a descriptive error message
- Form resets after a failed attempt

---

## Register Page (`register.html`)

### Features
- **Registration Form** — Creates a new account and stores it in `localStorage`
- **Navigation Link** — Link back to the sign-in page

### Form Fields
1. **Email** *(Required)*
   - Same format rules as sign-in
   - Must not already exist in stored accounts

2. **Password** *(Required)*
   - Minimum 5 characters

### Behaviors
- Duplicate email shows an alert and redirects to sign-in
- Successful registration stores the account and redirects to sign-in
- Form resets after submission

---

## Dashboard (`dashboard.html`)

Access is protected. Users without an active session are immediately redirected to `signin.html`.

### Menu View

#### Features
- **Menu Grid** — Displays meal cards loaded from TheMealDB API
- **Loading State** — Shows a loading message while the API request is in-flight
- **Error State** — Shows a fallback message if the API request fails
- **Add to Cart Button** — Adds the selected item to the cart (increments quantity if already present)

#### Meal Card Information
- Meal thumbnail image (lazy-loaded)
- Meal name
- Price (deterministically derived from meal ID)

---

### Cart View

#### Features
- **Cart Item List** — Shows all items currently in the cart
- **Empty State** — Shows a message when no items have been added
- **Quantity Controls** — `+` and `−` buttons per item; removing below 1 deletes the item
- **Running Total** — Recalculated and displayed after every change

#### Cart Item Information
- Item name
- Unit price
- Current quantity

---

### Checkout

#### Behaviors
- If the cart view is not active, the checkout button switches to the cart view first
- If the cart is empty, an alert prompts the user to add items
- On successful checkout:
  - An alert displays a receipt with each item, unit price, quantity, and the total charged
  - The cart is cleared after the alert is dismissed

---

### Navigation Bar

- **Menu Button** — Switches to the menu view
- **Cart Button** — Switches to the cart view
- **Items in Cart** — Live count of total items across all cart entries
- **Active Account** — Displays the signed-in user's email
- **Checkout Button** — Initiates checkout or navigates to the cart view
- **Sign Out Button** — Clears the active session and redirects to `signin.html`
