import { shelfLabel, prefectureLabel, storageLabel } from "./lib/display";
import { useEffect, useRef } from "react";
import { ItemImage } from "./ItemImage";
import { ItemPrice, dateLabel } from "./ItemPrice";
import { itemMarks, markLabels, type Mark } from "./lib/marks";
import type { Result } from "./lib/score";
export const packagingLabel = (ko: boolean | null) => ko === true ? "個包装あり" : ko === false ? "個包装なし" : "個包装は不明";
export function ItemDetail({ result, season, onClose, onFailure }: { result: Result; season: string; onClose: () => void; onFailure: (id: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { item: i, why, cautions } = result;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.body.style.overflow = old; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="item-detail" role="dialog" aria-modal="true" aria-labelledby="item-title"
    onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <button type="button" className="detail-close" aria-label="閉じる" onClick={onClose}>×</button>
    <div className="detail-photo"><ItemImage item={i} onFailure={onFailure} /></div>
    <h2 id="item-title">{i.n}</h2><p>{i.m}{i.p && `（${prefectureLabel(i.p)}）`}</p>
    <ItemPrice item={i} />
    <dl className="detail-specs">
      <div><dt>贈る時期</dt><dd>{season}</dd></div>
      <div><dt>内容量</dt><dd>{i.q || "不明"}</dd></div>
      <div><dt>個包装</dt><dd>{packagingLabel(i.ko)}</dd></div>
      <div><dt>日持ち</dt><dd>{shelfLabel(i, true)}</dd></div>
      <div><dt>保存方法</dt><dd>{storageLabel(i)}</dd></div>
    </dl>
    {Object.keys(itemMarks[i.id] ?? {}).length > 0 && <section className="detail-marks"><h3>合う相手・場面</h3>
    <div className="mark-tags" aria-label="合う相手・場面・時期・注意の印">{(Object.keys(itemMarks[i.id] ?? {}) as Mark[]).map(mark => <span key={mark} title={itemMarks[i.id]?.[mark]}>{markLabels[mark]}</span>)}</div></section>}
    {why.some(reason => reason.trim()) && <section><h3>おすすめ理由</h3><p>{why.filter(reason => reason.trim()).join("・")}</p></section>}
    {cautions.map(note => <p className="caution-note" key={note}>注意：{note}</p>)}
    <p className="detail-source">情報：{i.src === "公式" ? "お店の公式サイト" : i.src === "百貨店" ? "百貨店のサイト" : i.src || "確認先未記載"}（{dateLabel(i.c) || "確認日未記載"}確認）</p>
    {/^https?:\/\/[^\s|]+$/i.test(i.u) ? <a className="primary detail-official" href={i.u} target="_blank" rel="noopener noreferrer">公式ページで見る ↗</a> : <p>公式ページの情報がありません</p>}
  </dialog>;
}
