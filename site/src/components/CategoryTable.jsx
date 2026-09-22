// src/components/CategoryTable.jsx
import { createSignal, createMemo, createUniqueId, For, Show } from 'solid-js';
import '@/styles/CategoryTable.scss';

/**
 * props:
 *   data   – { CategoryName: [ { col: value, ... }, ... ], ... }
 *   label  – optional aria-label for the tab list
 *   class  – optional extra class on the wrapper
 *
 * A cell value can be:
 *   - a string / number               -> rendered as text
 *   - { url, text }                   -> rendered as a link
 *   - { text }                        -> rendered as text
 *   - null / undefined / ''           -> rendered as an empty cell
 */
export default function CategoryTable(props) {
  const uid = createUniqueId();

  const data = createMemo(() => props.data || {});
  const categories = createMemo(() => Object.keys(data()));

  const [selected, setSelected] = createSignal(null);

  // Falls back to the first category if the selected one disappears
  // (or if nothing has been selected yet).
  const activeCategory = createMemo(() => {
    const cats = categories();
    const sel = selected();
    return sel && cats.includes(sel) ? sel : cats[0];
  });

  const rows = createMemo(() => {
    const cat = activeCategory();
    if (!cat) return [];
    const value = data()[cat];
    return Array.isArray(value) ? value : [];
  });

  // Column subheaders are derived from the union of keys used by every row
  // in the *active* category, in first-seen order.
  const columns = createMemo(() => {
    const cols = [];
    for (const row of rows()) {
      if (!row || typeof row !== 'object') continue;
      for (const key of Object.keys(row)) {
        if (!cols.includes(key)) cols.push(key);
      }
    }
    return cols;
  });

  const tabId = (cat) => `${uid}-tab-${String(cat).replace(/\W+/g, '-')}`;
  const panelId = `${uid}-panel`;

  function renderCell(value) {
    if (value === null || value === undefined || value === '') return null;

    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'object' && v !== null ? v.text ?? '' : String(v))).join(', ');
    }

    if (typeof value === 'object') {
      const text = value.text ?? value.label ?? '';
      if (value.url) {
        return (
          <a
            href={value.url}
            target={value.target ?? '_blank'}
            rel="noopener noreferrer"
          >
            {text || value.url}
          </a>
        );
      }
      return text || null;
    }

    return String(value);
  }

  function onTablistKeyDown(event) {
    const cats = categories();
    if (cats.length === 0) return;

    const current = cats.indexOf(activeCategory());
    let next = null;

    if (event.key === 'ArrowRight') next = (current + 1) % cats.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + cats.length) % cats.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cats.length - 1;

    if (next === null) return;

    event.preventDefault();
    setSelected(cats[next]);
    const buttons = event.currentTarget.querySelectorAll('[role="tab"]');
    if (buttons[next]) buttons[next].focus();
  }

  return (
    <div class={`category-table ${props.class || ''}`.trim()}>
      <div
        class="tabs"
        role="tablist"
        aria-label={props.label || 'Categories'}
        onKeyDown={onTablistKeyDown}
      >
        <For each={categories()}>
          {(cat) => (
            <button
              type="button"
              role="tab"
              id={tabId(cat)}
              class="tab"
              classList={{ 'active': activeCategory() === cat }}
              aria-selected={activeCategory() === cat}
              aria-controls={panelId}
              tabindex={activeCategory() === cat ? 0 : -1}
              onClick={() => setSelected(cat)}
            >
              {cat}
            </button>
          )}
        </For>
      </div>

      <div
        class="wrap"
        role="tabpanel"
        id={panelId}
        aria-labelledby={activeCategory() ? tabId(activeCategory()) : undefined}
      >
        <table class="table">
          <thead>
            <tr class="subheader-row">
              <For each={columns()}>
                {(col) => <th scope="col">{col}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For
              each={rows()}
              fallback={
                <tr class="empty-row">
                  <td colspan={Math.max(columns().length, 1)}>No entries.</td>
                </tr>
              }
            >
              {(row) => (
                <tr>
                  <For each={columns()}>
                    {(col) => <td>{renderCell(row?.[col])}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}