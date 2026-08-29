// ============================================================
// login.ts
// Logic for index.html (the Login page).
// ============================================================
import { login, redirectToCorrectDashboard } from "./auth.js";
import { getCurrentUser, initializeSampleData } from "./storage.js";
import { setFieldError, clearFieldErrors } from "./ui.js";
// Set up demo data the very first time the app runs.
initializeSampleData();
// If someone who is already logged in opens the login page directly,
// send them straight to their dashboard instead of showing the form.
const existingUser = getCurrentUser();
if (existingUser) {
    redirectToCorrectDashboard(existingUser);
}
// Grab references to the elements we need. The "as" keyword here is
// a TypeScript "type assertion" - it tells the compiler "trust me,
// I know this element exists and is this specific type".
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");
const loginButton = document.getElementById("login-btn");
const generalErrorEl = document.getElementById("general-error");
// ------------------------------------------------------------
// SHOW / HIDE PASSWORD
// ------------------------------------------------------------
togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePasswordBtn.textContent = isPassword ? "Hide" : "Show";
});
// ------------------------------------------------------------
// QUICK-FILL DEMO ACCOUNTS
// Clicking a demo account card fills the form with that account's
// credentials so the project can be tested with a single click.
// ------------------------------------------------------------
const demoAccountCards = document.querySelectorAll("[data-demo-email]");
demoAccountCards.forEach((card) => {
    card.addEventListener("click", () => {
        const demoEmail = card.dataset.demoEmail ?? "";
        const demoPassword = card.dataset.demoPassword ?? "";
        emailInput.value = demoEmail;
        passwordInput.value = demoPassword;
        setFieldError("email", "");
        setFieldError("password", "");
        generalErrorEl.textContent = "";
        emailInput.focus();
    });
});
// ------------------------------------------------------------
// LIVE VALIDATION (clears errors as the user types)
// ------------------------------------------------------------
emailInput.addEventListener("input", () => {
    setFieldError("email", "");
    generalErrorEl.textContent = "";
});
passwordInput.addEventListener("input", () => {
    setFieldError("password", "");
    generalErrorEl.textContent = "";
});
// ------------------------------------------------------------
// FORM SUBMISSION
// ------------------------------------------------------------
function isValidEmailFormat(value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value.trim());
}
loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors(["email", "password"]);
    generalErrorEl.textContent = "";
    const email = emailInput.value;
    const password = passwordInput.value;
    let hasError = false;
    if (email.trim() === "") {
        setFieldError("email", "Email is required.");
        hasError = true;
    }
    else if (!isValidEmailFormat(email)) {
        setFieldError("email", "Please enter a valid email address.");
        hasError = true;
    }
    if (password.trim() === "") {
        setFieldError("password", "Password is required.");
        hasError = true;
    }
    if (hasError) {
        return;
    }
    // Show a brief loading state on the button so the login feels responsive.
    loginButton.disabled = true;
    const originalText = loginButton.textContent;
    loginButton.textContent = "Signing in...";
    // A tiny delay simulates a network request and lets the loading
    // state actually be visible, which is nicer for demo purposes.
    setTimeout(() => {
        const result = login(email, password);
        if (!result.success || !result.user) {
            generalErrorEl.textContent = result.message;
            loginButton.disabled = false;
            loginButton.textContent = originalText;
            return;
        }
        redirectToCorrectDashboard(result.user);
    }, 400);
});
//# sourceMappingURL=login.js.map