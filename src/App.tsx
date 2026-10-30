import { createImageGate, priorityImageCount, snapshotImageFailures } from "./lib/imageLoading";
import { shelfLabel, shopShelfText, cardCautionText } from "./lib/display";
import { ItemDetail, packagingLabel } from "./ItemDetail";
import { BudgetRange } from "./BudgetRange";
import { ItemImage } from "./ItemImage";
import { ItemPrice, dateLabel } from "./ItemPrice";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import data from "./data/items.json";
import { Emblem, Flower, Icon } from "./Artwork";
import {
  traitGroups,
  traitLabels,
} from "./lib/marks";
import {
  budgetText,
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
import { searchSuggestions } from "./lib/search";
import { readConditions, writeConditions, readItemId, writeItemId } from "./lib/url";
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
  if (!raw || raw === "不明") return false;
  const daysOnly = raw.match(/^(?:約)?(\d+(?:\.\d+)?)(?:日(?:間)?)?$/);
  return !daysOnly || item.d === null || Number(daysOnly[1]) !== item.d;
}
const prefs =
  "北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄".split(
    " ",
  );
const genres = [...new Set(items.map((i) => i.g))];
function budgetSummary(c: Conditions) {
  return (
    budgetText(c) + (c.budget !== "any" && c.pu ? "（価格不明も含む）" : "")
  );
}
function App() {
  const [c, setC] = useState<Conditions>(() => readConditions(prefs, genres));
  const [itemId, setItemId] = useState(readItemId);
  const pushedItem = useRef(false);
  const [failedImages, setFailedImages] = useState<ReadonlySet<number>>(new Set());
  const imageFailure = (id: number) => setFailedImages(old => old.has(id) ? old : new Set([...old, id]));
  function openItem(id: number) { writeItemId(id, true); pushedItem.current = true; setItemId(id); }
  function closeItem() {
    if (pushedItem.current) { pushedItem.current = false; history.back(); }
    else { writeItemId(null); setItemId(null); }
  }
  const [panel, setPanel] = useState("");
  const [bottomReady, setBottomReady] = useState(false);
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
  const bottomVisibleNow = bottomReady && !panel && itemId === null && !fallback;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [priorityCount] = useState(() => priorityImageCount(window.innerWidth));
  const deferred = useDeferredValue(c);
  const [failureSnapshot, setFailureSnapshot] = useState(() => ({ conditions: deferred, failedImages }));
  const sortingSnapshot = snapshotImageFailures(failureSnapshot, deferred, failedImages);
  if (sortingSnapshot !== failureSnapshot) setFailureSnapshot(sortingSnapshot);
  const results = useMemo(
    () => filterSort(scoreItems(items, deferred), deferred, sortingSnapshot.failedImages),
    [deferred, sortingSnapshot.failedImages],
  );
  const [imageGate] = useState(() => createImageGate(
    results.slice(0, priorityCount).filter(({ item }) => !!item.img).map(({ item }) => item.id),
  ));
  useEffect(() => imageGate.start(), [imageGate]);
  const suggestions = useMemo(
    () => (results.length === 0 ? searchSuggestions(items, deferred.q) : []),
    [results.length, deferred.q],
  );
  useEffect(() => {
    // Keep the first card unobstructed until it has been read past.
    const updateBottom = () => {
      const firstCard = resultRef.current?.querySelector(".item-card");
      setBottomReady(window.scrollY > window.innerHeight / 2 &&
        !!firstCard && firstCard.getBoundingClientRect().bottom <= 0);
    };
    updateBottom();
    window.addEventListener("scroll", updateBottom, { passive: true });
    window.addEventListener("resize", updateBottom);
    return () => {
      window.removeEventListener("scroll", updateBottom);
      window.removeEventListener("resize", updateBottom);
    };
  }, [results]);
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
      if (key === "budget") {
        delete next.bmin;
        delete next.bmax;
      }
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
    const handler = () => { setC(readConditions(prefs, genres)); setItemId(readItemId()); };
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
              </button>
              {index < 3 && (
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
                  ["予算", budgetSummary(c)],
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
              <button type="button" onClick={closePanel} aria-label="閉じる">
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
                    ふたりの土地
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
                    好みとこだわり
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
                <section className="form-section section-occasion">
                  <h2>
                    贈る時期と場面
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
            <BudgetRange conditions={c} onChange={setC} />
            <div className="filter-box">
              <label className="search-label" htmlFor="search">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
                <input
                  id="search"
                  type="search"
                  placeholder="品名・店名・県・ジャンルで検索"
                  value={c.q}
                  onChange={(e) => update("q", e.target.value)}
                  aria-label="品名・店名・県・ジャンルで検索"
                />
              </label>
              <div className="filter-selects">
                <div className="filter-pref">
                  <select
                    id="fpref"
                    aria-label="産地で絞る"
                    value={c.fpref}
                    onChange={(e) => update("fpref", e.target.value)}
                  >
                    <option value="">産地：すべて</option>
                    {prefs.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="genre-filter">
                  <select
                    id="genre"
                    aria-label="ジャンルで絞る"
                    value={c.genre}
                    onChange={(e) => update("genre", e.target.value)}
                  >
                    <option value="">ジャンル：すべて</option>
                    {genres.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="sort-label">
                  <select
                    id="sort"
                    aria-label="並べ替え"
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
                </div>
              </div>
            </div>
            <div className="result-toolbar">
              <div className="result-count">
                <p role="status">
                  全{items.length}品中 <strong>{results.length}</strong>品が条件に合います
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
                          <button className="card-open-photo" onClick={() => openItem(i.id)} aria-label={`${i.n}の詳細を見る`}><ItemImage item={i} gate={imageGate} priority={index < priorityCount} onFailure={imageFailure} credit={false} /></button>
                          <div className="card-top">
                            <span className="region">
                              {i.p}
                              <small> / {i.r}</small>
                            </span>
                            {(!i.v || i.y === null) && (
                              <span className="badge unverified">要確認</span>
                            )}
                          </div>
                        </div>
                        <div className="card-content">
                          <span className="verified-note">{i.v && i.y !== null ? "価格確認済み" : ""}</span>
                          <div className="card-title">
                            <span className="item-genre">
                              {i.g}
                              {c.sort === "recommend" && index < 3 && (
                                <span className="rank">
                                  おすすめ
                                </span>
                              )}
                            </span>
                            <h3><button className="card-open-title" onClick={() => openItem(i.id)}>{i.n}</button></h3>
                            <p className="maker">{i.m}</p>
                          </div>
                          <p className="quantity">
                            {i.q || "内容量は販売元へご確認ください"}
                          </p>
                          <div className="price-specs">
                            <ItemPrice item={i} />
                            <div className="specs">
                              <span>
                                {shelfLabel(i)}
                              </span>
                              <span>
                                {packagingLabel(i.ko)}
                              </span>
                              {i.st && <span className="cold">{i.st}</span>}
                            </div>
                          </div>
                          <p className="shelf-note" title={i.dr}>
                            {hasShelfDetails(i) ? `お店の表記：${shopShelfText(i.dr)}` : ""}
                          </p>
                          <div className={`reasons ${why.some(reason => reason.trim()) ? "" : "reasons-empty"}`}>
                            <h4>
                              <Flower />
                              おすすめ理由
                            </h4>
                            <p>{why.filter(reason => reason.trim()).join("・")}</p>
                          </div>
                          <p className="card-caution" aria-label="注意">
                            {cardCautionText(i, cautions)}
                          </p>
                          <div className="card-link">
                            <button onClick={() => openItem(i.id)}>詳しく見る →</button>
                            <small>情報：{i.src === "公式" ? "お店の公式サイト" : i.src === "百貨店" ? "百貨店のサイト" : i.src}（{dateLabel(i.c)}確認）</small>
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
                {c.q.trim() && c.q === deferred.q && suggestions.length > 0 && (
                  <div>
                    <span>もしかして：</span>
                    {suggestions.map((word) => (
                      <button
                        key={word}
                        className="secondary"
                        onClick={() => update("q", word)}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                )}
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
              品は予算「指定しない」または「価格不明の品も含める」で候補に含まれ、価格のある品のあとに表示します。日持ち不明の品は「日持ち重視」でも含まれます。
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
      <nav className={`mobile-bottom ${bottomVisibleNow ? "is-visible" : ""}`} aria-label="条件と共有"
        ref={(node) => node?.toggleAttribute("inert", !bottomVisibleNow)}>
        <button
          aria-haspopup="dialog"
          aria-controls="condition-dialog"
          aria-expanded={!!panel && !!conditionsRef.current?.open}
          disabled={!bottomVisibleNow}
          onClick={(e) => openPanel("all", e.currentTarget)}
        >
          <Icon kind="sliders" />
          条件を変える
        </button>
        <button disabled={!bottomVisibleNow} onClick={share}>
          <Icon kind="share" />
          共有
        </button>
      </nav>
      {itemId !== null && (() => {
        const item = items.find(i => i.id === itemId);
        if (!item) return null;
        const result = results.find(r => r.item.id === itemId) ?? scoreItems([item], { ...defaults, pref: "", budget: "any", season: c.season, use: c.use })[0];
        return result ? <ItemDetail key={itemId} result={result} season={seasons[c.season]} onClose={closeItem} onFailure={imageFailure} /> : null;
      })()}
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
