import { useState } from "react";
import { Artwork } from "./Artwork";
import type { Item } from "./lib/score";

export function ItemImage({ item }: { item: Item }) {
  const [failed, setFailed] = useState<string>();
  if (!item.img || failed === item.img) return <Artwork genre={item.g} />;
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
        onError={() => setFailed(item.img)}
      />
      <a
        className="image-credit"
        href={item.imgsrc}
        target="_blank"
        rel="noopener noreferrer"
      >
        画像：公式ページより
      </a>
    </>
  );
}
