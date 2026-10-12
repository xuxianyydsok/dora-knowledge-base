// 共创（/coop）：邀请大家一起参与站点建设的一页。
//
// 产品定位：这不是「联系我」表单，而是一封写给访客的邀请信 —— 上面是站长第一人称的
// 介绍（这个站是我一个人慢慢搭的，很多地方还不好用，想请你一起把它改好），下面是
// 一个反馈表单：分类 + 正文 + 匿名/实名 + 可选联系方式。提交后弹一个温暖的感谢弹窗，
// 并提醒「右上角通知铃铛会有提示」。提交是**匿名默认**的，访客也能提交。
//
// 设计取舍：
// 1) 上半部分是阅读型窄栏排版（--content-read），字号 / 行高按长文来调，标题用衬线体
//    （--font-display）；下半部分才是表单，两者之间用一条细线分隔，不做成大标题压场。
// 2) 分类用 chip（复用 .seg 的分段切换语义），不用原生 <select>：chip 一眼能看全四类。
// 3) 感谢弹窗用 portal 挂到 body（避免祖先 transform 让 fixed 定位跑偏），半透明遮罩
//    + 背景模糊 + 圆角卡片，进入动画是轻微缩放 + 淡入；支持 Esc 与点遮罩关闭。
// 4) 页面底部放「已经改过的例子」，从 lib/changelog.js 读最新一版的 2~3 条变更，
//    让访客看到反馈是真的会落地（只读 changelog.js，不改它）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Icon } from '../components/Icon.jsx';
import { MiniUniverse } from '../components/MiniUniverse.jsx';
import { toastError } from '../lib/toast.jsx';
import { CHANGELOG, sortVersions, formatDate } from '../lib/changelog.js';
import '../styles/coop.css';

const MAX_CONTENT = 4000;
const MAX_NAME = 60;
const MAX_CONTACT = 200;

// 四类反馈：与后端 feedback.js 的 CATEGORIES / CATEGORY_LABELS 保持一致
const CATEGORIES = [
  { key: 'bug', label: '缺陷', hint: '哪里坏了、哪里点不动' },
  { key: 'improve', label: '值得改进', hint: '能用，但还不够好用' },
  { key: 'feature', label: '想要的新功能', hint: '希望这里多出点什么' },
  { key: 'other', label: '其它', hint: '想说的都可以' }
];

// 介绍文案：站长第一人称，真诚、不喊口号。段落之间留白由样式控制。
const INTRO = [
  '这个站是我一个人慢慢搭起来的。从最开始只是想找个地方放几篇文章，到后来把书、照片、音乐、影视都一点点搬进来，再让它们彼此连起来 —— 中间走了不少弯路，也踩了很多坑。',
  '写着写着就发现，很多地方其实还不好用：有的按钮点了没反应，有的页面在手机上挤成一团，有些功能是我自己想要，却不一定是你需要的。这些问题我自己未必都能发现，因为它们大多藏在别人真正用起来的时候。',
  '所以想邀请你也来参与。参与不一定要会写代码 —— 你用着哪里别扭、哪里报错、哪个功能没看懂，或者希望这里再多出点什么，把它告诉我，就是在帮我一起把它改好。',
  '我会认真看每一条。能改的尽快改，改好了会写进「更新日志」；暂时改不了的，我也会记下来，等条件成熟再做。这里没有客服话术，收到就是收到，我会自己一条条回看。'
];

// 感谢弹窗：portal 到 body，半透明遮罩 + 背景模糊，卡片轻微缩放 + 淡入。
function ThanksDialog({ onClose }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const trigger = document.activeElement;
    boxRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (trigger && typeof trigger.focus === 'function') trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal((
    <div
      ref={boxRef}
      tabIndex={-1}
      class="coop-modal-mask"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coop-thanks-title"
      onClick={onClose}
    >
      <div class="coop-modal" onClick={(e) => e.stopPropagation()}>
        <span class="coop-modal-mark" aria-hidden="true"><Icon name="heart" size={22} /></span>
        <h2 id="coop-thanks-title" class="coop-modal-title">收到了，谢谢你</h2>
        <p class="coop-modal-text">
          你的这条反馈我已经收到。每一条我都会认真看，能改的会尽快改，改好了会写进更新日志。
          这里因为是我一个人在做，可能会慢一点，但不会漏掉。
        </p>
        <p class="coop-modal-note">
          <Icon name="bell" size={14} />
          我回复或改动之后，右上角的通知铃铛会有提示。
        </p>
        <button type="button" class="primary coop-modal-ok" onClick={onClose}>好的</button>
      </div>
    </div>
  ), document.body);
}

// 底部「已经改过的例子」：取最新一版里 2~3 条变更，证明反馈会落地。
function RecentChanges() {
  const picks = useMemo(() => {
    const latest = sortVersions(CHANGELOG)[0];
    if (!latest) return null;
    return { version: latest.version, date: formatDate(latest.date), changes: (latest.changes || []).slice(0, 3) };
  }, []);

  if (!picks || picks.changes.length === 0) return null;
  return (
    <section class="coop-done">
      <div class="coop-done-head">
        <span class="coop-done-kicker">已经改过的例子</span>
        <span class="coop-done-meta">最近一版 {picks.version} · {picks.date}</span>
      </div>
      <ul class="coop-done-list">
        {picks.changes.map((c, i) => (
          <li key={i} class="coop-done-item">
            <span class="coop-done-dot" aria-hidden="true" />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      <a class="coop-done-more" href="/changelog">
        去看完整的更新日志 <Icon name="arrowRight" size={14} />
      </a>
    </section>
  );
}

// 页脚字标（2026-10-12 用户要求）：
// 「共创页的结尾加上首页那个光之工作室模板的第一个画面 —— 一个上面写着字母的单纯字母的
//   那个，把它的模板改成 Dora Studio，放在最后，与首页的最后形成一个呼应。」
//
// 复刻的是 LUMEN · 光之工作室112 模板的 #hero 首屏：巨型衬线字母 + 一条渐变细线，
// 每个字母带一段错峰的 RGB 错位呼吸（模板里叫 ech）。首页结尾是一整块 DoraStudio 水印，
// 这里换成逐个字母的版本，首尾呼应但形态不同，不会显得是同一块东西重复出现。
//
// 为什么按「单词」而不是「字母」分组：Dora Studio 是两个词，字母全拆开会让词间空格
// 也变成一个可动画的槽位，读起来会断。按词分组、词内逐字母，节奏才对。
const FOOTER_WORDS = ['Dora', 'Studio'];

function FooterWordmark() {
  // 字母序号在整块字标里连续递增 —— 模板里 --i 决定错峰延迟，
  // 若每个词都从 0 重数，两个词会同步呼吸，失去逐字流动的感觉。
  let letterIndex = 0;
  return (
    <div class="coop-mark" aria-label="Dora Studio">
      <div class="coop-mark-line" aria-hidden="true">
        {FOOTER_WORDS.map((word, wi) => (
          <span key={word} class="coop-mark-word">
            {[...word].map((ch) => {
              const i = letterIndex++;
              return (
                <span key={i} class="coop-mark-glyph" style={`--i:${i}`} aria-hidden="true">{ch}</span>
              );
            })}
            {/* 词间空隙：用真实空格占位，保证与 aria-label 的读法一致。
                key 加前缀，避免与上面的字母序号（0、1、2…）撞车。 */}
            {wi < FOOTER_WORDS.length - 1 && <span key={`gap-${wi}`} class="coop-mark-gap" aria-hidden="true"> </span>}
          </span>
        ))}
      </div>
      <i class="coop-mark-rule" aria-hidden="true" />
    </div>
  );
}

export function Coop() {
  const { isAuthenticated, profile } = useAuth();
  const [category, setCategory] = useState('other');
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);

  // 已登录用户切到「实名」时，用资料里的昵称预填，省得再打一遍
  useEffect(() => {
    if (!anonymous && isAuthenticated && !displayName) {
      const guess = profile?.display_name || profile?.username || '';
      if (guess) setDisplayName(guess);
    }
  }, [anonymous, isAuthenticated, profile]);

  const canSubmit = content.trim().length > 0 && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await api.submitFeedback({
        category,
        content: content.trim(),
        is_anonymous: anonymous,
        display_name: anonymous ? undefined : (displayName.trim() || undefined),
        contact: contact.trim() || undefined,
        page_url: typeof location !== 'undefined' ? location.pathname : undefined
      });
      // 提交成功后清空表单并弹感谢弹窗
      setContent('');
      setContact('');
      setCategory('other');
      setThanks(true);
    } catch (err) {
      toastError(err.message || '提交失败，稍后再试试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="coop-page">
      <PageHeader
        kicker="Co-create"
        title="共创"
        sub="这个站是我一个人慢慢搭的，想邀请你一起把它变得更好用。"
      />

      {/* 介绍 + 迷你星体（2026-10-12 用户要求第二版）：
          星体从「段落下方居中」改成**贴在介绍文字的右侧**，高度与这段文字齐平，
          两者并排成一栏「文字 + 星体」的版面。窄屏（≤900px）自动落回上下堆叠。 */}
      <div class="coop-lead">
        <article class="coop-intro">
          {INTRO.map((p, i) => <p key={i}>{p}</p>)}
        </article>

        <div class="coop-orb">
          <MiniUniverse>
            <p class="coop-orb-text">欢迎加入共创</p>
            <span class="coop-orb-sub">转动看看</span>
          </MiniUniverse>
        </div>
      </div>

      <div class="coop-divider" aria-hidden="true">
        <span class="coop-divider-line" />
        <span class="coop-divider-label">留下你的想法</span>
        <span class="coop-divider-line" />
      </div>

      <form class="coop-form" onSubmit={submit}>
        <div class="coop-field">
          <label class="coop-label">这是关于哪方面的？</label>
          <div class="seg coop-cats">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                class={category === c.key ? 'on' : ''}
                title={c.hint}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p class="coop-hint">{CATEGORIES.find((c) => c.key === category)?.hint}</p>
        </div>

        <div class="coop-field">
          <label class="coop-label" for="coop-content">想说的话</label>
          <textarea
            id="coop-content"
            class="coop-textarea"
            rows={6}
            maxLength={MAX_CONTENT}
            placeholder="哪里不好用、哪里报错、希望增加什么功能…… 说得越具体，我越好改。"
            value={content}
            onInput={(e) => setContent(e.currentTarget.value)}
          />
          <div class="coop-counter">
            <span class={content.length > MAX_CONTENT ? 'over' : ''}>{content.length}</span> / {MAX_CONTENT}
          </div>
        </div>

        <div class="coop-field">
          <label class="coop-label">署名方式</label>
          <div class="seg coop-ident">
            <button
              type="button"
              class={anonymous ? 'on' : ''}
              onClick={() => setAnonymous(true)}
            >
              匿名提交
            </button>
            <button
              type="button"
              class={!anonymous ? 'on' : ''}
              onClick={() => setAnonymous(false)}
              disabled={!isAuthenticated}
              title={isAuthenticated ? '' : '登录后才能实名提交'}
            >
              实名提交
            </button>
          </div>
          <p class="coop-hint">
            {anonymous
              ? '默认匿名，不会记下你是谁。'
              : (isAuthenticated ? '会用你填的称呼署名，方便我在更新里提到你。' : '登录后即可实名提交。')}
          </p>
          {!anonymous && isAuthenticated && (
            <input
              class="coop-name"
              type="text"
              maxLength={MAX_NAME}
              placeholder="你的称呼"
              value={displayName}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
            />
          )}
        </div>

        <div class="coop-field">
          <label class="coop-label" for="coop-contact">联系方式<span class="coop-opt">（选填）</span></label>
          <input
            id="coop-contact"
            type="text"
            maxLength={MAX_CONTACT}
            placeholder="选填，方便我回复你"
            value={contact}
            onInput={(e) => setContact(e.currentTarget.value)}
          />
        </div>

        <div class="coop-actions">
          <button class="primary coop-submit" type="submit" disabled={!canSubmit}>
            {busy ? '正在提交…' : '提交反馈'}
          </button>
          <span class="coop-actions-note">提交后我会尽快看到，谢谢你的每一句话。</span>
        </div>
      </form>

      <RecentChanges />

      <FooterWordmark />

      {thanks && <ThanksDialog onClose={() => setThanks(false)} />}
    </section>
  );
}
