// musicIdentity.probe.mjs —— 音乐去重口径（frontend/src/lib/musicIdentity.js）离线探针
//
// 用户反馈（2026-10-12）：「管理端音乐最近添加里同一首歌重复出现」。
// 判定口径是纯函数，这里直接跑；另外用源码契约锁住两件事：
//   1) Music.jsx 的「最近添加」列表走的是 dedupeMusicList（不是裸 slice）；
//   2) 音乐库多了「播放历史」分组，且历史数据走 /api/music/history。
// 后端那一侧由 backend/tests/run.mjs 的同一套用例 + 前后端一致性契约覆盖。

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicIdentity, normalizeMusicText, dedupeMusicList } from '../src/lib/musicIdentity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

let pass = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' —— ' + extra : ''}`); }
  else { failures.push(name); console.log(`  ❌ ${name}${extra ? ' —— ' + extra : ''}`); }
}

console.log('\n=== 音乐去重口径（前端） ===');

ok('空白差异视为同一首',
  musicIdentity({ title: '晴天', artist: '周杰伦' }) === musicIdentity({ title: ' 晴天 ', artist: '周杰伦' }));
ok('大小写差异视为同一首',
  musicIdentity({ title: 'Hello', artist: 'Adele' }) === musicIdentity({ title: 'hello', artist: 'ADELE' }));
ok('中英文括号差异视为同一首',
  musicIdentity({ title: '晴天 (Live)', artist: '周杰伦' }) === musicIdentity({ title: '晴天（Live）', artist: '周杰伦' }));
ok('不同歌手不合并',
  musicIdentity({ title: '稻香', artist: '周杰伦' }) !== musicIdentity({ title: '稻香', artist: '其他' }));
ok('歌名为空时返回 null（无法判定）', musicIdentity({ title: '', artist: '周杰伦' }) === null);
ok('空对象返回 null', musicIdentity({}) === null);
ok('归一化去掉分隔符', normalizeMusicText('A - B_1') === 'ab1', normalizeMusicText('A - B_1'));

const list = [
  { id: 'a', title: '晴天', track: { artist: '周杰伦' } },
  { id: 'b', title: '晴天', track: { artist: '周杰伦' } },
  { id: 'c', title: '稻香', track: { artist: '周杰伦' } },
  { id: 'd', title: '晴天', track: { artist: '翻唱歌手' } }
];
const deduped = dedupeMusicList(list);
ok('去重后剩 3 条', deduped.length === 3, `${deduped.length}`);
ok('保留最先出现的那条（列表已按时间倒序）', deduped[0].id === 'a');
ok('顺序稳定 a,c,d', deduped.map((m) => m.id).join('') === 'acd', deduped.map((m) => m.id).join(''));
ok('非数组输入返回空数组', dedupeMusicList(null).length === 0);
ok('歌名为空时一律保留', dedupeMusicList([{ id: 'x' }, { id: 'y' }]).length === 2);
ok('track.artist 缺失时退化比歌名',
  dedupeMusicList([{ id: '1', title: '歌' }, { id: '2', title: '歌' }]).length === 1);

console.log('\n=== 源码契约 ===');
const music = readFileSync(resolve(SRC, 'routes', 'Music.jsx'), 'utf8');
ok('Music.jsx 引入 dedupeMusicList', /import \{ dedupeMusicList \} from '\.\.\/lib\/musicIdentity\.js'/.test(music));
ok('load() 用 dedupeMusicList 清洗列表', /dedupeMusicList\(list \|\| \[\]\)/.test(music));
ok('分组里有「播放历史」', /key: 'history', label: '播放历史'/.test(music));
ok('历史数据走 api.listMusicHistory', /api\.listMusicHistory\(/.test(music));
ok('后端命中重复时提示「已经在音乐库里」', /已经在音乐库里了/.test(music));
ok('历史分组有登录态空态', /登录后才能看到播放历史/.test(music));

console.log(`\n${failures.length === 0 ? '全部通过' : '存在失败'}：${pass} 项通过 / ${failures.length} 项失败`);
if (failures.length) { console.log('失败清单：\n  ' + failures.join('\n  ')); process.exit(1); }
