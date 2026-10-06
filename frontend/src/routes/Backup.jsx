// 资源导入导出备份页
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';

export function Backup() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const [result, setResult] = useState(null);

  async function doExport() {
    setBusy(true); setError(''); setStatus('');
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge-base-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('导出完成，文件已开始下载。');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function doImport(e) {
    e.preventDefault();
    if (!importFile) { setError('请先选择备份 JSON 文件'); return; }
    setBusy(true); setError(''); setStatus(''); setResult(null);
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      const payload = parsed.data ? parsed.data : parsed;
      const res = await api.importBackup(payload, mode);
      setResult(res.imported);
      setStatus('导入完成。');
    } catch (e) { setError(`导入失败：${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <section class="stack">
      <h2 style="margin:0">导入 / 导出备份</h2>

      {error && <p style="color:var(--danger)">{error}</p>}
      {status && <p style="color:var(--primary)">{status}</p>}

      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">导出</h3>
        <p class="muted">导出你名下的分类、标签、资源、博客、关联关系与收藏，保存为 JSON 文件。</p>
        <button class="primary" onClick={doExport} disabled={busy}>{busy ? '处理中…' : '导出全部数据'}</button>
      </div>

      <form class="card stack" style="padding:16px" onSubmit={doImport}>
        <h3 style="margin-top:0">导入</h3>
        <p class="muted">选择此前导出的 JSON 文件进行恢复。分类与标签按 slug 复用，资源与博客将新建并重建关联。</p>
        <input type="file" accept="application/json,.json" onChange={(e) => setImportFile(e.currentTarget.files?.[0] || null)} />
        <div class="row">
          <label class="row" style="gap:6px">
            <input type="radio" style="width:auto" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            合并（保留现有数据）
          </label>
          <label class="row" style="gap:6px">
            <input type="radio" style="width:auto" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            替换模式
          </label>
        </div>
        <div class="row">
          <button class="primary" type="submit" disabled={busy}>{busy ? '导入中…' : '开始导入'}</button>
        </div>
        {result && (
          <div class="muted" style="font-size:13px">
            导入结果：分类 {result.categories} · 标签 {result.tags} · 资源 {result.resources} ·
            博客 {result.posts} · 收藏 {result.favorites}
          </div>
        )}
      </form>
    </section>
  );
}
