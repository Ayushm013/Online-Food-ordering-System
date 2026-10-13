# Technical Implementation Guide

## Project Architecture

This project follows Feature-Sliced Design (FSD): shared infrastructure is
isolated from user, meal, and cart entities; auth is a feature; and each page
composes only the modules it needs.

### Technology Stack
- **Markup**: HTML5
- **Styling**: Tailwind CSS (CDN), custom CSS (`css/styles.css`)
- **Logic**: Vanilla JavaScript (ES6+)
- **Storage**: Browser `localStorage`
- **External API**: TheMealDB

### Folder Structure

```
online-food-ordering-app/
├── css/
│   └── styles.css              (Custom styles, accessibility helpers, responsive polish)
├── images/                     (Background and decorative assets)
├── js/
│   ├── shared/                 (Storage, navigation, formatting, constants)
│   ├── entities/               (User, meal, and cart domain models)
│   ├── features/               (Auth use cases)
│   └── pages/                  (Page composition and UI wiring)
├── signin.html                 (Sign-in page)
├── register.html               (Registration page)
└── dashboard.html              (Protected dashboard page)
```

---

## Module Responsibilities

### Auth layers
- Defines shared `localStorage` keys and validation constants
- Provides helpers for reading and writing the accounts array
- Exports `register()` and `signIn()` as global functions called from HTML form `onsubmit` handlers
- Validates email format with a regex pattern and enforces the minimum password length
- Blocks duplicate registrations and clears forms after submission

### Dashboard layers
- Bootstraps on `DOMContentLoaded`: validates session, caches DOM elements, binds events, and loads the menu
- Manages a single `state` object (`cart`, `cartInView`, `total`) as the source of truth
- Uses event delegation on `menuDisplay` and `cartItem` containers to handle dynamic button clicks
- Fetches menu data from TheMealDB and renders meal cards using DOM nodes and `DocumentFragment`
- Recalculates cart totals and rerenders the full cart display on every mutation

---

## State Management

### localStorage Keys

| Key             | Purpose                                        |
|-----------------|------------------------------------------------|
| `accounts`      | JSON array of `{ un, pw }` credential objects  |
| `activeAccount` | Email string of the currently signed-in user   |
| `dashKey`       | Temporary access token cleared on dashboard load |

### Dashboard State Object

```javascript
const state = {
    cart: [],       // Array of { id, name, price, quantity }
    cartInView: false,
    total: 0
};
```

All cart mutations go through `refreshCart()`, which recalculates `state.total`, calls `renderCart()`, and calls `updateCartCount()` in one pass.

---

## API Integration

### Endpoint
```
GET https://www.themealdb.com/api/json/v1/1/search.php?f=a
```

Returns meals whose names start with the letter `a`. The response shape is `{ meals: [...] }`.

### Fields Used Per Meal
| Field         | Usage                          |
|---------------|-------------------------------|
| `idMeal`      | Unique ID used for cart key and pricing |
| `strMeal`     | Display name and button dataset attribute |
| `strMealThumb`| Thumbnail image source          |

### Error Handling
- A loading message is rendered before the fetch begins
- Network failures or non-`ok` responses render a static error message in place of the menu grid

---

## Pricing Algorithm

Item prices are deterministic and derived solely from the meal ID, so the same item always displays the same price without any server-side data:

```javascript
function getItemPrice(itemId) {
    const baseCents = 799 + (Number(itemId) % 1300);
    return Number((baseCents / 100).toFixed(2));
}
```

This produces prices in the range $7.99–$20.98.

---

## DOM Rendering Pattern

Menu cards and cart items are built with `document.createElement` and collected into a `DocumentFragment` before a single `appendChild` call. This avoids repeated `innerHTML` assignments and keeps reflow cost low.

```javascript
const fragment = document.createDocumentFragment();
items.forEach((item) => {
    const card = document.createElement("article");
    // ... build card nodes ...
    fragment.appendChild(card);
});
elements.menuDisplay.appendChild(fragment);
```

---

## Validation Pattern

Both the email format check and password length check run through the shared `validateCredentials()` function in `js/features/auth/model/auth.js` before any `localStorage` read or write occurs:

```javascript
function validateCredentials(email, password) {
    if (!email) return "Email required";
    if (!EMAIL_PATTERN.test(email)) return "Please enter an email with the required pattern...";
    if (!password) return "Password required";
    if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    return "";
}
```

A non-empty return value is shown in an `alert` and the operation is aborted.
