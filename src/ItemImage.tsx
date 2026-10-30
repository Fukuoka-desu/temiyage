import { useState } from "react";
import { Artwork } from "./Artwork";
import type { Item } from "./lib/score";

export function ItemImage({ item, onFailure, credit = true }: { item: Item; onFailure?: (id: number) => void; credit?: boolean }) {
  const [failed, setFailed] = useState<string>();
  if (!item.img || failed === item.img) return <div className="photo-placeholder"><Artwork genre={item.g} /><span>{item.g} · 写真なし</span></div>;
  return (
    <>
      <img
        className="item-photo"
        src={item.img}
        alt={`${item.n}の写真`}
        loading="lazy"
        decoding="async"
        width={640}
        height={400}
        referrerPolicy="no-referrer"
        onError={() => { setFailed(item.img); onFailure?.(item.id); }}
      />
      {credit && <a
        className="image-credit"
        href={item.imgsrc}
        target="_blank"
        rel="noopener noreferrer"
      >
        画像：公式ページより
      </a>}
    </>
  );
}
