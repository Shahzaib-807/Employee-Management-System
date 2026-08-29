// ============================================================
// ui.ts
// Small reusable UI helper functions shared across every page:
// toast notifications, confirmation modals, initials generation,
// currency formatting, and inline form-error display.
// ============================================================
// ------------------------------------------------------------
// TOAST NOTIFICATIONS
// ------------------------------------------------------------
// Shows a temporary "toast" notification in the corner of the screen.
// Every page includes a <div id="toast-container"></div> in its HTML
// for these to be appended into.
export function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) {
        // Fallback in case a page forgot the container - still inform the user.
        console.warn("Toast container not found on page.");
        return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    // Trigger the enter animation on the next frame.
    requestAnimationFrame(() => {
        toast.classList.add("toast-visible");
    });
    // Automatically remove the toast after a few seconds.
    setTimeout(() => {
        toast.classList.remove("toast-visible");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3200);
}
// ------------------------------------------------------------
// CONFIRMATION MODAL
// ------------------------------------------------------------
// Shows a confirmation modal (e.g. "Are you sure you want to delete
// this employee?") and calls onConfirm() only if the user confirms.
// Uses a real modal element instead of the browser's alert()/confirm().
export function showConfirmModal(message, onConfirm) {
    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) {
        console.warn("Modal root not found on page.");
        return;
    }
    modalRoot.innerHTML = `
    <div class="modal-overlay" id="confirm-modal-overlay">
      <div class="modal-box">
        <h3 class="modal-title">Please Confirm</h3>
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-ok-btn">Confirm</button>
        </div>
      </div>
    </div>
  `;
    const closeModal = () => {
        modalRoot.innerHTML = "";
    };
    const overlay = document.getElementById("confirm-modal-overlay");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const okBtn = document.getElementById("confirm-ok-btn");
    // Clicking the dark overlay background cancels the action.
    overlay?.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeModal();
        }
    });
    cancelBtn?.addEventListener("click", closeModal);
    okBtn?.addEventListener("click", () => {
        closeModal();
        onConfirm();
    });
}
// Closes any open modal (used after successfully submitting a form modal).
export function closeModal() {
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot) {
        modalRoot.innerHTML = "";
    }
}
// ------------------------------------------------------------
// FORM ERROR DISPLAY
// ------------------------------------------------------------
// Displays (or clears) an inline error message under a form field.
// Expects an element with id `${fieldName}-error` to exist in the HTML.
export function setFieldError(fieldName, message) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    const inputElement = document.getElementById(fieldName);
    if (errorElement) {
        errorElement.textContent = message;
    }
    if (inputElement) {
        if (message) {
            inputElement.classList.add("input-error");
        }
        else {
            inputElement.classList.remove("input-error");
        }
    }
}
// Clears every error message for a list of field names.
export function clearFieldErrors(fieldNames) {
    fieldNames.forEach((name) => setFieldError(name, ""));
}
// ------------------------------------------------------------
// MISC FORMATTING HELPERS
// ------------------------------------------------------------
// Generates initials from a full name, e.g. "Sarah Johnson" -> "SJ".
// Used for the avatar circle on the Employee Dashboard.
export function getInitials(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || parts[0] === "") {
        return "?";
    }
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase();
}
// Formats a number as a currency string, e.g. 65000 -> "$65,000".
export function formatCurrency(amount) {
    return "$" + amount.toLocaleString("en-US");
}
// Formats an ISO date string (yyyy-mm-dd) into a more readable form,
// e.g. "2023-01-09" -> "Jan 9, 2023".
export function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
// Escapes HTML special characters to prevent injecting markup when
// rendering user-entered text (like names or addresses) into innerHTML.
export function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
// Formats a timestamp (ISO datetime string) as a readable date + time,
// e.g. "Aug 28, 2026, 3:45 PM". Used by the audit log and password
// change request panels.
export function formatDateTime(isoDateTime) {
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) {
        return isoDateTime;
    }
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}
// Masks a password for display, e.g. "mypassword" -> "••••••••••".
// Used wherever a stored password is shown before the user reveals it.
export function maskPassword(password) {
    return "•".repeat(Math.max(password.length, 6));
}
// Triggers a browser download of a text file (used for CSV export).
export function downloadTextFile(filename, content, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
//# sourceMappingURL=ui.js.map