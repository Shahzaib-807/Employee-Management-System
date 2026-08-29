// ============================================================
// employeeService.ts
// Contains all CRUD (Create, Read, Update, Delete) logic for
// EMPLOYEE RECORDS (name, department, salary, etc). Login
// credentials are a separate concern handled by userService.ts -
// keeping them apart means HR's file never even imports a
// "delete" or "change password directly" function, which enforces
// permission boundaries at the code level, not just visually.
// ============================================================

import { Employee, NewEmployeeData, EmployeeStatus, ValidationResult, EmployeeFormErrors } from "./types.js";
import { getEmployees, saveEmployees, getUsers, saveUsers } from "./storage.js";

// ------------------------------------------------------------
// CREATE
// ------------------------------------------------------------

// Generates a new unique employee ID by taking the highest existing
// ID and adding 1. Starts at 1 if there are no employees yet.
function generateNewEmployeeId(employees: Employee[]): number {
  if (employees.length === 0) {
    return 1;
  }
  const maxId = Math.max(...employees.map((e) => e.id));
  return maxId + 1;
}

// Adds a new employee to localStorage. Returns the newly created
// Employee object (including its generated id). Creating the linked
// login account is a separate step handled by userService, so this
// function only ever deals with the HR record itself.
export function addEmployee(data: NewEmployeeData): Employee {
  const employees = getEmployees();
  const newEmployee: Employee = {
    id: generateNewEmployeeId(employees),
    ...data,
  };
  employees.push(newEmployee);
  saveEmployees(employees);
  return newEmployee;
}

// ------------------------------------------------------------
// READ
// ------------------------------------------------------------

export function getAllEmployees(): Employee[] {
  return getEmployees();
}

export function getEmployeeById(id: number): Employee | undefined {
  const employees = getEmployees();
  return employees.find((e) => e.id === id);
}

// Checks whether an email is already used by another employee OR by
// any existing login account (Admin, HR, or another Employee). This
// matters because an employee's email doubles as their login email,
// so it must be unique across the WHOLE system, not just among other
// employee records. "excludeId" ignores the employee's own record
// (and their own linked login account) when editing.
export function isEmailTaken(email: string, excludeId?: number): boolean {
  const normalized = email.trim().toLowerCase();

  const employees = getEmployees();
  const usedByEmployee = employees.some(
    (e) => e.email.toLowerCase() === normalized && e.id !== excludeId
  );

  const users = getUsers();
  const usedByUser = users.some((u) => {
    if (u.email.toLowerCase() !== normalized) return false;
    // Admin/HR accounts have no linked employeeId, so any match on
    // their email always counts as taken.
    if (u.employeeId === undefined) return true;
    // An employee-linked account only counts as taken if it belongs
    // to a DIFFERENT employee than the one currently being edited.
    return u.employeeId !== excludeId;
  });

  return usedByEmployee || usedByUser;
}

// ------------------------------------------------------------
// UPDATE
// ------------------------------------------------------------

// Updates an existing employee record. "updates" is a Partial<Employee>
// meaning the caller can pass just the fields that changed.
export function updateEmployee(id: number, updates: Partial<Employee>): Employee | null {
  const employees = getEmployees();
  const index = employees.findIndex((e) => e.id === id);

  if (index === -1) {
    return null;
  }

  const updatedEmployee: Employee = { ...employees[index], ...updates, id };
  employees[index] = updatedEmployee;
  saveEmployees(employees);

  // If the employee's name or email changed, keep any linked user
  // account in sync so the login system and displayed name stay correct.
  const users = getUsers();
  const linkedUserIndex = users.findIndex((u) => u.employeeId === id);
  if (linkedUserIndex !== -1) {
    if (updates.fullName) {
      users[linkedUserIndex].name = updates.fullName;
    }
    if (updates.email) {
      users[linkedUserIndex].email = updates.email;
    }
    saveUsers(users);
  }

  return updatedEmployee;
}

// Convenience helper for toggling active/inactive status from the table.
export function setEmployeeStatus(id: number, status: EmployeeStatus): Employee | null {
  return updateEmployee(id, { status });
}

// ------------------------------------------------------------
// DELETE
// ------------------------------------------------------------

// Deletes an employee AND any user account linked to that employee,
// so we never leave an orphaned login account behind.
export function deleteEmployee(id: number): void {
  const employees = getEmployees().filter((e) => e.id !== id);
  saveEmployees(employees);

  const users = getUsers().filter((u) => u.employeeId !== id);
  saveUsers(users);
}

// ------------------------------------------------------------
// SEARCH & FILTER
// ------------------------------------------------------------

// Searches employees by name OR email (case-insensitive, partial match).
export function searchEmployees(employees: Employee[], query: string): Employee[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") {
    return employees;
  }
  return employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(trimmed) ||
      e.email.toLowerCase().includes(trimmed)
  );
}

// Filters employees by department. An empty string / "all" means
// "no filter applied".
export function filterEmployeesByDepartment(
  employees: Employee[],
  department: string
): Employee[] {
  if (department === "" || department === "all") {
    return employees;
  }
  return employees.filter((e) => e.department === department);
}

// Filters employees by status. "all" means "no filter applied".
export function filterEmployeesByStatus(
  employees: Employee[],
  status: EmployeeStatus | "all"
): Employee[] {
  if (status === "all") {
    return employees;
  }
  return employees.filter((e) => e.status === status);
}

// Returns a list of unique department names currently in use,
// useful for populating dropdown filters.
export function getUniqueDepartments(employees: Employee[]): string[] {
  const departments = employees.map((e) => e.department);
  return Array.from(new Set(departments)).sort();
}

// ------------------------------------------------------------
// SORTING (used by the sortable table headers)
// ------------------------------------------------------------

export type SortField = "fullName" | "department" | "position" | "salary" | "joiningDate";
export type SortDirection = "asc" | "desc";

export function sortEmployees(
  employees: Employee[],
  field: SortField,
  direction: SortDirection
): Employee[] {
  const sorted = [...employees].sort((a, b) => {
    let comparison = 0;

    if (field === "salary") {
      comparison = a.salary - b.salary;
    } else if (field === "joiningDate") {
      comparison = new Date(a.joiningDate).getTime() - new Date(b.joiningDate).getTime();
    } else {
      comparison = a[field].localeCompare(b[field]);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

// ------------------------------------------------------------
// STATISTICS (used by the dashboard summary cards)
// ------------------------------------------------------------

export function getTotalEmployees(employees: Employee[]): number {
  return employees.length;
}

export function getTotalDepartments(employees: Employee[]): number {
  return getUniqueDepartments(employees).length;
}

export function getAverageSalary(employees: Employee[]): number {
  if (employees.length === 0) {
    return 0;
  }
  const total = employees.reduce((sum, e) => sum + e.salary, 0);
  return Math.round(total / employees.length);
}

// Returns employees sorted by joining date, most recent first,
// limited to the given count.
export function getRecentEmployees(employees: Employee[], count: number): Employee[] {
  const sorted = [...employees].sort(
    (a, b) => new Date(b.joiningDate).getTime() - new Date(a.joiningDate).getTime()
  );
  return sorted.slice(0, count);
}

// ------------------------------------------------------------
// CSV EXPORT
// ------------------------------------------------------------

// Builds a CSV string from a list of employees, suitable for
// downloading via a Blob link. Kept here since it's employee-data
// specific formatting logic.
export function employeesToCsv(employees: Employee[]): string {
  const headers = [
    "ID",
    "Full Name",
    "Email",
    "Phone",
    "Department",
    "Position",
    "Salary",
    "Address",
    "Joining Date",
    "Status",
  ];

  const escapeCsvValue = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const rows = employees.map((e) =>
    [
      String(e.id),
      e.fullName,
      e.email,
      e.phone,
      e.department,
      e.position,
      String(e.salary),
      e.address,
      e.joiningDate,
      e.status,
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

// ------------------------------------------------------------
// VALIDATION
// ------------------------------------------------------------

function validateFullName(value: string): ValidationResult {
  if (value.trim() === "") {
    return { isValid: false, errorMessage: "Full name is required." };
  }
  if (value.trim().length < 2) {
    return { isValid: false, errorMessage: "Full name must be at least 2 characters." };
  }
  return { isValid: true, errorMessage: "" };
}

function validateEmail(value: string, excludeId?: number): ValidationResult {
  if (value.trim() === "") {
    return { isValid: false, errorMessage: "Email is required." };
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(value.trim())) {
    return { isValid: false, errorMessage: "Please enter a valid email address." };
  }
  if (isEmailTaken(value, excludeId)) {
    return { isValid: false, errorMessage: "This email is already in use." };
  }
  return { isValid: true, errorMessage: "" };
}

function validatePhone(value: string): ValidationResult {
  if (value.trim() === "") {
    return { isValid: false, errorMessage: "Phone number is required." };
  }
  // Accepts digits, spaces, dashes, parentheses, and an optional leading +.
  // Requires at least 7 digits total, which covers most real phone formats.
  const digitsOnly = value.replace(/\D/g, "");
  const phonePattern = /^[+]?[\d\s()-]{7,20}$/;
  if (!phonePattern.test(value.trim()) || digitsOnly.length < 7) {
    return { isValid: false, errorMessage: "Please enter a valid phone number." };
  }
  return { isValid: true, errorMessage: "" };
}

function validateRequiredText(value: string, fieldLabel: string): ValidationResult {
  if (value.trim() === "") {
    return { isValid: false, errorMessage: `${fieldLabel} is required.` };
  }
  return { isValid: true, errorMessage: "" };
}

function validateSalary(value: string): ValidationResult {
  if (value.trim() === "") {
    return { isValid: false, errorMessage: "Salary is required." };
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return { isValid: false, errorMessage: "Salary must be a positive number." };
  }
  return { isValid: true, errorMessage: "" };
}

// Data shape used by the employee form before it has been validated
// and converted into a real Employee object (fields arrive as strings
// from HTML inputs). Password fields are only present/validated when
// creating a brand-new employee (see validateEmployeeForm below).
export interface EmployeeFormInput {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  salary: string;
  address: string;
  joiningDate: string;
  password: string;
  confirmPassword: string;
}

// Validates a full employee form and returns an object containing
// only the fields that failed validation. An empty object means
// the form is fully valid.
//
// "isNewEmployee" controls whether the password fields are validated:
// a brand-new employee needs login credentials created at the same
// time, but editing an existing employee never touches their password
// (that happens separately through the credentials modal).
export function validateEmployeeForm(
  input: EmployeeFormInput,
  isNewEmployee: boolean,
  excludeId?: number
): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};

  const fullNameResult = validateFullName(input.fullName);
  if (!fullNameResult.isValid) errors.fullName = fullNameResult.errorMessage;

  const emailResult = validateEmail(input.email, excludeId);
  if (!emailResult.isValid) errors.email = emailResult.errorMessage;

  const phoneResult = validatePhone(input.phone);
  if (!phoneResult.isValid) errors.phone = phoneResult.errorMessage;

  const departmentResult = validateRequiredText(input.department, "Department");
  if (!departmentResult.isValid) errors.department = departmentResult.errorMessage;

  const positionResult = validateRequiredText(input.position, "Position");
  if (!positionResult.isValid) errors.position = positionResult.errorMessage;

  const salaryResult = validateSalary(input.salary);
  if (!salaryResult.isValid) errors.salary = salaryResult.errorMessage;

  const addressResult = validateRequiredText(input.address, "Address");
  if (!addressResult.isValid) errors.address = addressResult.errorMessage;

  const joiningDateResult = validateRequiredText(input.joiningDate, "Joining date");
  if (!joiningDateResult.isValid) errors.joiningDate = joiningDateResult.errorMessage;

  if (isNewEmployee) {
    if (input.password.trim() === "") {
      errors.password = "Password is required.";
    } else if (input.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (input.confirmPassword.trim() === "") {
      errors.confirmPassword = "Please confirm the password.";
    } else if (input.password !== input.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  return errors;
}

// Small helper used by the Employee Dashboard, which only allows
// editing phone and address.
export function validatePhoneAndAddress(
  phone: string,
  address: string
): { phone?: string; address?: string } {
  const errors: { phone?: string; address?: string } = {};

  const phoneResult = validatePhone(phone);
  if (!phoneResult.isValid) errors.phone = phoneResult.errorMessage;

  const addressResult = validateRequiredText(address, "Address");
  if (!addressResult.isValid) errors.address = addressResult.errorMessage;

  return errors;
}
