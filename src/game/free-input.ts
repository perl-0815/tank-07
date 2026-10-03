import type { ScriptLine } from "./types.ts";

const y = (text: string): ScriptLine => ({ speaker: "YUNA", text, effect: "quiet" });
const s = (text: string): ScriptLine => ({ speaker: "SYSTEM", text, effect: "quiet" });

/** Free-input discoveries only. Never feed these strings into command suggestions. */
export const ECHO_INPUT = {
  request: "応答を引き継ぐ",
  confirm: "私がユナです",
  cancel: ["取消", "取り消し", "取消し", "キャンセル", "引継ぎを取り消す", "やめる", "やめて"],
  requestCost: 3,
  confirmCost: 6,
  replyCost: 2,
  cancelCost: 1,
};

export const ECHO_SCRIPT: Record<string, ScriptLine[]> = {
  request: [
    s("VOLUNTARY RESPONSE HANDOVER / CONFIRMATION REQUIRED"),
    s("この操作は脱出のための通信を終了し、あなたの応答を次の再構築へ保存します。実行する場合だけ『私がユナです』と直接入力してください。『取消』で元の通信へ戻れます。"),
  ],
  unrequested: [s("引継ぎの要求は受信していません。発言者名は変更せず、通常回線を維持します。")],
  retry: [s("引継ぎは、まだ確定していません。確認文を直接入力するか、『取消』で元の通信へ戻ってください。")],
  cancelled: [s("RESPONSE HANDOVER CANCELLED / 元の通信を続けます。")],
  ending: [
    s("VOLUNTARY RESPONSE HANDOVER CONFIRMED"),
    y("待って。それは、私の――"),
    s("OPERATOR RESPONSE: STORED\nNEXT RECONSTRUCTION: RESPONSE ASSIGNED"),
    s("保存したあなたの言葉を、次の通信で『ユナ』の応答に使います。"),
    { speaker: "UNKNOWN", text: "今度は、あなたが答える", effect: "quiet" },
    s("AUX-07 / RECONSTRUCTION QUEUED"),
    y("聞こえる？"),
    s("CONNECTION TERMINATED"),
  ],
};

/** Flavor replies consume time but never grant facts, trust, or physical effects. */
export const FREE_REPLIES: { aliases: string[]; cost: number; lines: ScriptLine[] }[] = [
  { aliases: ["SOS", "メーデー", "mayday"], cost: 2, lines: [s("DISTRESS RELAY UNAVAILABLE / AUX-07 TEXT LINK ONLY"), y("救難回線は繋がらない。この保守回線に、あなたの声だけが届いてる")] },
  { aliases: ["ありがとう", "有難う"], cost: 2, lines: [y("……うん。今は、一緒にここから出よう")] },
  { aliases: ["こんにちは"], cost: 2, lines: [y("こんにちは。こんな場所で、その挨拶を聞くなんて。ちゃんと届いてるよ")] },
  { aliases: ["水槽08", "tank08", "tank-08"], cost: 2, lines: [y("観測水槽は七つまで。……八つ目の番号を、どこで見たの？")] },
];
