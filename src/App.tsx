import { useEffect, useMemo, useRef, useState } from 'react';
import data from './data/items.json';
import { budgets, defaults, filterSort, likeTags, scoreItems, type Conditions, type Item } from './lib/score';
import { readConditions, writeConditions } from './lib/url';
const items: Item[] = data;
const prefs =
  '北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄'.split(
    ' ',
  );
const genres = [...new Set(items.map((i) => i.g))];
const uses = {
  first: '初訪問',
  apology: 'お詫び',
  thanks: 'お礼',
  office: '職場で配る',
  celebrate: 'お祝い',
};
const budgetLabels = { b1: '〜3,000円', b2: '3,000〜5,000円', b3: '5,000〜10,000円', b4: '10,000円〜' };
function dateLabel(value: string) {
  const m = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : value;
}
function App() {
  const [c, setC] = useState<Conditions>(() => readConditions(prefs, genres));
  const [limit, setLimit] = useState(24);
  const [toast, setToast] = useState('');
  const [fallback, setFallback] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterSort(scoreItems(items, c), c), [c]);
  const update = <K extends keyof Conditions>(key: K, value: Conditions[K]) =>
    setC((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    writeConditions(c);
    setLimit(24);
  }, [c]);
  useEffect(() => {
    const handler = () => setC(readConditions(prefs, genres));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (fallback) {
      dialogRef.current?.showModal();
      fallbackRef.current?.select();
    } else dialogRef.current?.close();
  }, [fallback]);
  async function share() {
    writeConditions(c);
    try {
      await navigator.clipboard.writeText(location.href);
      setToast('URLをコピーしました');
      setFallback('');
    } catch {
      setFallback(location.href);
    }
  }
  function reset() {
    setC({ ...defaults, likes: [...defaults.likes] });
    setFallback('');
  }
  const chips = (values: string[], selected: string, onSelect: (value: string) => void) =>
    values.map((value) => (
      <button
        type="button"
        className={`chip ${selected === value ? 'selected' : ''}`}
        aria-pressed={selected === value}
        key={value}
        onClick={() => onSelect(value)}
      >
        {value}
      </button>
    ));
  return (
    <>
      <header className="header">
        <a className="brand" href={location.pathname} aria-label="手土産えらび ホーム">
          <img src="./favicon.svg" alt="" width="38" height="38" />
          <span>
            手土産えらび<small>心をつなぐ、ひと品を。</small>
          </span>
        </a>
        <button className="share-button" onClick={share}>
          <span aria-hidden="true">↗</span> この条件を共有
        </button>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">贈る気持ちに、ちょうどいい一品。</p>
            <h1>
              相手に合う手土産が、
              <br />
              すぐ見つかる。
            </h1>
            <p className="hero-description">
              相手のふるさと、好み、渡すシーンから。
              <br className="desktop-break" />
              全国の名品のなかから、喜ばれる手土産を探しましょう。
            </p>
            <div className="stats">
              <div>
                <strong>
                  941<span>品</span>
                </strong>
                <small>全国の手土産を収録</small>
              </div>
              <div>
                <strong>
                  47<span>都道府県</span>
                </strong>
                <small>土地の魅力をお届け</small>
              </div>
              <div>
                <strong>
                  850<span>品</span>
                </strong>
                <small>公式・百貨店で価格確認済み</small>
              </div>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="art-circle" />
            <span className="art-sprig">❋</span>
            <div className="gift gift-back">
              <i />
            </div>
            <div className="gift gift-front">
              <div className="gift-band" />
              <div className="gift-knot">結</div>
              <span>こころばかり</span>
            </div>
            <span className="art-caption">選ぶ時間も、贈りもの。</span>
          </div>
        </section>
        <div className="workspace">
          <aside className="conditions">
            <details open>
              <summary>
                <span>
                  <small>FIND YOUR GIFT</small>贈る相手に合わせる
                </span>
                <span className="fold-icon" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="condition-body">
                <section className="form-section">
                  <h2>
                    <span>01</span> ふたりの土地
                  </h2>
                  <label htmlFor="pref">相手の出身地</label>
                  <select id="pref" value={c.pref} onChange={(e) => update('pref', e.target.value)}>
                    {prefs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <label htmlFor="mine">こちら（贈る側）の土地</label>
                  <select id="mine" value={c.mine} onChange={(e) => update('mine', e.target.value)}>
                    <option value="">指定しない</option>
                    {prefs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <div className="segment" aria-label="地元の品の扱い">
                    {(['avoid', 'nostalgic'] as const).map((v) => (
                      <button
                        key={v}
                        aria-pressed={c.home === v}
                        className={c.home === v ? 'active' : ''}
                        onClick={() => update('home', v)}
                      >
                        {v === 'avoid' ? '地元のものは避ける' : '懐かしい地元の味'}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="form-section">
                  <h2>
                    <span>02</span> 好みとこだわり
                  </h2>
                  <p className="field-help">
                    好みを選択 <span>複数選べます</span>
                  </p>
                  <div className="chips">
                    {Object.keys(likeTags).map((l) => (
                      <button
                        key={l}
                        className={`chip ${c.likes.includes(l) ? 'selected' : ''}`}
                        aria-pressed={c.likes.includes(l)}
                        onClick={() =>
                          update(
                            'likes',
                            c.likes.includes(l) ? c.likes.filter((x) => x !== l) : [...c.likes, l],
                          )
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="small-note">選んだ好みのいずれかに合う品を表示します。</p>
                  {(['nosweet', 'keep'] as const).map((key) => (
                    <label className="toggle-row" key={key}>
                      <span>
                        {key === 'nosweet' ? '甘いものは苦手' : '日持ち重視'}
                        <small>
                          {key === 'nosweet'
                            ? '和菓子・洋菓子・チョコを除く'
                            : '1週間未満の品を除く（不明は含む）'}
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={c[key]}
                        onChange={(e) => update(key, e.target.checked)}
                      />
                      <span className="switch" aria-hidden="true" />
                    </label>
                  ))}
                </section>
                <section className="form-section">
                  <h2>
                    <span>03</span> ご予算とシーン
                  </h2>
                  <label htmlFor="budget">ご予算（税込）</label>
                  <select
                    id="budget"
                    value={c.budget}
                    onChange={(e) => update('budget', e.target.value as Conditions['budget'])}
                  >
                    {Object.entries(budgetLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <p className="small-note">予算に近い品も候補に含めます。</p>
                  <label htmlFor="use">お渡しするシーン</label>
                  <select
                    id="use"
                    value={c.use}
                    onChange={(e) => update('use', e.target.value as Conditions['use'])}
                  >
                    {Object.entries(uses).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </section>
                <button
                  className="primary mobile-results"
                  onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {results.length}件の候補を見る <span aria-hidden="true">↓</span>
                </button>
                <button className="reset" onClick={reset}>
                  ↺ 条件をリセット
                </button>
              </div>
            </details>
          </aside>
          <section className="results" ref={resultRef} aria-label="手土産の候補">
            <div className="results-heading">
              <div>
                <p className="eyebrow">あなたの気持ちを届ける候補</p>
                <h2>こんな手土産はいかが？</h2>
              </div>
              <span className="small-seal" aria-hidden="true">
                心<br />遣
              </span>
            </div>
            <div className="filter-box">
              <label className="search-label" htmlFor="search">
                <span aria-hidden="true">⌕</span>
                <input
                  id="search"
                  type="search"
                  placeholder="品名・メーカー・土地の名前で探す"
                  value={c.q}
                  onChange={(e) => update('q', e.target.value)}
                  aria-label="品名・メーカー・県・内容量で検索"
                />
              </label>
              <div className="filter-pref">
                <label htmlFor="fpref">産地で絞る</label>
                <select id="fpref" value={c.fpref} onChange={(e) => update('fpref', e.target.value)}>
                  <option value="">すべての都道府県</option>
                  {prefs.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="genre-chips">
                <span>ジャンル</span>
                <div className="chips">
                  <button
                    className={`chip ${!c.genre ? 'selected' : ''}`}
                    aria-pressed={!c.genre}
                    onClick={() => update('genre', '')}
                  >
                    すべて
                  </button>
                  {chips(genres, c.genre, (v) => update('genre', v))}
                </div>
              </div>
            </div>
            <div className="result-toolbar">
              <p role="status">
                <strong>{results.length}</strong>件中{' '}
                <span>
                  {c.sort === 'recommend' ? '上位から表示' : `${Math.min(limit, results.length)}件を表示`}
                </span>
              </p>
              <label htmlFor="sort" className="sort-label">
                並べ替え
                <select
                  id="sort"
                  value={c.sort}
                  onChange={(e) => update('sort', e.target.value as Conditions['sort'])}
                >
                  <option value="recommend">おすすめ順</option>
                  <option value="low">価格の安い順</option>
                  <option value="high">価格の高い順</option>
                  <option value="days">日持ちの長い順</option>
                </select>
              </label>
            </div>
            {results.length > 0 ? (
              <>
                <div className="card-grid">
                  {results.slice(0, limit).map(({ item: i, why }, index) => (
                    <article className="item-card" key={i.id}>
                      <div className="card-top">
                        <span className="region">
                          {i.p}
                          <small> / {i.r}</small>
                        </span>
                        <span className={i.v ? 'badge verified' : 'badge unverified'}>
                          {i.v ? '価格確認済み' : '要確認'}
                        </span>
                      </div>
                      <div className="card-title">
                        <span className="item-genre">
                          {i.g}
                          {c.sort === 'recommend' && index < 3 && (
                            <span className="rank">おすすめ {String(index + 1).padStart(2, '0')}</span>
                          )}
                        </span>
                        <h3>{i.n}</h3>
                        <p className="maker">{i.m}</p>
                      </div>
                      <p className="quantity">{i.q || '内容量は公式ページでご確認ください'}</p>
                      <div className="price">
                        <strong>
                          {i.y?.toLocaleString('ja-JP')}
                          <span>円（税込）</span>
                        </strong>
                        <small>{dateLabel(i.c)}確認時点・税込</small>
                      </div>
                      <div className="specs">
                        <span>{i.d !== null ? `約${i.d}日` : '日持ち要確認'}</span>
                        <span>{i.ko ? '個包装あり' : '個包装なし・不明'}</span>
                        {i.st && <span className="cold">{i.st}</span>}
                      </div>
                      {i.dr && (
                        <p className="shelf-note" title={i.dr}>
                          {i.dr}
                        </p>
                      )}
                      {!i.v && (
                        <p className="verification-note">価格・販売状況は公式ページでご確認ください</p>
                      )}
                      <div className="reasons">
                        {why.slice(0, 3).map((w, j) => (
                          <span key={j}>{w}</span>
                        ))}
                      </div>
                      <div className="card-link">
                        <a
                          href={/^https?:\/\//.test(i.u) ? i.u : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          公式ページを見る <span aria-hidden="true">↗</span>
                        </a>
                        <small>出典：{i.src}</small>
                      </div>
                    </article>
                  ))}
                </div>
                {limit < results.length && (
                  <div className="load-more">
                    <button onClick={() => setLimit((v) => v + 24)}>
                      もっと見る <span aria-hidden="true">＋</span>
                    </button>
                    <small>
                      {Math.min(limit, results.length)} / {results.length} 件を表示中
                    </small>
                  </div>
                )}
              </>
            ) : (
              <div className="empty">
                <span aria-hidden="true">◇</span>
                <h3>ぴったりの品を、もう少し広く。</h3>
                <p>条件を少しゆるめると、新しい候補に出会えるかもしれません。</p>
                <div>
                  <button
                    className="primary"
                    disabled={c.budget === 'b4'}
                    onClick={() => {
                      const keys = Object.keys(budgets) as Conditions['budget'][];
                      update('budget', keys[Math.min(keys.indexOf(c.budget) + 1, 3)]);
                    }}
                  >
                    予算を一段上げる
                  </button>
                  <button className="secondary" onClick={() => update('likes', [])}>
                    好みの指定を減らす
                  </button>
                  <button className="reset" onClick={reset}>
                    条件をリセット
                  </button>
                </div>
              </div>
            )}
            <p className="results-note">
              確認済みの品を優先してご提案。価格・日持ちは、ご購入前にリンク先でもご確認ください。
            </p>
          </section>
        </div>
        <section className="data-note">
          <span className="note-mark" aria-hidden="true">
            i
          </span>
          <div>
            <h2>安心して選ぶために、データについて</h2>
            <p>
              収録941品（47都道府県、2026年10月28日のWeb調査）。うち850品はメーカー公式・公式通販・百貨店のページで税込価格の一致を確認。それ以外は要確認。価格・内容・日持ちは変わることがあるため、購入前に公式ページでご確認ください。日持ちは出典記載の日数で、製造日・発送日起算などの違いがあります。
            </p>
            <p>価格不明の53品は候補に表示しません。日持ち不明の品は「日持ち重視」でも含まれます。</p>
          </div>
        </section>
      </main>
      <footer>
        <a className="footer-brand" href={location.pathname}>
          手土産えらび
        </a>
        <p>大切な人へ、気持ちが伝わるひと品を。</p>
        <small>個人情報・アクセス解析データは収集していません。</small>
      </footer>
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="share-fallback"
        aria-labelledby="share-title"
        onCancel={() => setFallback('')}
      >
        <div>
          <h2 id="share-title">この条件を共有</h2>
          <p>URLを選択してコピーしてください。</p>
          <input
            ref={fallbackRef}
            readOnly
            value={fallback}
            aria-label="共有URL"
            onFocus={(e) => e.target.select()}
          />
          <button className="primary" onClick={() => setFallback('')}>
            閉じる
          </button>
        </div>
      </dialog>
    </>
  );
}
export default App;
