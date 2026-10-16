# Visual Databricks App Builder – Version 1.0 RequirementS Document

## Project ​Overview​

The Visual Databricks App Builder (VDAB) is a low-code platform, with chatbot feature, designed to make building and deploying apps for the Databricks environment as simple as working with a modern drag-and-drop web editor. It provides a canvas where users can visually arrange UI components (tables, charts, filters, buttons, forms) and bind them directly to Databricks SQL queries, Delta tables, or ML models. Developers and data teams don’t have to hand-code React or Streamlit (V2) apps, instead, they configure properties, map data sources, and define actions through a schema-driven interface. Behind the scenes, the builder generates a ready-to-run App and deploys directly to Databricks with secure authentication, and governance through Unity Catalog.

## MVP Features and Requirements

### SAAS Features

#### Account Management

The SaaS platform must include a secure user account system to allow individuals and organizations to register, authenticate, and manage their VDAB access.
* **Account Creation**: Users can create an account with email, password and they will be verified via email.
* **Email Verification**: A verification email is sent upon registration to validate ownership before enabling access. It is also used as the login process so there are no passwords.
* **Multi-Tenant Isolation**: Each account belongs to a specific tenant; all stored workflows, assets, and configurations are logically and physically separated by tenant ID.
* **Audit Logging**: All user actions such as login, workflow changes, and publishing events are logged.
* **Encryption**: All credentials, workspace connections, and stored workflows are encrypted in transit (TLS 1.2+) and at rest (AES-256).
* **Billing and Subscription Management**: Simple subscription-based model (monthly or annual) with tracking for number of users, published apps, or workspaces.
     * **STRIPE Integration**:

#### User Management

Administrators within each tenant can invite and manage users.
* **Invite Users**: Admins can invite additional users by email, assign roles, and manage permissions.
* **Roles**:
     * **Admin**: Full control of account settings, billing, workspace connections, and user roles.
     * **Editor**: Can create and modify workflows, templates, and connections.
* **User Directory**: Each tenant has a user list showing name, role, and last activity.
* **Profile Information**: Users can edit name and email.

#### Databricks Connection Management

Users must be able to connect VDAB to one or more Databricks workspaces securely.
* **Connect Workspace**: Establish connection to a databricks workspace.
     * Test connectivity to verify credentials and permissions.
     * Connections are encrypted at rest and saved by tenant.
* **Workspace Selector**: Users with multiple workspaces can easily switch between them when building or publishing.

##### Organization and Workspace Settings

Each tenant (organization) has administrative settings that control overall usage and governance.
* **Tenant Profile**: Includes organization name, subscription plan, billing info, and default workspace.
* **Usage Dashboard**: Displays number of users, number of published apps and number of Databricks workspaces linked.
* **Audit and Compliance Logs**: Provides downloadable logs of user actions, publish history, and connection changes.

### Core Builder Capabilities

#### Visual App Workflow

The visual app workflow is the main flow interface. It allows users to view forms and modals to see the complete application workflow.

#### Visual Designer Canvas

The visual designer canvas is the main form builder interface. It is a visual workspace where users build their entire form or modal by assembling components and connecting them together. Each form has controls or components that have actions and can be dragged, resized. The canvas visually represents the layout of a specific form or informational page.

#### Visual Form Workflow

The visual form workflow is a visual interface that shows all the pieces and actions of form or modal. It allows users to view controls and actions in a workflow view. Each element on the canvas represents a functional unit, such as a data form, SQL query, or Databricks Job trigger.

#### Property and Component Panel

The right area is where all the available components are shown. Once a component is added to a form, its properties can be configured. The property panel shows properties like title, color, font, padding, and data binding. Bindings can link to Databricks SQL queries, Delta tables, or ML endpoints, all discoverable via the Unity Catalog metadata browser.

#### Action and Event System

Every component can have one or more event triggers such as OnClick, OnSubmit, OnChange, or OnLoad. These events execute bound actions, including SQL queries, Databricks Jobs, and Model Serving calls. This event framework provides full interactivity without scripting.

#### One-Click Deployment to Databricks App

When the app is ready, users click Deploy to package the applications workflow configuration, front-end assets, and bindings into a Databricks App bundle. The app runs entirely inside Databricks, using only in-workspace resources.

### Standard Canvas Components

VDAB’s component library must include a complete set of configurable components that serve as the foundation for all data-entry and user interaction across the platform. Each input element not only collects user data but also supports specific actions that determine how it interacts with Databricks resources, updates downstream components, or triggers workflows. Below are the expanded requirements and capabilities for each component type.

#### Text Input
Used for capturing freeform, single line, text-based input.

#### Text Area
Used for capturing freeform, multiline, text-based input.

#### Dropdown / Combo Box
Displays a selectable list of options that can be defined statically by the designer or populated dynamically from Databricks SQL queries.

#### Date Picker
Allows users to choose single dates. Date pickers support both manual entry and calendar-based selection, with validation for allowable ranges.

#### Time Picker
Allows users to choose times.

#### Numeric Input / Slider
Used for entering numeric values or adjusting thresholds interactively. Sliders visualize range selections and support incremental adjustment with configurable min, max, and step values.

#### Checkbox
Represents Boolean values with a checkbox.

#### Toggle
Represents Boolean values for simple on/off or true/false states.

#### Button
A universal action trigger used to execute defined workflows, queries, or UI events.

### UI Design Canvas Components

The canvas will use responsive, pre-styled UI elements that maintain visual alignment, accessibility standards, and mobile compatibility without requiring developers to manually code layouts or CSS. These components allow users to design polished Databricks-native apps that follow the same aesthetic and usability standards expected in modern enterprise software.

#### Form Group / Section
Serves as a structural container for organizing related input fields into logical sections or steps. Form groups can include validation logic and workflow dependencies that determine which sections appear based on prior input.

#### Columns Layout
Serves as a structural container for organizing content into columns.

#### Row Layout
Serves as a structural container for organizing content into rows.

#### Tabs
Tabs allow users to organize complex forms into separate sections. Tabs provide horizontal or vertical navigation between content panes.

#### Accordions
Accordions allow users to organize complex forms into separate sections. Accordions allow expansion and collapse of sections within a single page.

#### Toast
Toast notifications for short-lived messages.

### Visualization Canvas Components

Each visualization component is configurable through the property panel and binds directly to Databricks SQL, Delta tables, or DLT outputs. The goal is to give both technical and non-technical users the ability to design dashboards and analytical interfaces that look professional and operate seamlessly within Databricks. Charts and graphs are the foundation of VDAB’s visualization system.  All charts will be powered by live data retrieved from Databricks SQL endpoints or DLT metrics tables. Each chart will have configurable axes, labels, legends, color palettes, and refresh intervals. The supported charts are listed below.

#### Line Chart

#### Bar Chart

#### Pie Chart

#### Donut Chart

### Data Display Canvas Components

The data display canvas in VDAB provides the foundation for presenting Databricks data interactively within applications. It enables users to build fully functional data exploration, review, and update experiences directly from Delta tables or SQL query results. Each component on the canvas is designed to work with governed Databricks data while supporting high performance and visual clarity.

#### Data Grid
The data grid is a core component that allows users to view tabular data retrieved from Databricks SQL or Delta tables. It supports common grid features such as column sorting, dynamic filtering, and column resizing. The grid refreshes dynamically in response to filters or parameter changes, allowing near real-time data interaction.

#### Editable Data Grid
The editable data grid builds on the standard data grid by introducing inline editing of individual cells and rows. Users can update numeric, text, or Boolean values directly in place without opening separate forms.

#### File Upload
The file upload component allows users to upload CSV, JSON, or other supported file formats.

### Data Connectors

The data connectors in VDAB are responsible for establishing secure and efficient communication between applications built in the visual builder and Databricks resources. These connectors ensure that every app component, whether a grid, chart, form, or model, can retrieve and update data directly within the Databricks environment while preserving governance, authentication, and performance standards.

#### Permissions
Add ability to create an app with specified resources and permissions in the same way you create an app on Databricks

#### Databricks SQL Warehouse Connector
The Databricks SQL Warehouse connector is a data access layer for VDAB. It executes SQL queries, retrieves results, handles pagination, and performs write-back operations when users update data from within the app.

#### Delta Lake Connector (via Unity Catalog)
The Delta Lake connector provides governed access to Delta tables within Unity Catalog. It supports full CRUD operations, Create, Read, Update, Delete.

#### Databricks Jobs API Connector
The Databricks Jobs API connector allows VDAB applications to start, monitor, and control Databricks Jobs directly through user interactions.

#### Model Serving Connector
The Model Serving Connector connects with Databricks Model Serving endpoints.

#### Lake Flow Designer
The Model Serving Connector connects with Databricks Model Serving endpoints.

### Chat Auto-Builder (AI Assistant)

The Chat Auto-Builder extends VDAB beyond a visual design tool by introducing an intelligent, natural-language creation layer. Users can describe the type of app they want in plain language, and the system interprets the request and creates the app or form.

This capability makes app creation conversational and iterative. Non-technical users can prototype fully functional Databricks-native apps in minutes, while advanced users benefit from rapid scaffolding and intelligent recommendations.

For version 1.0 of VDAB this will be listed as in beta mode.