# AHEAD Console — UI rules

The Console looks and behaves like the AHEAD ERP. These rules come from the ERP's own pieces
(`frontend/components/data-list.tsx`, `page-parts.tsx`, `record-kit.tsx`, `stepper.tsx`,
`settings-parts.tsx`, `save-bar.tsx`, `summary-cards.tsx`). The Console keeps its own copies of
them (the two products share no UI code), so a change to one is made to both.

## Frame
- Sidebar 272 px, attached and square, grouped menu; header 64 px with Ctrl K search, help,
  notifications, light/dark and the account menu. Pages use the full width.
- Each person sees only the pages their role can open.

## Lists — one table everywhere (`DataList`)
- Title and description on the left; the main action (`+ Add …`) on the right; less common
  actions and **Export CSV** under the ⋯ menu.
- Summary cards (tinted, with an icon) above the table when the numbers help.
- Status tabs with counts on the table when a list has states.
- Toolbar: search on the left; **Table / Cards** switch, **Columns** and **Filters** on the right.
  Filters open a panel with **Apply** and **Clear**; nothing filters until Apply.
- Columns a person would look for; IDs where people quote them; numbers right-aligned.
- Every row has its actions in a ⋮ menu (open, edit, status actions, delete last, in red).
- Tick rows for bulk actions; the bar shows how many are selected and "Select all N matching".
- Below: **Rows per page** and numbered pages. Cards on phones.
- Distinct states: first use (what this list is + the main action), nothing matches (with Clear
  filters), loading (skeleton rows), error (with Retry and a reference).

## Record pages — one layout (`DetailHeader`)
- Header: initials or icon, name, status pills, one line under it, actions on the right
  (primary action as a button, the rest under ⋮).
- Tinted stat cards with the record's key numbers.
- A progress strip (`Steps`) when the record moves through stages.
- Tabs kept in the address (`?tab=`): Overview first, History last.
- Overview: sections (`Section`) with a details grid (`DetailList`), and on the right an
  **About this record** card (created by, created on, ID to copy).
- History: what happened, by whom, when — newest first, ending with "Created".

## Forms
- **Short forms** (up to ~6 fields) open in a dialog over the list. One API call on Save.
- **Long forms** (a new business, a plan) are a full page with a **Stepper** across the top and a
  **live preview** on the right. Previous / Next; the last step saves. Fields of a step are
  checked before moving on; a server error jumps back to the step with that field.
- Fields in titled groups, two columns on wide screens. Every field has a label; required ones
  are marked and enforced; a field that becomes needed (a coupon when "Coupon" is chosen) turns
  required. Example placeholders ("e.g. Sharma Electronics"). Masks stop wrong input (mobile,
  GSTIN). Message space under each field is reserved, so errors never move the form.
- No API call while typing, except a live price quote.

## Settings — one page (`SettingsCard`, `SettingRow`, `SaveBar`)
- A section index on the left; cards with an icon, title and one line on what the section does.
- Each setting is a row: name and what it does on the left, the control on the right.
- Nothing saves on its own. Changing anything raises the **Save bar** (Discard / Save changes);
  leaving with changes asks first.

## Words
- Plain words, no jargon (no MRR/ARR on screens for vendors and partners).
- Active / Inactive and "Make inactive" for people and partners.
- Money with ₹ and Indian grouping; dates like 24 Nov 2026.
