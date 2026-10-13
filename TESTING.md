# Testing Guide

This application is a static front-end project, so testing is primarily manual in the browser.

## Test Environment

- Modern desktop browser such as Microsoft Edge or Google Chrome.
- Optional: VS Code Live Server extension or any local static file server.
- Internet connection for loading menu data from TheMealDB API.

## Pre-Test Reset

Before each full test pass, clear browser storage for the app:

1. Open the application in the browser.
2. Open DevTools.
3. Clear `localStorage` for the site or origin.
4. Reload the page.

## Core Functional Tests

### Registration

1. Open `register.html`.
2. Submit the form with an empty email.
Expected result: You should see `Email required`.
3. Submit the form with an invalid email.
Expected result: You should see the email format guidance.
4. Submit the form with an empty password.
Expected result: You should see `Password required`.
5. Submit the form with a password shorter than 5 characters.
Expected result: You should see the password length warning.
6. Submit the form with a valid email and password.
Expected result: The account is stored, a success message appears, and the app returns to the sign-in page.
7. Register the same email again.
Expected result: You should be told the account already exists and be sent to the sign-in page.

### Sign In

1. Open `signin.html`.
2. Submit invalid credentials.
Expected result: You should see `Invalid credentials`.
3. Submit valid credentials from a registered account.
Expected result: You should see a welcome message and be redirected to the dashboard.
4. Try to sign in again while an account is already active in the same browser storage.
Expected result: You should be blocked from signing in to a second session.

### Dashboard Menu

1. Sign in successfully and open the dashboard.
2. Confirm the signed-in email is shown in the top bar.
3. Confirm the menu loads meal cards from the API.
Expected result: Each card shows an image, meal name, price, and add-to-cart button.
4. Refresh the page while the meal API is unavailable.
Expected result: The menu should show a readable fallback error message.

### Cart and Checkout

1. Add one menu item to the cart.
Expected result: The cart count increments.
2. Add the same item again.
Expected result: Quantity increases instead of creating a duplicate line item.
3. Open the cart.
Expected result: The cart lists the item, unit price, quantity, and total amount.
4. Increase and decrease item quantity.
Expected result: Totals and item counts update correctly.
5. Reduce an item quantity to zero.
Expected result: The item is removed from the cart.
6. Click checkout while the menu view is active.
Expected result: The app switches to the cart view first.
7. Click checkout with an empty cart.
Expected result: You should see `Your cart is empty!`.
8. Click checkout with items in the cart.
Expected result: A receipt appears in an alert, the total is shown, and the cart is cleared.

### Sign Out

1. Click `Sign Out` from the dashboard.
Expected result: You should be returned to the sign-in page.
2. Try opening `dashboard.html` directly after signing out.
Expected result: The app should redirect you back to the sign-in page.

## UI and Accessibility Checks

1. Tab through the forms and buttons.
Expected result: Focus indicators should be visible.
2. Check the pages on a narrow viewport.
Expected result: Layout should remain readable and controls should not overlap.
3. Confirm hidden form labels are still associated with the inputs.
Expected result: Screen readers can identify the fields.

## Known Constraints

- Authentication is for demo purposes only and uses browser `localStorage`.
- Menu availability depends on the external API response.
- There are no automated tests configured in this project.
