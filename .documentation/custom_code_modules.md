# Custom Code Modules

Custom Code Modules let you add your own Python functions to a VDAB app and call them from component workflows. Use them when a built-in workflow action is not quite enough: validating a form, changing component labels, copying values between controls, calculating derived values, preparing uploaded files, or coordinating several UI updates from one event.

This guide is written for VDAB builders. It focuses on how to write, link, and use modules in the app builder experience.

## How Custom Modules Work

A custom module is Python code that lives in the generated app file named `custom_modules.py`. You edit this file from the VDAB Code tab.

Each callable module is a top-level Python function:

```python
def my_function(ctx):
    # Your code here
    return {"ok": True}
```

You then connect that function to a workflow by adding a `Call Custom Module` action. When the workflow runs, VDAB calls your function and passes it a context object named `ctx`.

The context object gives your code a small set of safe helpers:

```python
ctx.get_value("componentCodeName")
ctx.set_value("componentCodeName", value)
ctx.set_label("componentCodeName", "New label")
```

Use the component code name, not the display label. For example, a button might display `Submit`, but its code name might be `submitButton`.

## Quick Start

1. Add components to your app.
2. Give every component you want to read or update a clear code name, such as `customerName`, `statusFilter`, or `submitButton`.
3. Open the Code tab.
4. Select `custom_modules.py`.
5. Add a top-level Python function that accepts `ctx`.
6. Open the Workflow Builder.
7. Select a component event, such as a button `onClick` or text input `onChange`.
8. Add a `Call Custom Module` action.
9. Choose your function from the Target function dropdown.
10. Save, preview, or deploy the app.

Example:

```python
def update_submit_button(ctx):
    customer_name = ctx.get_value("customerName")

    if customer_name:
        ctx.set_label("submitButton", f"Submit for {customer_name}")
    else:
        ctx.set_label("submitButton", "Submit")

    return {"customerName": customer_name}
```

Link this function to the `onChange` event of a text input with code name `customerName`. The function updates the label of a button with code name `submitButton`.

## Writing `custom_modules.py`

VDAB can discover functions that are declared at the top level of `custom_modules.py`.

Good:

```python
def normalize_customer_name(ctx):
    value = ctx.get_value("customerName") or ""
    ctx.set_value("customerName", value.strip().title())
    return {"normalized": True}
```

Not discoverable as a workflow target:

```python
if True:
    def nested_function(ctx):
        return {"ok": True}
```

Function naming rules:

- Start the function name with a letter.
- Use only letters, digits, and underscores.
- Do not start with an underscore.
- Do not use double underscores.
- Keep functions top-level.
- Use one function per workflow action when possible.

Recommended signature:

```python
def function_name(ctx):
    return {"ok": True}
```

You can define helper functions too. If a helper is not meant to be called directly from a workflow, keep it private by starting it with `_`. Private helper names will not be valid workflow targets.

```python
def _calculate_discount(total):
    if total > 1000:
        return 0.1
    return 0

def apply_discount(ctx):
    total = ctx.get_value("orderTotal") or 0
    discount = _calculate_discount(float(total))
    ctx.set_value("discountRate", discount)
    return {"discount": discount}
```

## The `ctx` Object

### `ctx.get_value(code_name)`

Reads the current value for a component.

```python
status = ctx.get_value("statusFilter")
```

Common returned values:

- Text input: string
- Dropdown: selected option string, or list of strings for multiselect
- Checkbox and toggle: boolean
- Slider: number
- Date picker: date value
- Time picker: time value
- File upload: uploaded file objects or file-related state depending on runtime
- Editable data window: edited table state depending on runtime

If the component code name is unknown or the value has not been set yet, the result may be `None`.

### `ctx.set_value(code_name, value)`

Sets the value for a component by code name.

```python
ctx.set_value("statusFilter", "Approved")
```

Use a value shape that matches the target component. For example, set a checkbox to `True` or `False`, a slider to a number inside its range, a dropdown to one of its configured options, and a Label to the display text you want to show.

### `ctx.set_label(code_name, label)`

Overrides the visible label for a component.

```python
ctx.set_label("submitButton", "Ready to Submit")
```

This is useful for dynamic button text, contextual field labels, chart titles, table headings, upload prompts, and lightweight status messages. For display-only components such as Label, `ctx.set_label(...)` updates the visible text.

## Return Values

A custom module can return:

- `None`
- A dictionary
- A simple value, such as a string, number, or boolean

Returning a dictionary is recommended:

```python
def validate_customer(ctx):
    name = ctx.get_value("customerName")

    if not name:
        return {"ok": False, "message": "Customer name is required."}

    return {"ok": True}
```

VDAB records whether the action succeeded or errored. Workflow routes can continue through `onSuccess`, `onError`, or `always`.

## Linking a Module to a Workflow

Custom modules run through workflows. They are not attached directly to component properties.

To link a module:

1. Open the Workflow Builder.
2. Create or select a workflow.
3. Choose a trigger component.
4. Choose the event for that component.
5. Add an action node.
6. Set the action type to `Call Custom Module`.
7. Select a Target function from `custom_modules.py`.
8. Connect follow-up actions using `onSuccess`, `onError`, or `always` routes as needed.

The Target function dropdown is populated from top-level `def` declarations in `custom_modules.py`. If your function does not appear, check that it is not indented, commented out, misspelled, or named with an invalid identifier.

## Components That Can Trigger Modules

The following VDAB components support workflow events and can trigger a `Call Custom Module` action.

| Component | Event | Typical module use |
| --- | --- | --- |
| Button | `onClick` | Run explicit user actions, update labels, copy values, validate before continuing |
| Form | `onSubmit` | Validate fields, normalize inputs, set status feedback |
| Text Input | `onChange` | Clean text, update dependent labels, populate related fields |
| Dropdown | `onChange` | Apply a selection to other controls, change labels, set defaults |
| Checkbox | `onChange` | Enable option-driven behavior, update messages, mirror boolean state |
| Toggle | `onChange` | Switch app modes, set defaults, update related labels |
| Slider | `onChange` | Calculate bands, thresholds, and derived values |
| Date Picker | `onChange` | Validate ranges, derive period labels, set related dates |
| Time Picker | `onChange` | Validate schedule inputs, build display labels |
| File Upload | `onChange` | Inspect uploaded file state, update status controls |
| Editable Data Window | `onChange` | React to edited rows, update status text, prepare downstream actions |

Components without workflow events cannot directly trigger a module. A module may still affect them if they have a code name and support the value or label update you are trying to apply.

## Button Modules

Buttons trigger modules with `onClick`. Use button modules when the user should explicitly start an action.

Example: copy a selected status into a text field and update the button label.

```python
def apply_status(ctx):
    status = ctx.get_value("statusFilter") or "Pending"

    ctx.set_value("statusText", status)
    ctx.set_label("applyStatusButton", f"Applied: {status}")

    return {"status": status}
```

Builder setup:

1. Add a dropdown with code name `statusFilter`.
2. Add a text input with code name `statusText`.
3. Add a button with code name `applyStatusButton`.
4. Create a workflow on `applyStatusButton`.
5. Select event `onClick`.
6. Add `Call Custom Module`.
7. Select `apply_status(ctx)`.

Good button use cases:

- Apply filters.
- Reset a group of inputs.
- Run a validation function before a workflow continues.
- Change a button label after it is used.

## Form Modules

Forms trigger modules with `onSubmit`. Use form modules when the user submits a group of fields together.

Example: trim and validate a form before follow-up workflow actions run.

```python
def prepare_customer_form(ctx):
    name = (ctx.get_value("customerName") or "").strip()
    email = (ctx.get_value("customerEmail") or "").strip().lower()

    ctx.set_value("customerName", name)
    ctx.set_value("customerEmail", email)

    if not name or "@" not in email:
        ctx.set_value("formStatus", "Fix required fields")
        return {"ok": False, "message": "Name and valid email are required."}

    ctx.set_value("formStatus", "Customer ready")
    return {"ok": True, "name": name, "email": email}
```

Builder setup:

1. Add a form with code name `customerForm`.
2. Place text inputs in the form, such as `customerName` and `customerEmail`.
3. Add a text input or status field with code name `formStatus`.
4. Create a workflow on `customerForm`.
5. Select event `onSubmit`.
6. Add `Call Custom Module`.
7. Select `prepare_customer_form(ctx)`.

Good form use cases:

- Normalize text before saving.
- Validate required fields.
- Set labels or values based on the submitted form state.
- Prepare data for a later `Save To Table` or Databricks action.

## Text Input Modules

Text inputs trigger modules with `onChange`. Use text input modules for immediate feedback as a user types or leaves a field.

Example: build a greeting and update a button label.

```python
def update_customer_greeting(ctx):
    name = (ctx.get_value("customerName") or "").strip()

    if name:
        ctx.set_value("greetingText", f"Hello, {name}!")
        ctx.set_label("submitButton", f"Submit {name}")
    else:
        ctx.set_value("greetingText", "")
        ctx.set_label("submitButton", "Submit")

    return {"name": name}
```

Builder setup:

1. Add a text input with code name `customerName`.
2. Add another text input or display-oriented component with code name `greetingText`.
3. Add a button with code name `submitButton`.
4. Create a workflow on `customerName`.
5. Select event `onChange`.
6. Add `Call Custom Module`.
7. Select `update_customer_greeting(ctx)`.

Good text input use cases:

- Trim or format text.
- Build a search term.
- Update labels based on entered text.
- Copy a value into another component.

## Dropdown Modules

Dropdowns trigger modules with `onChange`. Use dropdown modules to react to a selected option.

Example: set a priority label and default assignee based on ticket type.

```python
def apply_ticket_type(ctx):
    ticket_type = ctx.get_value("ticketType")

    if ticket_type == "Production Issue":
        ctx.set_value("priority", "High")
        ctx.set_label("priority", "Priority (production issue)")
    elif ticket_type == "Question":
        ctx.set_value("priority", "Low")
        ctx.set_label("priority", "Priority (question)")
    else:
        ctx.set_value("priority", "Medium")
        ctx.set_label("priority", "Priority")

    return {"ticketType": ticket_type}
```

Builder setup:

1. Add a dropdown with code name `ticketType`.
2. Add a dropdown or text input with code name `priority`.
3. Create a workflow on `ticketType`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `apply_ticket_type(ctx)`.

For multiselect dropdowns, expect a list of selected option values.

```python
def summarize_selected_regions(ctx):
    regions = ctx.get_value("regionFilter") or []
    ctx.set_label("regionFilter", f"Regions selected: {len(regions)}")
    return {"regions": regions}
```

Good dropdown use cases:

- Set defaults for dependent controls.
- Update labels based on selected categories.
- Convert a user selection into a value used by later workflow actions.

## Checkbox Modules

Checkboxes trigger modules with `onChange`. Use checkbox modules when a boolean option should change the rest of the app.

Example: show whether archived records are included.

```python
def toggle_archived_message(ctx):
    include_archived = bool(ctx.get_value("includeArchived"))

    if include_archived:
        ctx.set_value("resultsStatus", "Results include archived records")
    else:
        ctx.set_value("resultsStatus", "Active results only")

    return {"includeArchived": include_archived}
```

Builder setup:

1. Add a checkbox with code name `includeArchived`.
2. Add a text input or status field with code name `resultsStatus`.
3. Create a workflow on `includeArchived`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `toggle_archived_message(ctx)`.

Good checkbox use cases:

- Include or exclude optional behavior.
- Toggle status text.
- Mirror a boolean value into another component.

## Toggle Modules

Toggles trigger modules with `onChange`. They are similar to checkboxes, but are often used for app modes.

Example: switch between simple and advanced mode.

```python
def apply_advanced_mode(ctx):
    advanced = bool(ctx.get_value("advancedMode"))

    if advanced:
        ctx.set_value("thresholdSlider", 75)
        ctx.set_value("thresholdStatus", "Advanced threshold enabled")
    else:
        ctx.set_value("thresholdSlider", 50)
        ctx.set_value("thresholdStatus", "Standard threshold enabled")

    return {"advanced": advanced}
```

Builder setup:

1. Add a toggle with code name `advancedMode`.
2. Add a slider with code name `thresholdSlider`.
3. Add a text input or status field with code name `thresholdStatus`.
4. Create a workflow on `advancedMode`.
5. Select event `onChange`.
6. Add `Call Custom Module`.
7. Select `apply_advanced_mode(ctx)`.

Good toggle use cases:

- Switch modes.
- Set a group of default values.
- Update labels to match the selected mode.

## Slider Modules

Sliders trigger modules with `onChange`. Use slider modules to calculate bands, thresholds, or derived values.

Example: label a risk band from a numeric threshold.

```python
def update_risk_band(ctx):
    score = ctx.get_value("riskScore") or 0

    if score >= 80:
        band = "High"
    elif score >= 50:
        band = "Medium"
    else:
        band = "Low"

    ctx.set_value("riskBand", band)
    ctx.set_label("riskBand", f"Risk band: {band}")

    return {"score": score, "band": band}
```

Builder setup:

1. Add a slider with code name `riskScore`.
2. Add a text input or dropdown with code name `riskBand`.
3. Create a workflow on `riskScore`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `update_risk_band(ctx)`.

Good slider use cases:

- Calculate thresholds.
- Update derived values.
- Display severity or range labels.

## Date Picker Modules

Date pickers trigger modules with `onChange`. Use date picker modules to calculate periods or validate date ranges.

Example: calculate a reporting period label from start and end dates.

```python
def update_reporting_period(ctx):
    start_date = ctx.get_value("startDate")
    end_date = ctx.get_value("endDate")

    if start_date and end_date:
        ctx.set_label("runReportButton", f"Run report: {start_date} to {end_date}")
    else:
        ctx.set_label("runReportButton", "Run report")

    return {"startDate": str(start_date), "endDate": str(end_date)}
```

Builder setup:

1. Add date pickers with code names `startDate` and `endDate`.
2. Add a button with code name `runReportButton`.
3. Create a workflow on `startDate`.
4. Add another workflow on `endDate` if both fields should update the label.
5. In each workflow, add `Call Custom Module`.
6. Select `update_reporting_period(ctx)`.

Good date picker use cases:

- Build period labels.
- Validate start and end dates.
- Set related date fields.

## Time Picker Modules

Time pickers trigger modules with `onChange`. Use time picker modules for scheduling and time-window labels.

Example: create a schedule summary.

```python
def update_schedule_summary(ctx):
    start_time = ctx.get_value("startTime")
    end_time = ctx.get_value("endTime")

    if start_time and end_time:
        ctx.set_value("scheduleSummary", f"{start_time} - {end_time}")
    else:
        ctx.set_value("scheduleSummary", "")

    return {"startTime": str(start_time), "endTime": str(end_time)}
```

Builder setup:

1. Add time pickers with code names `startTime` and `endTime`.
2. Add a text input with code name `scheduleSummary`.
3. Create workflows on `startTime` and `endTime`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `update_schedule_summary(ctx)` in both workflows.

Good time picker use cases:

- Display time windows.
- Validate schedule inputs.
- Update dependent fields when a selected time changes.

## File Upload Modules

File uploads trigger modules with `onChange`. Use file upload modules to respond after files are selected.

Example: update a status label after upload state changes.

```python
def update_upload_status(ctx):
    uploaded = ctx.get_value("sourceFiles")

    if uploaded:
        try:
            count = len(uploaded)
        except TypeError:
            count = 1
        ctx.set_value("uploadStatus", f"Files selected: {count}")
    else:
        count = 0
        ctx.set_value("uploadStatus", "No files selected")

    return {"fileCount": count}
```

Builder setup:

1. Add a file upload component with code name `sourceFiles`.
2. Add a text input or status field with code name `uploadStatus`.
3. Create a workflow on `sourceFiles`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `update_upload_status(ctx)`.

Good file upload use cases:

- Update upload status text.
- Capture file counts.
- Prepare metadata for later workflow actions.

## Editable Data Window Modules

Editable Data Windows trigger modules with `onChange`. Use these modules to react when a user edits table data.

Example: mark a table as having unsaved or changed data.

```python
def mark_table_changed(ctx):
    edited_rows = ctx.get_value("editableOrders")

    ctx.set_value("tableStatus", "Review changes before saving")

    return {"hasChanges": edited_rows is not None}
```

Builder setup:

1. Add an Editable Data Window with code name `editableOrders`.
2. Add a text input or status field with code name `tableStatus`.
3. Create a workflow on `editableOrders`.
4. Select event `onChange`.
5. Add `Call Custom Module`.
6. Select `mark_table_changed(ctx)`.

Good editable data window use cases:

- Show change status.
- Update helper labels.
- Prepare values for downstream save or SQL actions.

## Chaining Custom Modules With Other Actions

A `Call Custom Module` action can be part of a larger workflow.

Common chains:

- `Call Custom Module` -> `Trigger Toast`
- `Call Custom Module` -> `Build SQL` -> `Run SQL` -> `Set Binding`
- `Call Custom Module` -> `Save To Table`
- `Build SQL` -> `Run SQL` -> `Call Custom Module`

Use routes to control what happens next:

- `onSuccess`: continue only when the module completes without an exception.
- `onError`: continue when the module raises an exception.
- `always`: continue either way.

Example:

```python
def require_customer_name(ctx):
    name = (ctx.get_value("customerName") or "").strip()

    if not name:
        ctx.set_label("submitButton", "Customer name required")
        raise ValueError("Customer name is required.")

    ctx.set_label("submitButton", "Submitting")
    return {"customerName": name}
```

Workflow idea:

1. Button `onClick`.
2. `Call Custom Module` with `require_customer_name`.
3. `onSuccess` route to `Save To Table`.
4. `onError` route to `Trigger Toast`.

## Practical Patterns

### Reset a form-like group

```python
def reset_filters(ctx):
    ctx.set_value("customerName", "")
    ctx.set_value("statusFilter", "All")
    ctx.set_value("includeArchived", False)
    ctx.set_label("applyFiltersButton", "Apply filters")
    return {"reset": True}
```

### Keep labels in sync with values

```python
def update_search_button_label(ctx):
    search = (ctx.get_value("searchText") or "").strip()
    label = f"Search for {search}" if search else "Search"
    ctx.set_label("searchButton", label)
    return {"search": search}
```

### Guard a workflow with validation

```python
def validate_required_filters(ctx):
    region = ctx.get_value("regionFilter")
    start_date = ctx.get_value("startDate")

    if not region or not start_date:
        ctx.set_label("runQueryButton", "Select region and start date")
        raise ValueError("Missing required filters.")

    ctx.set_label("runQueryButton", "Run query")
    return {"region": region, "startDate": str(start_date)}
```

### Set a derived field

```python
def calculate_order_total(ctx):
    quantity = float(ctx.get_value("quantity") or 0)
    unit_price = float(ctx.get_value("unitPrice") or 0)
    total = quantity * unit_price

    ctx.set_value("orderTotal", round(total, 2))
    return {"total": total}
```

## Troubleshooting

### My function does not appear in the Target function dropdown

Check that:

- The function is in `custom_modules.py`.
- The function starts at the beginning of the line with `def`.
- The function is not commented out.
- The function name starts with a letter.
- The function name does not start with `_`.
- The function name does not contain `__`.
- The app has the latest code in the Code tab.

### My workflow says the function is not callable

The workflow target must match the function name exactly. If you renamed the function, reselect it in the `Call Custom Module` action.

### `ctx.get_value(...)` returns `None`

Common causes:

- The component code name is misspelled.
- You used the visible label instead of the code name.
- The component has not produced a value yet.
- The value belongs to a component that is not currently rendered.

### `ctx.set_value(...)` does not look right

Make sure the value matches the target component type:

- Text inputs expect strings.
- Checkboxes and toggles expect booleans.
- Sliders expect numbers inside the configured range.
- Dropdowns expect configured option values.
- Multiselect dropdowns expect a list of configured option values.

### The module works, but the UI does not change how I expected

Use `ctx.set_label(...)` for visible label changes and `ctx.set_value(...)` for component values. Some visual elements may not react to every kind of value update. Prefer simple, component-appropriate updates.

### The workflow should stop when validation fails

Raise an exception when the module should use the `onError` route.

```python
def validate_before_save(ctx):
    if not ctx.get_value("customerName"):
        raise ValueError("Customer name is required.")
    return {"ok": True}
```

## Best Practices

- Use clear component code names before writing module code.
- Keep module functions small and focused.
- Return dictionaries so outputs are easy to inspect later.
- Raise `ValueError` for validation failures that should follow the workflow `onError` route.
- Use helper functions for repeated calculations.
- Avoid long-running work inside UI-triggered modules.
- Prefer built-in workflow actions for standard VDAB behavior and custom modules for app-specific logic.
- Use `ctx.set_label(...)` for short user feedback and a workflow `Trigger Toast` action for explicit notifications.

## Complete Example

This example uses a text input, dropdown, checkbox, slider, label, and button to build a small customer review workflow.

Components:

| Component | Code name | Purpose |
| --- | --- | --- |
| Text Input | `customerName` | Customer name |
| Dropdown | `customerTier` | Tier selection |
| Checkbox | `includeArchived` | Include archived records |
| Slider | `riskScore` | Risk score |
| Label | `reviewSummary` | Generated summary |
| Button | `runReviewButton` | Starts the review |

`custom_modules.py`:

```python
def update_review_summary(ctx):
    name = (ctx.get_value("customerName") or "Unknown customer").strip()
    tier = ctx.get_value("customerTier") or "Standard"
    include_archived = bool(ctx.get_value("includeArchived"))
    score = ctx.get_value("riskScore") or 0

    if score >= 80:
        risk_band = "High"
    elif score >= 50:
        risk_band = "Medium"
    else:
        risk_band = "Low"

    archive_text = "including archived records" if include_archived else "active records only"
    summary = f"{name}: {tier} tier, {risk_band} risk, {archive_text}."

    ctx.set_label("reviewSummary", summary)
    ctx.set_label("runReviewButton", f"Run review for {name}")

    return {
        "customerName": name,
        "tier": tier,
        "includeArchived": include_archived,
        "riskBand": risk_band,
    }

def validate_and_run_review(ctx):
    name = (ctx.get_value("customerName") or "").strip()

    if not name:
        ctx.set_label("runReviewButton", "Enter a customer name")
        raise ValueError("Customer name is required.")

    ctx.set_label("runReviewButton", "Review ready")
    return {"ok": True, "customerName": name}
```

Workflow setup:

1. Add a Label component named `reviewSummary`, and set its Size property to `Medium` or the display size you prefer.
2. Add `Call Custom Module` with `update_review_summary` to the `onChange` event for `customerName`.
3. Add `Call Custom Module` with `update_review_summary` to the `onChange` event for `customerTier`.
4. Add `Call Custom Module` with `update_review_summary` to the `onChange` event for `includeArchived`.
5. Add `Call Custom Module` with `update_review_summary` to the `onChange` event for `riskScore`.
6. Add `Call Custom Module` with `validate_and_run_review` to the `onClick` event for `runReviewButton`.
7. Connect the button module's `onSuccess` route to the next real action, such as `Build SQL`, `Run SQL`, or `Trigger Toast`.
8. Connect the button module's `onError` route to `Trigger Toast` if you want a visible validation message.

This pattern keeps continuous UI updates separate from the final user-triggered action.
