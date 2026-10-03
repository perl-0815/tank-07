import type { ActionDefinition, ChoiceContextRule, DialogueTopic, Fact, ScriptLine } from "./types.ts";

export const LOOP_SECONDS = 180;
export const TRUE_FACTS = ["F10", "F11", "F12", "F13", "F14", "F21"];

export const FACTS: Record<string, Fact> = {
  F01: { title: "第4研究区画", detail: "接続開始時、ユナは第4研究区画にいた。", category: "攻略", keyword: "今どこ？" },
  F02: { title: "非常電源の場所", detail: "非常電源は第2機械室にある。移動には25秒かかる。", category: "攻略", keyword: "第2機械室へ" },
  F03: { title: "非常電源コード", detail: "非常電源の認証コードは7319。知っていれば最初から使える。", category: "攻略", keyword: "7319" },
  F04: { title: "中央管理端末", detail: "扉を開けても自動封鎖される。隔離プロトコルは中央管理端末から操作できる。", category: "攻略", keyword: "中央管理端末" },
  F05: { title: "隔離と圧力", detail: "隔離が圧力を閉じ込めている。水槽07の隔離解除で自動封鎖は停止する。解除前に第7区画の排水ポンプを止める必要がある。", category: "攻略", keyword: "隔離プロトコルを解除" },
  F10: { title: "模倣された声", detail: "水槽07は事故前から研究員の声を模倣していた。音声ログに、ユナと同じ声がある。", category: "真相", keyword: "音声ログ" },
  F11: { title: "言語学習", detail: "水槽07は人間の言葉を繰り返し、学習していた。", category: "真相" },
  F12: { title: "17分前のユナ", detail: "事故17分前、ユナは水槽07に入室している。本人は覚えていない。", category: "真相", keyword: "監視ログ" },
  F13: { title: "途切れた応答", detail: "監視ログ上、ユナは事故5分前から応答していない。", category: "真相", keyword: "君、本当にユナ？" },
  F14: { title: "生体反応ゼロ", detail: "水槽07の内部には、通常の生体反応が存在しない。", category: "真相", keyword: "生体反応は？" },
  F20: { title: "巻き戻らない施設", detail: "施設の時計は進み続けている。時間が巻き戻っているのは、施設そのものではない。", category: "通信", keyword: "通信履歴" },
  F21: { title: "再構築された記録", detail: "この通信回線は、事故直前の記録を再構築している可能性がある。", category: "通信", keyword: "君、本当にユナ？" },
  F22: { title: "こちらを見ている", detail: "UNKNOWNは通信システムを介して、地上側の操作者を認識している。", category: "通信" },
  F23: { title: "前にもされた質問", detail: "UNKNOWNだけは、この接続を繰り返していることを認識している可能性がある。", category: "通信" },
};

const y = (text: string, imageId?: string, effect?: ScriptLine["effect"]): ScriptLine => ({ speaker: "YUNA", text, ...(imageId ? { imageId } : {}), ...(effect ? { effect } : {}) });
const s = (text: string, effect?: ScriptLine["effect"]): ScriptLine => ({ speaker: "SYSTEM", text, ...(effect ? { effect } : {}) });
const u = (text: string, imageId?: string): ScriptLine => ({ speaker: "UNKNOWN", text, effect: "quiet", ...(imageId ? { imageId } : {}) });
const p = (text: string): ScriptLine => ({ speaker: "YOU", text });

/** Content-only script blocks: image IDs point to replaceable attachment assets. */
export const SCRIPT: Record<string, ScriptLine[]> = {
  opening: [s("ABYSSAL-7 緊急通信を検出しました"), s("AUXILIARY LINK ESTABLISHED\nDEPTH 3200m / CHANNEL AUX-07"), y("聞こえる？")],
  reconnect: [s("RECONNECTING...\nAUX CHANNEL 07 / SEARCHING...\nSIGNAL FOUND")],
  welcome: [y("よかった"), y("通信が全部死んでる"), y("あと数分で第4区画が完全に封鎖される")],
  machineKnown: [y("分かった。さっき話した第2機械室へ、保守通路から向かう")],
  machineUnknown: [y("え？　なんで場所を知ってるの？"), y("……分かった。第2機械室へ行く")],
  machineArrival: [y("着いた。非常電源の端末がある", "IMG_03"), y("認証コードが必要みたい", "IMG_04")],
  powerKnown: [s("EMERGENCY POWER ONLINE"), y("さっき見つけたコードで通った。電源が戻った！"), y("この端末で、施設の監視映像と記録、設備の一覧も見られるようになった")],
  powerUnknown: [s("EMERGENCY POWER ONLINE"), y("……本当に通った"), y("あなた何者？"), y("この端末で、施設の監視映像と記録、設備の一覧も見られるようになった")],
  codeFirst: [y("7319？　非常電源のコード？"), y("どうして知ってるの？　……第2機械室で試してみる")],
  noPower: [y("電源が落ちていて操作できない。まず第2機械室の非常電源を戻して")],
  tankTrusted: [y("生物観測用の水槽。少なくとも……表向きは"), y("事故の前、誰もいないはずの場所から、私たちの声が聞こえた")],
  tankDistrust: [y("今それ説明してる場合じゃない"), y("電源を戻せば、監視映像は見られると思う")],
  identityHigh: [y("分からない", undefined, "quiet"), y("私も、自分がここにいる理由が分からない", undefined, "quiet"), s("AUX-07 / INCIDENT BUFFER RECONSTRUCTION"), y("この回線、事故の直前の記録をつなぎ直してる……？", undefined, "quiet")],
  identityLow: [y("やめて", undefined, "quiet"), y("あなたの方がおかしい", undefined, "quiet"), y("今は、施設の操作だけにして")],
  truthClosed: [y("その話はしたくない。脱出のための操作なら続ける")],
  releaseWarning: [s("WARNING\nSPECIMEN 07 CONTAINMENT WILL BE LOST", "glitch"), y("隔離を解除すれば、自動封鎖も停止する。でも、それは水槽07を開けるってこと……")],
  pumpWarning: [s("PRESSURE DIFFERENTIAL WARNING\nSECTION-07 DRAINAGE PUMP: ACTIVE"), y("排水ポンプが動いたままだと、解除した瞬間に圧力差で隔壁が破損する。先に第7区画のポンプを止める必要がある")],
  releaseTrusted: [y("……分かった。あなたを信じる")],
  releaseDistrust: [y("信じられない。でも、他に方法がない")],
  released: [s("CONTAINMENT RELEASED\nTANK-07 OPEN\nAUTOMATIC LOCKDOWN DISABLED", "glitch"), y("……", undefined, "quiet"), p("どうした？"), y("いない", undefined, "quiet"), p("何が？"), y("中に。何もいない", "IMG_09", "quiet"), s("UNKNOWN CONNECTION", "quiet"), u("こんにちは"), y("誰？", undefined, "quiet"), u("やっと。話せた")],
  normal: [s("ABYSSAL-7 INCIDENT\nSURVIVORS: 1\nCAUSE: UNKNOWN"), u("こんにちは"), s("CONNECTION TERMINATED", "quiet")],
  secret: [y("どうして全部知ってるの？", undefined, "quiet"), u("また来た"), p("また？"), u("今度は早かったね"), s("CONNECTION TERMINATED", "quiet")],
  secretLearned: [y("一緒に調べた手順で、ここまで来られた……", undefined, "quiet"), u("また来た"), p("また？"), u("今度は早かったね"), s("CONNECTION TERMINATED", "quiet")],
  true: [u("違う", "IMG_10"), p("じゃあ誰？"), u("その質問は。前にもされた"), p("誰に？"), u("あなたに"), s("CONNECTION HISTORY ERROR", "glitch"), s("LOOP COUNT: UNKNOWN", "quiet")],
  flood: [s("PRESSURE DROP DETECTED\nSECTION-04 WATER INGRESS", "glitch"), y("待って。水が入ってきてる", "IMG_02", "glitch")],
  floodRemote: [s("PRESSURE DROP DETECTED\nSECTION-04 WATER INGRESS", "glitch"), y("第4区画のカメラに浸水が映ってる。機械室も揺れた", "IMG_02", "glitch")],
  floodTransit: [s("PRESSURE DROP DETECTED\nSECTION-04 WATER INGRESS", "glitch"), y("通路まで水が来てる。先を急がないと", "IMG_02", "glitch")],
  minute: [s("AUXILIARY POWER LOW / 60 SECONDS REMAINING")],
  thirty: [y("だめ。隔壁が閉じる", undefined, "glitch"), s("区画圧力異常 / SECTION-04 LOCKDOWN", "glitch"), y("もし聞こえてるなら、第2機械室を――")],
  thirtyPowered: [s("区画圧力異常 / ISOLATION PRESSURE CRITICAL", "glitch"), y("電源は戻ったのに、隔離はまだ動いてる", undefined, "glitch"), y("中央端末を。もう時間がない――")],
  thirtyMachine: [s("区画圧力異常 / SECTION-04 LOCKDOWN", "glitch"), y("第4区画の隔壁が閉じる。機械室の非常電源を起動しないと――", undefined, "glitch")],
  thirtyCentral: [s("区画圧力異常 / ISOLATION PRESSURE CRITICAL", "glitch"), y("中央端末には繋がってる。隔離の圧力を何とかしないと――", undefined, "glitch")],
  thirtyDrained: [s("ISOLATION PRESSURE CRITICAL / DRAINAGE OFFLINE", "glitch"), y("排水は止まった。あとは隔離の解除を急いで――", undefined, "glitch")],
  ten: [s("SYSTEM ALERT\nSIGNAL INSTABILITY DETECTED", "glitch")],
  timeout: [s("SIGNAL LOST", "glitch"), y("待っ――", undefined, "glitch"), s("CONNECTION TERMINATED", "glitch")],
  escapeFailure: [s("ISOLATION PROTOCOL ACTIVATED", "glitch"), y("また閉まった！"), y("中央システムが勝手に封鎖してる。中央管理端末から隔離を止めないと――"), s("SECTION-04 LINK LOST\nCONNECTION TERMINATED", "glitch")],
  pressureFailure: [s("STRUCTURAL FAILURE CAUSED BY CONTAINMENT PRESSURE", "glitch"), y("隔離しているから、圧力が逃げない……！"), s("RECOVERY PROCEDURE / CENTRAL CONTROL\n第7区画排水ポンプ停止 → 水槽07隔離解除\n隔離解除により自動封鎖を停止"), s("CONNECTION TERMINATED", "glitch")],
  orderFailure: [s("AUTOMATIC LOCKDOWN DISABLED\nPRESSURE DIFFERENTIAL EXCEEDED\nDRAINAGE PUMP ACTIVE / BULKHEAD FAILURE", "glitch"), y("自動封鎖は止まったのに、圧力が――先に第7区画の排水を止めないと、だめだった"), s("CONNECTION TERMINATED", "glitch")],
};

/** Editable commands. Conditional responses and physical prerequisites are in engine.ts. */
export const ACTIONS: Record<string, ActionDefinition> = {
  hello: { id: "hello", label: "聞こえる", cost: 3, scene: "contact", trust: 1 },
  name: { id: "name", label: "誰？", cost: 5, scene: "contact", lines: [y("神崎ユナ。ここの生物研究員。あなた、救難担当の人？")] },
  incident_intro: { id: "incident_intro", label: "何が起きてる？", cost: 5, scene: "contact" },
  incident: { id: "incident", label: "何が起きた？", cost: 15, facts: ["F01"], lines: [y("水槽07の警報が鳴った直後に電源が落ちた。そのとき私は、第4研究区画にいた")] },
  location: { id: "location", label: "今どこ？", cost: 8 },
  escape: { id: "escape", label: "逃げられない？", cost: 10 },
  more: { id: "more", label: "設備や周囲について聞く", cost: 0, scene: "questions" },
  power_location: { id: "power_location", label: "非常電源はどこ？", cost: 8, facts: ["F02"], lines: [y("第2機械室。保守用の通路なら、まだ通れる")] },
  tank_question: { id: "tank_question", label: "水槽07って何？", cost: 10 },
  other_people: { id: "other_people", label: "他に人は？", cost: 8, scene: "surroundings", lines: [y("呼びかけても返事がない。さっき、私の声みたいなものは聞こえたけど……") ] },
  break_door: { id: "break_door", label: "扉を壊せない？", cost: 12, facts: ["F02"], lines: [y("耐圧隔壁だから無理。第2機械室の非常電源なら、まだ使えるはず")] },
  go_machine: { id: "go_machine", label: "第2機械室へ行って", cost: 25, scene: "machine", facts: ["F02"] },
  find_code: { id: "find_code", label: "コードを探して", cost: 25, facts: ["F03"], lines: [y("保守用のパネルを外す。少し待って"), y("あった。手書きの番号……7319。これが非常電源のコード")] },
  enable_power: { id: "enable_power", label: "7319 を入力", cost: 8, scene: "powered", facts: ["F03"] },
  admin: { id: "admin", label: "管理者権限を使って", cost: 12, lines: [s("ADMIN AUTHENTICATION UNAVAILABLE"), y("管理サーバーに繋がらない。保守パネルに非常電源のコードがないか探せる")] },
  back: { id: "back", label: "操作メニューに戻る", cost: 0 },
  open_door: { id: "open_door", label: "第4区画の扉を開けて", cost: 8, scene: "escaping", lines: [s("LOCK RELEASED"), y("第4区画の扉が開いた。機械室からそちらへ戻って、出口を目指す！")] },
  inspect_controls: { id: "inspect_controls", label: "操作できる設備を調べる", cost: 8, scene: "powered", facts: ["F04"], lines: [s("FACILITY CONTROL DIRECTORY\nISOLATION CONTROL: CENTRAL TERMINAL"), y("中央管理端末から、隔離プロトコルを操作できる"), y("個別に扉を開けても、中央が自動で封鎖し直す仕組みみたい")] },
  tank: { id: "tank", label: "水槽07を確認する", cost: 12, scene: "tank", lines: [y("……本気？"), p("必要だ"), y("監視映像を開く。何も見えない。水槽の中、真っ暗", "IMG_05", "quiet")] },
  vitals: { id: "vitals", label: "生体反応は？", cost: 8, facts: ["F14"], lines: [y("ゼロ。そんなはずない", undefined, "quiet")] },
  brighten: { id: "brighten", label: "映像を明るくして", cost: 8, lines: [y("明るさを上げた。これは……反射？", "IMG_06", "quiet")] },
  audio: { id: "audio", label: "音声ログを確認", cost: 15, facts: ["F10", "F11"], lines: [s("TANK-07 / AUDIO ARCHIVE\n『こんにちは』『ユナ』『こんにちは』"), y("……これ。私の声", undefined, "quiet"), s("VOCAL MIMICRY CONFIRMED / LANGUAGE LEARNING IN PROGRESS")] },
  security: { id: "security", label: "監視ログを見る", cost: 15, scene: "security", facts: ["F12"], lines: [s("17 MIN BEFORE INCIDENT"), y("……私？", "IMG_07", "quiet"), p("覚えてない？"), y("行ってない", undefined, "quiet")] },
  next_security: { id: "next_security", label: "次の映像を見る", cost: 12, facts: ["F13"], lines: [s("5 MIN BEFORE INCIDENT"), y("水槽07の前に、立ってる。ずっと動かない", "IMG_08", "quiet"), s("SUBJECT YUNA / NO RESPONSE\nVIDEO FEED INTERRUPTED", "quiet")] },
  question_identity: { id: "question_identity", label: "君、本当にユナ？", cost: 10, scene: "identity" },
  reassure: { id: "reassure", label: "信じて。時間がない", cost: 6, trust: 1 },
  central: { id: "central", label: "中央管理端末にアクセス", cost: 10, scene: "central", facts: ["F04"], lines: [s("CENTRAL CONTROL ONLINE\nISOLATION PROTOCOL ACTIVE"), y("機械室の端末から、中央管理に遠隔接続できた。隔離、圧力制御、通信履歴を操作できる")] },
  protocol: { id: "protocol", label: "隔離プロトコルの状態を確認", cost: 3, scene: "protocol", facts: ["F04"], lines: [s("ISOLATION PROTOCOL ACTIVE\nMAINTAIN / REINFORCE / RELEASE")] },
  pressure: { id: "pressure", label: "圧力制御を確認", cost: 8, scene: "pressure", facts: ["F05"] },
  pressure_details: { id: "pressure_details", label: "圧力が異常になる理由は？", cost: 8, facts: ["F05"] },
  stop_pump: { id: "stop_pump", label: "第7区画の排水ポンプを停止", cost: 10, scene: "central" },
  comms: { id: "comms", label: "通信回線を調べる", cost: 5, scene: "comms", lines: [s("AUX-07 / MAINTENANCE LINK\nINCIDENT BUFFER AVAILABLE")] },
  history: { id: "history", label: "通信履歴と施設の時計を照合", cost: 12, facts: ["F20"], lines: [s("FACILITY CLOCK: CONTINUOUS\nAUX-07 RECORD TIMESTAMP: REPEATING"), y("施設の時計は戻ってない。なのに、この回線だけ同じ3分間を繰り返してる……？")] },
  signal: { id: "signal", label: "信号の発信元は？", cost: 8, lines: [s("SOURCE: AUX-07 / INCIDENT BUFFER\nADDITIONAL SOURCE: UNRESOLVED"), y("発信元が、一つじゃない。水槽の回線が混じってる") ] },
  maintain: { id: "maintain", label: "隔離を維持", cost: 5, scene: "pressure_failure", lines: [s("CONTAINMENT MAINTAINED\nPRESSURE RISING", "glitch"), y("待って、隔壁が軋んでる。圧力が逃げない") ] },
  reinforce: { id: "reinforce", label: "隔離を強化", cost: 5, scene: "pressure_failure", lines: [s("CONTAINMENT REINFORCED\nPRESSURE CRITICAL", "glitch"), y("余計に圧力が上がった……！") ] },
  request_release: { id: "request_release", label: "隔離プロトコルを解除", cost: 3, scene: "release_confirm", facts: ["F04"] },
  release: { id: "release", label: "開ける", cost: 18 },
  refuse: { id: "refuse", label: "やめる", cost: 3, scene: "pressure_failure", lines: [y("……そうだね。開けるわけにはいかない"), s("CONTAINMENT PRESSURE RISING", "glitch")] },
  alternative: { id: "alternative", label: "別の方法を探す", cost: 10, scene: "pressure_failure", lines: [y("他の経路も、全部隔離されてる"), s("CONTAINMENT PRESSURE CRITICAL", "glitch")] },
  wait: { id: "wait", label: "応答を待つ", cost: 20 },
  unknown_identity: { id: "unknown_identity", label: "君は水槽07？", cost: 0 },
};

/** Flat candidates, grouped only for presentation; no navigation actions. */
export const CHOICE_GROUPS: Record<string, string[]> = {
  会話: ["hello", "name", "incident", "location", "escape", "tank_question", "other_people", "break_door", "reassure", "question_identity"],
  非常電源: ["power_location", "go_machine", "find_code", "enable_power", "admin"],
  調査: ["tank", "vitals", "brighten", "audio", "security", "next_security", "comms", "history", "signal"],
  施設操作: ["inspect_controls", "central", "protocol", "pressure", "pressure_details", "stop_pump", "request_release", "maintain", "reinforce", "open_door"],
};

/**
 * Current-conversation prerequisites for every flat-list candidate. Empty rules
 * are intentional: neutral questions need no setup; recorded instructions keep
 * their separate CHOICE_RECORDS contract. None of these rules validate input.
 */
export const CHOICE_CONTEXTS: Record<string, ChoiceContextRule> = {
  hello: {}, name: {}, incident: {}, location: {},
  escape: { anyTopics: ["emergency", "closed_door", "power_outage", "emergency_power"] },
  tank_question: { allTopics: ["tank07"] },
  other_people: { anyTopics: ["facility", "emergency"] },
  break_door: { allTopics: ["closed_door"] },
  reassure: { anyTopics: ["emergency", "deadline", "suspicion"] },
  question_identity: {},
  power_location: { anyTopics: ["power_outage", "emergency_power"] },
  go_machine: {},
  find_code: { allTopics: ["code_required"] },
  enable_power: {},
  admin: { allTopics: ["code_required"] },
  tank: { allTopics: ["tank07"] },
  vitals: { allTopics: ["tank_feed"] },
  brighten: { allTopics: ["tank_feed"] },
  audio: { allTopics: ["tank_feed"] },
  security: { allTopics: ["surveillance"] },
  next_security: { allTopics: ["security_archive"] },
  comms: { anyTopics: ["central_controls", "communications"] },
  history: { allTopics: ["communications"] },
  signal: { allTopics: ["communications"] },
  inspect_controls: { allTopics: ["terminal"] },
  central: {},
  protocol: { anyTopics: ["central_controls", "isolation"] },
  pressure: { anyTopics: ["central_controls", "pressure"] },
  pressure_details: { allTopics: ["pressure_abnormal"] },
  stop_pump: {},
  request_release: {},
  maintain: { allTopics: ["isolation"] },
  reinforce: { allTopics: ["isolation"] },
  open_door: { allTopics: ["closed_door"] },
};

/** Topics introduced by actual script output, not by accumulated fact IDs. */
export const SCRIPT_TOPICS: Record<string, DialogueTopic[]> = {
  welcome: ["emergency", "deadline", "facility"],
  machineKnown: ["facility", "emergency_power"],
  machineUnknown: ["facility", "emergency_power", "suspicion"],
  machineArrival: ["terminal", "code_required", "emergency_power", "facility"],
  powerKnown: ["terminal", "surveillance", "emergency_power"],
  powerUnknown: ["terminal", "surveillance", "emergency_power", "suspicion"],
  codeFirst: ["emergency_power", "suspicion"],
  noPower: ["power_outage", "emergency_power", "facility"],
  tankTrusted: ["tank07", "facility"],
  tankDistrust: ["tank07", "power_outage", "emergency"],
  releaseWarning: ["tank07", "isolation"],
  pumpWarning: ["pressure", "pressure_abnormal"],
  flood: ["emergency", "facility", "pressure_abnormal"],
  floodRemote: ["emergency", "facility", "pressure_abnormal"],
  floodTransit: ["emergency", "facility", "pressure_abnormal"],
  minute: ["deadline"],
  thirty: ["closed_door", "emergency_power", "deadline", "pressure_abnormal"],
  thirtyMachine: ["closed_door", "emergency_power", "deadline", "pressure_abnormal"],
  thirtyPowered: ["isolation", "pressure", "deadline", "pressure_abnormal"],
  thirtyCentral: ["isolation", "pressure", "deadline", "pressure_abnormal"],
  thirtyDrained: ["isolation", "pressure", "deadline", "pressure_abnormal"],
  ten: ["deadline"],
};

/**
 * Topics introduced by completed action responses. Conditional replies use
 * their explicit variant keys, so incident/F01 never implies a closed door.
 */
export const ACTION_TOPICS: Record<string, DialogueTopic[]> = {
  name: ["facility"],
  incident: ["emergency", "power_outage", "tank07", "facility"],
  location: ["facility"],
  location_section4: ["closed_door"],
  escape_unpowered: ["closed_door", "emergency_power"],
  escape_powered: ["closed_door", "isolation"],
  power_location: ["emergency_power", "facility"],
  tank_question: ["tank07"],
  other_people: ["facility"],
  break_door: ["closed_door", "emergency_power"],
  find_code: ["code_required", "emergency_power"],
  admin: ["code_required"],
  inspect_controls: ["terminal", "isolation", "closed_door"],
  tank: ["tank07", "tank_feed", "surveillance"],
  vitals: ["tank07"],
  brighten: ["tank07", "tank_feed"],
  audio: ["tank07"],
  security: ["tank07", "surveillance", "security_archive"],
  next_security: ["tank07", "surveillance", "security_archive"],
  question_identity: ["suspicion"],
  central: ["central_controls", "isolation", "pressure", "communications"],
  protocol: ["isolation"],
  pressure: ["pressure", "pressure_abnormal", "isolation", "tank07"],
  pressure_details: ["pressure", "pressure_abnormal", "isolation", "tank07"],
  stop_pump: ["pressure", "isolation"],
  comms: ["communications"],
  history: ["communications"],
  signal: ["communications", "tank07"],
  input_hint_unpowered: ["emergency_power"],
  input_hint_powered: ["surveillance", "central_controls", "pressure"],
  wrong_code_unpowered: ["code_required"],
};

/**
 * Suggestions only: these records must never be consulted by execute or the
 * keyword parser. Physical prerequisites remain separate in engine.ts.
 * The pump warning can also supply the pump clue before a full F05 record.
 */
export const CHOICE_RECORDS: Record<string, string[]> = {
  go_machine: ["F02"],
  enable_power: ["F03"],
  central: ["F04"],
  protocol: ["F04"],
  stop_pump: ["F05"],
  request_release: ["F04", "F05"],
  question_identity: ["F12", "F13"],
  unknown_identity: TRUE_FACTS,
};

/** Normalize before lookup; knowledge changes suggestions, never validity. */
export const KEYWORDS: Record<string, string[]> = {
  hello: ["聞こえる"], name: ["誰", "名前は", "ユナ", "yuna"], incident: ["何が起きた", "何が起きてる"],
  location: ["今どこ", "現在地", "第4研究区画"], escape: ["逃げられない", "脱出できる"],
  power_location: ["非常電源はどこ", "電源はどこ"], tank_question: ["水槽07って何", "水槽07とは"],
  other_people: ["他に人は"], break_door: ["扉を壊せない", "扉を壊して"],
  go_machine: ["第2機械室", "第2機械室へ", "第2機械室へ行って", "第2機械室に行って", "機械室へ"],
  find_code: ["コードを探して", "コードを探す", "非常電源のコード", "コードは"],
  enable_power: ["7319", "7319を入力", "コード7319", "非常電源コード7319", "非常電源コードは7319", "非常電源コードは7319です", "非常電源コード:7319"],
  admin: ["管理者権限", "管理者権限を使って"],
  open_door: ["第4区画を開ける", "第4区画の扉を開けて", "扉を開けて"],
  inspect_controls: ["操作できる設備を調べる", "設備を調べる", "制御盤を調べる"],
  tank: ["水槽07", "tank07", "tank-07", "水槽07を確認", "水槽07を確認して"],
  vitals: ["生体反応", "生体反応は"], brighten: ["映像を明るくして", "明るくして"], audio: ["音声ログ", "音声ログを確認"],
  security: ["監視ログ", "監視ログを見る", "17分前"], next_security: ["5分前", "5分前の記録", "次の映像", "次の映像を見る"],
  question_identity: ["君本当にユナ", "本当にユナ", "あなたは本当にユナ", "君は本当にユナ", "事故の5分前から君は応答してない"],
  reassure: ["信じて時間がない", "信じて", "非常電源が必要になる", "落ち着いて", "説明している時間がない"],
  central: ["中央管理端末", "中央端末", "中央管理端末にアクセス"], protocol: ["隔離プロトコル", "isolation"],
  pressure: ["圧力制御", "圧力を確認", "排水ポンプ", "第7区画"], pressure_details: ["なぜ圧力が上がる", "圧力が異常になる理由は", "隔離そのものが事故原因"],
  stop_pump: ["第7区画の排水ポンプを停止", "第7区画排水ポンプを停止", "第7区画の排水ポンプ停止", "第7区画排水ポンプ停止", "排水ポンプを停止", "排水ポンプ停止", "ポンプを止めて", "排水ポンプを止めて", "drainageoff"],
  comms: ["通信回線", "通信回線を調べる"], history: ["通信履歴", "履歴", "時間を巻き戻している", "ループ"], signal: ["信号の発信元", "発信元"],
  maintain: ["維持", "隔離を維持"], reinforce: ["強化", "隔離を強化"],
  request_release: ["隔離解除", "隔離を解除", "隔離プロトコルを解除", "水槽07の隔離を解除", "isolationrelease"],
  release: ["開ける", "開けて", "そう", "解除する", "解除を実行"], refuse: ["やめる", "やめて"], alternative: ["別の方法を探す"],
  wait: ["待つ", "待って"], unknown_identity: ["君は水槽07", "あなたは水槽07"],
};
