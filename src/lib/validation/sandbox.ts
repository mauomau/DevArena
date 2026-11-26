import vm from "node:vm";
import { GAME_CONFIG } from "../game/config";
import type { ValidationCheck } from "./types";

/**
 * ⚠️ `node:vm` n'est PAS une frontière de sécurité à lui seul.
 * Il sert ici à isoler le code joueur (pas de `require`, pas de `process`,
 * timeout par exécution, taille de code limitée). Pour une exposition
 * publique à fort trafic, exécuter ce code dans un service séparé
 * (isolated-vm, worker dédié, conteneur sans privilèges) et appliquer
 * un rate-limit sur `/api/validate`.
 */

const CONSOLE_BOOTSTRAP = `
"use strict";
globalThis.console = Object.freeze({
  log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {},
});
`;

/**
 * Mini-DOM synthétique écrit DANS le contexte vm (aucun objet hôte exposé).
 * Contrat du niveau 3 :
 *   <button id="btn">+1</button> <p id="count">0</p>
 */
const DOM_BOOTSTRAP = `
"use strict";
globalThis.console = Object.freeze({
  log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {},
});
globalThis.setTimeout = function (callback) {
  if (typeof callback === "function") callback();
  return 0;
};
globalThis.clearTimeout = function () {};
globalThis.setInterval = function () { return 0; };
globalThis.clearInterval = function () {};

(function () {
  const documentListeners = Object.create(null);
  let documentStub;

  function createClassList() {
    return {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    };
  }

  function Element(id, tagName, initialText) {
    this.id = id;
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this.className = "";
    this.dataset = {};
    this.style = {};
    this.classList = createClassList();
    this._text = String(initialText);
    this._listeners = Object.create(null);
  }

  Object.defineProperty(Element.prototype, "textContent", {
    get: function () { return this._text; },
    set: function (value) {
      this._text = value === null || value === undefined ? "" : String(value);
    },
  });

  Object.defineProperty(Element.prototype, "innerText", {
    get: function () { return this._text; },
    set: function (value) {
      this._text = value === null || value === undefined ? "" : String(value);
    },
  });

  Object.defineProperty(Element.prototype, "innerHTML", {
    get: function () { return this._text; },
    set: function (value) {
      this._text = String(value).replace(/<[^>]*>/g, "");
    },
  });

  Object.defineProperty(Element.prototype, "value", {
    get: function () { return this._text; },
    set: function (value) {
      this._text = value === null || value === undefined ? "" : String(value);
    },
  });

  Element.prototype.addEventListener = function (type, listener) {
    if (typeof listener !== "function") return;
    const key = String(type);
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(listener);
  };

  Element.prototype.removeEventListener = function (type, listener) {
    const list = this._listeners[String(type)];
    if (!list) return;
    const index = list.indexOf(listener);
    if (index !== -1) list.splice(index, 1);
  };

  Element.prototype.dispatchEvent = function (event) {
    const type = event && event.type ? String(event.type) : "click";
    const evt = {
      type: type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
    };
    const inline = this["on" + type];
    if (typeof inline === "function") inline.call(this, evt);
    const list = (this._listeners[type] || []).slice();
    for (let i = 0; i < list.length; i++) list[i].call(this, evt);
    const documentList = documentListeners[type] || [];
    for (let i = 0; i < documentList.length; i++) {
      documentList[i].call(documentStub, evt);
    }
    return true;
  };

  Element.prototype.click = function () {
    return this.dispatchEvent({ type: "click" });
  };

  Element.prototype.appendChild = function (child) { return child; };
  Element.prototype.setAttribute = function (name, value) {
    this[name] = String(value);
  };
  Element.prototype.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(this, name)
      ? String(this[name])
      : null;
  };

  const button = new Element("btn", "button", "+1");
  const counter = new Element("count", "p", "0");
  const body = new Element("body", "body", "");
  const byId = { btn: button, count: counter };

  function pick(selector) {
    if (typeof selector !== "string") return null;
    const value = selector.trim();
    if (value.charAt(0) === "#") {
      return byId[value.slice(1)] || null;
    }
    const simple = value.split(/[\\s>+~]+/).pop() || "";
    if (simple.indexOf("button") !== -1 || simple.indexOf(".btn") !== -1) {
      return button;
    }
    if (simple === "p" || simple.indexOf("count") !== -1) {
      return counter;
    }
    if (simple === "body") return body;
    return null;
  }

  documentStub = {
    body: body,
    getElementById: function (id) { return byId[String(id)] || null; },
    querySelector: pick,
    querySelectorAll: function (selector) {
      const found = pick(selector);
      return found ? [found] : [];
    },
    getElementsByTagName: function (tag) {
      const name = String(tag).toLowerCase();
      if (name === "button") return [button];
      if (name === "p") return [counter];
      if (name === "body") return [body];
      return [];
    },
    createElement: function (tag) { return new Element("", tag, ""); },
    addEventListener: function (type, listener) {
      if (typeof listener !== "function") return;
      const key = String(type);
      if (key === "DOMContentLoaded") {
        listener.call(documentStub, {
          type: "DOMContentLoaded",
          target: documentStub,
          preventDefault() {},
        });
        return;
      }
      if (!documentListeners[key]) documentListeners[key] = [];
      documentListeners[key].push(listener);
    },
    removeEventListener: function () {},
  };

  globalThis.document = documentStub;
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  globalThis.HTMLElement = Element;
  globalThis.Element = Element;
  globalThis.Node = Element;
  globalThis.addEventListener = function (type, listener) {
    if (String(type) === "DOMContentLoaded" && typeof listener === "function") {
      listener.call(documentStub, {
        type: "DOMContentLoaded",
        target: documentStub,
        preventDefault() {},
      });
    }
  };

  globalThis.__devarena = {
    click: function (times) {
      const count = typeof times === "number" ? times : 1;
      for (let i = 0; i < count; i++) {
        button.dispatchEvent({ type: "click" });
      }
    },
    countText: function () {
      return String(counter.textContent);
    },
  };
})();
`;

export const DOM_TEST_API = "__devarena";

export function createSandbox(): vm.Context {
  return vm.createContext(
    {},
    {
      codeGeneration: { strings: false, wasm: false },
    },
  );
}

export function runScript(
  code: string,
  context: vm.Context,
  timeoutMs: number = GAME_CONFIG.sandboxTimeoutMs,
): unknown {
  const script = new vm.Script(code, { filename: "code-joueur.js" });
  return script.runInContext(context, { timeout: timeoutMs, displayErrors: true });
}

export function initDomSandbox(): vm.Context {
  const context = createSandbox();
  runScript(DOM_BOOTSTRAP, context, GAME_CONFIG.sandboxTimeoutMs);
  return context;
}

export function initFunctionSandbox(): vm.Context {
  const context = createSandbox();
  runScript(CONSOLE_BOOTSTRAP, context, GAME_CONFIG.sandboxTimeoutMs);
  return context;
}

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

export function describeSandboxError(error: unknown): string {
  const code = readProperty(error, "code");
  const name = readProperty(error, "name");
  const message = readProperty(error, "message");

  if (
    code === "ERR_SCRIPT_EXECUTION_TIMEOUT" ||
    (typeof message === "string" && message.includes("timed out"))
  ) {
    return "Temps d'exécution dépassé : vérifie tes boucles (pas de boucle infinie).";
  }
  if (typeof message === "string" && message) {
    if (name === "SyntaxError") {
      return `Erreur de syntaxe : ${message}`;
    }
    return `Erreur d'exécution : ${message}`;
  }
  return "Erreur inconnue pendant l'exécution du code.";
}

export interface FunctionTestCase {
  label: string;
  args: readonly unknown[];
  expected: unknown;
}

export interface FunctionTestReport {
  checks: ValidationCheck[];
  fatalError: string | null;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  try {
    const json = JSON.stringify(value);
    if (json) {
      return json.length > 80 ? `${json.slice(0, 77)}...` : json;
    }
  } catch {
    // ignore
  }
  return String(value);
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "boolean") {
    if (typeof actual === "boolean") {
      return actual === expected;
    }
    if (actual === 0 || actual === 1) {
      return (actual === 1) === expected;
    }
    return false;
  }
  return actual === expected;
}

function serializeArgument(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? "undefined" : json;
}

/**
 * Exécute une fonction écrite par le joueur sur une série de cas cachés.
 * Chaque cas repart d'un contexte neuf pour éviter les effets de bord.
 */
export function runFunctionTests(
  code: string,
  functionName: string,
  cases: readonly FunctionTestCase[],
  timeoutMs: number = GAME_CONFIG.sandboxTimeoutMs,
): FunctionTestReport {
  try {
    const context = initFunctionSandbox();
    runScript(code, context, timeoutMs);
    const type = runScript(`typeof ${functionName}`, context, timeoutMs);
    if (type !== "function") {
      const detail = `La fonction ${functionName} est introuvable. Garde son nom exact.`;
      return {
        checks: [
          {
            id: "function",
            label: `Fonction ${functionName} définie`,
            passed: false,
            detail,
          },
        ],
        fatalError: detail,
      };
    }
  } catch (error) {
    const detail = describeSandboxError(error);
    return {
      checks: [
        {
          id: "script",
          label: "Le script s'exécute sans erreur",
          passed: false,
          detail,
        },
      ],
      fatalError: detail,
    };
  }

  const checks: ValidationCheck[] = [
    {
      id: "function",
      label: `Fonction ${functionName} définie`,
      passed: true,
    },
  ];

  let timedOut = false;

  cases.forEach((testCase, index) => {
    const id = `test-${index + 1}`;
    if (timedOut) {
      checks.push({
        id,
        label: testCase.label,
        passed: false,
        detail: "Test non exécuté après un dépassement de temps.",
      });
      return;
    }

    try {
      const context = initFunctionSandbox();
      runScript(code, context, timeoutMs);
      const expression = `${functionName}(${testCase.args
        .map(serializeArgument)
        .join(", ")})`;
      const actual = runScript(expression, context, timeoutMs);
      const passed = valuesMatch(actual, testCase.expected);
      if (!passed) {
        const detail = `Attendu : ${formatValue(
          testCase.expected,
        )} · Obtenu : ${formatValue(actual)}`;
        checks.push({ id, label: testCase.label, passed, detail });
      } else {
        checks.push({ id, label: testCase.label, passed });
      }
    } catch (error) {
      const detail = describeSandboxError(error);
      if (detail.includes("Temps d'exécution dépassé")) {
        timedOut = true;
      }
      checks.push({ id, label: testCase.label, passed: false, detail });
    }
  });

  return { checks, fatalError: null };
}
