// ============================================================
// types.ts
// This file contains all the shared TypeScript interfaces and
// types used across the whole application. Keeping types in one
// place makes the app easier to maintain and avoids repeating
// the same shape definitions in multiple files.
// ============================================================

// A "union type" - a role can ONLY be one of these three strings.
// This gives us type safety: TypeScript will error if we try to
// assign anything else to a variable of type UserRole.
export type UserRole = "admin" | "hr" | "employee";

// Whether an employee record is currently active or has left/been
// deactivated. Used for filtering and as a softer alternative to
// permanently deleting a record.
export type EmployeeStatus = "active" | "inactive";

// Represents a single employee record stored in the system.
export interface Employee {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  salary: number;
  address: string;
  joiningDate: string; // Stored as a simple ISO date string, e.g. "2024-01-15"
  status: EmployeeStatus;
}

// Represents a user account used to log in to the system.
// Not every user needs an employeeId (e.g. Admin/HR might not
// have a linked employee record), so it is marked optional with "?".
export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId?: number;
}

// Used when creating a new employee - same as Employee but without
// the auto-generated "id" field, since the system creates that itself.
export type NewEmployeeData = Omit<Employee, "id">;

// Used to represent validation results for a form field.
export interface ValidationResult {
  isValid: boolean;
  errorMessage: string;
}

// Used to represent the full validation state of the employee form.
// Each key maps to a possible error message for that field.
export interface EmployeeFormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  salary?: string;
  address?: string;
  joiningDate?: string;
  password?: string;
  confirmPassword?: string;
}

// Errors for the standalone credentials forms (assign/manage login).
export interface CredentialsFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// Used for showing toast notifications across the app.
export type ToastType = "success" | "error" | "info";

// ------------------------------------------------------------
// PASSWORD CHANGE REQUESTS
// An Employee or HR user cannot change their own password
// directly. Instead they submit a request containing the new
// password they'd like, and an Admin must approve it before it
// takes effect anywhere in the system.
// ------------------------------------------------------------

export type PasswordRequestStatus = "pending" | "approved" | "rejected";

export interface PasswordChangeRequest {
  id: number;
  userId: number;
  employeeId?: number;
  requesterName: string;
  requesterRole: UserRole;
  requestedEmail: string; // The account email at the time of the request, for display.
  newPassword: string;
  status: PasswordRequestStatus;
  requestedAt: string; // ISO datetime string
  reviewedAt?: string;
  reviewedBy?: string;
}

// ------------------------------------------------------------
// AUDIT LOG
// A simple, human-readable history of important actions taken in
// the system, viewable by Admin. Useful for accountability in a
// real HR system.
// ------------------------------------------------------------

export interface AuditLogEntry {
  id: number;
  timestamp: string; // ISO datetime string
  actorName: string;
  actorRole: UserRole;
  action: string; // Short label, e.g. "Employee Added"
  details: string; // Human readable detail, e.g. "Added Jane Smith (IT)"
}
