// ============================================================
// auth.ts
// Handles login, logout, and role-based access control (RBAC).
// This file is shared by every page so we don't repeat the same
// authentication logic four times.
// ============================================================
import { getUsers, getCurrentUser, setCurrentUser, clearCurrentUser } from "./storage.js";
// Attempts to log a user in using their email and password.
// Returns a LoginResult describing success or failure.
export function login(email, password) {
    const users = getUsers();
    // Emails are treated as case-insensitive, which matches how most
    // real login systems behave.
    const normalizedEmail = email.trim().toLowerCase();
    const matchedUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!matchedUser) {
        return { success: false, message: "Invalid email or password." };
    }
    if (matchedUser.password !== password) {
        return { success: false, message: "Invalid email or password." };
    }
    setCurrentUser(matchedUser);
    return { success: true, message: "Login successful.", user: matchedUser };
}
// Logs the current user out and sends them back to the login page.
export function logout() {
    clearCurrentUser();
    window.location.href = "index.html";
}
// Returns the correct dashboard filename for a given role.
export function getDashboardForRole(role) {
    switch (role) {
        case "admin":
            return "admin.html";
        case "hr":
            return "hr.html";
        case "employee":
            return "employee.html";
    }
}
// Sends the browser to whichever dashboard matches the user's role.
export function redirectToCorrectDashboard(user) {
    window.location.href = getDashboardForRole(user.role);
}
// This is the core of our Role-Based Access Control (RBAC).
// Every protected page (admin.html, hr.html, employee.html) calls
// this function at the very top of its script.
//
// Behaviour:
// 1. If nobody is logged in -> send them to the login page.
// 2. If the logged-in user's role does NOT match the page they are
//    trying to view -> send them to THEIR correct dashboard instead.
// 3. Otherwise, return the current user so the page can use it.
export function checkAccess(requiredRole) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = "index.html";
        // Throwing here stops the rest of the page's script from running
        // while the browser processes the redirect.
        throw new Error("Not authenticated. Redirecting to login.");
    }
    if (currentUser.role !== requiredRole) {
        redirectToCorrectDashboard(currentUser);
        throw new Error("Not authorized for this page. Redirecting.");
    }
    return currentUser;
}
//# sourceMappingURL=auth.js.map