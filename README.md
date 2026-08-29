# Employee Management System

A complete, fully functional **Employee Management System** built with vanilla **HTML, CSS, and TypeScript** — no frameworks, no backend, no database. This project was built as an internship demonstration of TypeScript fundamentals, CRUD operations, form validation, authentication, and role-based access control (RBAC), using `localStorage` as the app's data store.

---

## 1. Project Description

The application simulates a real employee management platform with three distinct user roles — **Admin**, **HR**, and **Employee** — each with its own dashboard, permissions, and visual design. All data (users and employees) is stored in the browser's `localStorage`, and all application logic is written in strongly-typed TypeScript.

---

## 2. Features

- 🔐 Login system with email/password validation, show/hide password, and one-click demo account autofill
- 🎨 Animated gradient login background with a floating, glassmorphic demo-credentials card
- 👑 **Admin Dashboard** — full CRUD on employees, full control over login credentials (own, HR's, and every employee's), password-change approvals, and a system activity log
- 🧑‍💼 **HR Dashboard** — can Create, Read, and Update employees; can VIEW (but never edit) login credentials; **cannot delete** employees or edit credentials directly
- 🙋 **Employee Dashboard** — personal portal; can view own profile and edit only phone & address; can view own login email/password and request a password change
- 🔑 **Employee login credentials** — Admin/HR set an email + password when creating an employee, so that employee can immediately sign in to their own portal
- 🔁 **Password-change approval workflow** — HR and Employee can never change their own password directly; they submit a request, and only Admin can approve or reject it. Once approved, the new password takes effect everywhere (Admin, HR, and the employee's own portal) because they all read from the same underlying account record
- 🆕 **Assign Login Credentials** — Admin/HR can grant login access to an employee who doesn't have an account yet
- 🛠️ **Admin Settings** — change your own login credentials directly, directly edit any HR account's credentials, and review/approve/reject pending password-change requests
- 🕒 **Activity Log** — a running history of important actions (employee added/edited/deleted, credentials changed, requests approved, etc.), visible to Admin
- 🟢 **Active/Inactive employee status** — Admin can toggle status as a softer alternative to deleting a record; both dashboards can filter by status
- ↕️ **Sortable table columns** — click Name, Department, Position, Salary, or Joined to sort the employee table
- ⬇️ **CSV export** — download the full employee list as a `.csv` file
- 🔒 **Password strength meter** — live feedback while setting or requesting a new password
- 🖨️ **Print Profile** — employees can print a clean copy of their own profile
- 🔎 Search employees by name or email
- 🏷️ Filter employees by department and status
- 📊 Dashboard statistics: total employees, total departments, average salary, recent hires, recent activity
- ✅ Full form validation with inline error messages (no `alert()` popups)
- 🔔 Toast notifications for success/error feedback, plus a notification badge for pending password requests
- 🗑️ Confirmation modal before deleting an employee
- 🔒 Role-based access control — manually visiting the wrong dashboard redirects you to the correct one
- 📱 Fully responsive design (desktop, tablet, mobile)
- 💾 Automatic demo data seeding on first run

---

## 3. Technologies Used

- **HTML5** — page structure
- **CSS3** — styling with CSS variables, Flexbox, and Grid (no CSS frameworks)
- **TypeScript** — all application logic, compiled to plain JavaScript
- **localStorage** — client-side data persistence (acts as the "database")

No React, Angular, Vue, Bootstrap, Tailwind, backend, or database is used.

---

## 4. Folder Structure

```
employee-management-system/
│
├── index.html              # Login page
├── admin.html               # Admin Dashboard
├── hr.html                  # HR Dashboard
├── employee.html             # Employee Dashboard (personal portal)
│
├── css/
│   ├── common.css           # Shared design system (buttons, forms, modals, toasts, tables)
│   ├── login.css             # Login page styling
│   ├── admin.css             # Admin dashboard styling
│   ├── hr.css                # HR dashboard styling
│   └── employee.css          # Employee portal styling
│
├── src/                     # TypeScript source files
│   ├── types.ts              # Shared interfaces & types
│   ├── storage.ts            # localStorage access layer
│   ├── auth.ts                # Login, logout, role-based access control
│   ├── employeeService.ts    # Employee CRUD + search + filter + sort + validation
│   ├── userService.ts        # Login credentials, password-change requests, audit log
│   ├── ui.ts                  # Toasts, modals, formatting helpers
│   ├── login.ts               # Login page logic
│   ├── admin.ts               # Admin dashboard logic
│   ├── hr.ts                  # HR dashboard logic
│   └── employee.ts            # Employee dashboard logic
│
├── dist/                    # Compiled JavaScript (output of `npm run build`)
│
├── tsconfig.json
├── package.json
├── README.md
└── .gitignore
```

---

## 5. Installation Instructions

1. Extract the project ZIP file (or clone the folder) to your computer.
2. Open the folder in **VS Code**.
3. Open a terminal in VS Code (`Terminal > New Terminal`).
4. Install dependencies:

   ```bash
   npm install
   ```

---

## 6. How to Compile TypeScript

The TypeScript source lives in `src/` and compiles to plain JavaScript in `dist/`, which is what the HTML files actually load.

**One-time build:**

```bash
npm run build
```

**Watch mode** (automatically recompiles whenever you save a `.ts` file):

```bash
npm run watch
```

> The project already ships with a pre-built `dist/` folder, so it will run immediately even before you compile — but you should run `npm run build` after making any changes to the TypeScript source.

---

## 7. How to Run the Project

Because the app uses ES modules (`<script type="module">`), it needs to be served over `http://` rather than opened directly as a `file://` path in some browsers. The easiest way in VS Code:

1. Install the **Live Server** extension (if you don't already have it).
2. Right-click `index.html` → **"Open with Live Server"**.
3. The Login page will open in your browser.

Alternatively, run any simple local server from the project folder, for example:

```bash
npx serve .
```

Then open the printed `localhost` URL in your browser.

---

## 8. Demo Login Accounts

The app automatically creates these accounts the first time it runs:

| Role     | Email                  | Password    |
|----------|-------------------------|-------------|
| Admin    | admin@example.com       | admin123    |
| HR       | hr@example.com          | hr123       |
| Employee | employee@example.com    | employee123 |

Click any demo account card on the login page to auto-fill the form. The **Employee** demo account is linked to a real sample employee record (Sarah Johnson). Five other sample employees exist without login accounts yet — use **Assign Login Credentials** on the Employee Directory to see how Admin/HR grant access to them.

### Trying the password-change approval workflow
1. Log in as HR (or Employee) and go to **My Account**.
2. Click **Request Password Change**, enter a new password, and submit.
3. Log out, log back in as Admin, and go to **Settings → Pending Password Change Requests**.
4. Click **Show** to verify the requested password, then **Approve**.
5. Log back in as that HR/Employee user with the new password — it now works everywhere.

---

## 9. CRUD Explanation

CRUD stands for **Create, Read, Update, Delete** — the four basic operations for managing data.

- **Create** — Admin and HR can add new employees via a validated form (`addEmployee()` in `employeeService.ts`).
- **Read** — All roles can read data: Admin/HR see the full employee list (with search & filter), while an Employee can only read their *own* record.
- **Update** — Admin and HR can edit any employee's full record. An Employee can only update their own **phone number** and **address**.
- **Delete** — Only Admin can delete employees. Deleting an employee also removes any linked user login account, so there are no orphaned accounts left behind.

All CRUD functions live in `src/employeeService.ts` and read/write through `src/storage.ts`, so every page that reads employee data always sees the latest changes.

---

## 10. TypeScript Interfaces Explanation

Two core interfaces drive the whole app (defined in `src/types.ts`):

```ts
interface Employee {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  salary: number;
  address: string;
  joiningDate: string;
}

type UserRole = "admin" | "hr" | "employee";

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  employeeId?: number;
}
```

- `Employee` represents one employee's HR record.
- `User` represents a login account. The optional `employeeId?` links a `User` of role `"employee"` to their own `Employee` record.
- `UserRole` is a **union type**, meaning a role can only ever be `"admin"`, `"hr"`, or `"employee"` — TypeScript will flag any other value as an error at compile time.

Additional supporting types (`NewEmployeeData`, `EmployeeFormErrors`, `ValidationResult`, etc.) are used to keep form handling and validation fully type-safe without using `any`.

---

## 11. Role-Based Access Control Explanation

Every protected page calls a single function, `checkAccess(requiredRole)`, at the top of its script (see `src/auth.ts`):

- If **no one is logged in**, the visitor is redirected to `index.html`.
- If someone **is** logged in but their role doesn't match the page (e.g. an Employee manually types `admin.html` into the address bar), they are redirected to **their own correct dashboard** instead.
- Each dashboard's TypeScript file only imports the functions that role is allowed to use — for example, `hr.ts` never imports `deleteEmployee` or `updateUserCredentials`, so HR truly has no code path to delete an employee or edit a password directly, not just a hidden button.

---

## 11a. Login Credentials & Password-Change Approval Model

Every employee's login email doubles as their `Employee.email` field, so the two always stay in sync. Here's how credential permissions break down by role:

| Action | Admin | HR | Employee |
|---|---|---|---|
| Set a new employee's initial email + password | ✅ | ✅ | — |
| Assign login access to an existing employee without one | ✅ | ✅ | — |
| View any employee's stored email/password | ✅ | ✅ (view only) | Own only |
| Directly edit an employee's email/password | ✅ | ❌ | ❌ |
| Directly edit their **own** login credentials | ✅ (Settings) | ❌ | ❌ |
| Directly edit an HR account's credentials | ✅ (Settings) | — | — |
| Request a password change (needs Admin approval) | — | ✅ | ✅ |
| Approve/reject a password-change request | ✅ | — | — |

The reasoning: Admin sits at the top of the trust hierarchy, so Admin can edit anyone's credentials directly, including their own. HR and Employee accounts can never silently change their own password — they submit a request (`src/userService.ts` → `submitPasswordChangeRequest`), and only after an Admin reviews and approves it (`approvePasswordChangeRequest`) does the password actually change. Because every dashboard reads the same underlying `User` record from `localStorage`, an approved change is instantly visible everywhere — Admin's employee table, HR's directory, and the employee's own portal — with no separate sync step needed.

---

## 12. localStorage Explanation

`localStorage` is used as a simple, persistent, client-side "database". These keys are used:

- `"employees"` → a JSON array of all `Employee` objects
- `"users"` → a JSON array of all `User` (login) objects
- `"currentUser"` → the single `User` object currently logged in (removed on logout)
- `"passwordRequests"` → a JSON array of all `PasswordChangeRequest` objects (pending/approved/rejected)
- `"auditLog"` → a JSON array of all `AuditLogEntry` objects, shown on the Admin Activity Log page

All reads/writes go through reusable functions in `src/storage.ts` (`getEmployees()`, `saveEmployees()`, `getUsers()`, `saveUsers()`, `getCurrentUser()`, `setCurrentUser()`, `clearCurrentUser()`, `getPasswordRequests()`, `savePasswordRequests()`, `getAuditLog()`, `saveAuditLog()`), so no other file touches `localStorage` directly.

---

## 13. ⚠️ Important Security Note

This project uses `localStorage` and plain-text password comparison **purely for demonstration purposes** in a frontend-only learning project. This is **not secure** and should **never** be used in a real production application. A real system would require:

- A real **backend server** to handle authentication logic
- A proper **database** (e.g. PostgreSQL, MongoDB) instead of `localStorage`
- **Password hashing** (e.g. bcrypt) — passwords should never be stored or compared in plain text
- **Secure sessions or tokens** (e.g. JWT, HTTP-only cookies) instead of storing the logged-in user in `localStorage`
- **Server-side authorization** checks on every request, since any client-side check (like the one in this project) can be bypassed by a technically savvy user editing their browser's `localStorage`

---

## 14. License

This project is provided under the MIT License for educational/internship purposes.
