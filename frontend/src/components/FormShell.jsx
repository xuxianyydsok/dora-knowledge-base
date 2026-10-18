// 统一的编辑页骨架：页头 + 错误提示 + 表单 + 底部操作。
//
// 为什么抽出来：博客 / 音乐 / 影视三个编辑页此前各写各的工具栏、错误条和按钮，
// 改一次间距要改三处，且很容易出现「一个页面有取消、另一个没有」这种不一致。
// 这里只统一**结构**，字段本身仍由各页面自己决定。
import { PageHeader } from './PageHeader.jsx';

export function FormShell({ kicker, title, sub, actions, error, busy, submitLabel = '保存', onSubmit, onCancel, children }) {
  return (
    <section class="form-shell page-col">
      <PageHeader kicker={kicker} title={title} sub={sub}>
        {actions}
      </PageHeader>

      {error && <div class="notice danger" role="alert">{error}</div>}

      <form class="form-shell-body" onSubmit={onSubmit}>
        {children}

        <div class="form-shell-actions">
          <button class="primary" type="submit" disabled={busy}>
            {busy ? '保存中…' : submitLabel}
          </button>
          <button type="button" onClick={onCancel || (() => history.back())}>取消</button>
        </div>
      </form>
    </section>
  );
}

export function FormSection({ title, hint, children }) {
  return (
    <section class="form-section">
      {(title || hint) && (
        <header class="form-section-head">
          {title && <h2>{title}</h2>}
          {hint && <p class="muted">{hint}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function FormField({ label, required, hint, children, className = '', inline = false }) {
  return (
    <label class={`form-field${inline ? ' form-field-check' : ''} ${className}`.trim()}>
      <span class="form-label">
        {label}
        {required && <em>*</em>}
      </span>
      {children}
      {hint && <small class="form-hint">{hint}</small>}
    </label>
  );
}

export function FormRow({ children, className = '' }) {
  return <div class={`form-row ${className}`.trim()}>{children}</div>;
}
