import { useEffect, useMemo, useRef, useState } from "react";
import data from "./data/items.json";
import { Artwork, Emblem, Flower, Icon } from "./Artwork";
import {
  itemMarks,
  markLabels,
  traitGroups,
  traitLabels,
  type Mark,
} from "./lib/marks";
import {
  budgets,
  defaults,
  filterSort,
  likeTags,
  scoreItems,
  sweetLikes,
  relaxationOptions,
  seasons,
  uses,
  type Conditions,
  type Item,
} from "./lib/score";
import { readConditions, writeConditions } from "./lib/url";
const items: Item[] = data;
const prefectureCount = new Set(items.map((i) => i.p)).size;
const verifiedCount = items.filter((i) => i.v).length;
const unknownPriceCount = items.filter((i) => i.y === null).length;
const confirmationDates = [
  ...new Set(items.map((i) => i.c).filter(Boolean)),
].sort();
const confirmationPeriod = confirmationDates.length
  ? confirmationDates.length === 1
    ? confirmationDates[0]
    : `${confirmationDates[0]}〜${confirmationDates[confirmationDates.length - 1]}`
  : "確認日未記載";
function hasShelfDetails(item: Item) {
  const raw = item.dr.normalize("NFKC").replace(/\s/g, "");
  if (!raw) return false;
  const daysOnly = raw.match(/^(?:約)?(\d+(?:\.\d+)?)(?:日(?:間)?)?$/);
  return !daysOnly || item.d === null || Number(daysOnly[1]) !== item.d;
}
const prefs =
  "北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split(
    " ",
  );
const genres = [...new Set(items.map((i) => i.g))];
const budgetLabels = {
  b1: "〜3,000円",
  b2: "3,000〜5,000円",
  b3: "5,000〜10,000円",
  b4: "10,000円〜",
};
function dateLabel(value: string) {
  const m = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : value;
}
function App() {
  const [c, setC] = useState<Conditions>(() => readConditions(prefs, genres));
  const [panel, setPanel] = useState("");
  const conditionsRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  function openPanel(value: string, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setPanel(value);
    conditionsRef.current?.showModal();
  }
  function closePanel() {
    conditionsRef.current?.close();
  }
  const [limit, setLimit] = useState(24);
  const [desktopTraits, setDesktopTraits] = useState(
    () => window.matchMedia("(min-width: 641px)").matches,
  );
  const [expandedTraits, setExpandedTraits] = useState<string[]>([]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 641px)");
    const change = () => setDesktopTraits(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const [toast, setToast] = useState("");
  const [fallback, setFallback] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterSort(scoreItems(items, c), c), [c]);
  const quickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    quickRef.current
      ?.querySelectorAll<HTMLElement>(".selected")
      .forEach((chip) =>
        chip.scrollIntoView({
          inline: "nearest",
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        }),
      );
  }, [c.season, c.use]);
  const update = <K extends keyof Conditions>(key: K, value: Conditions[K]) =>
    setC((old) => {
      const next = { ...old, [key]: value };
      if (key === "nosweet" && value) {
        next.likes = old.likes.filter((like) => !sweetLikes.includes(like));
        if (next.likes.length !== old.likes.length)
          setToast("甘いものの好みを外しました");
      }
      if (
        key === "likes" &&
        next.likes.some(
          (like) => sweetLikes.includes(like) && !old.likes.includes(like),
        )
      )
        next.nosweet = false;
      return next;
    });
  useEffect(() => {
    writeConditions(c);
    setLimit(24);
  }, [c]);
  useEffect(() => {
    const handler = () => setC(readConditions(prefs, genres));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
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
      setToast("URLをコピーしました");
      setFallback("");
    } catch {
      setFallback(location.href);
    }
  }
  function reset() {
    setC({ ...defaults, likes: [...defaults.likes] });
    setFallback("");
  }
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href={location.pathname}
          aria-label="手土産えらび ホーム"
        >
          <span className="pc-emblem">
            <Emblem />
          </span>
          <span className="sp-emblem">
            <Emblem gift />
          </span>
          <span>
            手土産えらび<small>地域の想いを、ちょうどいい贈り物に。</small>
          </span>
        </a>
        <h1>
          贈る相手に、ちょうどいい一品を。
          <span className="header-flower">
            <Flower />
          </span>
        </h1>
        <button className="share-button" onClick={share}>
          <Icon kind="share" />
          この条件を共有
        </button>
      </header>
      <main>
        <nav className="condition-pills" aria-label="贈り物の条件">
          {[
            ["land", "pin", "相手の出身地", c.pref],
            ["occasion", "calendar", "時期", seasons[c.season]],
            ["occasion", "gift", "用途", uses[c.use]],
            [
              "taste",
              "star",
              "相手の趣味",
              [...c.likes, ...c.traits.map((t) => traitLabels[t])].join("・") ||
                "指定なし",
            ],
            ["budget", "yen", "予算", budgetLabels[c.budget]],
          ].map(([key, icon, title, value], index) => (
            <div className="pill-step" key={title}>
              <button
                aria-haspopup="dialog"
                aria-controls="condition-dialog"
                aria-expanded={
                  (conditionsRef.current?.open &&
                    (panel === key || panel === "all")) ||
                  false
                }
                onClick={(e) => openPanel(key, e.currentTarget)}
              >
                <span className="pill-title">
                  <Icon kind={icon} />
                  {title}
                </span>
                <span className="pill-value">
                  {value}
                  <span aria-hidden="true">⌄</span>
                </span>
                {key === "budget" && (
                  <span className="range-decoration" aria-hidden="true">
                    <i
                      style={{
                        width: `${(Object.keys(budgets).indexOf(c.budget) + 1) * 25}%`,
                      }}
                    />
                  </span>
                )}
              </button>
              {index < 4 && (
                <span className="step-arrow" aria-hidden="true">
                  ›
                </span>
              )}
            </div>
          ))}
        </nav>
        <div className="mobile-quick" ref={quickRef}>
          {(["season", "use"] as const).map((key) => (
            <section key={key}>
              <h2>
                {key === "season" ? "時期" : "用途"}
                <span />
              </h2>
              <div className="quick-chips">
                {Object.entries(key === "season" ? seasons : uses).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      className={`chip ${c[key] === value ? "selected" : ""}`}
                      aria-pressed={c[key] === value}
                      onClick={() => update(key, value as never)}
                    >
                      {label}
                      <Icon kind={value} />
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
        <div className="workspace">
          <aside className="selected-conditions">
            <details open>
              <summary>
                <Flower />
                選んだ条件<span className="fold-icon">⌄</span>
              </summary>
              <dl>
                {[
                  ["相手の出身地", c.pref],
                  ["こちらの土地", c.mine || "東京（未指定）"],
                  [
                    "地元の扱い",
                    c.home === "avoid"
                      ? "地元のものは避ける"
                      : "懐かしい地元の味",
                  ],
                  ["時期", seasons[c.season]],
                  ["用途", uses[c.use]],
                  ["相手の趣味", c.likes.join("・") || "指定なし"],
                  [
                    "人柄・暮らし",
                    c.traits.map((t) => traitLabels[t]).join("・") ||
                      "指定なし",
                  ],
                  ["予算", budgetLabels[c.budget]],
                  [
                    "関係",
                    c.rel === "business"
                      ? "取引先・目上の人"
                      : c.rel === "casual"
                        ? "気軽な相手"
                        : "指定なし",
                  ],
                  ["甘いもの", c.nosweet ? "除く" : "含む"],
                  ["日持ち", c.keep ? "1週間以上（不明を含む）" : "指定なし"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="edit-conditions"
                aria-haspopup="dialog"
                aria-controls="condition-dialog"
                aria-expanded={panel === "all"}
                onClick={(e) => openPanel("all", e.currentTarget)}
              >
                詳しい条件を変える
              </button>
            </details>
            <button className="primary" onClick={share}>
              <Icon kind="share" />
              この条件を共有
            </button>
            <p>条件をリンクで共有できます</p>
          </aside>
          <dialog
            id="condition-dialog"
            ref={conditionsRef}
            className={`conditions panel-${panel}`}
            aria-labelledby="condition-title"
            onCancel={() => setPanel("")}
            onClose={() => {
              setPanel("");
              triggerRef.current?.focus();
            }}
          >
            <div className="dialog-heading">
              <h2 id="condition-title">贈る相手に合わせる</h2>
              <button onClick={closePanel} aria-label="条件パネルを閉じる">
                ×
              </button>
            </div>

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
                <section className="form-section section-land">
                  <h2>
                    <span>01</span> ふたりの土地
                  </h2>
                  <label htmlFor="pref">相手の出身地</label>
                  <select
                    id="pref"
                    value={c.pref}
                    onChange={(e) => update("pref", e.target.value)}
                  >
                    {prefs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <label htmlFor="mine">こちら（贈る側）の土地</label>
                  <select
                    id="mine"
                    value={c.mine}
                    onChange={(e) => update("mine", e.target.value)}
                  >
                    <option value="">指定しない（東京として扱う）</option>
                    {prefs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  {!c.mine && (
                    <p className="small-note">
                      未指定のため東京としておすすめしています
                    </p>
                  )}
                  <div className="segment" aria-label="地元の品の扱い">
                    {(["avoid", "nostalgic"] as const).map((v) => (
                      <button
                        key={v}
                        aria-pressed={c.home === v}
                        className={c.home === v ? "active" : ""}
                        onClick={() => update("home", v)}
                      >
                        {v === "avoid"
                          ? "地元のものは避ける"
                          : "懐かしい地元の味"}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="form-section section-taste">
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
                        className={`chip ${c.likes.includes(l) ? "selected" : ""}`}
                        aria-pressed={c.likes.includes(l)}
                        onClick={() =>
                          update(
                            "likes",
                            c.likes.includes(l)
                              ? c.likes.filter((x) => x !== l)
                              : [...c.likes, l],
                          )
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="small-note">
                    好みはいずれかに合う品だけ表示します（OR・絞り込み）。
                  </p>
                  {(["nosweet", "keep"] as const).map((key) => (
                    <label className="toggle-row" key={key}>
                      <span>
                        {key === "nosweet" ? "甘いものは苦手" : "日持ち重視"}
                        <small>
                          {key === "nosweet"
                            ? "和菓子・洋菓子・チョコを除く"
                            : "1週間未満の品を除く（不明は含む）"}
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
                <section className="form-section section-taste">
                  <h2>相手の人柄・暮らし</h2>
                  <p className="small-note">
                    複数選べます。人柄・暮らしに合う品を上位にします（加点）。
                  </p>
                  {traitGroups.map((group) => {
                    const open =
                      desktopTraits || expandedTraits.includes(group.id);
                    const count = group.traits.filter((trait) =>
                      c.traits.includes(trait),
                    ).length;
                    return (
                      <div className="trait-group" key={group.id}>
                        <h3>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`traits-${group.id}`}
                            disabled={desktopTraits}
                            onClick={() =>
                              setExpandedTraits((old) =>
                                old.includes(group.id)
                                  ? old.filter((id) => id !== group.id)
                                  : [...old, group.id],
                              )
                            }
                          >
                            {group.label}
                            <span
                              className="trait-count"
                              aria-label={`${count}項目選択中`}
                            >
                              {count}
                            </span>
                          </button>
                        </h3>
                        <div
                          className="chips"
                          id={`traits-${group.id}`}
                          hidden={!open}
                        >
                          {group.traits.map((trait) => (
                            <button
                              type="button"
                              key={trait}
                              className={`chip ${c.traits.includes(trait) ? "selected" : ""}`}
                              aria-pressed={c.traits.includes(trait)}
                              onClick={() =>
                                update(
                                  "traits",
                                  c.traits.includes(trait)
                                    ? c.traits.filter(
                                        (value) => value !== trait,
                                      )
                                    : [...c.traits, trait],
                                )
                              }
                            >
                              {traitLabels[trait]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>
                <section className="form-section section-budget">
                  <h2>
                    <span>03</span> ご予算
                  </h2>
                  <label htmlFor="budget-range">
                    ご予算（税込）：{budgetLabels[c.budget]}
                  </label>
                  <input
                    id="budget-range"
                    type="range"
                    min="0"
                    max="3"
                    step="1"
                    value={Object.keys(budgets).indexOf(c.budget)}
                    aria-valuetext={budgetLabels[c.budget]}
                    onChange={(e) =>
                      update(
                        "budget",
                        Object.keys(budgets)[
                          Number(e.target.value)
                        ] as Conditions["budget"],
                      )
                    }
                  />
                  <label htmlFor="budget">予算帯を選ぶ</label>
                  <select
                    id="budget"
                    value={c.budget}
                    onChange={(e) =>
                      update("budget", e.target.value as Conditions["budget"])
                    }
                  >
                    {Object.entries(budgetLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <p className="small-note">予算に近い品も候補に含めます。</p>
                </section>
                <section className="form-section section-occasion">
                  <h2>
                    <span>04</span> 贈る時期と場面
                  </h2>
                  <p className="small-note">
                    時期・用途・関係はそれぞれ1つ選べます。合う品を加点し、保存や贈る場面の注意がある品も候補に残します。
                  </p>
                  <label htmlFor="season">時期</label>
                  <select
                    id="season"
                    value={c.season}
                    onChange={(e) =>
                      update("season", e.target.value as Conditions["season"])
                    }
                  >
                    {Object.entries(seasons).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="rel">相手との関係</label>
                  <select
                    id="rel"
                    value={c.rel}
                    onChange={(e) =>
                      update("rel", e.target.value as Conditions["rel"])
                    }
                  >
                    <option value="">指定しない</option>
                    <option value="business">取引先・目上の人</option>
                    <option value="casual">気軽な相手</option>
                  </select>
                  <label htmlFor="use">用途</label>
                  <select
                    id="use"
                    value={c.use}
                    onChange={(e) =>
                      update("use", e.target.value as Conditions["use"])
                    }
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
                  onClick={() => closePanel()}
                >
                  {results.length}件の候補を見る{" "}
                  <span aria-hidden="true">↓</span>
                </button>
                <button className="reset" onClick={reset}>
                  ↺ 条件をリセット
                </button>
              </div>
            </details>
          </dialog>
          <section
            className="results"
            ref={resultRef}
            aria-label="手土産の候補"
          >
            <div className="results-heading">
              <div>
                <p className="eyebrow">あなたの気持ちを届ける候補</p>
                <h2>こんな手土産はいかが？</h2>
              </div>
            </div>
            <div className="filter-box">
              <label className="search-label" htmlFor="search">
                <span>キーワード</span>
                <input
                  id="search"
                  type="search"
                  placeholder="スペース区切りで絞り込み（すべて含む）"
                  value={c.q}
                  onChange={(e) => update("q", e.target.value)}
                  aria-label="品名・メーカー・県・内容量で検索"
                />
              </label>
              <div className="filter-pref">
                <label htmlFor="fpref">産地で絞る</label>
                <select
                  id="fpref"
                  value={c.fpref}
                  onChange={(e) => update("fpref", e.target.value)}
                >
                  <option value="">すべての都道府県</option>
                  {prefs.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="genre-filter">
                <label htmlFor="genre">ジャンル</label>
                <select
                  id="genre"
                  value={c.genre}
                  onChange={(e) => update("genre", e.target.value)}
                >
                  <option value="">すべて</option>
                  {genres.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <label htmlFor="sort" className="sort-label">
                並べ替え
                <select
                  id="sort"
                  value={c.sort}
                  onChange={(e) =>
                    update("sort", e.target.value as Conditions["sort"])
                  }
                >
                  <option value="recommend">おすすめ順</option>
                  <option value="low">価格の安い順</option>
                  <option value="high">価格の高い順</option>
                  <option value="days">日持ちの長い順</option>
                </select>
              </label>
            </div>
            <div className="result-toolbar">
              <div className="result-count">
                <p role="status">
                  <strong>{results.length}</strong>件
                  {results.length > 0 && (
                    <>
                      中{" "}
                      <span>
                        {c.sort === "recommend"
                          ? "上位から表示"
                          : `${Math.min(limit, results.length)}件を表示`}
                      </span>
                    </>
                  )}
                </p>
                <small className="price-note">
                  価格は
                  {confirmationDates.map(dateLabel).join("〜") ||
                    "確認日未記載"}
                  確認時点・税込
                </small>
              </div>
            </div>
            {results.length > 0 ? (
              <>
                <div className="card-grid">
                  {results
                    .slice(0, limit)
                    .map(({ item: i, why, cautions }, index) => (
                      <article className="item-card" key={i.id}>
                        <div className="card-visual">
                          <Artwork genre={i.g} />
                          <div className="card-top">
                            <span className="region">
                              {i.p}
                              <small> / {i.r}</small>
                            </span>
                            {!i.v && (
                              <span className="badge unverified">要確認</span>
                            )}
                          </div>
                        </div>
                        <div className="card-content">
                          {i.v && (
                            <span className="verified-note">価格確認済み</span>
                          )}
                          <div className="card-title">
                            <span className="item-genre">
                              {i.g}
                              {c.sort === "recommend" && index < 3 && (
                                <span className="rank">
                                  おすすめ {String(index + 1).padStart(2, "0")}
                                </span>
                              )}
                            </span>
                            <h3>{i.n}</h3>
                            <p className="maker">{i.m}</p>
                          </div>
                          <p className="quantity">
                            {i.q || "内容量は販売元へご確認ください"}
                          </p>
                          <div className="price-specs">
                            <div className="price">
                              <strong>
                                {i.y?.toLocaleString("ja-JP")}
                                <span>円（税込）</span>
                              </strong>
                              <small>{dateLabel(i.c)}確認時点・税込</small>
                            </div>
                            <div className="specs">
                              <span>
                                {i.d !== null ? `約${i.d}日` : "日持ち要確認"}
                              </span>
                              <span>
                                {i.ko ? "個包装あり" : "個包装なし・不明"}
                              </span>
                              {i.st && <span className="cold">{i.st}</span>}
                            </div>
                          </div>
                          {hasShelfDetails(i) && (
                            <p className="shelf-note" title={i.dr}>
                              出典の表記：{i.dr}
                            </p>
                          )}
                          {!i.v && (
                            <p className="verification-note">
                              価格・販売状況は購入前に販売元へご確認ください
                            </p>
                          )}
                          <div className="reasons">
                            <h4>
                              <Flower />
                              おすすめ理由
                            </h4>
                            <p>{why.join("・")}</p>
                          </div>
                          <div className="mark-tags" aria-label="品の印">
                            {(Object.keys(itemMarks[i.id] ?? {}) as Mark[])
                              .filter((mark) =>
                                c.traits.includes(mark as never),
                              )
                              .map((mark) => (
                                <span
                                  key={mark}
                                  title={itemMarks[i.id]?.[mark]}
                                >
                                  {markLabels[mark]}
                                </span>
                              ))}
                          </div>
                          {cautions.map((note) => (
                            <p className="caution-note" key={note}>
                              注意：{note}
                            </p>
                          ))}
                          <div className="card-link">
                            {/^https?:\/\/[^\s|]+$/i.test(i.u) ? (
                              <a
                                href={i.u}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {i.src === "公式"
                                  ? "公式ページを見る"
                                  : i.src === "百貨店"
                                    ? "百貨店のページを見る"
                                    : "販売ページを見る"}{" "}
                                <span aria-hidden="true">↗</span>
                              </a>
                            ) : (
                              <small>公式ページの情報がありません</small>
                            )}
                            <small>出典：{i.src}</small>
                          </div>
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
                      {Math.min(limit, results.length)} / {results.length}{" "}
                      件を表示中
                    </small>
                  </div>
                )}
              </>
            ) : (
              <div className="empty">
                <span aria-hidden="true">◇</span>
                <h3>ぴったりの品を、もう少し広く。</h3>
                <p>
                  いまの条件で候補は0件です。好み・産地・ジャンル・検索語を減らす、日持ち重視を外す、予算を広げると候補が見つかることがあります。
                </p>
                <div>
                  {relaxationOptions(items, c).map(
                    ({ label, conditions, count }) => (
                      <button
                        key={label}
                        className="secondary"
                        onClick={() => setC(conditions)}
                      >
                        {label}（→{count}件）
                      </button>
                    ),
                  )}
                  <button className="reset" onClick={reset}>
                    条件をリセット
                  </button>
                </div>
              </div>
            )}
            <p className="results-note">
              確認済みの品を優先してご提案。価格・日持ちは、ご購入前に販売元でもご確認ください。
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
              収録{items.length}品（{prefectureCount}
              都道府県、確認日：{confirmationPeriod}）。うち{verifiedCount}
              品はメーカー公式・公式通販・百貨店のページで税込価格の一致を確認。それ以外は要確認。価格・内容・日持ちは変わることがあるため、購入前に公式ページでご確認ください。日持ちは出典記載の日数で、製造日・発送日起算などの違いがあります。
            </p>
            <p>
              価格不明の{unknownPriceCount}
              品は候補に表示しません。日持ち不明の品は「日持ち重視」でも含まれます。
            </p>
          </div>
        </section>
      </main>
      <footer>
        <p>
          人柄・暮らし・時期・用途の印は品名・ジャンル・内容量・個包装・価格・日持ち・保存方法から決めたルールで付けています（パッケージの見た目など品名から分からないものには付けていません）。
        </p>
        <a className="footer-brand" href={location.pathname}>
          手土産えらび
        </a>
        <p>大切な人へ、気持ちが伝わるひと品を。</p>
        <small>個人情報・アクセス解析データは収集していません。</small>
      </footer>
      <nav className="mobile-bottom" aria-label="条件と共有">
        <button
          aria-haspopup="dialog"
          aria-controls="condition-dialog"
          aria-expanded={!!panel && !!conditionsRef.current?.open}
          onClick={(e) => openPanel("all", e.currentTarget)}
        >
          <Icon kind="sliders" />
          条件を変える
        </button>
        <button onClick={share}>
          <Icon kind="share" />
          共有
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="share-fallback"
        aria-labelledby="share-title"
        onCancel={() => setFallback("")}
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
          <button className="primary" onClick={() => setFallback("")}>
            閉じる
          </button>
        </div>
      </dialog>
    </>
  );
}
export default App;
