// ============================================================
// admin.ts
// Logic for admin.html (the Admin Dashboard).
// The Admin has full CRUD access on employees, full control over
// login credentials (their own, HR's, and every employee's), and
// is the only role that can approve or reject password-change
// requests submitted by HR or Employee users.
// ============================================================

import { checkAccess, logout } from "./auth.js";
import { EmployeeFormErrors, EmployeeStatus, User } from "./types.js";
import {
  getAllEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  setEmployeeStatus,
  searchEmployees,
  filterEmployeesByDepartment,
  filterEmployeesByStatus,
  getUniqueDepartments,
  getTotalEmployees,
  getTotalDepartments,
  getAverageSalary,
  getRecentEmployees,
  sortEmployees,
  employeesToCsv,
  validateEmployeeForm,
  SortField,
  SortDirection,
  EmployeeFormInput,
} from "./employeeService.js";
import {
  getUserByEmployeeId,
  updateUserCredentials,
  createEmployeeUser,
  validateCredentialsForm,
  validatePasswordOnly,
  getPasswordStrength,
  getAllPasswordRequests,
  getPendingRequestCount,
  approvePasswordChangeRequest,
  rejectPasswordChangeRequest,
  logAction,
  getRecentAuditLog,
} from "./userService.js";
import { setCurrentUser, getUsers } from "./storage.js";
import {
  showToast,
  showConfirmModal,
  setFieldError,
  clearFieldErrors,
  formatCurrency,
  formatDate,
  formatDateTime,
  maskPassword,
  downloadTextFile,
  escapeHtml,
} from "./ui.js";

// Protect this page: only an "admin" may view it. If the check fails,
// checkAccess() redirects and throws, which stops the rest of this
// file from running.
const currentUser = checkAccess("admin");

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

let editingEmployeeId: number | null = null;
let currentSearchQuery = "";
let currentDepartmentFilter = "all";
let currentStatusFilter: EmployeeStatus | "all" = "all";
let currentSortField: SortField = "fullName";
let currentSortDirection: SortDirection = "asc";

const EMPLOYEE_FORM_FIELDS = [
  "fullName",
  "email",
  "phone",
  "department",
  "position",
  "salary",
  "address",
  "joiningDate",
  "password",
  "confirmPassword",
];

// ------------------------------------------------------------
// DOM REFERENCES
// ------------------------------------------------------------

const userNameEl = document.getElementById("current-user-name") as HTMLElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

const navLinks = document.querySelectorAll<HTMLElement>(".nav-link");
const views = document.querySelectorAll<HTMLElement>(".view-section");
const settingsBadge = document.getElementById("settings-badge") as HTMLElement;

const statTotalEmployees = document.getElementById("stat-total-employees") as HTMLElement;
const statTotalDepartments = document.getElementById("stat-total-departments") as HTMLElement;
const statRecentEmployees = document.getElementById("stat-recent-employees") as HTMLElement;
const statAverageSalary = document.getElementById("stat-average-salary") as HTMLElement;
const recentEmployeesList = document.getElementById("recent-employees-list") as HTMLElement;
const dashboardActivityList = document.getElementById("dashboard-activity-list") as HTMLElement;

const employeesTableBody = document.getElementById("employees-table-body") as HTMLElement;
const employeesEmptyState = document.getElementById("employees-empty-state") as HTMLElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const departmentFilterSelect = document.getElementById("department-filter") as HTMLSelectElement;
const statusFilterSelect = document.getElementById("status-filter") as HTMLSelectElement;
const exportCsvBtn = document.getElementById("export-csv-btn") as HTMLButtonElement;
const sortableHeaders = document.querySelectorAll<HTMLElement>("[data-sort-field]");

const employeeForm = document.getElementById("employee-form") as HTMLFormElement;
const formTitle = document.getElementById("form-title") as HTMLElement;
const submitBtn = document.getElementById("employee-submit-btn") as HTMLButtonElement;
const cancelEditBtn = document.getElementById("cancel-edit-btn") as HTMLButtonElement;
const credentialsFieldGroup = document.getElementById("credentials-field-group") as HTMLElement;
const passwordStrengthBar = document.getElementById("password-strength-bar") as HTMLElement;
const passwordStrengthLabel = document.getElementById("password-strength-label") as HTMLElement;

const departmentsListEl = document.getElementById("departments-list") as HTMLElement;

const auditLogList = document.getElementById("audit-log-list") as HTMLElement;

const detailsModalRoot = document.getElementById("details-modal-root") as HTMLElement;
const credentialsModalRoot = document.getElementById("credentials-modal-root") as HTMLElement;

// Settings view elements
const myEmailInput = document.getElementById("settings-my-email") as HTMLInputElement;
const myNewPasswordInput = document.getElementById("settings-my-password") as HTMLInputElement;
const myConfirmPasswordInput = document.getElementById("settings-my-confirm-password") as HTMLInputElement;
const myCredentialsForm = document.getElementById("my-credentials-form") as HTMLFormElement;
const hrAccountsList = document.getElementById("hr-accounts-list") as HTMLElement;
const pendingRequestsList = document.getElementById("pending-requests-list") as HTMLElement;
const requestHistoryList = document.getElementById("request-history-list") as HTMLElement;

// Mobile sidebar toggle
const sidebarToggleBtn = document.getElementById("sidebar-toggle") as HTMLButtonElement | null;
const sidebarEl = document.getElementById("sidebar") as HTMLElement | null;

// ------------------------------------------------------------
// INITIAL PAGE SETUP
// ------------------------------------------------------------

userNameEl.textContent = currentUser.name;

logoutBtn.addEventListener("click", () => {
  logout();
});

sidebarToggleBtn?.addEventListener("click", () => {
  sidebarEl?.classList.toggle("sidebar-open");
});

function refreshNotificationBadge(): void {
  const count = getPendingRequestCount();
  if (count > 0) {
    settingsBadge.textContent = String(count);
    settingsBadge.classList.remove("hidden");
  } else {
    settingsBadge.classList.add("hidden");
  }
}

// ------------------------------------------------------------
// NAVIGATION BETWEEN VIEWS
// ------------------------------------------------------------

function showView(viewName: string): void {
  views.forEach((view) => {
    if (view.dataset.view === viewName) {
      view.classList.add("view-active");
    } else {
      view.classList.remove("view-active");
    }
  });

  navLinks.forEach((link) => {
    if (link.dataset.view === viewName) {
      link.classList.add("nav-active");
    } else {
      link.classList.remove("nav-active");
    }
  });

  sidebarEl?.classList.remove("sidebar-open");

  if (viewName === "dashboard") {
    renderDashboard();
  } else if (viewName === "employees") {
    renderEmployeeTable();
  } else if (viewName === "departments") {
    renderDepartments();
  } else if (viewName === "settings") {
    renderSettings();
  } else if (viewName === "activity") {
    renderActivityLog();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const viewName = link.dataset.view;
    if (!viewName) return;

    // Only reset the Add/Edit form when navigating in fresh via the
    // sidebar. startEditingEmployee() fills the form THEN calls
    // showView() directly (bypassing this click handler), so its
    // data is never wiped out. This is the fix for the bug where
    // clicking "Edit" used to clear the form.
    if (viewName === "add-employee") {
      resetForm();
    }

    showView(viewName);
  });
});

// ------------------------------------------------------------
// DASHBOARD VIEW
// ------------------------------------------------------------

function renderDashboard(): void {
  const employees = getAllEmployees();

  statTotalEmployees.textContent = String(getTotalEmployees(employees));
  statTotalDepartments.textContent = String(getTotalDepartments(employees));
  statAverageSalary.textContent = formatCurrency(getAverageSalary(employees));

  const recent = getRecentEmployees(employees, 5);
  statRecentEmployees.textContent = String(recent.length);

  if (recent.length === 0) {
    recentEmployeesList.innerHTML = `<p class="empty-text">No employees yet. Add your first employee to get started.</p>`;
  } else {
    recentEmployeesList.innerHTML = recent
      .map(
        (emp) => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${escapeHtml(emp.fullName)}</strong>
            <span>${escapeHtml(emp.position)} &middot; ${escapeHtml(emp.department)}</span>
          </div>
          <span class="recent-item-date">${formatDate(emp.joiningDate)}</span>
        </div>
      `
      )
      .join("");
  }

  const recentActivity = getRecentAuditLog(5);
  if (recentActivity.length === 0) {
    dashboardActivityList.innerHTML = `<p class="empty-text">No activity recorded yet.</p>`;
  } else {
    dashboardActivityList.innerHTML = recentActivity
      .map(
        (entry) => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${escapeHtml(entry.action)}</strong>
            <span>${escapeHtml(entry.details)}</span>
          </div>
          <span class="recent-item-date">${formatDateTime(entry.timestamp)}</span>
        </div>
      `
      )
      .join("");
  }

  refreshNotificationBadge();
}

// ------------------------------------------------------------
// EMPLOYEES TABLE VIEW (Read, Search, Filter, Sort, CRUD, Credentials)
// ------------------------------------------------------------

function populateDepartmentFilterOptions(): void {
  const employees = getAllEmployees();
  const departments = getUniqueDepartments(employees);

  const currentValue = departmentFilterSelect.value;
  departmentFilterSelect.innerHTML =
    `<option value="all">All Departments</option>` +
    departments.map((dept) => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`).join("");

  if (departments.includes(currentValue)) {
    departmentFilterSelect.value = currentValue;
  }
}

function updateSortIndicators(): void {
  sortableHeaders.forEach((header) => {
    const field = header.dataset.sortField;
    header.classList.remove("sort-asc", "sort-desc");
    if (field === currentSortField) {
      header.classList.add(currentSortDirection === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

function renderEmployeeTable(): void {
  populateDepartmentFilterOptions();
  updateSortIndicators();

  let employees = getAllEmployees();
  employees = searchEmployees(employees, currentSearchQuery);
  employees = filterEmployeesByDepartment(employees, currentDepartmentFilter);
  employees = filterEmployeesByStatus(employees, currentStatusFilter);
  employees = sortEmployees(employees, currentSortField, currentSortDirection);

  if (employees.length === 0) {
    employeesTableBody.innerHTML = "";
    employeesEmptyState.classList.remove("hidden");
    return;
  }

  employeesEmptyState.classList.add("hidden");

  employeesTableBody.innerHTML = employees
    .map((emp) => {
      const hasAccount = getUserByEmployeeId(emp.id) !== undefined;
      const statusBadge =
        emp.status === "active"
          ? `<span class="status-badge status-active">Active</span>`
          : `<span class="status-badge status-inactive">Inactive</span>`;
      const credentialsBtn = hasAccount
        ? `<button class="icon-btn" data-action="credentials" data-id="${emp.id}" title="View/manage login credentials">Credentials</button>`
        : `<button class="icon-btn icon-btn-accent" data-action="assign" data-id="${emp.id}" title="Assign login credentials">Assign Login</button>`;

      return `
      <tr>
        <td data-label="ID">${emp.id}</td>
        <td data-label="Name">${escapeHtml(emp.fullName)}</td>
        <td data-label="Email">${escapeHtml(emp.email)}</td>
        <td data-label="Department">${escapeHtml(emp.department)}</td>
        <td data-label="Position">${escapeHtml(emp.position)}</td>
        <td data-label="Salary">${formatCurrency(emp.salary)}</td>
        <td data-label="Joined">${formatDate(emp.joiningDate)}</td>
        <td data-label="Status">${statusBadge}</td>
        <td data-label="Actions" class="actions-cell">
          <button class="icon-btn" data-action="view" data-id="${emp.id}" title="View details">View</button>
          <button class="icon-btn" data-action="edit" data-id="${emp.id}" title="Edit employee">Edit</button>
          ${credentialsBtn}
          <button class="icon-btn" data-action="toggle-status" data-id="${emp.id}" title="Toggle active status">${emp.status === "active" ? "Deactivate" : "Activate"}</button>
          <button class="icon-btn icon-btn-danger" data-action="delete" data-id="${emp.id}" title="Delete employee">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

searchInput.addEventListener("input", () => {
  currentSearchQuery = searchInput.value;
  renderEmployeeTable();
});

departmentFilterSelect.addEventListener("change", () => {
  currentDepartmentFilter = departmentFilterSelect.value;
  renderEmployeeTable();
});

statusFilterSelect.addEventListener("change", () => {
  currentStatusFilter = statusFilterSelect.value as EmployeeStatus | "all";
  renderEmployeeTable();
});

sortableHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const field = header.dataset.sortField as SortField;
    if (currentSortField === field) {
      currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
      currentSortField = field;
      currentSortDirection = "asc";
    }
    renderEmployeeTable();
  });
});

exportCsvBtn.addEventListener("click", () => {
  const employees = getAllEmployees();
  if (employees.length === 0) {
    showToast("There are no employees to export yet.", "info");
    return;
  }
  const csv = employeesToCsv(employees);
  downloadTextFile("employees.csv", csv, "text/csv");
  showToast("Employee list exported as CSV.", "success");
  logAction(currentUser.name, currentUser.role, "Exported Employees", "Downloaded full employee list as CSV.");
});

// Event delegation: one listener handles every row action button.
employeesTableBody.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;
  const idAttr = target.dataset.id;

  if (!action || !idAttr) {
    return;
  }

  const id = Number(idAttr);

  if (action === "view") {
    openDetailsModal(id);
  } else if (action === "edit") {
    startEditingEmployee(id);
  } else if (action === "delete") {
    confirmDeleteEmployee(id);
  } else if (action === "credentials") {
    openManageCredentialsModal(id);
  } else if (action === "assign") {
    openAssignCredentialsModal(id);
  } else if (action === "toggle-status") {
    toggleStatus(id);
  }
});

function toggleStatus(id: number): void {
  const employee = getAllEmployees().find((e) => e.id === id);
  if (!employee) return;

  const newStatus: EmployeeStatus = employee.status === "active" ? "inactive" : "active";
  setEmployeeStatus(id, newStatus);
  logAction(
    currentUser.name,
    currentUser.role,
    "Employee Status Changed",
    `${employee.fullName} marked as ${newStatus}.`
  );
  showToast(`${employee.fullName} is now ${newStatus}.`, "success");
  renderEmployeeTable();
}

// ------------------------------------------------------------
// VIEW EMPLOYEE DETAILS MODAL
// ------------------------------------------------------------

function openDetailsModal(id: number): void {
  const employees = getAllEmployees();
  const employee = employees.find((e) => e.id === id);
  if (!employee) return;

  detailsModalRoot.innerHTML = `
    <div class="modal-overlay" id="details-overlay">
      <div class="modal-box modal-box-wide">
        <h3 class="modal-title">Employee Details</h3>
        <div class="details-grid">
          <div><span class="details-label">Employee ID</span><span>${employee.id}</span></div>
          <div><span class="details-label">Full Name</span><span>${escapeHtml(employee.fullName)}</span></div>
          <div><span class="details-label">Email</span><span>${escapeHtml(employee.email)}</span></div>
          <div><span class="details-label">Phone</span><span>${escapeHtml(employee.phone)}</span></div>
          <div><span class="details-label">Department</span><span>${escapeHtml(employee.department)}</span></div>
          <div><span class="details-label">Position</span><span>${escapeHtml(employee.position)}</span></div>
          <div><span class="details-label">Salary</span><span>${formatCurrency(employee.salary)}</span></div>
          <div><span class="details-label">Joining Date</span><span>${formatDate(employee.joiningDate)}</span></div>
          <div><span class="details-label">Status</span><span>${employee.status === "active" ? "Active" : "Inactive"}</span></div>
          <div class="details-full"><span class="details-label">Address</span><span>${escapeHtml(employee.address)}</span></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="details-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("details-overlay");
  const closeBtn = document.getElementById("details-close-btn");

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) detailsModalRoot.innerHTML = "";
  });
  closeBtn?.addEventListener("click", () => {
    detailsModalRoot.innerHTML = "";
  });
}

// ------------------------------------------------------------
// CREDENTIALS: VIEW/MANAGE (existing account) & ASSIGN (new account)
// ------------------------------------------------------------

function renderPasswordStrengthMeter(password: string, barEl: HTMLElement, labelEl: HTMLElement): void {
  if (password.length === 0) {
    barEl.style.width = "0%";
    barEl.className = "password-strength-fill";
    labelEl.textContent = "";
    return;
  }
  const strength = getPasswordStrength(password);
  barEl.className = `password-strength-fill strength-${strength}`;
  if (strength === "weak") {
    barEl.style.width = "33%";
    labelEl.textContent = "Weak password";
  } else if (strength === "medium") {
    barEl.style.width = "66%";
    labelEl.textContent = "Medium strength";
  } else {
    barEl.style.width = "100%";
    labelEl.textContent = "Strong password";
  }
}

// Admin can VIEW and DIRECTLY EDIT an employee's login credentials.
function openManageCredentialsModal(employeeId: number): void {
  const employee = getAllEmployees().find((e) => e.id === employeeId);
  const user = getUserByEmployeeId(employeeId);
  if (!employee || !user) return;

  credentialsModalRoot.innerHTML = `
    <div class="modal-overlay" id="credentials-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Manage Login Credentials</h3>
        <p class="modal-subtext">${escapeHtml(employee.fullName)}'s login account. As Admin, you can view and directly edit these.</p>
        <form id="credentials-form" novalidate>
          <div class="form-group">
            <label for="cred-email">Login Email</label>
            <input type="text" id="cred-email" value="${escapeHtml(user.email)}" />
            <div class="field-error" id="cred-email-error"></div>
          </div>
          <div class="form-group">
            <label for="cred-password">Current Password</label>
            <div class="input-with-action">
              <input type="password" id="cred-password" value="${escapeHtml(user.password)}" />
              <button type="button" class="input-action-btn" id="cred-password-toggle">Show</button>
            </div>
            <div class="field-error" id="cred-password-error"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="credentials-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Credentials</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("credentials-overlay");
  const cancelBtn = document.getElementById("credentials-cancel-btn");
  const form = document.getElementById("credentials-form") as HTMLFormElement;
  const emailInput = document.getElementById("cred-email") as HTMLInputElement;
  const passwordInput = document.getElementById("cred-password") as HTMLInputElement;
  const toggleBtn = document.getElementById("cred-password-toggle") as HTMLButtonElement;

  const close = () => {
    credentialsModalRoot.innerHTML = "";
  };

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  cancelBtn?.addEventListener("click", close);

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "Hide" : "Show";
  });

  emailInput.addEventListener("input", () => setFieldError("cred-email", ""));
  passwordInput.addEventListener("input", () => setFieldError("cred-password", ""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors(["cred-email", "cred-password"]);

    const newEmail = emailInput.value.trim();
    const newPassword = passwordInput.value;
    let hasError = false;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newEmail === "") {
      setFieldError("cred-email", "Email is required.");
      hasError = true;
    } else if (!emailPattern.test(newEmail)) {
      setFieldError("cred-email", "Please enter a valid email address.");
      hasError = true;
    }

    if (newPassword.trim() === "") {
      setFieldError("cred-password", "Password is required.");
      hasError = true;
    } else if (newPassword.length < 6) {
      setFieldError("cred-password", "Password must be at least 6 characters.");
      hasError = true;
    }

    if (hasError) return;

    updateUserCredentials(user.id, { email: newEmail, password: newPassword });
    logAction(
      currentUser.name,
      currentUser.role,
      "Credentials Updated",
      `Updated login credentials for ${employee.fullName}.`
    );
    showToast("Credentials updated successfully.", "success");
    close();
    renderEmployeeTable();
  });
}

// Admin assigns a brand-new login account to an employee who
// doesn't have one yet (e.g. an employee added before this feature,
// or one who declined credentials at creation time).
function openAssignCredentialsModal(employeeId: number): void {
  const employee = getAllEmployees().find((e) => e.id === employeeId);
  if (!employee) return;

  credentialsModalRoot.innerHTML = `
    <div class="modal-overlay" id="credentials-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Assign Login Credentials</h3>
        <p class="modal-subtext">Create a login account for <strong>${escapeHtml(employee.fullName)}</strong> so they can access the Employee Portal.</p>
        <form id="assign-credentials-form" novalidate>
          <div class="form-group">
            <label for="assign-email">Login Email</label>
            <input type="text" id="assign-email" value="${escapeHtml(employee.email)}" />
            <div class="field-error" id="assign-email-error"></div>
          </div>
          <div class="form-group">
            <label for="assign-password">Password</label>
            <input type="text" id="assign-password" placeholder="At least 6 characters" />
            <div class="password-strength-track"><div class="password-strength-fill" id="assign-strength-bar"></div></div>
            <div class="password-strength-label" id="assign-strength-label"></div>
            <div class="field-error" id="assign-password-error"></div>
          </div>
          <div class="form-group">
            <label for="assign-confirm-password">Confirm Password</label>
            <input type="text" id="assign-confirm-password" placeholder="Re-enter password" />
            <div class="field-error" id="assign-confirm-password-error"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="assign-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Login</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("credentials-overlay");
  const cancelBtn = document.getElementById("assign-cancel-btn");
  const form = document.getElementById("assign-credentials-form") as HTMLFormElement;
  const emailInput = document.getElementById("assign-email") as HTMLInputElement;
  const passwordInput = document.getElementById("assign-password") as HTMLInputElement;
  const confirmInput = document.getElementById("assign-confirm-password") as HTMLInputElement;
  const strengthBar = document.getElementById("assign-strength-bar") as HTMLElement;
  const strengthLabel = document.getElementById("assign-strength-label") as HTMLElement;

  const close = () => {
    credentialsModalRoot.innerHTML = "";
  };

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  cancelBtn?.addEventListener("click", close);

  emailInput.addEventListener("input", () => setFieldError("assign-email", ""));
  passwordInput.addEventListener("input", () => {
    setFieldError("assign-password", "");
    renderPasswordStrengthMeter(passwordInput.value, strengthBar, strengthLabel);
  });
  confirmInput.addEventListener("input", () => setFieldError("assign-confirm-password", ""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors(["assign-email", "assign-password", "assign-confirm-password"]);

    const errors = validateCredentialsForm(
      emailInput.value,
      passwordInput.value,
      confirmInput.value,
      undefined
    );

    if (errors.email) setFieldError("assign-email", errors.email);
    if (errors.password) setFieldError("assign-password", errors.password);
    if (errors.confirmPassword) setFieldError("assign-confirm-password", errors.confirmPassword);

    if (errors.email || errors.password || errors.confirmPassword) return;

    // If the admin changed the email from the employee's existing
    // record, keep the employee record in sync too.
    if (emailInput.value.trim() !== employee.email) {
      updateEmployee(employee.id, { email: emailInput.value.trim() });
    }

    const updatedEmployee = { ...employee, email: emailInput.value.trim() };
    createEmployeeUser(updatedEmployee, passwordInput.value);

    logAction(
      currentUser.name,
      currentUser.role,
      "Login Assigned",
      `Assigned login credentials to ${employee.fullName}.`
    );
    showToast(`Login credentials created for ${employee.fullName}.`, "success");
    close();
    renderEmployeeTable();
  });
}

// ------------------------------------------------------------
// ADD / EDIT EMPLOYEE FORM
// ------------------------------------------------------------

function resetForm(): void {
  editingEmployeeId = null;
  employeeForm.reset();
  clearFieldErrors(EMPLOYEE_FORM_FIELDS);
  formTitle.textContent = "Add New Employee";
  submitBtn.textContent = "Add Employee";
  cancelEditBtn.classList.add("hidden");
  // Credentials are only set when creating a brand-new employee;
  // editing uses the separate Credentials modal instead.
  credentialsFieldGroup.classList.remove("hidden");
  passwordStrengthBar.style.width = "0%";
  passwordStrengthBar.className = "password-strength-fill";
  passwordStrengthLabel.textContent = "";
}

function startEditingEmployee(id: number): void {
  const employee = getAllEmployees().find((e) => e.id === id);
  if (!employee) return;

  editingEmployeeId = id;

  (document.getElementById("fullName") as HTMLInputElement).value = employee.fullName;
  (document.getElementById("email") as HTMLInputElement).value = employee.email;
  (document.getElementById("phone") as HTMLInputElement).value = employee.phone;
  (document.getElementById("department") as HTMLInputElement).value = employee.department;
  (document.getElementById("position") as HTMLInputElement).value = employee.position;
  (document.getElementById("salary") as HTMLInputElement).value = String(employee.salary);
  (document.getElementById("address") as HTMLTextAreaElement).value = employee.address;
  (document.getElementById("joiningDate") as HTMLInputElement).value = employee.joiningDate;

  clearFieldErrors(EMPLOYEE_FORM_FIELDS);
  formTitle.textContent = "Edit Employee";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  credentialsFieldGroup.classList.add("hidden");

  // This calls showView() directly, NOT through the sidebar nav click
  // handler, so the "always reset when navigating to add-employee"
  // logic never fires and the values we just set are preserved.
  showView("add-employee");
}

cancelEditBtn.addEventListener("click", () => {
  resetForm();
  showView("employees");
});

EMPLOYEE_FORM_FIELDS.forEach((fieldName) => {
  const el = document.getElementById(fieldName);
  el?.addEventListener("input", () => {
    setFieldError(fieldName, "");
    if (fieldName === "password") {
      const value = (el as HTMLInputElement).value;
      renderPasswordStrengthMeter(value, passwordStrengthBar, passwordStrengthLabel);
    }
  });
});

employeeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const isNewEmployee = editingEmployeeId === null;

  const formInput: EmployeeFormInput = {
    fullName: (document.getElementById("fullName") as HTMLInputElement).value,
    email: (document.getElementById("email") as HTMLInputElement).value,
    phone: (document.getElementById("phone") as HTMLInputElement).value,
    department: (document.getElementById("department") as HTMLInputElement).value,
    position: (document.getElementById("position") as HTMLInputElement).value,
    salary: (document.getElementById("salary") as HTMLInputElement).value,
    address: (document.getElementById("address") as HTMLTextAreaElement).value,
    joiningDate: (document.getElementById("joiningDate") as HTMLInputElement).value,
    password: (document.getElementById("password") as HTMLInputElement).value,
    confirmPassword: (document.getElementById("confirmPassword") as HTMLInputElement).value,
  };

  const errors: EmployeeFormErrors = validateEmployeeForm(
    formInput,
    isNewEmployee,
    editingEmployeeId ?? undefined
  );

  clearFieldErrors(EMPLOYEE_FORM_FIELDS);

  const errorKeys = Object.keys(errors) as (keyof EmployeeFormErrors)[];
  if (errorKeys.length > 0) {
    errorKeys.forEach((key) => {
      const message = errors[key];
      if (message) setFieldError(key, message);
    });
    return;
  }

  const employeeData = {
    fullName: formInput.fullName.trim(),
    email: formInput.email.trim(),
    phone: formInput.phone.trim(),
    department: formInput.department.trim(),
    position: formInput.position.trim(),
    salary: Number(formInput.salary),
    address: formInput.address.trim(),
    joiningDate: formInput.joiningDate,
    status: "active" as const,
  };

  if (isNewEmployee) {
    const newEmployee = addEmployee(employeeData);
    createEmployeeUser(newEmployee, formInput.password);
    logAction(
      currentUser.name,
      currentUser.role,
      "Employee Added",
      `Added ${newEmployee.fullName} (${newEmployee.department}) with login access.`
    );
    showToast(`Employee added. They can log in with ${employeeData.email}.`, "success");
  } else if (editingEmployeeId !== null) {
    updateEmployee(editingEmployeeId, employeeData);
    logAction(
      currentUser.name,
      currentUser.role,
      "Employee Updated",
      `Updated details for ${employeeData.fullName}.`
    );
    showToast("Employee updated successfully.", "success");
  }

  resetForm();
  showView("employees");
});

// ------------------------------------------------------------
// DELETE EMPLOYEE (with confirmation modal)
// ------------------------------------------------------------

function confirmDeleteEmployee(id: number): void {
  const employee = getAllEmployees().find((e) => e.id === id);
  if (!employee) return;

  showConfirmModal(
    `Are you sure you want to delete <strong>${escapeHtml(employee.fullName)}</strong>? This action cannot be undone and will also remove their login access.`,
    () => {
      deleteEmployee(id);
      logAction(currentUser.name, currentUser.role, "Employee Deleted", `Deleted ${employee.fullName}.`);
      showToast("Employee deleted successfully.", "success");
      renderEmployeeTable();
      renderDashboard();
    }
  );
}

// ------------------------------------------------------------
// DEPARTMENTS VIEW
// ------------------------------------------------------------

function renderDepartments(): void {
  const employees = getAllEmployees();
  const departments = getUniqueDepartments(employees);

  if (departments.length === 0) {
    departmentsListEl.innerHTML = `<p class="empty-text">No departments yet.</p>`;
    return;
  }

  departmentsListEl.innerHTML = departments
    .map((dept) => {
      const deptEmployees = employees.filter((e) => e.department === dept);
      const avgSalary = Math.round(
        deptEmployees.reduce((sum, e) => sum + e.salary, 0) / deptEmployees.length
      );
      return `
        <div class="department-card">
          <h3>${escapeHtml(dept)}</h3>
          <p>${deptEmployees.length} employee${deptEmployees.length === 1 ? "" : "s"}</p>
          <p class="department-avg">Avg. salary: ${formatCurrency(avgSalary)}</p>
        </div>
      `;
    })
    .join("");
}

// ------------------------------------------------------------
// ACTIVITY LOG VIEW
// ------------------------------------------------------------

function renderActivityLog(): void {
  const entries = getRecentAuditLog(100);

  if (entries.length === 0) {
    auditLogList.innerHTML = `<p class="empty-text">No activity recorded yet.</p>`;
    return;
  }

  auditLogList.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Role</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (entry) => `
            <tr>
              <td data-label="When">${formatDateTime(entry.timestamp)}</td>
              <td data-label="Actor">${escapeHtml(entry.actorName)}</td>
              <td data-label="Role">${escapeHtml(entry.actorRole)}</td>
              <td data-label="Action">${escapeHtml(entry.action)}</td>
              <td data-label="Details">${escapeHtml(entry.details)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ------------------------------------------------------------
// SETTINGS VIEW: My Credentials, HR Accounts, Password Requests
// ------------------------------------------------------------

function renderSettings(): void {
  refreshNotificationBadge();

  // --- My Credentials ---
  myEmailInput.value = currentUser.email;
  myNewPasswordInput.value = "";
  myConfirmPasswordInput.value = "";
  clearFieldErrors(["settings-my-email", "settings-my-password", "settings-my-confirm-password"]);

  // --- HR Accounts ---
  const hrUsers = getUsers().filter((u: User) => u.role === "hr");
  if (hrUsers.length === 0) {
    hrAccountsList.innerHTML = `<p class="empty-text">No HR accounts exist yet.</p>`;
  } else {
    hrAccountsList.innerHTML = hrUsers
      .map(
        (u) => `
        <div class="account-row">
          <div class="account-row-info">
            <strong>${escapeHtml(u.name)}</strong>
            <span>${escapeHtml(u.email)}</span>
          </div>
          <button class="btn btn-secondary btn-sm" data-hr-edit="${u.id}">Edit Credentials</button>
        </div>
      `
      )
      .join("");
  }

  // --- Pending Password Requests ---
  const requests = getAllPasswordRequests();
  const pending = requests.filter((r) => r.status === "pending");
  const history = requests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => new Date(b.reviewedAt ?? "").getTime() - new Date(a.reviewedAt ?? "").getTime())
    .slice(0, 10);

  if (pending.length === 0) {
    pendingRequestsList.innerHTML = `<p class="empty-text">No pending password change requests.</p>`;
  } else {
    pendingRequestsList.innerHTML = pending
      .map(
        (req) => `
        <div class="request-card">
          <div class="request-card-info">
            <strong>${escapeHtml(req.requesterName)}</strong>
            <span>${escapeHtml(req.requesterRole.toUpperCase())} &middot; ${escapeHtml(req.requestedEmail)}</span>
            <span class="request-card-meta">Requested ${formatDateTime(req.requestedAt)}</span>
          </div>
          <div class="request-card-password">
            <span class="masked-password" data-request-password="${req.id}">${maskPassword(req.newPassword)}</span>
            <button class="input-action-btn" data-reveal-request="${req.id}" data-value="${escapeHtml(req.newPassword)}">Show</button>
          </div>
          <div class="request-card-actions">
            <button class="btn btn-secondary btn-sm" data-reject-request="${req.id}">Reject</button>
            <button class="btn btn-primary btn-sm" data-approve-request="${req.id}">Approve</button>
          </div>
        </div>
      `
      )
      .join("");
  }

  if (history.length === 0) {
    requestHistoryList.innerHTML = `<p class="empty-text">No reviewed requests yet.</p>`;
  } else {
    requestHistoryList.innerHTML = history
      .map(
        (req) => `
        <div class="recent-item">
          <div class="recent-item-info">
            <strong>${escapeHtml(req.requesterName)}</strong>
            <span>${req.status === "approved" ? "Approved" : "Rejected"} by ${escapeHtml(req.reviewedBy ?? "-")}</span>
          </div>
          <span class="recent-item-date">${req.reviewedAt ? formatDateTime(req.reviewedAt) : "-"}</span>
        </div>
      `
      )
      .join("");
  }
}

myCredentialsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(["settings-my-email", "settings-my-password", "settings-my-confirm-password"]);

  const newEmail = myEmailInput.value.trim();
  const newPassword = myNewPasswordInput.value;
  const confirmPassword = myConfirmPasswordInput.value;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let hasError = false;

  if (newEmail === "") {
    setFieldError("settings-my-email", "Email is required.");
    hasError = true;
  } else if (!emailPattern.test(newEmail)) {
    setFieldError("settings-my-email", "Please enter a valid email address.");
    hasError = true;
  }

  // Password fields are optional here - leave blank to keep the
  // current password unchanged, but if provided they must match.
  if (newPassword !== "" || confirmPassword !== "") {
    const result = validatePasswordOnly(newPassword, confirmPassword);
    if (result.password) {
      setFieldError("settings-my-password", result.password);
      hasError = true;
    }
    if (result.confirmPassword) {
      setFieldError("settings-my-confirm-password", result.confirmPassword);
      hasError = true;
    }
  }

  if (hasError) return;

  const updates: { email?: string; password?: string } = { email: newEmail };
  if (newPassword !== "") {
    updates.password = newPassword;
  }

  const updatedUser = updateUserCredentials(currentUser.id, updates);
  if (updatedUser) {
    // Refresh the in-memory session object and localStorage so the
    // header and every future checkAccess() call see the new email.
    currentUser.email = updatedUser.email;
    currentUser.password = updatedUser.password;
    setCurrentUser(updatedUser);
  }

  logAction(currentUser.name, currentUser.role, "Admin Credentials Updated", "Admin updated their own login credentials.");
  showToast("Your credentials have been updated.", "success");
  myNewPasswordInput.value = "";
  myConfirmPasswordInput.value = "";
});

// HR account edit (event delegation)
hrAccountsList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const hrId = target.dataset.hrEdit;
  if (!hrId) return;
  openEditHrModal(Number(hrId));
});

function openEditHrModal(userId: number): void {
  const hrUser = getUsers().find((u: User) => u.id === userId);
  if (!hrUser) return;

  credentialsModalRoot.innerHTML = `
    <div class="modal-overlay" id="hr-edit-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Edit HR Credentials</h3>
        <p class="modal-subtext">Update login details for <strong>${escapeHtml(hrUser.name)}</strong>.</p>
        <form id="hr-edit-form" novalidate>
          <div class="form-group">
            <label for="hr-edit-email">Email</label>
            <input type="text" id="hr-edit-email" value="${escapeHtml(hrUser.email)}" />
            <div class="field-error" id="hr-edit-email-error"></div>
          </div>
          <div class="form-group">
            <label for="hr-edit-password">Password</label>
            <div class="input-with-action">
              <input type="password" id="hr-edit-password" value="${escapeHtml(hrUser.password)}" />
              <button type="button" class="input-action-btn" id="hr-edit-password-toggle">Show</button>
            </div>
            <div class="field-error" id="hr-edit-password-error"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="hr-edit-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("hr-edit-overlay");
  const cancelBtn = document.getElementById("hr-edit-cancel-btn");
  const form = document.getElementById("hr-edit-form") as HTMLFormElement;
  const emailInput = document.getElementById("hr-edit-email") as HTMLInputElement;
  const passwordInput = document.getElementById("hr-edit-password") as HTMLInputElement;
  const toggleBtn = document.getElementById("hr-edit-password-toggle") as HTMLButtonElement;

  const close = () => {
    credentialsModalRoot.innerHTML = "";
  };

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  cancelBtn?.addEventListener("click", close);
  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "Hide" : "Show";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors(["hr-edit-email", "hr-edit-password"]);

    const newEmail = emailInput.value.trim();
    const newPassword = passwordInput.value;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (newEmail === "") {
      setFieldError("hr-edit-email", "Email is required.");
      hasError = true;
    } else if (!emailPattern.test(newEmail)) {
      setFieldError("hr-edit-email", "Please enter a valid email address.");
      hasError = true;
    }
    if (newPassword.trim() === "") {
      setFieldError("hr-edit-password", "Password is required.");
      hasError = true;
    } else if (newPassword.length < 6) {
      setFieldError("hr-edit-password", "Password must be at least 6 characters.");
      hasError = true;
    }

    if (hasError) return;

    updateUserCredentials(hrUser.id, { email: newEmail, password: newPassword });
    logAction(currentUser.name, currentUser.role, "HR Credentials Updated", `Updated login credentials for ${hrUser.name}.`);
    showToast("HR credentials updated.", "success");
    close();
    renderSettings();
  });
}

// Pending requests: reveal password, approve, reject (event delegation)
pendingRequestsList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const revealId = target.dataset.revealRequest;
  if (revealId) {
    const span = document.querySelector(`[data-request-password="${revealId}"]`) as HTMLElement;
    const actualValue = target.dataset.value ?? "";
    const isMasked = span.textContent === maskPassword(actualValue);
    span.textContent = isMasked ? actualValue : maskPassword(actualValue);
    target.textContent = isMasked ? "Hide" : "Show";
    return;
  }

  const approveId = target.dataset.approveRequest;
  if (approveId) {
    approvePasswordChangeRequest(Number(approveId), currentUser.name);
    logAction(currentUser.name, currentUser.role, "Password Request Approved", `Approved a password change request (#${approveId}).`);
    showToast("Password change approved and applied.", "success");
    renderSettings();
    return;
  }

  const rejectId = target.dataset.rejectRequest;
  if (rejectId) {
    rejectPasswordChangeRequest(Number(rejectId), currentUser.name);
    logAction(currentUser.name, currentUser.role, "Password Request Rejected", `Rejected a password change request (#${rejectId}).`);
    showToast("Password change request rejected.", "info");
    renderSettings();
  }
});

// ------------------------------------------------------------
// INITIAL RENDER
// ------------------------------------------------------------

showView("dashboard");
