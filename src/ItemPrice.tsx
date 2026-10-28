import type { Item } from "./lib/score";
export function dateLabel(value: string) {
  const m = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : value;
}
export function ItemPrice({ item }: { item: Item }) {
  return (
    <div className="price">
      {item.y === null ? (
        <small>価格は公式ページでご確認ください</small>
      ) : (
        <>
          <strong>
            {item.y.toLocaleString("ja-JP")}
            <span>円（税込）</span>
          </strong>
          <small>{dateLabel(item.c)}確認時点・税込</small>
        </>
      )}
    </div>
  );
}
