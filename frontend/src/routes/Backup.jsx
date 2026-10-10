// 资源导入导出备份页
import { useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/PageHeader.jsx';

export function Backup() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
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
      // 后端只支持安全合并模式；replace 会被 422 拒绝（不做虚假的“替换”承诺）
      const res = await api.importBackup(payload, 'merge');
      setResult(res.imported);
      setStatus('导入完成。');
    } catch (e) { setError(`导入失败：${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <section class="stack">
      <PageHeader
        kicker="Backup"
        title="导入 / 导出备份"
        sub="完整导出分类、标签、资源、博客、音乐、影视、关联、进度、通知与偏好，或从 JSON 备份安全恢复。"
      />

      {error && <div class="notice danger">{error}</div>}
      {status && <p style="color:var(--primary)">{status}</p>}

      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">导出</h3>
        <p class="muted">导出你名下的内容与专属字段（音乐/影视扩展、关联关系、播放进度、通知、主题偏好），保存为 JSON 文件。</p>
        <button class="primary" onClick={doExport} disabled={busy}>{busy ? '处理中…' : '导出全部数据'}</button>
      </div>

      <form class="card stack" style="padding:16px" onSubmit={doImport}>
        <h3 style="margin-top:0">导入</h3>
        <p class="muted">选择此前导出的 JSON 文件进行恢复。分类与标签按 slug 复用，资源与博客将新建并重建关联。</p>
        <input type="file" accept="application/json,.json" onChange={(e) => setImportFile(e.currentTarget.files?.[0] || null)} />
        <div class="notice">恢复采用安全合并模式：保留现有数据，分类与标签按 slug 复用。</div>
        <div class="row">
          <button class="primary" type="submit" disabled={busy}>{busy ? '导入中…' : '开始导入'}</button>
        </div>
        {result && (
          <div class="muted" style="font-size:13px">
            导入结果：分类 {result.categories} · 标签 {result.tags} · 资源 {result.resources} ·
            博客 {result.posts} · 音乐 {result.music_tracks || 0} · 影视 {result.movie_titles || 0} ·
            进度 {result.progress || 0} · 通知 {result.notifications || 0} · 收藏 {result.favorites}
          </div>
        )}
      </form>
    </section>
  );
}
