const fs = require("fs");
const vm = require("vm");

function fakeElement() {
  return {
    style: {},
    classList: {
      toggle() {},
      add() {},
      remove() {}
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() {
      return "";
    },
    innerText: "",
    value: "",
    muted: true,
    playsInline: true
  };
}

const consoleErrors = [];
const sandbox = {
  console: {
    log() {},
    warn() {},
    error(...args) {
      consoleErrors.push(args.join(" "));
    }
  },
  window: {
    setTimeout(callback) {
      callback();
      return 0;
    },
    clearTimeout() {}
  },
  document: {
    title: "",
    documentElement: { style: { setProperty() {} } },
    addEventListener() {},
    createElement() {
      return fakeElement();
    },
    getElementById() {
      return fakeElement();
    },
    querySelector() {
      return fakeElement();
    }
  },
  Image: function Image() {
    return fakeElement();
  },
  HTMLMediaElement: {
    HAVE_FUTURE_DATA: 3
  },
  performance: {
    now() {
      return 0;
    }
  },
  requestAnimationFrame(callback) {
    callback();
  },
  setTimeout(callback) {
    callback();
    return 0;
  },
  clearTimeout() {}
};

sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;

const source = fs.readFileSync("script.js", "utf8")
  + "\nglobalThis.__AvatarController = AvatarController;"
  + "\nglobalThis.__AVATAR_STATES = AVATAR_STATES;";

vm.runInNewContext(source, sandbox, { filename: "script.js" });

async function simulate(label, replyText) {
  const controller = new sandbox.__AvatarController();
  const sequence = [];
  controller.isCurrentRequest = () => true;
  controller.playOneShotState = async (state) => {
    sequence.push(state);
    return fakeElement();
  };
  controller.playState = async (state) => {
    sequence.push(state);
    return fakeElement();
  };
  controller.waitForRequest = async () => true;
  controller.showDemoReply = () => {};
  await controller.enterTalking(replyText, 1);
  return { label, sequence };
}

(async () => {
  const results = [
    await simulate("quick", "Short reply."),
    await simulate("slow", "This is a medium length reply that should still move through the full candidate flow."),
    await simulate("long", "This is a much longer reply designed to keep NOVA speaking long enough to verify that TALKING_A transitions into the emphasis entry and then continues through TALKING_B without relying on the old alternating talking variant selector.")
  ];
  process.stdout.write(JSON.stringify({ consoleErrors, results }, null, 2));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
