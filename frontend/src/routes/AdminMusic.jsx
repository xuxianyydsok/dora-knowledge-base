// 管理员「上传本地音乐」页面（/admin/music）
//
// 用途（2026-10-12 用户原话）：
//   「管理员端的话，可以就是直接上传音乐，然后要正确的识别，并且将它的一个歌手
//    或者专辑的那个图像给刮削出来，然后对应的歌词的话也要配好」
//   「我肯定要手动填几个字的，就比如说它的歌名，还有那个它的歌手是谁，
//    谁唱了这首歌，就提供这两部分的内容。」
//
// 因此这一页只做一件事：**站长选音频文件 → 只填「歌名 + 歌手」→ 上传**。
// 专辑、封面、时长由后端自动刮削（见 backend/src/routes/musicUpload.js）；
// 歌词可选填 —— 站长填了就用他的，没填才联网刮削（2026-10-13 用户要求
// 「只用负责导入音乐和填写它的歌手和歌词就行了，其他的没有必要填」）。
// 前端不重复实现刮削逻辑，也不要求站长填任何其他字段。
//
// 两个容易踩坑的地方，先写在这里，免得后来改的人重犯：
// 1) **不要**用 multipart/form-data 上传。无损 FLAC 常有几十 MB，
//    `request.formData()` 会把整个文件读进内存，而 Worker 内存上限 128MB。
//    后端为此走「原始请求体直传 + X-Audio-* 自定义头」，前端必须配套。
//    lib/api.js 的 `api.uploadMusic()` 已经封装好这条通道（含 XHR 上传进度），
//    本页直接复用，不另起一套请求逻辑。
// 2) 上传后的曲目默认 `is_public = false`（私有），要公开得去音乐页的编辑入口切换。
//    这一页只负责「传上去」，并明确告诉站长当前是私有状态，避免误会成没传成功。
//
// 类名前缀用 `amu-`（admin music upload）而不是 `am-`：后者已被音乐页占用
// （global.css 里的 .am-hero / .am-track / .am-shelf 等，见 components/MusicHome.jsx），
// 用 `am-` 会直接串味。
import { useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';
import { toast, toastError, toastSuccess } from '../lib/toast.jsx';
import { parseBilibiliInput, isValidBvid, bilibiliEmbedUrl } from '../lib/bilibili.js';
import '../styles/admin-music.css';

// 与后端 audioType.js 的白名单一致：只收能真正解码出时长的音频容器
const ACCEPT = '.mp3,.flac,.m4a,.aac,.ogg,.opus,.wav,audio/*';

// 单文件的状态机。用不可变对象整块替换，避免 preact 的浅比较漏掉更新。
const PENDING = 'pending';
const RUNNING = 'running';
const DONE = 'done';
const FAILED = 'failed';

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 文件名 → 默认歌名：去掉扩展名，并把常见分隔符还原成空格，
// 让「周杰伦 - 晴天.mp3」这种命名省掉一次手输。
function guessTitle(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

// 上传成功后展示的封面缩略图。刮不到封面时退化成占位块，
// 不显示碎图标（用户很在意「别看起来很粗糙」）。
function ResultCover({ src, title }) {
  const [broken, setBroken] = useState(false);
  const show = src && !broken;
  return (
    <div class={`amu-cover${show ? '' : ' is-empty'}`}>
      {show
        ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
        : <Icon name="music" size={22} />}
      <span class="amu-cover-title">{title || '未命名'}</span>
    </div>
  );
}

// 来源标注：让站长一眼看出「封面刮到了没有、歌词配上了没有」。
const ART_SOURCE_LABEL = {
  id3: '来自音频标签',
  netease: '来自网易云',
  qq: '来自 QQ 音乐',
  kugou: '来自酷狗',
  kuwo: '来自酷我',
  migu: '来自咪咕',
  manual: '手动设置'
};

const LYRICS_SOURCE_LABEL = {
  manual: '手动填写',
  netease: '网易云',
  qq: 'QQ 音乐',
  kugou: '酷狗',
  kuwo: '酷我',
  migu: '咪咕',
  sidecar: '同目录歌词文件',
  id3: '音频标签内嵌'
};

export function AdminMusic() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);      // 待传队列
  const [results, setResults] = useState([]);  // 上传成功的曲目
  const [dragging, setDragging] = useState(false);
  // B 站曲目（MV）：用户要求「上传音乐时可以上传一个哔哩哔哩的链接」，
  // 且「需要的就是那个视频窗口……直接看那个视频」。
  const [biliUrl, setBiliUrl] = useState('');
  const [biliTitle, setBiliTitle] = useState('');
  const [biliArtist, setBiliArtist] = useState('');
  const [biliBusy, setBiliBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  // 只有站长能进。未登录 / 非管理员给一段友好提示，不留白屏。
  const blocked = !authLoading && !isAdmin;

  const readyCount = useMemo(
    () => items.filter((it) => it.status === PENDING).length,
    [items]
  );

  function patchItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  // 选文件（点击或拖拽）→ 只做入队，不立刻上传。
  // 理由：站长常常一次拖十几首，先让他在列表里核对歌名/歌手再统一开传，
  // 比「一选就传、发现歌手填错还得重传」友好得多。
  function enqueue(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        title: guessTitle(file.name),
        artist: '',
        lyrics: '',
        progress: 0,
        status: PENDING,
        error: ''
      }))
    ]);
  }

  // 上传单条。成功即移出队列、推进结果区；失败保留在队列里并写明原因，
  // 站长改完歌手可以直接重试，不用重新选文件。
  async function uploadOne(item) {
    const title = String(item.title || '').trim();
    const artist = String(item.artist || '').trim();
    const lyrics = String(item.lyrics || '').trim();
    if (!title) {
      patchItem(item.id, { status: FAILED, error: '请先填写歌名' });
      return null;
    }

    patchItem(item.id, { status: RUNNING, progress: 0, error: '' });
    try {
      const data = await api.uploadMusic(item.file, {
        title,
        artist,
        lyrics,
        onProgress: (pct) => patchItem(item.id, { progress: pct })
      });
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      if (data) setResults((prev) => [data, ...prev]);
      // 后端识别到「同名同歌手已存在」时会返回 duplicate 标记，这是正常去重，不是失败。
      if (data?.duplicate) toastSuccess(`《${title}》曲库里已有，已跳过重复入库`);
      else toastSuccess(`《${data?.title || title}》上传完成`);
      return data;
    } catch (err) {
      patchItem(item.id, {
        status: FAILED,
        error: err?.message || '上传失败，请重试'
      });
      return null;
    }
  }

  // 添加 B 站曲目：只填「链接 + 歌名（+ 歌手）」，不传文件。
  // 后端只校验并解析出 BV 号入库；播放时前端嵌 B 站官方播放器（见 BilibiliPlayer.jsx）。
  async function addBilibili() {
    const parsed = parseBilibiliInput(biliUrl);
    if (parsed.isShortLink) {
      toastError('b23.tv 短链无法直接识别，请打开后复制完整链接（含 BV 号）');
      return;
    }
    if (!parsed.bvid || !isValidBvid(parsed.bvid)) {
      toastError('没找到 B 站视频号（BV 号），请检查链接');
      return;
    }
    const title = biliTitle.trim();
    if (!title) { toastError('请填写歌名'); return; }
    setBiliBusy(true);
    try {
      const saved = await api.createMusic({
        title,
        artist: biliArtist.trim() || null,
        bilibili_url: parsed.bvid
      });
      setBiliUrl(''); setBiliTitle(''); setBiliArtist('');
      toastSuccess(`《${saved?.title || title}》已加入音乐库（B 站 MV）`);
      setResults((prev) => [saved, ...prev]);
    } catch (err) {
      toastError(err?.message || '添加失败，请重试');
    } finally {
      setBiliBusy(false);
    }
  }

  // 串行上传：并发传多个大文件会把上行带宽切碎，进度条也会互相拖慢，
  // 逐首传反而整体更快、状态更可读。
  async function uploadAll() {
    const queue = items.filter((it) => it.status === PENDING || it.status === FAILED);
    if (!queue.length) {
      toast('没有待上传的曲目', { tone: 'info' });
      return;
    }
    const missing = queue.filter((it) => !String(it.title || '').trim());
    if (missing.length) {
      toastError(`有 ${missing.length} 首还没填歌名，已在上方标出`);
      return;
    }
    setBusy(true);
    let okCount = 0;
    let failCount = 0;
    for (const it of queue) {
      // 每轮重新取一次最新状态（站长可能在等待期间改了歌名/歌手）
      let current = it;
      setItems((prev) => {
        const found = prev.find((x) => x.id === it.id);
        if (found) current = found;
        return prev;
      });
      const done = await uploadOne(current);
      if (done) okCount += 1;
      else failCount += 1;
    }
    setBusy(false);
    if (failCount === 0) toastSuccess(`${okCount} 首全部上传完成`);
    else toastError(`${okCount} 首成功，${failCount} 首失败（原因见列表）`);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clearQueue() {
    setItems([]);
  }

  // ---------------- 非管理员：友好拦截 ----------------
  if (blocked) {
    return (
      <div class="amu-page">
        <PageHeader
          kicker="Admin Upload"
          title="上传本地音乐"
          sub="这个页面只有站长能进。"
        />
        <EmptyState
          icon="crown"
          title={isAuthenticated ? '当前账号不是站长' : '这个页面只有站长能进'}
          hint="上传本地音乐属于站点管理操作，需要以站长账号登录后才能使用。"
          action={
            <a class="primary amu-inline-btn" href="/music">
              <Icon name="music" size={16} />去音乐页
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div class="amu-page">
      <PageHeader
        kicker="Admin Upload"
        title="上传本地音乐"
        sub="选好音频文件，只填歌名和歌手就行 —— 专辑、封面、歌词由后端自动刮削。"
        stats={[
          { label: '待上传', value: items.length },
          { label: '本次成功', value: results.length }
        ]}
      />

      {/* 上传区：拖拽 + 点击，支持多选 */}
      <div
        class={`amu-drop${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          enqueue(e.dataTransfer?.files);
        }}
      >
        <Icon name="music" size={26} />
        <div class="amu-drop-text">
          <strong>把音频文件拖到这里</strong>
          <span>支持 MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV，可一次多选。封面与歌词会自动补齐。</span>
        </div>
        <div class="amu-drop-actions">
          <button type="button" class="amu-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={16} />选择文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              enqueue(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      {/* B 站曲目（MV）：只填链接 + 歌名，不传文件。
          用户要求「有些音乐它是以 MV 的形式呈现出来的，那个直接看那个视频」，
          所以这类曲目在音乐页点开会打开 B 站播放器窗口，而不是走音频播放条。 */}
      <section class="amu-bili">
        <div class="amu-bili-head">
          <Icon name="video" size={16} />
          <h2>添加 B 站视频（MV）</h2>
        </div>
        <p class="amu-bili-hint">
          粘贴 B 站视频链接或 BV 号即可（也支持手机端链接、播放器链接）。
          播放时会嵌入 B 站官方播放器，所以是「边听边看视频」。
        </p>
        <div class="amu-bili-fields">
          <label class="amu-field amu-bili-url">
            <span>B 站链接 / BV 号</span>
            <input
              type="text"
              value={biliUrl}
              placeholder="https://www.bilibili.com/video/BV1xx411c7mD 或 BV1xx411c7mD"
              onInput={(e) => setBiliUrl(e.currentTarget.value)}
            />
          </label>
          <label class="amu-field">
            <span>歌名</span>
            <input
              type="text"
              value={biliTitle}
              placeholder="必填"
              onInput={(e) => setBiliTitle(e.currentTarget.value)}
            />
          </label>
          <label class="amu-field">
            <span>歌手</span>
            <input
              type="text"
              value={biliArtist}
              placeholder="选填"
              onInput={(e) => setBiliArtist(e.currentTarget.value)}
            />
          </label>
        </div>
        <div class="amu-bili-actions">
          <button
            type="button"
            class="primary amu-btn"
            disabled={biliBusy || !biliUrl.trim() || !biliTitle.trim()}
            onClick={addBilibili}
          >
            <Icon name="plus" size={15} />{biliBusy ? '添加中…' : '加入音乐库'}
          </button>
          {biliUrl && (() => {
            const p = parseBilibiliInput(biliUrl);
            const ok = p.bvid && isValidBvid(p.bvid);
            return ok
              ? <span class="amu-bili-ok">已识别：{p.bvid}</span>
              : <span class="amu-bili-bad">{p.isShortLink ? 'b23.tv 短链需展开后复制完整链接' : '没找到 BV 号'}</span>;
          })()}
        </div>
      </section>

      {/* 待上传队列 */}
      {items.length > 0 && (
        <section class="amu-queue">
          <div class="amu-queue-head">
            <h2>待上传 <span class="amu-count">{items.length}</span></h2>
            <div class="amu-queue-actions">
              <button type="button" class="amu-btn ghost" disabled={busy} onClick={clearQueue}>
                <Icon name="trash" size={15} />清空列表
              </button>
              <button
                type="button"
                class="primary amu-btn"
                disabled={busy || readyCount === 0}
                onClick={uploadAll}
              >
                <Icon name="plus" size={15} />
                {busy ? '上传中…' : `全部上传${readyCount ? `（${readyCount}）` : ''}`}
              </button>
            </div>
          </div>

          <ul class="amu-list">
            {items.map((it) => (
              <li key={it.id} class={`amu-row is-${it.status}`}>
                <div class="amu-row-file">
                  <Icon name="music" size={16} />
                  <span class="amu-filename" title={it.file.name}>{it.file.name}</span>
                  <span class="amu-size">{fmtSize(it.file.size)}</span>
                </div>

                <div class="amu-row-fields">
                  <label class={`amu-field${it.status === FAILED && !String(it.title || '').trim() ? ' has-error' : ''}`}>
                    <span>歌名</span>
                    <input
                      type="text"
                      value={it.title}
                      placeholder="必填"
                      onInput={(e) => patchItem(it.id, { title: e.currentTarget.value })}
                    />
                  </label>
                  <label class="amu-field">
                    <span>歌手</span>
                    <input
                      type="text"
                      value={it.artist}
                      placeholder="谁唱的"
                      onInput={(e) => patchItem(it.id, { artist: e.currentTarget.value })}
                    />
                  </label>
                  <label class="amu-field amu-field-lyrics">
                    <span>歌词<em>选填</em></span>
                    <textarea
                      rows={1}
                      value={it.lyrics}
                      placeholder="可粘贴歌词（支持 [00:12.34] 时间轴），留空则自动匹配"
                      onInput={(e) => patchItem(it.id, { lyrics: e.currentTarget.value })}
                    />
                  </label>
                </div>

                <div class="amu-row-status">
                  <div class="amu-bar">
                    {/* 上传中才让条纹流动（见 admin-music.css 的 .is-running 说明） */}
                    <div
                      class={`amu-bar-fill${it.status === RUNNING ? ' is-running' : ''}`}
                      style={`width:${it.progress}%`}
                    />
                  </div>
                  <span class="amu-status-text">
                    {it.status === PENDING && '等待上传'}
                    {it.status === RUNNING && `上传中 ${it.progress}%`}
                    {it.status === FAILED && (it.error || '上传失败')}
                  </span>
                </div>

                <div class="amu-row-actions">
                  <button
                    type="button"
                    class="amu-btn small"
                    disabled={busy || it.status === RUNNING}
                    onClick={() => uploadOne(it)}
                  >
                    上传
                  </button>
                  <button
                    type="button"
                    class="amu-icon-btn"
                    aria-label="移除"
                    disabled={it.status === RUNNING}
                    onClick={() => removeItem(it.id)}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 结果区：封面 + 刮削情况一目了然 */}
      {results.length > 0 && (
        <section class="amu-results">
          <div class="amu-queue-head">
            <h2>本次上传结果 <span class="amu-count">{results.length}</span></h2>
          </div>
          <ul class="amu-result-grid">
            {results.map((r) => {
              const track = r.track || {};
              const artSource = ART_SOURCE_LABEL[r.artwork_source] || r.artwork_source;
              const lyrSource = LYRICS_SOURCE_LABEL[r.lyrics_source] || r.lyrics_source;
              return (
                <li key={r.id} class="amu-result">
                  <ResultCover src={r.cover_path || track.artwork_url} title={r.title} />
                  <div class="amu-result-body">
                    <strong class="amu-result-title">{r.title || '未命名'}</strong>
                    <span class="amu-result-artist">
                      {track.artist || '未知歌手'}
                      {track.album ? ` · ${track.album}` : ''}
                    </span>
                    <div class="amu-tags">
                      <span class={`amu-tag${r.cover_path || track.artwork_url ? ' ok' : ''}`}>
                        {r.cover_path || track.artwork_url
                          ? `封面已就位${artSource ? `（${artSource}）` : ''}`
                          : '未找到封面'}
                      </span>
                      <span class={`amu-tag${r.has_lyrics ? ' ok' : ''}`}>
                        {r.has_lyrics
                          ? `歌词已配好${lyrSource ? `（${lyrSource}）` : ''}`
                          : '未找到歌词'}
                      </span>
                      <span class="amu-tag muted">默认私有，去音乐页可设为公开</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {items.length === 0 && results.length === 0 && (
        <EmptyState
          icon="music"
          title="还没有选择文件"
          hint="把下载好的歌曲拖到上面的区域，或者在文件选择框里多选几首。"
        />
      )}
    </div>
  );
}
