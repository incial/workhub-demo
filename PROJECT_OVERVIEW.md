# Dream India CRM & WorkHub — Enterprise Project Overview & Architecture Guide

## 1. Executive Summary

### What This Software Is
**Dream India CRM & WorkHub (`Incial CRM / WorkHub`)** is an enterprise-grade, multi-zone project tracking, customer relationship management (CRM), and workflow automation platform. Designed specifically for educational institutional sales and deployment operations, the application tracks end-to-end institutional projects (such as Smart Classroom setups, Solar Backup systems, Digital Lab infrastructure, and Auditorium AV refreshes) across schools and educational bodies. 

Built as a decoupled full-stack platform featuring a Java 17 / Spring Boot 3 backend (`backend`) and a TypeScript / React / Vite frontend (`client`), the system enforces strict stage gates, automated escalation triggers, multi-tier notifications, financial aging evaluations, and multi-zone role-based access control.

### Who It Is Built For
The software is engineered for **Dream India School Aid / Incial WorkHub** and its operational teams. Specifically, it caters to seven distinct enterprise roles across geographically separated operational zones (`ZONE_1`, `ZONE_2`, `ZONE_3`, and higher up to `ZONE_10` depending on data seed and runtime expansion):
1. **Field Executives (`ROLE_EXECUTIVE`)**: Field sales agents and relationship managers who acquire institutional leads, conduct school meetings, share proposals, and onboard projects once terms are agreed upon.
2. **Sales Coordinators (`ROLE_SALES_COORDINATOR` / `ROLE_SALES`)**: Internal coordinators who take over onboarded projects to verify commercial terms, input invoices, track expected delivery timelines, and verify installation requirements.
3. **Accounts & Billing Officers (`ROLE_ACCOUNTS`)**: Financial controllers responsible for recording received payments, monitoring pending dues, managing payment records, and granting clearance before hardware deployment begins.
4. **Installation & Dispatch Engineers (`ROLE_INSTALLATION`)**: Technical deployment teams responsible for on-site hardware dispatch, installation execution, and marking physical work completion.
5. **Quality & Feedback Officers (`ROLE_FEEDBACK`)**: Dedicated post-deployment verification agents who follow up with institutional stakeholders (`contactPerson`) to collect and record satisfaction feedback before final project closure.
6. **Data Entry Operators (`ROLE_OPERATOR`)**: Administrative support staff who assist in user provisioning, data entry, and cross-stage administrative support without modifying billing/financial records.
7. **System Administrators (`ROLE_ADMIN` & `ROLE_SUPER_ADMIN`)**: Regional management and executive leadership responsible for cross-zone governance, pipeline metrics, stage escalation alerts, employee status tracking, audit log reviews, and project deletion approvals.

### What Business Problem It Solves
Prior to digitizing through this CRM, complex institutional deployments faced critical operational risks:
- **Revenue Leakage & Unverified Deployment**: Hardware and technical teams might dispatch equipment before accounts cleared payment schedules, or billing details might remain unrecorded while projects progressed.
- **Siloed Communication & Blind Handoffs**: Field executives had no real-time visibility into whether the sales coordinator had invoiced the client or whether the accounts team had cleared the project for installation.
- **Stagnant Leads & SLA Breaches**: Projects often stalled indefinitely in intermediate stages (`QUOTATION_SENT`, `SALES`, or `ACCOUNTS`) without proactive alerts to management when timelines exceeded acceptable thresholds.
- **Lack of Accountability & Auditability**: When stage details, commercial figures, or project ownership changed, traditional paperwork or spreadsheets failed to maintain a tamper-proof historical audit trail.
- **Geographic Zone Overlap & Data Privacy**: Without hard zone segmentation, regional sales figures and sensitive commercial terms were visible across competing field agents or unrelated branch offices.

---

## 2. Client Workflow

### Explain the Real-World Workflow This Software Digitizes
The software digitizes the complete lifecycle of institutional hardware and infrastructure sales, spanning from initial contact to post-installation feedback:

```
[Field Lead Discovery] ---> [Initial School Meeting] ---> [Quotation & Proposal] ---> [Management Review]
                                                                                               |
                                                                                               v
[Completed Archive & Feedback] <--- [On-Site Installation] <--- [Accounts Clearance] <--- [Project Onboarded]
```

1. **Lead Generation & Discovery (`LEAD`)**: A Field Executive discovers or is assigned a lead at an educational institution (`school`, `contactPerson`, `contactNumber`, `place`, `district`).
2. **Engagement & Meeting (`ON_PROGRESS`)**: The Executive visits or calls the school to assess infrastructure requirements (`firstMeetingOutcome`).
3. **Proposal Submission (`QUOTATION_SENT`)**: Formal Bill of Quantities (BOQ) and commercial quotations (`projectValue`) are shared with the school's decision-makers.
4. **Negotiation (`IN_REVIEW`)**: The school management committee reviews the proposal, asks for revisions, or negotiates terms.
5. **Onboarding & Handover (`ONBOARDED`)**: Once the school agrees, the Executive formally "onboards" the project, locking in the deal and handing over operational control to internal coordination teams.
6. **Commercial Verification & Invoicing (`SALES`)**: A Sales Coordinator takes ownership, verifies the product package, logs the exact `invoiceAmount`, establishes the `expectedDeliveryDate`, assigns the `installationTaskList`, and categorizes the project (`projectClassification`).
7. **Financial Verification & Payment Tracking (`ACCOUNTS`)**: An Accounts Officer takes ownership, records incoming payments (`amountReceived`, `paymentStatus`), calculates `pendingAmount`, and tracks aging. Once `pendingAmount` drops to zero, the officer marks the project ready for deployment.
8. **On-Site Execution (`INSTALLATION`)**: Technical teams receive the dispatch manifest and execute physical setup. Upon finishing work on-site, the status is updated (`DONE` or `WORK_DONE`).
9. **Post-Deployment Verification & Closure (`COMPLETED`)**: The project transitions to completed status. A Quality/Feedback Officer reaches out to the school to collect customer feedback (`feedbackCollected = true`), archiving the project cleanly into the permanent institutional portfolio.

### What Was Likely Done Manually Before
Before adopting the Dream India CRM, operational workflows relied on decentralized, error-prone manual tools:
- **Spreadsheets (Microsoft Excel / Google Sheets)**: Separate, out-of-sync sheets were maintained by Sales, Accounts, and Dispatch teams. Formula errors or accidental row deletions frequently corrupted financial tracking (`invoiceAmount` vs. `amountReceived`).
- **Physical Paperwork & Files**: Physical folders containing school purchase orders, printed quotations, and hand-signed delivery challans were physically walked between desks for sign-offs.
- **WhatsApp & Email Threads**: Executives messaged coordinators via unstructured WhatsApp groups asking *"Has Sunrise Public School paid yet?"* or *"When will hardware reach Alappuzha?"* Information was lost in chat histories, and status updates depended on human memory.
- **Manual Reminders & Calendar Alarms**: Field agents had to manually set phone alarms or notebook reminders to call back principals after quotes were sent. Overdue follow-ups were routinely missed.

### How the Software Changes That Workflow
- **Single Source of Truth**: All teams log into a centralized web portal where stage status, financial balances (`pendingAmount`), and ownership (`salesUserEmail`, `accountsUserEmail`, `installationUserEmail`) are dynamically visible.
- **Automated Stage Guardrails**: System-enforced rules prevent stage jumping. For instance, the system **blocks** moving a project to `INSTALLATION` if `pendingAmount > 0`, completely eliminating unapproved credit deployments.
- **Proactive SLA Monitoring & Escalations**: Background schedulers run daily to calculate exactly how many days a project has stayed in `SALES` or `ACCOUNTS`. If a project stalls for 11+ days (`YELLOW`) or 21+ days (`RED`), automated alerts and emails fire to executive leadership (`ROLE_ADMIN` / `ROLE_SUPER_ADMIN`).
- **Automated Follow-up Reminders**: Schedulers identify upcoming executive follow-up dates and publish automated reminder events to field agents two days in advance.
- **Immutable Audit Trails**: Every stage movement, financial update (`invoiceAmount`, `amountReceived`), login, and project modification is permanently recorded in structured audit logs and activity histories with exact timestamps, actor names, and IP addresses.

---

## 3. Business Features

### 1. Multi-Stage Pipeline & Stage Guardrails
- **Detailed Explanation**: Projects flow through strict stage enums (`LEAD`, `ON_PROGRESS`, `QUOTATION_SENT`, `IN_REVIEW`, `ONBOARDED`, `SALES`, `ACCOUNTS`, `INSTALLATION`, `COMPLETED`, `DROPPED`). Every stage transition is verified by `WorkflowService.validateTransition()` against hard business invariants.
- **Why It Exists**: Ensures operational rigor. Sales cannot bypass accounts clearance, field agents cannot move out of `ON_PROGRESS` without logging the meeting outcome (`firstMeetingOutcome` must be `POSITIVE`, `NEGATIVE`, or `FIFTY_FIFTY`), and installation cannot close (`COMPLETED`) without physical work completion sign-off (`DONE` or `WORK_DONE`).

### 2. Automated Financial Reconciliation & Payment Evaluation
- **Detailed Explanation**: When `invoiceAmount` or `amountReceived` is updated via dedicated role APIs, the system automatically recalculates `pendingAmount = invoiceAmount - amountReceived` (clamped to zero if negative). Furthermore, `PaymentEvaluationService` evaluates payment records (`PaymentRecord`) against due dates, automatically categorizing aging status into color tiers (`GREEN` ≤ 10 days, `YELLOW` ≤ 20 days, `RED` > 20 days).
- **Why It Exists**: Prevents financial discrepancies and automates credit control. By categorizing overdue payments into `YELLOW` ("Approaching overdue") or `RED` ("Critical overdue"), the system triggers immediate `notificationOutboxService` alerts so finance managers take urgent recovery action.

### 3. Multi-Tier SLA Stage Escalation Engine
- **Detailed Explanation**: `ProjectStageEscalationScheduler` executes daily at 08:15 AM IST to audit all projects currently in `SALES` or `ACCOUNTS`. It calculates the tenure (`daysInStage`) since stage entry (`salesEntryDate` or `accountsEntryDate`). Tenures reaching 11–20 days trigger `YELLOW` escalation alerts; tenures reaching 21+ days trigger `RED` critical alerts to regional Admins and Super Admins.
- **Why It Exists**: Eliminates bottlenecks. When coordination or billing delays threaten client relationships, management receives automated summaries detailing exactly which required fields are missing (`Invoice amount not entered`, `Expected delivery date not entered`, etc.).

### 4. Controlled Project Deletion & Review Workflow
- **Detailed Explanation**: Users cannot simply delete a project from the database. Instead, an authorized user requests deletion (`requestProjectDeletion`), which transitions the project's `deletionRequestStatus` to `PENDING` along with a mandatory `deletionReason` and timestamp. Regional Administrators review these queues (`getDeletionRequestProjects`) and explicitly approve (`APPROVED`) or reject (`REJECTED`) the request with review remarks.
- **Why It Exists**: Protects institutional memory and prevents unauthorized data destruction or hiding of lost deals. Only upon formal administrative approval does the project get marked as deleted (`isDeleted = true` / soft or hard removal depending on role).

### 5. Dedicated Customer Quality & Feedback Collection Queue
- **Detailed Explanation**: Once a project enters `COMPLETED`, it enters a specialized Feedback Queue (`getFeedbackQueue`). Quality verification officers (`ROLE_FEEDBACK`) interview the client (`contactPerson`) and toggle `feedbackCollected = true` via a dedicated `PATCH` endpoint (`/api/v1/projects/{id}/feedback`).
- **Why It Exists**: Closes the loop between sales promise and physical delivery. Ensures no institutional project is permanently archived without explicit customer satisfaction validation.

### 6. Dynamic Production Planning & Monthly Summary Tracking
- **Detailed Explanation**: The platform includes a dedicated `ProductionService` (`/api/v1/production/*`) tracking monthly manufacturing and hardware assembly quotas across zones. Users define catalog items (`ProductionProduct` — name, category, active status) and record monthly quantities (`ProductionEntry` — month, year, productId, zone, quantity).
- **Why It Exists**: Bridges CRM demand with manufacturing supply. Allows regional leadership to view yearly production trends (`getYearlyTrend`) and monthly summaries (`getMonthlySummary`) aggregated by product category and zone.

### 7. Comprehensive Activity & Audit Logging Engine
- **Detailed Explanation**: Every user action is captured across three specialized tracking layers:
  - **`AuditLog`**: Security and compliance logs capturing logins, password resets, project creations, stage transitions, and deletion reviews (`AuditCategory.USER_LOGIN`, `PROJECT_MANAGEMENT`, `SECURITY`).
  - **`ProjectActivityLog` & `ProjectStageHistory`**: Granular entity-level diff logs capturing the exact `oldValue` and `newValue` of field edits (`actionType = FIELD_UPDATED`, `STAGE_CHANGED`), along with actor role and remarks.
  - **`UserActivityLog`**: Global user tracking logs that power the "Activity Statement" (`getUserActivityStatement`) and role-based tracking dashboards (`UserTrackingService`).
- **Why It Exists**: Delivers 100% accountability, simplifies troubleshooting, and satisfies institutional IT compliance audits.

### 8. System Capacity & Pipeline Limiting
- **Detailed Explanation**: `ProjectLimitService` monitors global database metrics against configured limits (`app.project-limits.max-projects` and `app.project-limits.max-pipeline-projects`). If total project counts or active pipeline project counts exceed thresholds, the system raises `ProjectCreationLimitStatusDto.creationBlocked = true`, halting new `POST /api/v1/projects/create` requests with explanatory messages.
- **Why It Exists**: Acts as an operational and system circuit breaker to prevent data overload or uncontrolled pipeline bloat when operational capacity is saturated.

### 9. Asynchronous Notification Outbox & Email Engine
- **Detailed Explanation**: Notifications (`NotificationOutboxService`) are written within ACID database transactions (`notification_outbox` table) alongside business entity updates. A background polling worker (`NotificationOutboxScheduler`) runs every 60 seconds (`fixedDelay = 60000`) to process pending outbox messages, resolve target recipients by zone and role, dispatch rich HTML emails (`EmailService`), and log delivery attempts (`notification_delivery` table with retry counts up to `MAX_RETRY_DELAY_MINUTES`).
- **Why It Exists**: Guarantees zero-loss notification delivery even during temporary SMTP outages (`smtp.gmail.com`). Decouples slow external network requests from fast user web request threads.

### 10. Multi-Zone Geographic & Role Governance
- **Detailed Explanation**: Users are strictly partitioned into regional zones (`ZONE_1`, `ZONE_2`, `ZONE_3`, etc.). `ZoneAccessService.requireCurrentUserContext()` inspects authenticated JWT tokens on every API call. If an Executive (`ROLE_EXECUTIVE`) attempts to query projects belonging to `ZONE_2` while assigned to `ZONE_1`, the service immediately throws `DomainException(FIELD_ACCESS_DENIED, "Cross-zone access denied")`.
- **Why It Exists**: Enforces strict regional data confidentiality between field teams while allowing cross-zone operational roles (`ROLE_SALES_COORDINATOR`, `ROLE_ACCOUNTS`, `ROLE_INSTALLATION`) and executive leadership (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`) to operate across boundaries.

---

## 4. User Roles & Permissions

The system defines seven core roles governed by `ZoneAccessService`, `WorkflowService`, and `SecurityConfiguration`:

| Role Identifier | Role Display Name | Geographic Zone Scope | Pipeline Stage Permissions | Key Capabilities & Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| **`ROLE_EXECUTIVE`** | Field Executive | **Strictly Assigned Zone** (`ZONE_1` to `ZONE_3`) | Can transition: `<br/>• `LEAD` → `ON_PROGRESS`<br/>• `ON_PROGRESS` → `QUOTATION_SENT`<br/>• `QUOTATION_SENT` → `IN_REVIEW`<br/>• `IN_REVIEW` → `ONBOARDED` | • Create new projects (`LEAD`/`ON_PROGRESS`)<br/>• Update basic school/contact info<br/>• Set `firstMeetingOutcome` & `projectValue`<br/>• **Cannot** modify invoice amounts, received payments, or installation status<br/>• **Cannot** view projects from other zones |
| **`ROLE_SALES_COORDINATOR`** (`ROLE_SALES`) | Sales Coordinator | **Global Operational Access** (All Zones) | Can transition: `<br/>• `SALES` → `ACCOUNTS` | • Take ownership of `SALES` projects (`salesUserEmail`, `salesEntryDate`)<br/>• Input `invoiceAmount` & `expectedDeliveryDate`<br/>• Define `installationTaskList` & `projectClassification`<br/>• Mark project "Ready for Accounts"<br/>• **Cannot** input received payment figures |
| **`ROLE_ACCOUNTS`** | Accounts Officer | **Global Operational Access** (All Zones) | Can transition: `<br/>• `ACCOUNTS` → `INSTALLATION` | • Take ownership of `ACCOUNTS` projects (`accountsUserEmail`, `accountsEntryDate`)<br/>• Record/Update `amountReceived` & `paymentStatus`<br/>• Calculate zero `pendingAmount` clearance<br/>• Evaluate payment records & due dates (`/api/v1/payments/evaluate`) |
| **`ROLE_INSTALLATION`** | Installation Engineer | **Global Operational Access** (All Zones) | Can transition: `<br/>• `INSTALLATION` → `COMPLETED` | • Take ownership of `INSTALLATION` projects (`installationUserEmail`)<br/>• Update on-site `installationStatus` (`IN_PROGRESS`, `DONE`, `WORK_DONE`)<br/>• **Cannot** transition to `COMPLETED` unless status is `DONE` or `WORK_DONE` |
| **`ROLE_FEEDBACK`** | Quality / Feedback Officer | **Global Operational Access** (All Zones) | No direct stage transition rights | • Access Completed Projects Feedback Queue (`/api/v1/projects/feedback/queue`)<br/>• Toggle client satisfaction flag (`feedbackCollected = true/false`) via `PATCH /api/v1/projects/{id}/feedback`<br/>• Log customer remarks |
| **`ROLE_OPERATOR`** | Data Entry Operator | **Global Operational Access** (All Zones) | Supportive cross-stage access | • Assist in operator-level user provisioning (`createUserByOperator`)<br/>• Assist in general non-financial project data entry across stages<br/>• View operational tracking dashboards |
| **`ROLE_ADMIN`** | Regional Administrator | **Global Access** (All Zones) | Can transition between **ANY** valid stages (`isAdmin(role) == true`) | • Full administrative override on project fields and stage moves<br/>• Review & decide on `deletionRequestStatus` (`APPROVED` / `REJECTED`)<br/>• View stage distribution, financial summaries, and aging reports<br/>• Receive SLA escalation (`YELLOW`/`RED`) alerts<br/>• Manage user directory (create, update, delete users) |
| **`ROLE_SUPER_ADMIN`** | System Super Admin | **Global Access** (All Zones) | Can transition between **ANY** valid stages | • All permissions of `ROLE_ADMIN`<br/>• Global recipient scope (`*`) for critical `RED` escalation alerts<br/>• System-wide configuration visibility and audit log management |

---

## 5. Business Logic

### 1. Stage Transition Validation Matrix (`WorkflowService`)
Every attempt to change `currentStage` (`/api/v1/projects/{id}/transition`) is evaluated by `WorkflowService.validateTransition()`:
- **Admin Override**: If `actorRole` is `ROLE_ADMIN` or `ROLE_SUPER_ADMIN`, standard role-based stage ownership guards are bypassed, though data integrity invariants are respected.
- **Role Transition Checks**:
  - `ROLE_EXECUTIVE` is restricted exclusively to early discovery transitions (`LEAD` ↔ `ONBOARDED`).
  - `ROLE_SALES_COORDINATOR` is restricted to `SALES` → `ACCOUNTS`.
  - `ROLE_ACCOUNTS` is restricted to `ACCOUNTS` → `INSTALLATION`.
  - `ROLE_INSTALLATION` is restricted to `INSTALLATION` → `COMPLETED`.
- **Mandatory Field Invariants (Stage Guards)**:
  - **Leaving `ON_PROGRESS`**: The field `firstMeetingOutcome` **must not be null** and must equal `'POSITIVE'`, `'NEGATIVE'`, or `'FIFTY_FIFTY'`.
  - **Moving `SALES` → `ACCOUNTS`**: The field `expectedDeliveryDate` **must not be null**.
  - **Moving `ACCOUNTS` → `INSTALLATION`**: The calculated `pendingAmount` (`invoiceAmount - amountReceived`) **must be exactly `BigDecimal.ZERO` (0)**. If `pendingAmount > 0`, the system throws `ErrorCode.WORKFLOW_GUARD_FAILED: Cannot move to INSTALLATION until pending amount is zero`.
  - **Moving `INSTALLATION` → `COMPLETED`**: The field `installationStatus` **must equal `'DONE'` or `'WORK_DONE'`**. If it is `IN_PROGRESS`, `PENDING`, or `NOT_DONE`, the transition is rejected.

### 2. Financial Reconciliation & Calculation Logic
Whenever commercial data is updated (`updateSalesData` or `updateAccountsData`):
$$\text{Pending Amount} = \max(0, \text{Invoice Amount} - \text{Amount Received})$$
- If `invoiceAmount` is `NULL`, `pendingAmount` defaults to `BigDecimal.ZERO`.
- If `amountReceived` is `NULL`, it is treated as `BigDecimal.ZERO`.
- If `amountReceived` exceeds `invoiceAmount`, `pendingAmount` is clamped to `0` (avoiding negative pending balances).
- Whenever `pendingAmount` reaches `0` during an accounts update, the project is flagged as fully paid, enabling clearance to `INSTALLATION`.

### 3. Payment Aging & Overdue Classification (`PaymentEvaluationService`)
When evaluating a payment record via `POST /api/v1/payments/evaluate`:
$$\text{Days Since Due} = \text{Current Date} - \text{Due Date}$$
- If `dueDate` is in the future (`Days Since Due < 0`), the service rejects the request (`Future due date is invalid`).
- **Classification Tiers**:
  - **`GREEN` (`Days Since Due ≤ 10`)**: Status = `"Normal follow-up"`, Action = `"No escalation required"`.
  - **`YELLOW` (`11 ≤ Days Since Due ≤ 20`)**: Status = `"Approaching overdue"`, Action = `"Escalated follow-up required"`. Enqueues `PAYMENT_DELAY_ALERT` to `ROLE_ADMIN`.
  - **`RED` (`Days Since Due > 20`)**: Status = `"Critical overdue"`, Action = `"Notify manager + urgent action"`. Enqueues `PAYMENT_ESCALATION_MANAGER_URGENT` to `ROLE_ADMIN`.

### 4. SLA Stage Escalation & Severity Logic (`ProjectStageEscalationScheduler`)
For every project sitting in `SALES` or `ACCOUNTS`:
$$\text{Days In Stage} = \text{Current Date} - \text{Stage Entry Date}$$
*(Where Stage Entry Date is `salesEntryDate` or `accountsEntryDate`)*
- **Thresholds**:
  - `daysInStage < 11`: `GREEN` (Normal tenure, no notification fired).
  - `11 ≤ daysInStage < 21`: `YELLOW` (Stalled project alert).
  - `daysInStage ≥ 21`: `RED` (Critical delay escalation).
- **Missing Required Fields Diagnostics**: The scheduler compiles an explicit checklist of missing fields included in the alert email:
  - For `SALES`: Checks `invoiceAmount`, `expectedDeliveryDate`, `installationTaskList`, and `projectClassification`.
  - For `ACCOUNTS`: Checks `invoiceAmount`, `amountReceived > 0`, and `paymentStatus`.
- **Suppression & Deduplication**: To prevent email spam, the system tracks `salesStatusLastNotified` and `accountsStatusLastNotified` on the `Project` entity. Alerts only fire if the severity tier escalates (`GREEN` → `YELLOW`, `GREEN` → `RED`, or `YELLOW` → `RED`).

### 5. Deletion Request Approval Flow (`ProjectService`)
1. **Request**: A user calls `requestProjectDeletion(id, reason, requestedBy, requestedByRole)`.
2. **Locking**: The project's `deletionRequestStatus` is set to `PENDING`, `deletionReason` is stored, and `deletionRequestedAt` is stamped.
3. **Admin Review**: An Admin calls `reviewProjectDeletionRequest(id, approve, remarks, reviewedBy, reviewedByRole)`.
4. **Outcome**:
   - If `approve == true`: `deletionRequestStatus` transitions to `APPROVED`, `deletionReviewedBy` and `deletionReviewRemarks` are stamped, `AuditLogService.logProjectDeletionReviewed` logs approval, and an email is dispatched to the requester (`sendProjectDeletionDecisionToRequester`).
   - If `approve == false`: `deletionRequestStatus` transitions to `REJECTED`, preserving the project active in the pipeline while informing the requester via email.

---

## 6. Database & Entities

The persistence layer (`com.incial.crm.entity`) utilizes Spring Data JPA / Hibernate mapped to a relational **PostgreSQL** database across 13 core tables:

```
+-----------------------------------------------------------------------------------+
|                                  users                                            |
| id (PK) | email (UK) | role | zone | executive_onboarded_count | ...              |
+-----------------------------------------------------------------------------------+
       ^
       | (user_id FK)
+-----------------------------------------------------------------------------------+
|                                  projects                                         |
| id (PK) | school | current_stage | invoice_amount | pending_amount | zone | ...     |
+-----------------------------------------------------------------------------------+
       |               |                 |                 |
       | (project_id)  | (project_id)    | (project_id)    | (project_id)
       v               v                 v                 v
+--------------+ +--------------------+ +---------------+ +-------------------------+
| project_     | | project_stage_     | | payment_      | | user_activity_logs    |
| activity_    | | history            | | transactions  | | (metadata / entity_id)|
| logs         | +--------------------+ +---------------+ +-------------------------+
+--------------+
```

### Detailed Breakdown of the 13 Entities

#### 1. `User` (`users` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Core Fields**: `name` (`String`), `email` (`String`, Unique), `passwordHash` (`String`, BCrypt), `role` (`String`), `zone` (`String`, normalized).
- **Audit & Governance**: `createdAt` (`LocalDateTime`), `termsAccepted` (`Boolean`), `policyVersion` (`String`).
- **Performance Counters**: `executiveOnboardedCount`, `salesToAccountsCount`, `accountsToInstallationCount`, `installationDoneCount` (`Integer`, tracked for quick dashboard KPI badges).

#### 2. `Project` (`projects` table)
- **Primary Key**: `id` (`Long`, Identity)
- **School & Discovery Info**: `school` (`String`), `contactPerson` (`String`), `contactNumber` (`String`), `place` (`String`), `district` (`String`), `region` (`String`), `projectName` (`String`), `parentCompany` (`String`), `executiveRemarks` (`TEXT`), `schoolLocationLink` (`String`), `zone` (`String`).
- **Timeline Tracking**: `lastContactDaysAgo` (`Integer`), `nextContactDays` (`Integer`), `createdDaysAgo` (`Integer`), `stageDaysAgo` (`Integer`), `firstMeetingOutcome` (`String`).
- **Stage & Ownership**: `currentStage` (`String`, indexed), `previousStage` (`String`), `stageChangeTimestamp` (`LocalDateTime`), `stageChangedBy` (`String`).
  - **Sales Stage**: `salesUserEmail`, `salesEntryDate`, `salesStatusLastNotified`.
  - **Accounts Stage**: `accountsUserEmail`, `accountsEntryDate`, `accountsStatusLastNotified`.
  - **Installation Stage**: `installationUserEmail`, `installationEntryDate`.
- **Financial & Commercials**: `projectValue` (`BigDecimal(15,2)`), `invoiceAmount` (`BigDecimal(15,2)`), `amountReceived` (`BigDecimal(15,2)`), `pendingAmount` (`BigDecimal(15,2)`, indexed), `paymentStatus` (`String`).
- **Execution & Feedback**: `expectedDeliveryDate` (`LocalDate`), `installationTaskList` (`TEXT`), `projectClassification` (`String`), `installationStatus` (`String`), `feedbackCollected` (`Boolean`).
- **Deletion Workflow**: `deletionRequestStatus` (`String`: `PENDING`/`APPROVED`/`REJECTED`), `deletionReason` (`TEXT`), `deletionRequestedBy` (`String`), `deletionRequestedAt` (`LocalDateTime`), `deletionReviewedBy` (`String`), `deletionReviewedAt` (`LocalDateTime`), `deletionReviewRemarks` (`TEXT`).

#### 3. `ProductionEntry` (`production_entries` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Constraints**: Unique constraint (`month_value`, `year_value`, `product_id`, `zone`).
- **Fields**: `monthValue` (`Integer`), `yearValue` (`Integer`), `productId` (`Long`), `zone` (`String(20)`), `quantity` (`Integer`), `updatedAt` (`LocalDateTime`), `updatedBy` (`String`).

#### 4. `ProductionProduct` (`production_products` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Fields**: `name` (`String`, Unique), `category` (`String(100)`), `status` (`String(50)`: `ACTIVE`/`INACTIVE`), `createdAt` (`LocalDateTime`), `createdBy` (`String`).

#### 5. `PaymentTransaction` (`payment_transactions` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Indexes**: Indexed on `project_id` and composite `(project_id, payment_date)`.
- **Fields**: `projectId` (`Long`), `amountPaid` (`BigDecimal(15,2)`), `paymentDate` (`LocalDate`), `paymentProofUrl` (`TEXT`), `remarks` (`TEXT`), `createdAt` (`LocalDateTime`), `createdBy` (`String`).

#### 6. `PaymentRecord` (`payment_records` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Fields**: `paymentId` (`String(120)`, Unique index), `dueDate` (`LocalDate`), `daysSinceDue` (`Integer`), `statusColor` (`PaymentStatusColor` Enum: `GREEN`/`YELLOW`/`RED`), `status` (`String`), `actionRequired` (`String`), `createdAt` (`LocalDateTime`).

#### 7. `AuditLog` (`audit_logs` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Indexes**: `timestamp DESC`, `zone`, `category`.
- **Fields**: `event` (`String(80)`), `description` (`TEXT`), `actorName` (`String`), `actorEmail` (`String`), `category` (`AuditCategory` Enum), `zone` (`String(20)`), `timestamp` (`LocalDateTime` in `Asia/Kolkata` IST).

#### 8. `ProjectActivityLog` (`project_activity_logs` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Indexes**: `(project_id, timestamp)`.
- **Fields**: `projectId` (`Long`), `actionType` (`String(50)`: `CREATED`, `STAGE_CHANGED`, `FIELD_UPDATED`, `STATUS_CHANGED`), `fieldName` (`String(100)`), `oldValue` (`TEXT`), `newValue` (`TEXT`), `performedBy` (`String`), `userId` (`Long`), `performedByRole` (`String(50)`), `timestamp` (`LocalDateTime`), `ipAddress` (`String(50)`), `remarks` (`TEXT`).

#### 9. `ProjectStageHistory` (`project_stage_history` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Indexes**: `(project_id, timestamp)`, `(project_id, to_stage, timestamp)`, `(user_id, from_stage, to_stage, timestamp)`.
- **Fields**: `projectId` (`Long`), `fromStage` (`String(50)`), `toStage` (`String(50)`), `changedBy` (`String`), `userId` (`Long`), `changedByRole` (`String`), `timestamp` (`LocalDateTime`), `remarks` (`TEXT`), `isSystemTriggered` (`Boolean`, default false).

#### 10. `UserActivityLog` (`user_activity_logs` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Relationships**: `@ManyToOne(fetch = FetchType.LAZY) JoinColumn(name = "user_id") User user`.
- **Indexes**: `(user_id, timestamp DESC)`, `(entity_type, entity_id, timestamp DESC)`, `(user_role, action_type, timestamp DESC)`.
- **Fields**: `userRole` (`String(50)`), `actionType` (`ActivityActionType` Enum), `entityType` (`ActivityEntityType` Enum), `entityId` (`Long`), `projectId` (`Long`), `timestamp` (`LocalDateTime`), `metadata` (`TEXT` JSON), `actionCode` (`String(120)`), `category` (`String(50)`), `ipAddress` (`String(50)`).

#### 11. `NotificationOutbox` (`notification_outbox` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Indexes**: `(status, next_retry_at)`, `(aggregate_type, aggregate_id)`, `created_at`.
- **Fields**: `eventType` (`String(120)`), `aggregateType` (`String(80)`), `aggregateId` (`Long`), `payload` (`TEXT` JSON), `status` (`String(20)`: `PENDING`/`SENT`/`FAILED`), `retryCount` (`Integer`, default 0), `nextRetryAt` (`LocalDateTime`), `createdAt` (`LocalDateTime`).

#### 12. `NotificationDelivery` (`notification_delivery` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Fields**: `outboxId` (`Long`), `recipientUserId` (`Long`), `recipientRole` (`String(50)`), `channel` (`String(20)`: `IN_APP`/`EMAIL`), `status` (`String(20)`: `SENT`/`FAILED`), `sentAt` (`LocalDateTime`), `errorMessage` (`TEXT`).

#### 13. `Otp` (`otps` table)
- **Primary Key**: `id` (`Long`, Identity)
- **Fields**: `email` (`String`), `otpCode` (`String(6)`), `expiresAt` (`LocalDateTime`), `verified` (`Boolean`, default false), `createdAt` (`LocalDateTime`).

---

## 7. API & Controller Architecture

The Spring Boot web layer exposes ~82 REST endpoints mapped across 11 `@RestController` classes under `api/v1/*` (`com.incial.crm.controller`):

### 1. `AuthController` (`/api/v1/auth`)
- **`POST /register`**: Registers a new user account with initial role and zone assignments.
- **`POST /login`**: Authenticates credentials (`email`, `password`), logs audit events, and issues signed JWT bearer tokens.
- **`POST /google-login`**: Verifies Google OAuth 2.0 ID tokens (`GoogleLoginRequest`) and issues JWT access tokens.
- **`POST /forgot-password`**: Triggers a 6-digit OTP code sent via `EmailService` to the user's email address.
- **`POST /verify-otp`**: Validates the OTP against the `otps` table and returns a temporary verification token/status.
- **`POST /change-password`**: Updates `passwordHash` after successful OTP verification.
- **`POST /update-password/request-otp` / `/password/change/request`**: Requests OTP for an already authenticated session.
- **`POST /update-password/confirm` / `/password/change/confirm`**: Confirms password update with OTP for authenticated sessions.
- **`GET /me`**: Returns the `UserDto` profile of the currently authenticated JWT user (`ZoneAccessService.UserContext`).
- **`POST /accept-policy`**: Records that the user accepted the terms and privacy policy (`termsAccepted = true`, `policyVersion`).

### 2. `ProjectController` (`/api/v1/projects`)
- **`POST /create`**: Creates a new lead project (`CreateProjectRequest`). Checks `ProjectLimitService.assertProjectCreationAllowed()`.
- **`PUT /{id}`**: Updates basic school and contact information for an existing project.
- **`POST /{id}/transition`**: Requests a stage transition (`toStage`, `remarks`). Executed through `WorkflowService.validateTransition()`.
- **`GET /executive` & `/executive/paged`**: Returns projects assigned to or created by the executive (`getExecutiveProjects`), optionally filtered by status buckets.
- **`GET /dashboard`**: Returns role-tailored dashboard project lists (`getDashboardProjects`) filtered by `ZoneAccessService`.
- **`GET /dashboard/count`**: Returns total counts of projects matching role view buckets (`countDashboardProjects`).
- **`GET /dashboard/badge-counts` & `/dashboard/badge-counts/admin`**: Returns structured KPI badge counters (`DashboardBadgeCountsDto`) for UI badges (e.g. `pendingOnboarded`, `pendingSales`, `pendingAccounts`).
- **`GET /sales` & `PUT /{id}/sales`**: Retrieves `SALES` stage projects or updates commercial details (`UpdateSalesDataRequest`: `invoiceAmount`, `expectedDeliveryDate`, `installationTaskList`, `projectClassification`).
- **`POST /{id}/ready-for-accounts`**: Sales Coordinator marks a project ready for Accounts verification (`markReadyForAccounts`).
- **`GET /accounts` & `PUT /{id}/accounts`**: Retrieves `ACCOUNTS` stage projects or updates payment records (`UpdateAccountsDataRequest`: `amountReceived`, `paymentStatus`). Recalculates `pendingAmount`.
- **`GET /installation` & `PUT /{id}/installation`**: Retrieves `INSTALLATION` stage projects or updates physical deployment status (`UpdateInstallationDataRequest`: `installationStatus`).
- **`GET /completed` & `/completed/paged` & `/completed/count`**: Retrieves final completed projects for institutional archives.
- **`GET /feedback/queue`**: Retrieves completed projects awaiting customer feedback verification (`getFeedbackQueue`).
- **`PATCH /{id}/feedback`**: Toggles customer satisfaction flag (`feedbackCollected = true/false`).
- **`GET /completed/archive/filter` & `/completed/archive/export`**: Filters archive records and exports them (`exportCompletedProjectsForArchive`).
- **`GET /completed/metrics`**: Returns aggregate completed project metrics (`CompletedProjectMetricsDto`).
- **`GET /dropped`**: Retrieves projects marked as `DROPPED` (`getDroppedProjects`).
- **`GET /deletion-requests`**: Retrieves projects with pending deletion requests (`getDeletionRequestProjects`).
- **`POST /{id}/deletion-request`**: Requests project deletion (`reason`, `requestedBy`).
- **`POST /{id}/deletion-request/review`**: Admin approves or rejects deletion request (`reviewProjectDeletionRequest`).
- **`GET /{id}` & `/all` & `/stage/{stage}` & `DELETE /{id}`**: Standard CRUD lookups, all-project administration queries, stage lookups, and administrative deletions.

### 3. `ProductionController` (`/api/v1/production`)
- **`GET /products` & `POST /products`**: Retrieves or creates active catalog hardware products (`ProductionProduct`).
- **`GET /summary` & `PUT /summary`**: Retrieves or saves monthly hardware production entries (`ProductionEntry`) by month, year, and zone.
- **`GET /trends`**: Retrieves yearly production trend aggregation (`ProductionTrendDto`).

### 4. `PaymentController` (`/api/v1/payments`)
- **`POST /evaluate`**: Evaluates `PaymentEvaluationRequest` against due dates, classifies into `GREEN`/`YELLOW`/`RED`, stores `PaymentRecord`, and enqueues outbox alerts.

### 5. `AnalyticsController` (`/api/v1/analytics`)
- **`GET /dashboard`**: Returns comprehensive analytics summaries (`AnalyticsDto`) including project counts and pipeline health.
- **`GET /stage-distribution`**: Returns stage-by-stage distribution counts (`StageDistributionDto`).
- **`GET /monthly-trends`**: Returns monthly onboarding and completion velocity (`MonthlyTrendDto`).
- **`GET /financial-summary`**: Returns overall financial totals (`FinancialSummaryDto`: total project value, total invoiced, total received, total pending).

### 6. `ReportController` (`/api/v1/reports`)
- **`GET /` & `/projects/tracking` & `/projects/tracking/paged` & `/projects/tracking/page-data`**: Retrieves multi-dimensional project tracking reports (`ProjectTrackingReportDto`) with date, zone, and stage filters.
- **`GET /payments/aging`**: Retrieves payment aging reports (`PaymentAgingReportDto`) categorized by aging buckets.
- **`GET /sales/pending-count`**: Retrieves counts of pending sales verifications (`SalesPendingCountDto`).
- **`GET /admin/employee-status`**: Retrieves administrative employee activity status reports (`EmployeeStatusReportDto`).
- **`GET /export/projects.csv`**: Streams a formatted CSV export of project tracking data.

### 7. `ActivityLogController` (`/api/v1/activity`)
- **`GET /me`**: Returns activity logs of the currently authenticated user (`UserActivityLogDto`).
- **`GET /user/{userId}` & `/statement/{userId}`**: Returns detailed activity statements (`UserActivityStatementDto`) for specific users within date ranges.
- **`GET /role/{role}` & `/entity/{entityType}/{entityId}` & `/`**: Filters user activities by role or entity ID, or performs paginated activity search (`search`).

### 8. `AuditLogController` (`/api/v1/audit-logs`)
- **`GET /`**: Returns paginated security and system audit logs (`AuditLogDto`).
- **`GET /counts`**: Returns category-wise and zone-wise audit log event counts (`getActivityCounts`).

### 9. `UserController` (`/api/v1/users`)
- **`GET /all` & `/directory`**: Retrieves all users or filters directory lists by role and zone.
- **`GET /me` & `/{id}`**: Retrieves current profile or user profile by ID.
- **`POST /create` & `PUT /update/{id}` & `DELETE /delete/{id}`**: User provisioning, role/zone updates (`updateUserRole`), and user deletions (`deleteUser`).
- **`PATCH /me/name` / `/update-name`**: Updates the current authenticated user's display name (`updateCurrentUserName`).

### 10. `UserNameController` (`/api/users`)
- **`PATCH /update-name`**: Auxiliary backward-compatible route mapping for updating user display names.

### 11. `UserTrackingController` (`/api/v1/tracking` & `/api/tracking`)
- **`GET /executive`**: Retrieves performance and tracking data for a specific field executive (`ExecutiveTrackingResponseDto`).
- **`GET /role-based`**: Retrieves aggregated role-level performance tracking (`RoleBasedTrackingResponseDto`).
- **`GET /user-tracking-data`**: Retrieves comprehensive user activity metrics (`UserTrackingDataDto`).

---

## 8. Frontend Architecture

The frontend (`client/` directory) is built with **React 19**, **TypeScript**, **Vite 6**, **Tailwind CSS 3.4**, and **Lucide React** icons. It communicates with the backend via `axios` REST calls.

### Route Mapping & Navigation Structure (`client/pages/`)
- **`LoginPage.tsx` & `ForgotPasswordPage.tsx`**: Public authentication entry points featuring JWT login, Google OAuth buttons, and OTP-based password recovery.
- **`DashboardPage.tsx`**: The main landing dashboard upon login. Displays dynamic role KPI badges (`DashboardBadgeCountsDto`), summary cards, and quick navigation links tailored to the user's role.
- **`ExecutivePage.tsx`**: Dedicated workspace for `ROLE_EXECUTIVE`. Features:
  - Lead discovery and project onboarding cards.
  - Stage transition controls (`ON_PROGRESS` → `QUOTATION_SENT` → `IN_REVIEW` → `ONBOARDED`).
  - Mobile-responsive card layouts with high-visibility pending/in-accounts badges.
  - Sorting by maximum pending amount first, then in-accounts, then fully paid.
- **`SalesCoordinatorPage.tsx`**: Dedicated workspace for `ROLE_SALES_COORDINATOR`. Features:
  - Verification queues for newly onboarded projects.
  - Form inputs for `invoiceAmount`, `expectedDeliveryDate`, `installationTaskList`, and `projectClassification`.
  - 2x2 grid badges for clean visual consistency without redundant UI labels.
- **`AccountsPage.tsx`**: Dedicated workspace for `ROLE_ACCOUNTS`. Features:
  - Financial tracking cards displaying total invoiced, amount received, and real-time calculated `pendingAmount`.
  - Action controls to update payment statuses and clear projects for deployment once `pendingAmount == 0`.
- **`InstallationPage.tsx`**: Dedicated workspace for `ROLE_INSTALLATION`. Features:
  - Deployment manifests showing school locations, contact numbers, and technical task lists.
  - Status toggle controls (`IN_PROGRESS`, `DONE`, `WORK_DONE`) to signal physical completion.
- **`WorkCompletedPage.tsx`**: The permanent institutional project archive (`COMPLETED`). Displays rich historical records, filtering options (`getCompletedProjectsForArchive`), metrics (`CompletedProjectMetricsDto`), and CSV export triggers.
- **`FeedbackPage.tsx`**: Workspace for `ROLE_FEEDBACK`. Displays the feedback verification queue (`getFeedbackQueue`) allowing officers to interview schools and toggle `feedbackCollected = true/false`.
- **`ProductionPage.tsx`**: Hardware manufacturing management page. Allows zone operators to manage catalog items (`ProductionProduct`), input monthly quantities (`ProductionEntry`), and view trend analytics.
- **`ReportsPage.tsx` & `ActivityExplorerPage.tsx`**: Enterprise intelligence views rendering project tracking tables, payment aging charts, employee status audits, and full chronological activity log explorers.
- **`ProfilePage.tsx` & `UniversalCalendarPage.tsx` & `OperatorPage.tsx`**: User profile management (display name updates, password changes), universal project schedule viewing, and data entry operator provisioning.
- **`ConsentPage.tsx`, `PrivacyPolicyPage.tsx`, `TermsOfServicePage.tsx`, `UnauthorizedPage.tsx`, `NotFoundPage.tsx`**: Compliance modals, policy agreements (`acceptPolicy`), error boundaries, and 404/403 pages.

---

## 9. Scheduled Jobs

The application runs five specialized automated schedulers inside the `com.incial.crm.scheduler` package using Spring's `@Scheduled` annotations configured with `Asia/Kolkata` (IST) timezone handling:

### 1. `ProjectStageEscalationScheduler`
- **Schedule**: Daily at 08:15 AM IST (`0 15 8 * * *`, `Asia/Kolkata`).
- **What It Does**: Audits all projects currently in `SALES` and `ACCOUNTS` stages (`findByCurrentStageAndZoneIsNotNull`, `findAccountsEscalationCandidates`).
- **Thresholds & Logic**:
  - Calculates `daysInStage = ChronoUnit.DAYS.between(stageEntryDate, LocalDate.now())`.
  - If `daysInStage ≥ 21` (`RED` severity): Enqueues `SALES_STAGE_RED` or `ACCOUNTS_STAGE_RED` outbox notifications targeting `ROLE_ADMIN` and `ROLE_SUPER_ADMIN`.
  - If `11 ≤ daysInStage < 21` (`YELLOW` severity): Enqueues `SALES_STAGE_YELLOW` or `ACCOUNTS_STAGE_YELLOW` outbox notifications targeting `ROLE_ADMIN`.
  - Compiles specific diagnostic lists of missing required fields (e.g., `Invoice amount not entered`, `Expected delivery date not entered`) and stores them inside the JSON payload.
  - Updates `salesStatusLastNotified` / `accountsStatusLastNotified` to prevent duplicate alert spam on consecutive days unless severity escalates.

### 2. `ProjectDataIntegrityScheduler`
- **Schedule**: Daily at 08:45 AM IST (`0 45 8 * * *`, `Asia/Kolkata`).
- **What It Does**: Validates data consistency invariants across active pipeline stages (`SALES`, `ACCOUNTS`, `INSTALLATION`, `COMPLETED`).
- **Invariants Checked**:
  - `SALES` stage must have non-null `salesUserEmail` and `salesEntryDate`.
  - `ACCOUNTS` stage must have non-null `accountsUserEmail` and `accountsEntryDate`.
  - `INSTALLATION` stage must have non-null `installationUserEmail` and `installationEntryDate`.
  - `INSTALLATION` stage must **never** have `pendingAmount > 0` (`DATA_INTEGRITY invalid INSTALLATION pending>0`).
  - `COMPLETED` stage must have `installationStatus` equal to `DONE` or `WORK_DONE`.
- **Outcome**: Logs structured warning violations (`DATA_INTEGRITY stage=... missing... projectId=...`) to alerts/monitoring logs so administrators can proactively fix data anomalies.

### 3. `ExecutiveFollowUpReminderScheduler`
- **Schedule**: Daily at 08:00 AM IST (`0 0 8 * * *`, `Asia/Kolkata`).
- **What It Does**: Scans active pre-onboarding pipeline stages (excluding `ONBOARDED`, `SALES`, `ACCOUNTS`, `INSTALLATION`, `COMPLETED`, `DROPPED`).
- **Thresholds & Logic**:
  - Identifies projects whose scheduled follow-up dates (`today` to `today.plusDays(2)`) are approaching.
  - Publishes `ExecutiveFollowUpReminderEvent(project.getId())` via Spring `ApplicationEventPublisher`.
  - `ExecutiveFollowUpReminderEmailListener` intercepts the event and dispatches reminder emails (`sendExecutiveFollowUpReminder`) to the assigned field executive (`exec1@dreamindia.com`).

### 4. `AuditLogCleanupScheduler`
- **Schedule**: Daily at 12:30 AM midnight IST (`0 30 0 * * *`, `Asia/Kolkata`).
- **What It Does**: Calls `AuditLogService.deleteLogsOlderThan30Days()` to purge historical security and routine audit logs (`audit_logs` table) older than 30 days.
- **Why**: Keeps database storage lean while maintaining a full 30-day rolling compliance window.

### 5. `NotificationOutboxScheduler`
- **Schedule**: Polling loop every 60 seconds (`@Scheduled(fixedDelay = 60000)`).
- **What It Does**: Calls `NotificationOutboxService.processPending()` to process pending outbox events (`status = 'PENDING'`) where `nextRetryAt` is null or past due.
- **Logic**:
  - Resolves target recipients (`resolveRecipients`) based on project zone and event type roles (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, `ROLE_SALES_COORDINATOR`, `ROLE_ACCOUNTS`).
  - Invokes `EmailService` methods (`sendRoleStageEscalationToAdmin`, etc.) to send HTML emails.
  - On success: Marks `notification_outbox.status = 'SENT'` and writes a `SENT` record to `notification_delivery`.
  - On failure: Increments `retryCount`. If `retryCount < MAX_RETRY_DELAY_MINUTES / BASE_RETRY_DELAY_MINUTES`, calculates exponential backoff (`nextRetryAt = now + retryCount * 5 mins`). Otherwise marks outbox as `FAILED` and records `errorMessage` in `notification_delivery`.

---

## 10. Integrations & External Services

### 1. Spring Boot Starter Mail (`EmailService`)
- **Configuration**: Uses SMTP credentials via `application.yml` (`spring.mail.host = smtp.gmail.com`, `port = 587`, `auth = true`, `starttls.enable = true`).
- **Custom App Mail Properties**: `app.mail.from-address`, `app.mail.from-name` (`Incial WorkHub`), `app.mail.reply-to`, `app.mail.base-url` (`https://workhub.dreamindiaschool.com`).
- **HTML Email Templates**: `EmailService` constructs branded, professional HTML emails with responsive tables, inline styles, call-to-action buttons, and detailed metadata for:
  - User Welcome & Account Creation (`sendUserWelcomeEmail`).
  - OTP Password Recovery (`sendOtpEmail`).
  - Project Onboarded Alerts to Admin (`sendProjectOnboardedToAdmin`).
  - Project Completion Notifications (`sendProjectCompletedToExecutive`, `sendProjectCompletedToAdmin`).
  - SLA Stage Escalations (`sendRoleStageEscalationToAdmin`).
  - Payment Delay Alerts (`sendPaymentDelayToAdmin`).
  - Project Deletion Requests & Decisions (`sendProjectDeletionRequestToAdmin`, `sendProjectDeletionDecisionToRequester`).
  - Executive Upcoming Follow-up Reminders (`sendExecutiveFollowUpReminder`).

### 2. Google OAuth 2.0 (`google-api-client`)
- **Integration**: Integrated via `com.google.api-client:google-api-client:2.2.0` and configured via `google.client.id`.
- **Flow**: When users click "Sign in with Google" on `LoginPage.tsx`, the client obtains an ID token from Google's OAuth servers and posts it to `POST /api/v1/auth/google-login`. `AuthController` verifies token authenticity against Google certificates, matches the verified email against `users.email`, and issues an internal JWT session token.

### 3. Bucket4j & Caffeine Cache Rate Limiting (`RateLimitService`)
- **Integration**: Integrated via `com.bucket4j:bucket4j-core:8.10.1` and `caffeine`.
- **Token Bucket Algorithms**:
  - `LOGIN_IP:*`: 5 requests per minute (`app.rate-limit.login-requests-per-minute = 5`). Prevents brute-force credential stuffing on `/api/v1/auth/login` and `/google-login`.
  - `USER:*` / `EMAIL:*` (Authenticated): 100 requests per minute (`authenticated-requests-per-minute = 100`).
  - `IP:*` (Unauthenticated): 50 requests per minute (`unauthenticated-requests-per-minute = 50`).
- **Enforcement**: When rate limits are exceeded, `RateLimitFilter` rejects HTTP requests with status `429 Too Many Requests` and sets the `Retry-After` HTTP response header.

### 4. Actuator & Prometheus Metrics (`micrometer-registry-prometheus`)
- **Integration**: Exposes runtime application health and operational metrics (`/actuator/health`, `/actuator/info`, `/actuator/prometheus`).
- **Custom Percentile Distributions**: Configured to emit P50, P95, and P99 latency histograms for HTTP server requests (`management.metrics.distribution.percentiles.http.server.requests = 0.5,0.95,0.99`) alongside HikariCP connection pool active/idle metrics for enterprise scraping by Prometheus and Grafana dashboards.

---

## 11. Configuration & Environments

### Spring Profiles (`src/main/resources/`)
The application supports multi-environment configurations via YAML profile files:
1. **`application.yml` (Common Core)**: Base configuration defining project name (`Dream-India`), JPA properties, mail SMTP defaults, JWT configuration, Bucket4j rate limits (`app.rate-limit.*`), project limits (`app.project-limits.*`), and Prometheus metric exports.
2. **`application-local.yml` (Local Development)**: Active profile by default (`spring.profiles.active: local`). Connects to local PostgreSQL instance (`jdbc:postgresql://localhost:5432/dream_india_crm`), sets `show_sql: true`, and formats SQL output for debugging.
3. **`application-dev.yml` (Development / Staging Server)**: Configured for cloud staging environments. Uses environment variable overrides (`${DB_URL}`, `${DB_USER}`, `${DB_PASS}`, `${JWT_SECRET}`) and relaxed CORS rules for development previews.
4. **`application-doc.yml` (Documentation Generation)**: Optimized profile for generating Swagger/OpenAPI docs or dry-run schema verifications without triggering heavy background schedulers.
5. **`application-prod.yml` (Production Engine)**: Production environment settings. Enforces secure environment variable bindings, strict HikariCP connection pooling maximums, suppressed SQL query logging (`show_sql: false`), and production base URLs (`https://workhub.dreamindiaschool.com`).

### Core Application Limits (`AppProjectLimitProperties`)
- `app.project-limits.max-projects`: Maximum lifetime projects allowed in the system before `ProjectLimitService` pauses new `POST /api/v1/projects/create` calls.
- `app.project-limits.max-pipeline-projects`: Maximum concurrent active projects allowed inside pipeline stages (`LEAD` through `INSTALLATION`). Prevents teams from opening more leads than operations can physically fulfill.

---

## 12. Security Architecture

### 1. Authentication & Session Management
- **JWT Bearer Tokens**: Stateless authentication using `io.jsonwebtoken:jjwt-api:0.12.3`. Upon successful login or Google OAuth verification, `AuthService` signs a JWT using HMAC-SHA256 (`${JWT_SECRET}`).
- **Authentication Filter**: A custom `JwtAuthenticationFilter` intercepts incoming requests (excluding `/api/v1/auth/*` and `/actuator/*`), extracts the `Authorization: Bearer <token>` header, verifies token signatures, and populates Spring Security (`SecurityContextHolder`) with `UsernamePasswordAuthenticationToken`.

### 2. Password Hashing & Recovery Flow
- **BCrypt Hashing**: All user passwords (`password_hash`) are hashed using Spring Security's `BCryptPasswordEncoder` with a strength factor of 12 (`$2b$12$...`). Plaintext passwords are never logged or stored.
- **Secure OTP Flow**: When a user requests a password reset (`POST /api/v1/auth/forgot-password`), a random 6-digit OTP code is generated, stored inside the `otps` table with an expiration timestamp (`expiresAt = LocalDateTime.now().plusMinutes(15)`), and emailed via `EmailService`. Upon `POST /api/v1/auth/verify-otp`, `verified` is set to `true`, authorizing the subsequent `POST /api/v1/auth/change-password` request.

### 3. Role-Based & Zone-Based Access Control (`ZoneAccessService`)
The application implements two-layered access security (`requireCurrentUserContext()`):
1. **Role-Based Access Control (RBAC)**: Checked via method-level security or programmatic checks. For instance, `ROLE_SALES_COORDINATOR` endpoints check `requireCurrentUserContext().role()`.
2. **Geographic Zone Filtering (`Zone.java`)**: Every user and project belongs to a zone (`ZONE_1`, `ZONE_2`, `ZONE_3`).
   - **Global Access Roles (`ROLE_SUPER_ADMIN`, `ROLE_ADMIN`)**: Can pass any `?zone=ZONE_X` parameter or view all zones.
   - **Global Operational Access Roles (`ROLE_SALES_COORDINATOR`, `ROLE_ACCOUNTS`, `ROLE_INSTALLATION`, `ROLE_FEEDBACK`, `ROLE_OPERATOR`)**: Can query and process projects across any zone because coordination, accounts verification, and dispatch operations span multiple regional sales offices (`hasGlobalOperationalAccess(role) == true`).
   - **Restricted Zone Roles (`ROLE_EXECUTIVE`)**: Field Executives are **strictly locked** to their assigned user zone (`UserContext.zone`). If an Executive from `ZONE_1` attempts `resolveRequestedZoneFilter("ZONE_2")` or calls `assertCanAccessProject(project)` on a `ZONE_2` project, the system immediately blocks execution with `ErrorCode.FIELD_ACCESS_DENIED: Cross-zone access denied`.

---

## 13. Project Lifecycle & Stage Transitions

### Complete Stage Flow Diagram

```
                              +-------------------------+
                              |         LEAD            |
                              +-------------------------+
                                           |
                              [ROLE_EXECUTIVE / ADMIN]
                                           |
                                           v
                              +-------------------------+
                              |       ON_PROGRESS       |   <--- Must record firstMeetingOutcome
                              +-------------------------+        ('POSITIVE', 'NEGATIVE', 'FIFTY_FIFTY')
                                           |
                              [ROLE_EXECUTIVE / ADMIN]
                                           |
                                           v
                              +-------------------------+
                              |     QUOTATION_SENT      |
                              +-------------------------+
                                           |
                              [ROLE_EXECUTIVE / ADMIN]
                                           |
                                           v
                              +-------------------------+
                              |        IN_REVIEW        |
                              +-------------------------+
                                           |
                              [ROLE_EXECUTIVE / ADMIN]
                                           |
                                           v
                              +-------------------------+
                              |        ONBOARDED        |
                              +-------------------------+
                                           |
                              [ROLE_SALES_COORDINATOR]
                                           |
                                           v
                              +-------------------------+
                              |          SALES          |   <--- Must record expectedDeliveryDate
                              +-------------------------+
                                           |
                              [ROLE_SALES_COORDINATOR]
                                           |
                                           v
                              +-------------------------+
                              |         ACCOUNTS        |   <--- Must have pendingAmount == 0
                              +-------------------------+
                                           |
                                   [ROLE_ACCOUNTS]
                                           |
                                           v
                              +-------------------------+
                              |       INSTALLATION      |   <--- Must have installationStatus ==
                              +-------------------------+        ('DONE' or 'WORK_DONE')
                                           |
                                 [ROLE_INSTALLATION]
                                           |
                                           v
                              +-------------------------+
                              |        COMPLETED        |   ---> [Feedback Queue: ROLE_FEEDBACK]
                              +-------------------------+
```

### Stage Summary Table

| Stage Name | Primary Owner Role | Entry Prerequisite & Guardrails | Key Activities & Fields Updated |
| :--- | :--- | :--- | :--- |
| **`LEAD`** | `ROLE_EXECUTIVE` | Project created via `POST /create`. | Initial discovery (`school`, `contactPerson`, `contactNumber`, `place`, `district`). |
| **`ON_PROGRESS`** | `ROLE_EXECUTIVE` | Transition from `LEAD`. | Conduct school meetings. **Guardrail**: Leaving `ON_PROGRESS` requires `firstMeetingOutcome` (`POSITIVE`, `NEGATIVE`, or `FIFTY_FIFTY`). |
| **`QUOTATION_SENT`** | `ROLE_EXECUTIVE` | Transition from `ON_PROGRESS`. | Send commercial proposals (`projectValue`). |
| **`IN_REVIEW`** | `ROLE_EXECUTIVE` | Transition from `QUOTATION_SENT`. | Management review and quotation negotiation. |
| **`ONBOARDED`** | `ROLE_EXECUTIVE` | Transition from `IN_REVIEW`. | School deal locked. Handover to internal coordination teams. |
| **`SALES`** | `ROLE_SALES_COORDINATOR` | Transition from `ONBOARDED`. | Coordinator takes ownership (`salesUserEmail`, `salesEntryDate`). Inputs `invoiceAmount`, `installationTaskList`, `projectClassification`. **Guardrail**: Moving to `ACCOUNTS` requires `expectedDeliveryDate != null`. |
| **`ACCOUNTS`** | `ROLE_ACCOUNTS` | Transition from `SALES`. | Accounts Officer takes ownership (`accountsUserEmail`, `accountsEntryDate`). Records `amountReceived` and `paymentStatus`. **Critical Guardrail**: Cannot transition to `INSTALLATION` unless `pendingAmount == 0`. |
| **`INSTALLATION`** | `ROLE_INSTALLATION` | Transition from `ACCOUNTS`. | Dispatch and physical setup (`installationUserEmail`, `installationEntryDate`). **Guardrail**: Cannot transition to `COMPLETED` unless `installationStatus` is `DONE` or `WORK_DONE`. |
| **`COMPLETED`** | `ROLE_FEEDBACK` / `ROLE_ADMIN` | Transition from `INSTALLATION`. | Final institutional archive. Enters Feedback Queue where `ROLE_FEEDBACK` collects customer review (`feedbackCollected = true`). |
| **`DROPPED`** | `ROLE_EXECUTIVE` / `ROLE_ADMIN` | Can transition from early pipeline stages (`LEAD`, `ON_PROGRESS`, `QUOTATION_SENT`, `IN_REVIEW`). | Marks dead deals or cancelled institutional proposals (`getDroppedProjects`). |

---

## 14. Technologies Used

### Backend Stack
- **Core Framework**: Java 17, Spring Boot 3.2.0 (`spring-boot-starter-web`, `spring-boot-starter-validation`).
- **Database & Persistence**: PostgreSQL Driver (`org.postgresql:postgresql`), Spring Data JPA / Hibernate (`spring-boot-starter-data-jpa`).
- **Security & Authentication**: Spring Security (`spring-boot-starter-security`, `spring-security-crypto` BCrypt), JSON Web Tokens (`io.jsonwebtoken:jjwt-api:0.12.3`), Google OAuth 2.0 API Client (`com.google.api-client:google-api-client:2.2.0`).
- **Caching & Rate Limiting**: Bucket4j Core (`com.bucket4j:bucket4j-core:8.10.1`), Caffeine Cache (`com.github.ben-manes.caffeine:caffeine`).
- **Messaging & Notifications**: Spring Boot Mail (`spring-boot-starter-mail` / JavaMailSender).
- **Monitoring & Observability**: Spring Boot Actuator (`spring-boot-starter-actuator`), Micrometer Prometheus Registry (`io.micrometer:micrometer-registry-prometheus`).
- **Configuration & Utilities**: Lombok (`org.projectlombok:lombok`), Spring Dotenv (`me.paulschwarz:spring-dotenv:2.5.4`), Env Printer (`io.github.skywalker690:spring-boot-starter-env-printer:1.0.0`), Jackson ObjectMapper (`com.fasterxml.jackson`).

### Frontend Stack
- **Core Library**: React 19.2.3 (`react`, `react-dom`).
- **Language & Types**: TypeScript 5.8.2 (`typescript`, `@types/node`).
- **Routing & Networking**: React Router DOM 7.10.1 (`react-router-dom`), Axios 1.13.2 (`axios`).
- **Build Tooling**: Vite 6.2.0 (`vite`, `@vitejs/plugin-react`).
- **Styling & UI**: Tailwind CSS 3.4.17 (`tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/forms`, `@tailwindcss/typography`, `@tailwindcss/aspect-ratio`), Lucide React Icons (`lucide-react:0.561.0`).

---

## 15. Repository Statistics

- **Total Modules**: 2 distinct modules (`server` Java Spring Boot backend, `client` TypeScript Vite React frontend).
- **Approximate API Endpoint Count**: **~82 REST endpoints** mapped across 11 `@RestController` classes (`com.incial.crm.controller`).
- **Entity Count**: **13 JPA Entities** mapped directly to 13 relational PostgreSQL database tables (`com.incial.crm.entity`).
- **Scheduled Jobs**: **5 Automated Schedulers** running cron tasks and polling loops (`com.incial.crm.scheduler`).
- **External Integrations**: **3 Core Integrations** (SMTP Gmail via `spring-boot-starter-mail`, Google OAuth 2.0 Identity via `google-api-client`, Prometheus Metrics Scraping via `micrometer-registry-prometheus`).
- **Major Packages (`com.incial.crm.*`)**:
  - `config`: Security, CORS, JWT, Rate Limiting, and Project Limit properties.
  - `controller`: 11 REST API Controllers.
  - `dto`: Request/Response Data Transfer Objects.
  - `entity`: 13 JPA Domain Entities.
  - `enums`: `Zone` (`ZONE_1`–`ZONE_3`), `AuditCategory`, `ActivityActionType`, `ActivityEntityType`, `PaymentStatusColor`.
  - `event`: Spring Application Events (`ExecutiveFollowUpReminderEvent`, `PaymentDelayEscalationEvent`, `ProjectCompletedEvent`, `ProjectDeletionRequestedEvent`, `ProjectDeletionReviewedEvent`, `ProjectOnboardedEvent`).
  - `exception`: Domain exceptions (`DomainException`) and structured error codes (`ErrorCode`).
  - `ratelimit`: Token bucket decision records (`RateLimitDecision`, `RateLimitFilter`).
  - `repository`: 13 Spring Data JPA Repositories.
  - `scheduler`: 5 Background Cron & Polling Schedulers.
  - `security`: JWT filter (`JwtAuthenticationFilter`), token provider (`JwtTokenProvider`), and Spring Security chain configuration.
  - `service`: Core domain business logic (`ProjectService`, `NotificationOutboxService`, `WorkflowService`, `ZoneAccessService`, `PaymentEvaluationService`, `ProductionService`, `AnalyticsService`, `ReportService`, `ActivityLogService`, `AuditLogService`, `AuthService`, `UserService`, `EmailService`, `ProjectLimitService`, `RateLimitService`, `UserTrackingService`).
