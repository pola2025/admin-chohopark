const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("src/lib/contract-remote-api.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ fetchImpl, storage } = {}) {
  const localStorage = storage || new Map();
  const store = {
    getItem: (key) => localStorage.get(key) ?? null,
    setItem: (key, value) => localStorage.set(key, String(value)),
    removeItem: (key) => localStorage.delete(key),
  };
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    window: { localStorage: store },
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}) })),
    URLSearchParams,
    Response,
    console,
  };
  vm.runInNewContext(compiled, context, { filename: "contract-remote-api.ts" });
  return { api: context.module.exports, localStorage, store };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

(async () => {
  let calls = [];
  let first = true;
  const flow = harness({
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      if (first) {
        first = false;
        throw new Error("connection reset");
      }
      return response({ ok: true, contract: { id: "contract-1", contractNumber: "C-1" }, agreementUrl: "/contract/1" });
    },
  });
  const input = { company: "초호", customerName: "담당자", phone: "010", useDate: "2026-09-10", adultCount: 1 };
  await assert.rejects(() => flow.api.createContract(input), (error) => error.unknownResult === true);
  assert.equal(flow.api.getPendingContractMutation("create").input.company, "초호");
  await flow.api.createContract(input);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].requestId, calls[1].requestId);
  assert.equal(JSON.stringify(calls[0].input), JSON.stringify(calls[1].input));
  assert.equal(flow.api.getPendingContractMutation("create"), null);

  let sendCalls = 0;
  const changed = harness({
    fetchImpl: async () => {
      sendCalls += 1;
      throw new Error("timeout");
    },
  });
  await assert.rejects(() => changed.api.sendContractLink("c-1", { channels: ["sms"], expectedPhone: "010" }));
  await assert.rejects(
    () => changed.api.sendContractLink("c-1", { channels: ["email"], expectedEmail: "a@example.com" }),
    (error) => error.unknownResult === true,
  );
  assert.equal(sendCalls, 1);

  const malformed = harness({
    fetchImpl: async () => response({ ok: true, channels: { sms: { status: "accepted" } } }),
  });
  await assert.rejects(
    () => malformed.api.sendContractLink("c-2", { channels: ["sms", "email"], expectedPhone: "010", expectedEmail: "a@example.com" }),
    (error) => error.unknownResult === true,
  );
  assert.ok(malformed.api.getPendingContractMutation("send:c-2"));

  let storageCalls = 0;
  const blocked = harness({
    storage: { get: () => null, set: () => { throw new Error("quota"); }, delete: () => {} },
    fetchImpl: async () => { storageCalls += 1; return response({ ok: true }); },
  });
  await assert.rejects(() => blocked.api.createContract(input), (error) => error.unknownResult === true);
  assert.equal(storageCalls, 0);
  console.log("contract remote mutation tests passed");
})();
