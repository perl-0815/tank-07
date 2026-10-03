export type Speaker = "SYSTEM" | "YUNA" | "YOU" | "UNKNOWN";
export type Ending = "normal" | "true" | "secret";

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
  location: "section4" | "machine" | "central";
  nextMessageId: number;
  triggeredEvents: string[];
  escapeTrapAt: number | null;
  pressureFailureAt: number | null;
  doomed: "escape" | "pressure" | "order" | null;
  hasPumpClue: boolean;
  truthClosed: boolean;
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
