export type Speaker = "SYSTEM" | "YUNA" | "YOU" | "UNKNOWN";
export type Ending = "normal" | "true" | "secret" | "echo";
export type DialogueTopic =
  | "emergency" | "deadline" | "facility" | "closed_door"
  | "power_outage" | "emergency_power" | "terminal" | "code_required"
  | "tank07" | "tank_feed" | "tank_methods" | "surveillance" | "security_archive"
  | "suspicion" | "central_controls" | "isolation" | "pressure" | "pressure_abnormal"
  | "communications" | "comms_methods";

export interface ChoiceContextRule {
  anyTopics?: DialogueTopic[];
  allTopics?: DialogueTopic[];
  /** Stable investigation knowledge can replace this connection's introduction. */
  rememberedFacts?: string[];
}

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  remaining: number;
  imageId?: string;
  effect?: "glitch" | "quiet";
}

export interface Choice {
  id: string;
  label: string;
  cost: number;
  /** A suggestion inferred from the player's recorded information. */
  fromRecord?: boolean;
  /** The player has already completed this response in a previous or current connection. */
  selected?: boolean;
  group?: string;
}

export interface GameState {
  status: "idle" | "playing" | "disconnected" | "ending";
  scene: string;
  loopCount: number;
  remaining: number;
  knownFacts: string[];
  trustYuna: number;
  powerEnabled: boolean;
  drainageDisabled: boolean;
  containmentReleased: boolean;
  watchedTankLog: boolean;
  watchedSecurityLog: boolean;
  questionedYunaIdentity: boolean;
  messages: Message[];
  ending: Ending | null;
  location: "section4" | "machine" | "central" | "passage";
  nextMessageId: number;
  triggeredEvents: string[];
  escapeTrapAt: number | null;
  pressureFailureAt: number | null;
  doomed: "escape" | "pressure" | "order" | null;
  hasPumpClue: boolean;
  truthClosed: boolean;
  /** Information Yuna and the player have actually shared in this connection. */
  sharedFacts: string[];
  /** Conversation topics introduced during this connection, never persisted. */
  sharedTopics: DialogueTopic[];
  completedActions: string[];
  /** Presentation-only history; never used to authorize actions or grant information. */
  selectedActions: string[];
  centralAccessed: boolean;
  protocolInspected: boolean;
  pressureInspected: boolean;
  commsInspected: boolean;
  usedForeknowledge: boolean;
  /** Explicit free-input handover confirmation, never retained on reconnect. */
  echoPending: boolean;
}

export interface Fact {
  title: string;
  detail: string;
  category: "攻略" | "真相" | "通信";
  keyword?: string;
}

export type ScriptLine = Omit<Message, "id" | "remaining">;

/** Dialogue, costs, and destination scenes live in scenario.ts. */
export interface ActionDefinition extends Choice {
  scene?: string;
  facts?: string[];
  trust?: number;
  lines?: ScriptLine[];
}
