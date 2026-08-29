// ============================================================
// storage.ts
// This file is the ONLY place that talks directly to localStorage.
// Every other file should use these functions instead of calling
// localStorage.getItem / setItem directly. This keeps our data
// access logic in one reusable place (a common software design
// practice sometimes called a "data access layer").
// ============================================================

import { Employee, User, PasswordChangeRequest, AuditLogEntry } from "./types.js";

// Keys used to store data inside localStorage.
// Using constants avoids typos like "employees" vs "employee".
const EMPLOYEES_KEY = "employees";
const USERS_KEY = "users";
const CURRENT_USER_KEY = "currentUser";
const INITIALIZED_KEY = "appInitialized";
const PASSWORD_REQUESTS_KEY = "passwordRequests";
const AUDIT_LOG_KEY = "auditLog";

// ------------------------------------------------------------
// EMPLOYEES
// ------------------------------------------------------------

// Reads the employees array from localStorage.
// Returns an empty array if nothing has been saved yet, so the
// rest of the app never has to worry about "null" or "undefined".
export function getEmployees(): Employee[] {
  const raw = localStorage.getItem(EMPLOYEES_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Employee[];
    return parsed;
  } catch (error) {
    console.error("Failed to parse employees from localStorage", error);
    return [];
  }
}

// Saves the given employees array to localStorage, replacing
// whatever was there before.
export function saveEmployees(employees: Employee[]): void {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
}

// ------------------------------------------------------------
// USERS
// ------------------------------------------------------------

export function getUsers(): User[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as User[];
    return parsed;
  } catch (error) {
    console.error("Failed to parse users from localStorage", error);
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ------------------------------------------------------------
// CURRENT LOGGED-IN USER
// ------------------------------------------------------------

// Returns the currently logged-in user, or null if nobody is logged in.
export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch (error) {
    console.error("Failed to parse current user from localStorage", error);
    return null;
  }
}

// Saves the logged-in user so the app "remembers" who is using it.
export function setCurrentUser(user: User): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

// Removes the logged-in user (used during logout).
export function clearCurrentUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ------------------------------------------------------------
// PASSWORD CHANGE REQUESTS
// ------------------------------------------------------------

export function getPasswordRequests(): PasswordChangeRequest[] {
  const raw = localStorage.getItem(PASSWORD_REQUESTS_KEY);
  if (raw === null) {
    return [];
  }
  try {
    return JSON.parse(raw) as PasswordChangeRequest[];
  } catch (error) {
    console.error("Failed to parse password requests from localStorage", error);
    return [];
  }
}

export function savePasswordRequests(requests: PasswordChangeRequest[]): void {
  localStorage.setItem(PASSWORD_REQUESTS_KEY, JSON.stringify(requests));
}

// ------------------------------------------------------------
// AUDIT LOG
// ------------------------------------------------------------

export function getAuditLog(): AuditLogEntry[] {
  const raw = localStorage.getItem(AUDIT_LOG_KEY);
  if (raw === null) {
    return [];
  }
  try {
    return JSON.parse(raw) as AuditLogEntry[];
  } catch (error) {
    console.error("Failed to parse audit log from localStorage", error);
    return [];
  }
}

export function saveAuditLog(entries: AuditLogEntry[]): void {
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
}

// ------------------------------------------------------------
// FIRST-TIME SETUP FLAG
// ------------------------------------------------------------

export function isAppInitialized(): boolean {
  return localStorage.getItem(INITIALIZED_KEY) === "true";
}

export function markAppInitialized(): void {
  localStorage.setItem(INITIALIZED_KEY, "true");
}

// ------------------------------------------------------------
// SAMPLE / DEMO DATA
// This function runs once (the very first time the app is opened)
// to populate localStorage with demo users and sample employees,
// so the project can be tested immediately without any setup.
// ------------------------------------------------------------

export function initializeSampleData(): void {
  // If we've already set things up before, do nothing.
  // This prevents overwriting real data the user has added.
  if (isAppInitialized()) {
    return;
  }

  const sampleEmployees: Employee[] = [
    {
      id: 1,
      fullName: "Sarah Johnson",
      email: "employee@example.com",
      phone: "555-201-3344",
      department: "Human Resources",
      position: "HR Coordinator",
      salary: 52000,
      address: "12 Maple Street, Springfield",
      joiningDate: "2022-03-14",
      status: "active",
    },
    {
      id: 2,
      fullName: "David Chen",
      email: "david.chen@example.com",
      phone: "555-482-9091",
      department: "Information Technology",
      position: "Software Engineer",
      salary: 78000,
      address: "88 Birch Avenue, Springfield",
      joiningDate: "2021-07-01",
      status: "active",
    },
    {
      id: 3,
      fullName: "Maria Gonzalez",
      email: "maria.gonzalez@example.com",
      phone: "555-673-2210",
      department: "Finance",
      position: "Financial Analyst",
      salary: 65000,
      address: "45 Oak Lane, Springfield",
      joiningDate: "2023-01-09",
      status: "active",
    },
    {
      id: 4,
      fullName: "James Carter",
      email: "james.carter@example.com",
      phone: "555-390-1123",
      department: "Marketing",
      position: "Marketing Specialist",
      salary: 58000,
      address: "19 Cedar Court, Springfield",
      joiningDate: "2020-11-23",
      status: "active",
    },
    {
      id: 5,
      fullName: "Emily Davis",
      email: "emily.davis@example.com",
      phone: "555-720-5567",
      department: "Operations",
      position: "Operations Manager",
      salary: 82000,
      address: "5 Pine Ridge, Springfield",
      joiningDate: "2019-05-30",
      status: "active",
    },
    {
      id: 6,
      fullName: "Michael Lee",
      email: "michael.lee@example.com",
      phone: "555-812-0033",
      department: "Information Technology",
      position: "IT Support Specialist",
      salary: 54000,
      address: "77 Willow Way, Springfield",
      joiningDate: "2023-08-17",
      status: "inactive",
    },
  ];

  // Demo user accounts, one for each role. Note that the Employee
  // account is linked to employeeId: 1 (Sarah Johnson), so the
  // Employee Dashboard has real data to display. Employees 2-6 are
  // intentionally left WITHOUT a login account so the "Assign Login
  // Credentials" feature has something to demonstrate.
  const sampleUsers: User[] = [
    {
      id: 1,
      name: "System Administrator",
      email: "admin@example.com",
      password: "admin123",
      role: "admin",
    },
    {
      id: 2,
      name: "Hannah Brooks",
      email: "hr@example.com",
      password: "hr123",
      role: "hr",
    },
    {
      id: 3,
      name: "Sarah Johnson",
      email: "employee@example.com",
      password: "employee123",
      role: "employee",
      employeeId: 1,
    },
  ];

  const initialAuditLog: AuditLogEntry[] = [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      actorName: "System",
      actorRole: "admin",
      action: "System Initialized",
      details: "Demo data was created automatically on first run.",
    },
  ];

  saveEmployees(sampleEmployees);
  saveUsers(sampleUsers);
  savePasswordRequests([]);
  saveAuditLog(initialAuditLog);
  markAppInitialized();
}
