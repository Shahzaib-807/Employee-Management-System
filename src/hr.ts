// ============================================================
// hr.ts
// Logic for hr.html (the HR Dashboard).
// HR can Create, Read, and Update employees, and can VIEW (but
// never directly edit) login credentials. HR cannot delete
// employees. Note that `deleteEmployee` and `updateUserCredentials`
// are never even imported in this file - the restriction is
// enforced by what code exists here, not just by hidden buttons.
// HR manages their OWN password the same way an Employee does: by
// submitting a request that an Admin must approve.
// ============================================================

import { checkAccess, logout } from "./auth.js";
import { EmployeeFormErrors, EmployeeStatus } from "./types.js";
import {
  getAllEmployees,
  addEmployee,
  updateEmployee,
  searchEmployees,
  filterEmployeesByDepartment,
  filterEmployeesByStatus,
  getUniqueDepartments,
  getTotalEmployees,
  getTotalDepartments,
  getAverageSalary,
  sortEmployees,
  employeesToCsv,
  validateEmployeeForm,
  SortField,
  SortDirection,
  EmployeeFormInput,
} from "./employeeService.js";
import {
  getUserByEmployeeId,
  createEmployeeUser,
  validateCredentialsForm,
  getPasswordStrength,
  submitPasswordChangeRequest,
  getPendingRequestForUser,
} from "./userService.js";
import {
  showToast,
  setFieldError,
  clearFieldErrors,
  formatCurrency,
  formatDate,
  formatDateTime,
  maskPassword,
  downloadTextFile,
  escapeHtml,
} from "./ui.js";

// Protect this page: only an "hr" user may view it.
const currentUser = checkAccess("hr");

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

const statTotalEmployees = document.getElementById("stat-total-employees") as HTMLElement;
const statTotalDepartments = document.getElementById("stat-total-departments") as HTMLElement;
const statNewEmployees = document.getElementById("stat-new-employees") as HTMLElement;
const statAverageSalary = document.getElementById("stat-average-salary") as HTMLElement;

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

const reportsContainer = document.getElementById("reports-container") as HTMLElement;
const detailsModalRoot = document.getElementById("details-modal-root") as HTMLElement;
const credentialsModalRoot = document.getElementById("credentials-modal-root") as HTMLElement;

// My Account view elements
const myAccountEmail = document.getElementById("my-account-email") as HTMLElement;
const myAccountPassword = document.getElementById("my-account-password") as HTMLElement;
const myAccountRevealBtn = document.getElementById("my-account-reveal-btn") as HTMLButtonElement;
const myAccountPendingBanner = document.getElementById("my-account-pending-banner") as HTMLElement;
const requestPasswordBtn = document.getElementById("request-password-btn") as HTMLButtonElement;
const requestPasswordModalRoot = document.getElementById("request-password-modal-root") as HTMLElement;

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

// ------------------------------------------------------------
// NAVIGATION
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
  } else if (viewName === "directory") {
    renderEmployeeTable();
  } else if (viewName === "departments") {
    renderDepartmentsView();
  } else if (viewName === "reports") {
    renderReports();
  } else if (viewName === "my-account") {
    renderMyAccount();
  }
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const viewName = link.dataset.view;
    if (!viewName) return;

    // See admin.ts for why this guard fixes the "edit form gets wiped"
    // bug: only reset when navigating in fresh via the sidebar, never
    // when startEditingEmployee() opens the form directly.
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

  const now = new Date().getTime();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const newCount = employees.filter((e) => now - new Date(e.joiningDate).getTime() <= ninetyDaysMs).length;
  statNewEmployees.textContent = String(newCount);
}

// ------------------------------------------------------------
// EMPLOYEE DIRECTORY VIEW (Read, Search, Filter, Sort, Edit - no Delete)
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

  // Note: only "View", "Edit", "Status" and "Assign/Credentials" (view
  // only) actions are rendered - no "Delete" button exists anywhere in
  // the HR interface at all.
  employeesTableBody.innerHTML = employees
    .map((emp) => {
      const hasAccount = getUserByEmployeeId(emp.id) !== undefined;
      const statusBadge =
        emp.status === "active"
          ? `<span class="status-badge status-active">Active</span>`
          : `<span class="status-badge status-inactive">Inactive</span>`;
      const credentialsBtn = hasAccount
        ? `<button class="icon-btn" data-action="credentials" data-id="${emp.id}" title="View login credentials">Credentials</button>`
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
});

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
  } else if (action === "credentials") {
    openViewCredentialsModal(id);
  } else if (action === "assign") {
    openAssignCredentialsModal(id);
  }
  // Intentionally: no "delete" or "edit credentials" case exists.
});

// ------------------------------------------------------------
// VIEW EMPLOYEE DETAILS MODAL
// ------------------------------------------------------------

function openDetailsModal(id: number): void {
  const employee = getAllEmployees().find((e) => e.id === id);
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
// CREDENTIALS: VIEW ONLY for HR, plus Assign for accounts that
// don't exist yet (HR is allowed to grant initial access, but can
// never change an existing password directly).
// ------------------------------------------------------------

function openViewCredentialsModal(employeeId: number): void {
  const employee = getAllEmployees().find((e) => e.id === employeeId);
  const user = getUserByEmployeeId(employeeId);
  if (!employee || !user) return;

  credentialsModalRoot.innerHTML = `
    <div class="modal-overlay" id="credentials-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Login Credentials</h3>
        <p class="modal-subtext">${escapeHtml(employee.fullName)}'s login account. HR can view these but only Admin can change them.</p>
        <div class="form-group">
          <label>Login Email</label>
          <input type="text" value="${escapeHtml(user.email)}" readonly />
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="input-with-action">
            <input type="password" id="view-cred-password" value="${escapeHtml(user.password)}" readonly />
            <button type="button" class="input-action-btn" id="view-cred-toggle">Show</button>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="credentials-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("credentials-overlay");
  const closeBtn = document.getElementById("credentials-close-btn");
  const toggleBtn = document.getElementById("view-cred-toggle") as HTMLButtonElement;
  const passwordInput = document.getElementById("view-cred-password") as HTMLInputElement;

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) credentialsModalRoot.innerHTML = "";
  });
  closeBtn?.addEventListener("click", () => {
    credentialsModalRoot.innerHTML = "";
  });
  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "Hide" : "Show";
  });
}

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

    const errors = validateCredentialsForm(emailInput.value, passwordInput.value, confirmInput.value, undefined);

    if (errors.email) setFieldError("assign-email", errors.email);
    if (errors.password) setFieldError("assign-password", errors.password);
    if (errors.confirmPassword) setFieldError("assign-confirm-password", errors.confirmPassword);

    if (errors.email || errors.password || errors.confirmPassword) return;

    if (emailInput.value.trim() !== employee.email) {
      updateEmployee(employee.id, { email: emailInput.value.trim() });
    }

    const updatedEmployee = { ...employee, email: emailInput.value.trim() };
    createEmployeeUser(updatedEmployee, passwordInput.value);

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

  // Called directly (not through the nav click handler), so the form
  // values set above survive - this is the fix for the "form becomes
  // empty on edit" bug.
  showView("add-employee");
}

cancelEditBtn.addEventListener("click", () => {
  resetForm();
  showView("directory");
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
    showToast(`Employee added. They can log in with ${employeeData.email}.`, "success");
  } else if (editingEmployeeId !== null) {
    updateEmployee(editingEmployeeId, employeeData);
    showToast("Employee updated successfully.", "success");
  }

  resetForm();
  showView("directory");
});

// ------------------------------------------------------------
// DEPARTMENTS VIEW
// ------------------------------------------------------------

function renderDepartmentsView(): void {
  const departmentsListEl = document.getElementById("departments-list") as HTMLElement;
  const employees = getAllEmployees();
  const departments = getUniqueDepartments(employees);

  if (departments.length === 0) {
    departmentsListEl.innerHTML = `<p class="empty-text">No departments yet.</p>`;
    return;
  }

  departmentsListEl.innerHTML = departments
    .map((dept) => {
      const deptEmployees = employees.filter((e) => e.department === dept);
      return `
        <div class="department-card">
          <h3>${escapeHtml(dept)}</h3>
          <p>${deptEmployees.length} employee${deptEmployees.length === 1 ? "" : "s"}</p>
        </div>
      `;
    })
    .join("");
}

// ------------------------------------------------------------
// REPORTS / STATISTICS VIEW
// ------------------------------------------------------------

function renderReports(): void {
  const employees = getAllEmployees();
  const departments = getUniqueDepartments(employees);

  if (employees.length === 0) {
    reportsContainer.innerHTML = `<p class="empty-text">No data available yet.</p>`;
    return;
  }

  const rows = departments
    .map((dept) => {
      const deptEmployees = employees.filter((e) => e.department === dept);
      const avgSalary = Math.round(
        deptEmployees.reduce((sum, e) => sum + e.salary, 0) / deptEmployees.length
      );
      const totalSalary = deptEmployees.reduce((sum, e) => sum + e.salary, 0);
      const activeCount = deptEmployees.filter((e) => e.status === "active").length;
      return `
        <tr>
          <td>${escapeHtml(dept)}</td>
          <td>${deptEmployees.length}</td>
          <td>${activeCount}</td>
          <td>${formatCurrency(avgSalary)}</td>
          <td>${formatCurrency(totalSalary)}</td>
        </tr>
      `;
    })
    .join("");

  reportsContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Department</th>
          <th>Employees</th>
          <th>Active</th>
          <th>Average Salary</th>
          <th>Total Salary</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ------------------------------------------------------------
// MY ACCOUNT VIEW (view own credentials, request password change)
// ------------------------------------------------------------

let myAccountPasswordRevealed = false;

function renderMyAccount(): void {
  myAccountEmail.textContent = currentUser.email;
  myAccountPassword.textContent = maskPassword(currentUser.password);
  myAccountPasswordRevealed = false;
  myAccountRevealBtn.textContent = "Show";

  const pending = getPendingRequestForUser(currentUser.id);
  if (pending) {
    myAccountPendingBanner.classList.remove("hidden");
    myAccountPendingBanner.textContent = `Your password change request (submitted ${formatDateTime(pending.requestedAt)}) is awaiting Admin approval.`;
    requestPasswordBtn.disabled = true;
  } else {
    myAccountPendingBanner.classList.add("hidden");
    requestPasswordBtn.disabled = false;
  }
}

myAccountRevealBtn.addEventListener("click", () => {
  myAccountPasswordRevealed = !myAccountPasswordRevealed;
  myAccountPassword.textContent = myAccountPasswordRevealed
    ? currentUser.password
    : maskPassword(currentUser.password);
  myAccountRevealBtn.textContent = myAccountPasswordRevealed ? "Hide" : "Show";
});

requestPasswordBtn.addEventListener("click", () => {
  requestPasswordModalRoot.innerHTML = `
    <div class="modal-overlay" id="request-password-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Request Password Change</h3>
        <p class="modal-subtext">Choose a new password below. An Admin must approve this before it takes effect.</p>
        <form id="request-password-form" novalidate>
          <div class="form-group">
            <label for="request-new-password">New Password</label>
            <input type="text" id="request-new-password" placeholder="At least 6 characters" />
            <div class="password-strength-track"><div class="password-strength-fill" id="request-strength-bar"></div></div>
            <div class="password-strength-label" id="request-strength-label"></div>
            <div class="field-error" id="request-new-password-error"></div>
          </div>
          <div class="form-group">
            <label for="request-confirm-password">Confirm Password</label>
            <input type="text" id="request-confirm-password" placeholder="Re-enter password" />
            <div class="field-error" id="request-confirm-password-error"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="request-password-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("request-password-overlay");
  const cancelBtn = document.getElementById("request-password-cancel-btn");
  const form = document.getElementById("request-password-form") as HTMLFormElement;
  const passwordInput = document.getElementById("request-new-password") as HTMLInputElement;
  const confirmInput = document.getElementById("request-confirm-password") as HTMLInputElement;
  const strengthBar = document.getElementById("request-strength-bar") as HTMLElement;
  const strengthLabel = document.getElementById("request-strength-label") as HTMLElement;

  const close = () => {
    requestPasswordModalRoot.innerHTML = "";
  };

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  cancelBtn?.addEventListener("click", close);

  passwordInput.addEventListener("input", () => {
    setFieldError("request-new-password", "");
    renderPasswordStrengthMeter(passwordInput.value, strengthBar, strengthLabel);
  });
  confirmInput.addEventListener("input", () => setFieldError("request-confirm-password", ""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFieldErrors(["request-new-password", "request-confirm-password"]);

    let hasError = false;
    if (passwordInput.value.trim() === "") {
      setFieldError("request-new-password", "Password is required.");
      hasError = true;
    } else if (passwordInput.value.length < 6) {
      setFieldError("request-new-password", "Password must be at least 6 characters.");
      hasError = true;
    }
    if (confirmInput.value.trim() === "") {
      setFieldError("request-confirm-password", "Please confirm the password.");
      hasError = true;
    } else if (passwordInput.value !== confirmInput.value) {
      setFieldError("request-confirm-password", "Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    submitPasswordChangeRequest(currentUser, passwordInput.value);
    showToast("Your password change request has been submitted for Admin approval.", "success");
    close();
    renderMyAccount();
  });
});

// ------------------------------------------------------------
// INITIAL RENDER
// ------------------------------------------------------------

showView("dashboard");
