// 独立阅读页 /books/:id
//
// 为什么从弹层改成路由：
// - 弹层不改变 URL，刷新 / 分享 / 浏览器后退都会丢掉“正在读哪本书”；
// - 首页书架与 /books 共用同一个阅读器，改一处即可让两个入口都连贯。
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';
import { BookReader } from '../components/BookReader.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';

export function BookRead({ id }) {
  const [book, setBook] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setBook(null);
    setError('');
    api.getBook(id)
      .then((data) => { if (alive) setBook(data); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div class="stack">
        <ErrorState title="图书打开失败" message={error} onRetry={() => route(`/books/${id}`, true)} />
        <button class="primary" onClick={() => route('/books')}>返回图书页</button>
      </div>
    );
  }

  if (!book) return <LoadingState shape="poster" count={4} label="正在打开图书" />;

  return <BookReader book={book} onClose={() => route('/books')} />;
}
