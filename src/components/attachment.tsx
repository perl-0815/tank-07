"use client";

import Image from "next/image";
import { IMAGES } from "@/game/images";

export function Attachment({ id, expanded = false, onOpen }: { id: string; expanded?: boolean; onOpen?: (id: string) => void }) {
  const asset = IMAGES[id];
  if (!asset) return null;
  const content = <>
    <div className="attachment-image" style={{ aspectRatio: `${asset.width} / ${asset.height}` }}><Image src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} sizes={expanded ? "(max-width: 900px) calc(100vw - 66px), 866px" : "(max-width: 600px) 80vw, 420px"} /><span className="image-scan" aria-hidden="true" /></div>
    <div className="attachment-meta"><span>{asset.id} / {asset.camera}</span><span>{expanded ? "受信映像" : "拡大 ↗"}</span></div>
  </>;
  return expanded ? <figure className="attachment expanded">{content}</figure> : <button type="button" className="attachment" onClick={() => onOpen?.(id)} aria-label={`${asset.id} ${asset.title}を拡大`}>{content}</button>;
}
