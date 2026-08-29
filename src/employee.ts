// ============================================================
// employee.ts
// Logic for employee.html (the Employee Dashboard / personal portal).
// The employee can only view their OWN profile, can edit their
// phone number and address directly, and can view their own login
// email/password - but any password CHANGE must go through a
// request that an Admin approves. This file never imports any
// function that could edit another employee's record or directly
// change a password, enforcing the restriction at the code level.
// ============================================================

import { checkAccess, logout } from "./auth.js";
import { getEmployeeById, updateEmployee, validatePhoneAndAddress } from "./employeeService.js";
import {
  getUserByEmployeeId,
  submitPasswordChangeRequest,
  getPendingRequestForUser,
  getPasswordStrength,
} from "./userService.js";
import {
  showToast,
  setFieldError,
  clearFieldErrors,
  getInitials,
  formatCurrency,
  formatDate,
  formatDateTime,
  maskPassword,
  escapeHtml,
} from "./ui.js";

// Protect this page: only an "employee" user may view it.
const currentUser = checkAccess("employee");

// ------------------------------------------------------------
// DOM REFERENCES
// ------------------------------------------------------------

const userNameEl = document.getElementById("current-user-name") as HTMLElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;

const welcomeNameEl = document.getElementById("welcome-name") as HTMLElement;
const avatarEl = document.getElementById("profile-avatar") as HTMLElement;

const profileIdEl = document.getElementById("profile-id") as HTMLElement;
const profileNameEl = document.getElementById("profile-name") as HTMLElement;
const profileNameEl2 = document.getElementById("profile-name-2") as HTMLElement;
const profilePositionHeaderEl = document.getElementById("profile-position") as HTMLElement;
const profilePositionEl2 = document.getElementById("profile-position-2") as HTMLElement;
const profileEmailEl = document.getElementById("profile-email") as HTMLElement;
const profilePhoneEl = document.getElementById("profile-phone") as HTMLElement;
const profileDepartmentEl = document.getElementById("profile-department") as HTMLElement;
const profileSalaryEl = document.getElementById("profile-salary") as HTMLElement;
const profileAddressEl = document.getElementById("profile-address") as HTMLElement;
const profileJoiningDateEl = document.getElementById("profile-joining-date") as HTMLElement;
const profileStatusEl = document.getElementById("profile-status") as HTMLElement;

const editProfileBtn = document.getElementById("edit-profile-btn") as HTMLButtonElement;
const editModalRoot = document.getElementById("edit-modal-root") as HTMLElement;

const noProfileState = document.getElementById("no-profile-state") as HTMLElement;
const profileContent = document.getElementById("profile-content") as HTMLElement;

// My Account (credentials) elements
const accountCard = document.getElementById("account-card") as HTMLElement;
const accountEmailEl = document.getElementById("account-email") as HTMLElement;
const accountPasswordEl = document.getElementById("account-password") as HTMLElement;
const accountRevealBtn = document.getElementById("account-reveal-btn") as HTMLButtonElement;
const accountPendingBanner = document.getElementById("account-pending-banner") as HTMLElement;
const requestPasswordBtn = document.getElementById("request-password-btn") as HTMLButtonElement;
const requestPasswordModalRoot = document.getElementById("request-password-modal-root") as HTMLElement;
const printProfileBtn = document.getElementById("print-profile-btn") as HTMLButtonElement;

// ------------------------------------------------------------
// INITIAL PAGE SETUP
// ------------------------------------------------------------

userNameEl.textContent = currentUser.name;

logoutBtn.addEventListener("click", () => {
  logout();
});

printProfileBtn?.addEventListener("click", () => {
  window.print();
});

// ------------------------------------------------------------
// LOAD AND RENDER THE EMPLOYEE'S OWN PROFILE
// ------------------------------------------------------------

function loadProfile(): void {
  if (currentUser.employeeId === undefined) {
    profileContent.classList.add("hidden");
    accountCard.classList.add("hidden");
    noProfileState.classList.remove("hidden");
    return;
  }

  const employee = getEmployeeById(currentUser.employeeId);

  if (!employee) {
    profileContent.classList.add("hidden");
    accountCard.classList.add("hidden");
    noProfileState.classList.remove("hidden");
    return;
  }

  profileContent.classList.remove("hidden");
  accountCard.classList.remove("hidden");
  noProfileState.classList.add("hidden");

  welcomeNameEl.textContent = employee.fullName.split(" ")[0];
  avatarEl.textContent = getInitials(employee.fullName);

  profileIdEl.textContent = String(employee.id);
  profileNameEl.textContent = employee.fullName;
  profileNameEl2.textContent = employee.fullName;
  profilePositionHeaderEl.textContent = employee.position;
  profilePositionEl2.textContent = employee.position;
  profileEmailEl.textContent = employee.email;
  profilePhoneEl.textContent = employee.phone;
  profileDepartmentEl.textContent = employee.department;
  profileSalaryEl.textContent = formatCurrency(employee.salary);
  profileAddressEl.textContent = employee.address;
  profileJoiningDateEl.textContent = formatDate(employee.joiningDate);
  profileStatusEl.textContent = employee.status === "active" ? "Active" : "Inactive";
  profileStatusEl.className =
    employee.status === "active" ? "status-badge status-active" : "status-badge status-inactive";

  renderMyAccount();
}

// ------------------------------------------------------------
// EDIT PROFILE MODAL (phone + address only)
// ------------------------------------------------------------

function openEditProfileModal(): void {
  if (currentUser.employeeId === undefined) return;
  const employee = getEmployeeById(currentUser.employeeId);
  if (!employee) return;

  editModalRoot.innerHTML = `
    <div class="modal-overlay" id="edit-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Edit Profile</h3>
        <p class="modal-subtext">You can only update your phone number and address. Contact HR or Admin to change other details.</p>
        <form id="edit-profile-form" novalidate>
          <div class="form-group">
            <label for="edit-phone">Phone Number</label>
            <input type="text" id="edit-phone" value="${escapeHtml(employee.phone)}" />
            <div class="field-error" id="edit-phone-error"></div>
          </div>
          <div class="form-group">
            <label for="edit-address">Address</label>
            <textarea id="edit-address" rows="3">${escapeHtml(employee.address)}</textarea>
            <div class="field-error" id="edit-address-error"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="edit-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="edit-save-btn">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const overlay = document.getElementById("edit-overlay");
  const cancelBtn = document.getElementById("edit-cancel-btn");
  const form = document.getElementById("edit-profile-form") as HTMLFormElement;
  const phoneInput = document.getElementById("edit-phone") as HTMLInputElement;
  const addressInput = document.getElementById("edit-address") as HTMLTextAreaElement;

  const closeModal = () => {
    editModalRoot.innerHTML = "";
  };

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  cancelBtn?.addEventListener("click", closeModal);

  phoneInput.addEventListener("input", () => setFieldError("edit-phone", ""));
  addressInput.addEventListener("input", () => setFieldError("edit-address", ""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    clearFieldErrors(["edit-phone", "edit-address"]);

    const errors = validatePhoneAndAddress(phoneInput.value, addressInput.value);

    if (errors.phone) setFieldError("edit-phone", errors.phone);
    if (errors.address) setFieldError("edit-address", errors.address);

    if (errors.phone || errors.address) {
      return;
    }

    if (currentUser.employeeId === undefined) return;

    updateEmployee(currentUser.employeeId, {
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
    });

    showToast("Profile updated successfully.", "success");
    closeModal();
    loadProfile();
  });
}

editProfileBtn.addEventListener("click", openEditProfileModal);

// ------------------------------------------------------------
// MY ACCOUNT: view own login email/password, request a change
// ------------------------------------------------------------

let accountPasswordRevealed = false;

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

function renderMyAccount(): void {
  if (currentUser.employeeId === undefined) return;
  const user = getUserByEmployeeId(currentUser.employeeId);
  if (!user) return;

  accountEmailEl.textContent = user.email;
  accountPasswordRevealed = false;
  accountPasswordEl.textContent = maskPassword(user.password);
  accountRevealBtn.textContent = "Show";

  const pending = getPendingRequestForUser(user.id);
  if (pending) {
    accountPendingBanner.classList.remove("hidden");
    accountPendingBanner.textContent = `Your password change request (submitted ${formatDateTime(pending.requestedAt)}) is awaiting Admin approval.`;
    requestPasswordBtn.disabled = true;
  } else {
    accountPendingBanner.classList.add("hidden");
    requestPasswordBtn.disabled = false;
  }
}

accountRevealBtn.addEventListener("click", () => {
  if (currentUser.employeeId === undefined) return;
  const user = getUserByEmployeeId(currentUser.employeeId);
  if (!user) return;

  accountPasswordRevealed = !accountPasswordRevealed;
  accountPasswordEl.textContent = accountPasswordRevealed ? user.password : maskPassword(user.password);
  accountRevealBtn.textContent = accountPasswordRevealed ? "Hide" : "Show";
});

requestPasswordBtn.addEventListener("click", () => {
  if (currentUser.employeeId === undefined) return;
  const user = getUserByEmployeeId(currentUser.employeeId);
  if (!user) return;

  requestPasswordModalRoot.innerHTML = `
    <div class="modal-overlay" id="request-password-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Request Password Change</h3>
        <p class="modal-subtext">Choose a new password below. An Admin must approve this before it takes effect anywhere in the system.</p>
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

    submitPasswordChangeRequest(user, passwordInput.value);
    showToast("Your password change request has been submitted for Admin approval.", "success");
    close();
    renderMyAccount();
  });
});

// ------------------------------------------------------------
// INITIAL RENDER
// ------------------------------------------------------------

loadProfile();
