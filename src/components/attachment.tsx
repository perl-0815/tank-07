"use client";

import Image from "next/image";
import { IMAGES } from "@/game/images";

export function Attachment({ id, expanded = false, onOpen }: { id: string; expanded?: boolean; onOpen?: (id: string) => void }) {
  const asset = IMAGES[id];
  if (!asset) return null;
  const content = <>
    <div className="attachment-label"><span>↳ IMAGE ATTACHMENT</span><span>{expanded ? asset.title : "拡大 ↗"}</span></div>
    <div className="attachment-image"><Image src={asset.src} alt={asset.alt} width={1200} height={675} sizes={expanded ? "(max-width: 800px) 90vw, 800px" : "(max-width: 600px) 80vw, 420px"} unoptimized /><span className="image-scan" aria-hidden="true" /></div>
    <div className="attachment-meta"><span>{asset.id} / {asset.camera}</span><span>SIGNAL {asset.quality}%</span></div>
  </>;
  return expanded ? <figure className="attachment expanded">{content}</figure> : <button type="button" className="attachment" onClick={() => onOpen?.(id)} aria-label={`${asset.id} ${asset.title}を拡大`}>{content}</button>;
}
