import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceTime,
  createGame,
  getChoices,
  performAction,
  reconnect,
  startGame,
  submitKeyword,
} from "../src/game/engine.ts";
import type { GameState } from "../src/game/types.ts";

function start(): GameState {
  return startGame(createGame());
}

function say(state: GameState, text: string): GameState {
  return submitKeyword(state, text);
}

function choose(state: GameState, id: string): GameState {
  assert.ok(
    getChoices(state).some((choice) => choice.id === id),
    `Action ${id} must be visible in scene ${state.scene}`,
  );
  return performAction(state, id);
}

function nextLoop(state: GameState): GameState {
  const disconnected = advanceTime(state, 180);
  assert.equal(disconnected.status, "disconnected");
  return reconnect(disconnected);
}

function clearByKnownCommands(state: GameState): GameState {
  state = say(state, "7319");
  assert.equal(state.powerEnabled, true);
  state = say(state, "第7区画の排水ポンプを停止");
  assert.equal(state.drainageDisabled, true);
  state = say(state, "隔離プロトコルを解除");
  return say(state, "開ける");
}

test("the initial connection starts a full three-minute loop", () => {
  const idle = createGame();
  assert.equal(idle.status, "idle");
  const game = startGame(idle);
  assert.equal(game.status, "playing");
  assert.equal(game.remaining, 180);
  assert.equal(game.loopCount, 1);
  assert.deepEqual(game.knownFacts, []);
  assert.equal(game.powerEnabled, false);
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.containmentReleased, false);
  assert.ok(game.messages.some((message) => message.text.includes("聞こえる")));
  assert.equal(getChoices(game).length, 3);
});

test("previously unknown correct commands clear loop one with SECRET END", () => {
  const game = clearByKnownCommands(start());
  assert.equal(game.loopCount, 1);
  assert.equal(game.powerEnabled, true);
  assert.equal(game.drainageDisabled, true);
  assert.equal(game.containmentReleased, true);
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "secret");
  assert.ok(game.messages.some((message) => message.text.includes("今度は早かったね")));
  assert.ok(game.remaining > 0);
});

test("a later clear without the six truth facts reaches NORMAL END", () => {
  const game = clearByKnownCommands(nextLoop(start()));
  assert.equal(game.loopCount, 2);
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "normal");
  assert.ok(game.messages.some((message) => message.text.includes("SURVIVORS")));
});

test("correct full-width authorization is normalized and usable before learning F03", () => {
  const before = start();
  assert.equal(before.knownFacts.includes("F03"), false);
  const game = say(before, "  ７３１９  ");
  assert.equal(game.powerEnabled, true);
  assert.equal(game.knownFacts.includes("F03"), true);
  assert.ok(game.trustYuna < before.trustYuna);
});

test("a reconnect preserves information but resets physical state and trust", () => {
  let game = say(start(), "7319");
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.powerEnabled, true);
  assert.equal(game.drainageDisabled, true);
  assert.notEqual(game.trustYuna, 0);
  const disconnected = advanceTime(game, 180);
  const facts = [...disconnected.knownFacts];
  const loop = game.loopCount;
  game = reconnect(disconnected);
  assert.equal(game.loopCount, loop + 1);
  assert.equal(game.remaining, 180);
  assert.equal(game.status, "playing");
  assert.deepEqual(game.knownFacts, facts);
  assert.equal(game.trustYuna, 0);
  assert.equal(game.powerEnabled, false);
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.containmentReleased, false);
  assert.equal(game.watchedTankLog, false);
  assert.equal(game.watchedSecurityLog, false);
  assert.equal(game.questionedYunaIdentity, false);
});

test("timer expiration ends the connection exactly at zero and further ticks are inert", () => {
  const game = advanceTime(start(), 180);
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.equal(game.ending, null);
  assert.ok(game.messages.some((message) => message.text.includes("CONNECTION TERMINATED")));
  assert.deepEqual(advanceTime(game, 30), game);
  assert.deepEqual(say(game, "7319"), game);
});

test("an invalid keyword gives feedback and leaves the game recoverable", () => {
  const before = start();
  const invalid = say(before, "quantum-banana-unknown");
  assert.equal(invalid.status, "playing");
  assert.equal(invalid.powerEnabled, false);
  assert.ok(invalid.messages.length > before.messages.length);
  assert.ok(invalid.messages.slice(before.messages.length).some((message) => message.speaker !== "YOU"));
  assert.equal(say(invalid, "7319").powerEnabled, true);
});

test("empty input has no game effect", () => {
  const game = start();
  assert.deepEqual(say(game, " \n\t "), game);
});

test("pump shutdown requires power but not previously acquired facts", () => {
  let game = say(start(), "第7区画の排水ポンプを停止");
  assert.equal(game.drainageDisabled, false);
  assert.equal(game.status, "playing");
  game = say(game, "7319");
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.drainageDisabled, true);
});

test("releasing containment before stopping drainage cannot be repaired afterward", () => {
  let game = say(start(), "7319");
  game = say(game, "隔離プロトコルを解除");
  game = say(game, "開ける");
  assert.equal(game.status, "disconnected");
  assert.equal(game.ending, null);
  assert.equal(game.drainageDisabled, false);
  game = say(game, "第7区画の排水ポンプを停止");
  assert.equal(game.ending, null);
  assert.equal(game.status, "disconnected");
});

function collectTankFacts(state: GameState): GameState {
  state = say(state, "7319");
  state = choose(state, "tank");
  state = choose(state, "vitals");
  state = choose(state, "brighten");
  return choose(state, "audio");
}

function collectIdentityFacts(state: GameState): GameState {
  state = choose(state, "hello");
  state = say(state, "信じて。時間がない");
  state = say(state, "7319");
  state = choose(state, "security");
  state = choose(state, "next_security");
  return choose(state, "question_identity");
}

test("six truth facts can be learned through choices across loops and unlock interactive TRUE END", () => {
  let game = collectTankFacts(start());
  for (const fact of ["F10", "F11", "F14"]) {
    assert.ok(game.knownFacts.includes(fact), `Tank investigation must provide ${fact}`);
  }
  game = collectIdentityFacts(nextLoop(game));
  for (const fact of ["F10", "F11", "F12", "F13", "F14", "F21"]) {
    assert.ok(game.knownFacts.includes(fact), `The two investigations must provide ${fact}`);
  }
  game = clearByKnownCommands(nextLoop(game));
  assert.equal(game.loopCount, 3);
  assert.equal(game.ending, null);
  assert.ok(getChoices(game).some((choice) => choice.id === "unknown_identity"));
  const waitingForPlayer = advanceTime(game, 500);
  assert.equal(waitingForPlayer.status, game.status);
  assert.equal(waitingForPlayer.remaining, game.remaining);
  game = choose(waitingForPlayer, "unknown_identity");
  assert.equal(game.status, "ending");
  assert.equal(game.ending, "true");
  assert.ok(game.messages.some((message) => message.text.includes("LOOP COUNT")));
});

test("identity information can be used before it is recorded when trust is high", () => {
  let game = choose(start(), "hello");
  game = say(game, "信じて。時間がない");
  assert.equal(game.knownFacts.includes("F12"), false);
  assert.equal(game.knownFacts.includes("F13"), false);
  game = say(game, "君、本当にユナ？");
  assert.equal(game.questionedYunaIdentity, true);
  assert.equal(game.knownFacts.includes("F21"), true);
});

test("investigation and identity flags reset even after both logs were actually read", () => {
  let game = collectIdentityFacts(start());
  game = choose(game, "back");
  game = choose(game, "tank");
  game = choose(game, "audio");
  assert.equal(game.watchedTankLog, true);
  assert.equal(game.watchedSecurityLog, true);
  assert.equal(game.questionedYunaIdentity, true);
  game = nextLoop(game);
  assert.equal(game.watchedTankLog, false);
  assert.equal(game.watchedSecurityLog, false);
  assert.equal(game.questionedYunaIdentity, false);
  assert.ok(game.knownFacts.includes("F10"));
  assert.ok(game.knownFacts.includes("F13"));
  assert.ok(game.knownFacts.includes("F21"));
});

test("low-trust identity questioning limits truth conversation but does not prevent rescue", () => {
  let game = say(start(), "7319");
  assert.ok(game.trustYuna < 1);
  game = say(game, "君、本当にユナ？");
  assert.equal(game.questionedYunaIdentity, true);
  assert.equal(game.knownFacts.includes("F21"), false);
  game = say(game, "第7区画の排水ポンプを停止");
  game = say(game, "隔離プロトコルを解除");
  game = say(game, "開ける");
  assert.equal(game.ending, "secret");
});

test("all ten specified image events are reachable through playable choices", () => {
  const images = new Set<string>();
  function collect(game: GameState) {
    for (const message of game.messages) {
      if (message.imageId) images.add(message.imageId);
    }
    return game;
  }
  let game = choose(start(), "hello");
  game = choose(game, "location");
  collect(game);
  game = collect(collectTankFacts(game));
  collect(advanceTime(game, 180));
  game = collect(collectIdentityFacts(nextLoop(game)));
  game = collect(clearByKnownCommands(nextLoop(game)));
  collect(choose(game, "unknown_identity"));
  assert.deepEqual([...images].sort(), Array.from({ length: 10 }, (_, index) => `IMG_${String(index + 1).padStart(2, "0")}`));
});

test("an operation cannot succeed after it consumes the last available seconds", () => {
  let game = advanceTime(start(), 179);
  assert.equal(game.remaining, 1);
  game = say(game, "7319");
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.equal(game.powerEnabled, false);
  assert.equal(game.ending, null);
});

test("zero and negative elapsed time do not extend or consume the connection", () => {
  const game = start();
  assert.deepEqual(advanceTime(game, 0), game);
  assert.deepEqual(advanceTime(game, -60), game);
});

test("the flooding event occurs at 120 seconds and does not repeat on later ticks", () => {
  let game = advanceTime(start(), 59);
  assert.equal(game.remaining, 121);
  assert.equal(game.messages.some((message) => message.imageId === "IMG_02"), false);
  game = advanceTime(game, 1);
  assert.equal(game.remaining, 120);
  const floodingImages = game.messages.filter((message) => message.imageId === "IMG_02").length;
  assert.equal(floodingImages, 1);
  game = advanceTime(game, 1);
  assert.equal(game.messages.filter((message) => message.imageId === "IMG_02").length, floodingImages);
});

test("large elapsed deltas still surface intermediate flooding and final signal failure", () => {
  const game = advanceTime(start(), 1_000);
  assert.equal(game.remaining, 0);
  assert.equal(game.status, "disconnected");
  assert.ok(game.messages.some((message) => message.imageId === "IMG_02"));
  assert.ok(game.messages.some((message) => message.text.includes("SIGNAL INSTABILITY")));
  assert.ok(game.messages.some((message) => message.text.includes("CONNECTION TERMINATED")));
});

test("the direct escape route relocks and reveals the central isolation clue", () => {
  let game = say(start(), "7319");
  game = choose(game, "open_door");
  game = advanceTime(game, 20);
  assert.ok(game.knownFacts.includes("F04"));
  assert.ok(game.messages.some((message) => message.text.includes("ISOLATION PROTOCOL ACTIVATED")));
  assert.equal(game.ending, null);
});

for (const decision of ["refuse", "alternative"] as const) {
  test(`declining release through ${decision} provides a pressure-failure clue`, () => {
    let game = say(start(), "7319");
    game = choose(game, "central");
    game = choose(game, "protocol");
    game = choose(game, "request_release");
    game = choose(game, decision);
    assert.equal(game.containmentReleased, false);
    game = advanceTime(game, 180);
    assert.equal(game.status, "disconnected");
    assert.equal(game.ending, null);
    assert.ok(game.messages.some((message) => message.text.includes("STRUCTURAL FAILURE CAUSED BY CONTAINMENT PRESSURE")));
  });
}

test("the final release must finish before the deadline, including its ten-second event", () => {
  for (const available of [18, 19]) {
    let game = say(start(), "7319");
    game = say(game, "第7区画の排水ポンプを停止");
    game = say(game, "隔離プロトコルを解除");
    game = advanceTime(game, game.remaining - available);
    assert.equal(game.remaining, available);
    game = say(game, "開ける");
    if (available === 18) {
      assert.equal(game.status, "disconnected");
      assert.equal(game.ending, null);
      assert.equal(game.containmentReleased, false);
      assert.equal(game.remaining, 0);
    } else {
      assert.equal(game.status, "ending");
      assert.equal(game.ending, "secret");
      assert.equal(game.remaining, 1);
    }
  }
});

test("60-, 30-, and 10-second warnings fire once and in chronological order", () => {
  let game = advanceTime(start(), 120);
  assert.equal(game.remaining, 60);
  assert.ok(game.messages.some((message) => message.text.includes("60 SECONDS REMAINING")));
  game = advanceTime(game, 30);
  assert.equal(game.remaining, 30);
  assert.ok(game.messages.some((message) => message.text.includes("SECTION-04 LOCKDOWN")));
  game = advanceTime(game, 20);
  assert.equal(game.remaining, 10);
  game = advanceTime(game, 1);
  const warnings = ["60 SECONDS REMAINING", "SECTION-04 LOCKDOWN", "SIGNAL INSTABILITY DETECTED"];
  const positions = warnings.map((warning) => {
    assert.equal(game.messages.filter((message) => message.text.includes(warning)).length, 1);
    return game.messages.findIndex((message) => message.text.includes(warning));
  });
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

test("wrong authorization does not enable power and a subsequent correct code recovers", () => {
  let game = say(start(), "7318");
  assert.equal(game.powerEnabled, false);
  assert.equal(game.knownFacts.includes("F03"), false);
  assert.ok(game.messages.some((message) => message.text.includes("認証されない")));
  game = say(game, "7319");
  assert.equal(game.powerEnabled, true);
});

test("a completed ending remains stable until reconnect is explicitly requested", () => {
  const ended = clearByKnownCommands(start());
  assert.deepEqual(advanceTime(ended, 500), ended);
  assert.deepEqual(say(ended, "7319"), ended);
  assert.deepEqual(performAction(ended, "hello"), ended);
  assert.equal(getChoices(ended).length, 0);
  const game = reconnect(ended);
  assert.equal(game.status, "playing");
  assert.equal(game.ending, null);
  assert.equal(game.loopCount, 2);
});
