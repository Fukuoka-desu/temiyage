import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { imageRetryDelay, type ImageGate } from "./lib/imageLoading";
import { Artwork } from "./Artwork";
import type { Item } from "./lib/score";

const useImageLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
type Props = { item: Item; onFailure?: (id: number) => void; credit?: boolean; priority?: boolean; gate?: ImageGate };

export function ItemImage(props: Props) {
  // A new source gets fresh state, including when a card or modal is reused.
  return <ImageSource key={props.item.img ?? ""} {...props} />;
}

function ImageSource({ item, onFailure, credit = true, priority = false, gate }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [gateOpen, setGateOpen] = useState(gate?.getSnapshot() ?? true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!gate) return;
    const update = () => setGateOpen(gate.getSnapshot());
    const unsubscribe = gate.subscribe(update);
    update();
    return unsubscribe;
  }, [gate]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const settle = () => { if (priority) gate?.settle(item.id); };
  const finishLoad = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    waiting.current = false;
    setLoaded(true);
    settle();
  };
  const fail = () => {
    if (waiting.current || failed) return;
    const delay = imageRetryDelay(attempt);
    if (delay === null) {
      setFailed(true);
      settle();
      onFailure?.(item.id);
      return;
    }
    waiting.current = true;
    timer.current = setTimeout(() => {
      timer.current = null;
      waiting.current = false;
      setAttempt(attempt + 1);
    }, delay);
  };
  const enabled = priority || gateOpen;
  useImageLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) finishLoad();
  }, [attempt, enabled, priority, gate, item.id]);
  if (!item.img || failed) return <div className="photo-placeholder"><Artwork genre={item.g} /><span>{item.g} · 写真なし</span></div>;
  return (
    <span className={`item-image${loaded ? " is-loaded" : " is-loading"}`}>
      <img
        key={attempt}
        ref={imageRef}
        className="item-photo"
        src={enabled ? item.img : undefined}
        alt={`${item.n}の写真`}
        loading={priority ? "eager" : "lazy"}
        {...(priority ? { fetchpriority: "high" } : {})}
        decoding="async"
        width={640}
        height={400}
        referrerPolicy="no-referrer"
        onLoad={finishLoad}
        onError={fail}
      />
      {credit && <a
        className="image-credit"
        href={item.imgsrc}
        target="_blank"
        rel="noopener noreferrer"
      >
        画像：公式ページより
      </a>}
    </span>
  );
}
