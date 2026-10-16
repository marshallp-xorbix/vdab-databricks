# Layout State Transition Scenarios (Desired Behavior)
This file outlines the rules for the layout system I am implementing for components in VDAB. Scenarios marked with **[tested]** have corresponding Vitest unit tests. Unmarked scenarios represent intended behavior but are not yet covered by automated tests.

Performance note: for lookup/indexing patterns in layout/render code (Map/Set guidance, anti-patterns, and checklist), see `.documentation/layout_lookup_performance_guidelines.md`.

## Desired Rules
1. **Component contexts**
   - All components are stored in a `ComponentContexts` record keyed by context ID.
   - The main page uses the key `page_1`. Each modal gets its own context key: `modal_<modalId>`.
   - Layout components (Form/Rows/Columns/Tabs) own their `children[]` array but do **not** create a separate context key; their children live in the same context as the layout component itself (either `page_1` or `modal_<id>`).
   - Modal components themselves receive `undefined` layout (they are not positioned within a context).
   - Components do **not** move across top-level contexts (`page_1` vs `modal_<id>`).
2. **Layout format**
   - Regular components use `layout` as a JSON string: `{"y": N}`.
   - Children of a **Tabs** component use an extended format: `{"tabIndex": N, "y": N}`, where `tabIndex` identifies the tab pane and `y` is the position within that pane.
   - `y` values are always non-negative integers and represent render order within a context or pane.
3. **Adding components**
   - New components are appended by assigning the next incremental `y` (`0, 1, 2, ...`) based on the highest existing `y` among top-level components in the target context.
   - Components can also be dropped at a specific index between existing components; the scenarios below illustrate dropping at the **end** of the list unless otherwise noted.
4. **Form/Expander/Column/Row/Tabs children**
   - **Form** and **Expander** children use contiguous `layout` values starting at `0` and compact on delete.
   - **Rows/Columns** children use `layout` values as index-based slot positions; **gaps are allowed** (e.g., `y: 0` and `y: 2` with slot `1` empty). No compaction occurs on delete.
   - **Tabs** children carry both `tabIndex` and `y`. On any reorder or removal, children are regrouped by `tabIndex` and each pane's `y` values are renormalized to `0, 1, 2, ...` based on sort order.
   - Render order for all layout types is determined by `y` value (ascending).
5. **Remove + deleteSubtree**
   - The removed component and all descendants are removed.
   - Only the affected context is compacted (top-level `y` values are renormalized).

## Scenario Format
- **Initial State** (components, `layout`, `children`)
- **Action**
- **Expected State** (after operations)

---

## Scenario A1: Add a top-level component to the main page [tested]
**Initial State (page_1)**
```
Components:
- A (Button) layout {"y": 0}
- B (TextInput) layout {"y": 1}
```

**Action**
Add C (Dropdown) to page_1 (appended at end).

**Expected State**
```
Components:
- A layout {"y": 0}
- B layout {"y": 1}
- C layout {"y": 2}
```

---

## Scenario A2: Add a child to a Form
**Initial State (page_1)**
```
Components:
- B (Button) layout {"y": 0}
- F (Form) layout {"y": 1} children [X]
- X (TextInput) layout {"y": 0}
```

**Action**
Drop Y (Checkbox) into Form F (appended at end of Form's children).

**Expected State**
```
Components:
- B layout {"y": 0}
- F layout {"y": 1} children [X, Y]
- X layout {"y": 0}
- Y layout {"y": 1}
```

---

## Scenario A3: Add a child to Columns in a Modal
**Initial State (page_1)**
```
Components:
- B (Button) layout {"y": 0}
```

**Initial State (modal_M1)**
```
Components:
- L1 (Label) layout {"y": 0}
- L2 (Label) layout {"y": 1}
- L (Columns, columnCount=2) layout {"y": 2} children [C1]
- C1 (TextInput) layout {"y": 0}
```

**Action**
Drop D (Slider) into Columns L at column index 1 (appended at end of Columns' children).

**Expected State (page_1)**  unchanged
```
Components:
- B (Button) layout {"y": 0}
```

**Expected State (modal_M1)**
```
Components:
- L1 (Label) layout {"y": 0}
- L2 (Label) layout {"y": 1}
- L (Columns, columnCount=2) layout {"y": 2} children [C1, D]
- C1 (TextInput) layout {"y": 0}
- D (Slider) layout {"y": 1}
```

---

## Scenario A4: Add a child to Rows inside a Form in a Modal
**Initial State (page_1)**
```
Components:
- B (Button) layout {"y": 0}
```

**Initial State (modal_M1)**
```
Components:
- L1 (Label) layout {"y": 0}
- L2 (Label) layout {"y": 1}
- F (Form) layout {"y": 2} children [R]
- R (Rows, rowCount=3) layout {"y": 0} children [C1]
- C1 (TextInput) layout {"y": 0}
```

**Action**
Drop D (Slider) into row index 2 of R (appended at end of Rows' children, targeting slot index 2).

**Expected State (page_1)**  unchanged
```
Components:
- B (Button) layout {"y": 0}
```

**Expected State (modal_M1)**
```
Components:
- L1 (Label) layout {"y": 0}
- L2 (Label) layout {"y": 1}
- F (Form) layout {"y": 2} children [R]
- R (Rows, rowCount=3) layout {"y": 0} children [C1, "", D]
- C1 (TextInput) layout {"y": 0}
- D (Slider) layout {"y": 2}
```

> Note: slot index 1 in R is left empty (`""`), reflecting the index-based placement of Rows. D lands at `y: 2` to match the target slot index.

---

## Scenario R1: Remove a Form child [tested]
**Initial State (page_1)**
```
Components:
- F (Form) layout {"y": 0} children [X, Y]
- X (TextInput) layout {"y": 0}
- Y (Checkbox) layout {"y": 1}
```

**Action**
Remove X.

**Expected State (page_1)**
```
Components:
- F layout {"y": 0} children [Y]
- Y layout {"y": 0}
```

> Form children are sequentially ordered (not index-based), so after removing X, Y compacts from `y: 1` to `y: 0`.

---

## Scenario R2: Delete a layout and its subtree [tested]
**Initial State (page_1)**
```
Components:
- L (Rows) layout {"y": 0} children [R1, R2]
- R1 (TextInput) layout {"y": 0}
- R2 (Checkbox) layout {"y": 1}
- A (Button) layout {"y": 1}
```

**Action**
Delete layout L with mode = deleteSubtree.

**Expected State (page_1)**
```
Components:
- A layout {"y": 0}
```

> L, R1, and R2 are all removed. A compacts from `y: 1` to `y: 0`.

---

## Scenario R3: Remove a child from Columns/Rows [tested]
**Initial State (page_1)**
```
Components:
- R (Rows, rowCount=2) layout {"y": 0} children [R1, R2]
- L (Columns, columnCount=2) layout {"y": 1} children [C1, C2]
- C1 (TextInput) layout {"y": 0}
- C2 (Dropdown) layout {"y": 1}
- R1 (Label) layout {"y": 0}
- R2 (Label) layout {"y": 1}
```

**Action**
Remove C1, then remove R1.

**Expected State (page_1)**
```
Components:
- R layout {"y": 0} children ["", R2]
- L layout {"y": 1} children ["", C2]
- C2 layout {"y": 1}
- R2 layout {"y": 1}
```

> Rows/Columns are index-based: removing a child leaves the slot empty (`""`). The sibling's `y` value is preserved, not compacted.

---

## Scenario T1: Tabs children are regrouped and renormalized by pane [tested]
**Initial State (page_1)**
```
Components:
- T (Tabs) children [A, B, C]
- A (TextInput) layout {"tabIndex": 0, "y": 5}
- B (Button) layout {"tabIndex": 0, "y": 2}
- C (Checkbox) layout {"tabIndex": 1, "y": 0.5}
```

**Action**
`updateOrderedChildLayouts` is called for Tabs component T.

**Expected State (page_1)**
```
Components:
- T (Tabs) children [A, B, C]
- B layout {"tabIndex": 0, "y": 0}    was y:2, sorts before A (y:5)
- A layout {"tabIndex": 0, "y": 1}    was y:5
- C layout {"tabIndex": 1, "y": 0}    only child in tab 1, renormalized to y:0
```

> Children are grouped by `tabIndex`. Within each pane, they are sorted by their current `y` and reassigned `y` values of `0, 1, 2, ...`.

---

## Scenario M1: Removing modal content does not affect page context layouts [tested]
**Initial State (page_1)**
```
Components:
- P1 (Button) layout {"y": 0}
- P2 (TextInput) layout {"y": 1}
```

**Initial State (modal_M1)**
```
Components:
- MC1 (Label) layout {"y": 0}
- MC2 (Checkbox) layout {"y": 1}
```

**Action**
Remove MC1 from modal_M1.

**Expected State (page_1)**  unchanged
```
Components:
- P1 layout {"y": 0}
- P2 layout {"y": 1}
```

**Expected State (modal_M1)**
```
Components:
- MC2 layout {"y": 0}
```

> Compaction in `modal_M1` does not touch `page_1`. Contexts are fully isolated.

---

## Notes
- Forms and Expanders are sequential (not index-based) and compact on child removal. Rows and Columns are index-based and do not compact, as shown in Scenario R3.
- Tabs children require both `tabIndex` and `y` in their layout JSON. A missing or malformed layout on any Tabs child is a validation error that blocks save.
- Context isolation is strict: operations on `modal_<id>` never affect `page_1` layout values, and vice versa.
- During drag/move operations, temporary fractional `y` values may be used internally as insertion markers (for example `insertAt - 0.5`). Ordered containers normalize these back to integer order after reindexing.
