// ============================================================
// userService.ts
// Handles everything related to LOGIN ACCOUNTS as opposed to
// employee HR records: creating login credentials for an employee,
// letting Admin directly edit credentials, the password-change
// approval workflow (Employee/HR request -> Admin approves), and
// the system-wide audit log.
// ============================================================

import {
  User,
  UserRole,
  Employee,
  PasswordChangeRequest,
  CredentialsFormErrors,
  AuditLogEntry,
} from "./types.js";
import {
  getUsers,
  saveUsers,
  getPasswordRequests,
  savePasswordRequests,
  getAuditLog,
  saveAuditLog,
  getEmployees,
  saveEmployees,
} from "./storage.js";

// ------------------------------------------------------------
// LOOKUPS
// ------------------------------------------------------------

export function getUserByEmployeeId(employeeId: number): User | undefined {
  return getUsers().find((u) => u.employeeId === employeeId);
}

export function getUserById(userId: number): User | undefined {
  return getUsers().find((u) => u.id === userId);
}

function generateNewUserId(users: User[]): number {
  if (users.length === 0) return 1;
  return Math.max(...users.map((u) => u.id)) + 1;
}

// Checks whether an email is already used by another login account.
export function isUserEmailTaken(email: string, excludeUserId?: number): boolean {
  const normalized = email.trim().toLowerCase();
  return getUsers().some(
    (u) => u.email.toLowerCase() === normalized && u.id !== excludeUserId
  );
}

// ------------------------------------------------------------
// CREATE LOGIN CREDENTIALS FOR AN EMPLOYEE
// Used both when Admin/HR creates a brand new employee (credentials
// are set at the same time) and when assigning login access to an
// employee who doesn't have an account yet.
// ------------------------------------------------------------

export function createEmployeeUser(employee: Employee, password: string): User {
  const users = getUsers();
  const newUser: User = {
    id: generateNewUserId(users),
    name: employee.fullName,
    email: employee.email,
    password,
    role: "employee",
    employeeId: employee.id,
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

// ------------------------------------------------------------
// DIRECT CREDENTIAL EDITS (Admin authority only)
// Admin can directly change: their own credentials, any HR
// account's credentials, or reset any employee's credentials.
// Keeps the linked Employee record's email in sync automatically.
// ------------------------------------------------------------

export function updateUserCredentials(
  userId: number,
  updates: { email?: string; password?: string; name?: string }
): User | null {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) return null;

  const updatedUser: User = { ...users[index], ...updates };
  users[index] = updatedUser;
  saveUsers(users);

  // Keep the linked employee record's email/name in sync so the
  // two never drift apart.
  if (updatedUser.employeeId !== undefined && (updates.email || updates.name)) {
    const employees = getEmployees();
    const empIndex = employees.findIndex((e) => e.id === updatedUser.employeeId);
    if (empIndex !== -1) {
      if (updates.email) employees[empIndex].email = updates.email;
      if (updates.name) employees[empIndex].fullName = updates.name;
      saveEmployees(employees);
    }
  }

  return updatedUser;
}

// ------------------------------------------------------------
// VALIDATION for credential forms (create/assign/manage)
// ------------------------------------------------------------

function isValidEmailFormat(value: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(value.trim());
}

export function getPasswordStrength(password: string): "weak" | "medium" | "strong" {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

export function validateCredentialsForm(
  email: string,
  password: string,
  confirmPassword: string,
  excludeUserId?: number
): CredentialsFormErrors {
  const errors: CredentialsFormErrors = {};

  if (email.trim() === "") {
    errors.email = "Email is required.";
  } else if (!isValidEmailFormat(email)) {
    errors.email = "Please enter a valid email address.";
  } else if (isUserEmailTaken(email, excludeUserId)) {
    errors.email = "This email is already used by another account.";
  }

  if (password.trim() === "") {
    errors.password = "Password is required.";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (confirmPassword.trim() === "") {
    errors.confirmPassword = "Please confirm the password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

// A lighter validation used when only the password is being changed
// (email stays the same), e.g. for password-change requests.
export function validatePasswordOnly(
  password: string,
  confirmPassword: string
): { password?: string; confirmPassword?: string } {
  const errors: { password?: string; confirmPassword?: string } = {};

  if (password.trim() === "") {
    errors.password = "Password is required.";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (confirmPassword.trim() === "") {
    errors.confirmPassword = "Please confirm the password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

// ------------------------------------------------------------
// PASSWORD CHANGE REQUESTS (Employee / HR -> Admin approval)
// ------------------------------------------------------------

function generateNewRequestId(requests: PasswordChangeRequest[]): number {
  if (requests.length === 0) return 1;
  return Math.max(...requests.map((r) => r.id)) + 1;
}

export function getAllPasswordRequests(): PasswordChangeRequest[] {
  return getPasswordRequests();
}

// Returns the current pending request for a user, if any. A user
// may only have one pending request open at a time.
export function getPendingRequestForUser(userId: number): PasswordChangeRequest | undefined {
  return getPasswordRequests().find((r) => r.userId === userId && r.status === "pending");
}

export function submitPasswordChangeRequest(user: User, newPassword: string): PasswordChangeRequest {
  const requests = getPasswordRequests();
  const newRequest: PasswordChangeRequest = {
    id: generateNewRequestId(requests),
    userId: user.id,
    employeeId: user.employeeId,
    requesterName: user.name,
    requesterRole: user.role,
    requestedEmail: user.email,
    newPassword,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  requests.push(newRequest);
  savePasswordRequests(requests);
  return newRequest;
}

export function getPendingRequestCount(): number {
  return getPasswordRequests().filter((r) => r.status === "pending").length;
}

// Approves a request: updates the underlying user's password so it
// takes effect everywhere (Admin, HR, and the Employee's own portal
// all read from the same Users list, so there is nothing else to
// update separately).
export function approvePasswordChangeRequest(requestId: number, reviewerName: string): boolean {
  const requests = getPasswordRequests();
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return false;

  const request = requests[index];
  request.status = "approved";
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = reviewerName;
  requests[index] = request;
  savePasswordRequests(requests);

  updateUserCredentials(request.userId, { password: request.newPassword });
  return true;
}

export function rejectPasswordChangeRequest(requestId: number, reviewerName: string): boolean {
  const requests = getPasswordRequests();
  const index = requests.findIndex((r) => r.id === requestId);
  if (index === -1) return false;

  requests[index].status = "rejected";
  requests[index].reviewedAt = new Date().toISOString();
  requests[index].reviewedBy = reviewerName;
  savePasswordRequests(requests);
  return true;
}

// ------------------------------------------------------------
// AUDIT LOG
// ------------------------------------------------------------

function generateNewLogId(entries: AuditLogEntry[]): number {
  if (entries.length === 0) return 1;
  return Math.max(...entries.map((e) => e.id)) + 1;
}

export function logAction(
  actorName: string,
  actorRole: UserRole,
  action: string,
  details: string
): void {
  const entries = getAuditLog();
  const newEntry: AuditLogEntry = {
    id: generateNewLogId(entries),
    timestamp: new Date().toISOString(),
    actorName,
    actorRole,
    action,
    details,
  };
  entries.push(newEntry);
  saveAuditLog(entries);
}

// Returns the most recent log entries, newest first.
export function getRecentAuditLog(count: number): AuditLogEntry[] {
  const entries = getAuditLog();
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return sorted.slice(0, count);
}
