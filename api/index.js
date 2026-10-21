// ALL-IN-ONE FILE for Vercel  ->  save as  api/index.js
// GET  /api -> the chat page (ads on the left and right)
// POST /api -> chats with Groq using the GROQ_NEW_API_KEY environment variable
// With vercel.json (included), the page also opens at your main domain "/".

const crypto = require("crypto");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const LIMIT = 20;          // chats per person per day
const IP_CAP = 60;         // extra safety net per IP (best effort)
const MAX_MESSAGES = 20;   // history sent to the model
const MAX_CHARS = 4000;
const COOKIE = "cb_usage";
const SYSTEM_PROMPT =
  "You are a friendly, helpful AI assistant. Answer clearly and concisely. " +
  "Reply in the same language the user writes in.";

const PAGE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ask AI – free AI chatbot</title>
<meta name="description" content="Chat with a fast AI assistant. 20 free chats every day.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%233b3bf0'/%3E%3Ccircle cx='22' cy='10' r='4.5' fill='%23ffc93c'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #e9ebf7;
    --panel: #ffffff;
    --soft: #f2f3fb;
    --ink: #151a33;
    --muted: #666c8c;
    --line: #d9dcee;
    --accent: #3b3bf0;
    --accent-ink: #ffffff;
    --sun: #ffc93c;
    --danger: #c43b3b;
    --code-bg: #151a33;
    --code-ink: #e8eaff;
    --shadow: 0 1px 2px rgba(21,26,51,.06), 0 12px 32px -12px rgba(21,26,51,.18);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1020;
      --panel: #151933;
      --soft: #1c2142;
      --ink: #e8eaff;
      --muted: #9aa0c7;
      --line: #2a3059;
      --accent: #7c7cff;
      --accent-ink: #0d1020;
      --danger: #ff7a7a;
      --code-bg: #0b0e1d;
      --shadow: none;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  button, textarea { font: inherit; color: inherit; }
  :focus-visible { outline: 3px solid var(--sun); outline-offset: 2px; }

  /* ---------- layout: ad | chat | ad ---------- */
  .layout {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(0, 780px) minmax(160px, 1fr);
    gap: 20px;
    padding: 20px;
  }
  .rail { min-width: 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
  .rail-tag { font-size: .75rem; color: var(--muted); text-align: center; }
  .rail-inner {
    flex: 1 1 250px; width: 100%; min-height: 250px;
    border: 1px dashed var(--line); border-radius: 14px;
    display: flex; align-items: flex-start; justify-content: center;
    overflow: hidden;
  }

  /* ---------- chat panel ---------- */
  .chat {
    min-height: 0; display: flex; flex-direction: column;
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 24px; box-shadow: var(--shadow); overflow: hidden;
  }
  .head {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid var(--line);
  }
  .mark {
    width: 34px; height: 34px; flex: none; border-radius: 50%;
    background: var(--accent); position: relative;
  }
  .mark::after {
    content: ""; position: absolute; width: 13px; height: 13px; border-radius: 50%;
    background: var(--sun); top: 4px; right: 3px;
  }
  .head h1 { margin: 0; font-size: 1.15rem; font-weight: 800; letter-spacing: -.01em; line-height: 1.1; }
  .head small { display: block; color: var(--muted); font-size: .8rem; font-weight: 400; letter-spacing: 0; }
  .spacer { flex: 1; }

  .meter { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
  .meter-text { font-size: .8rem; color: var(--muted); }
  .meter-text b { color: var(--ink); font-weight: 600; }
  .pips { display: flex; gap: 3px; }
  .pip { width: 6px; height: 14px; border-radius: 3px; background: var(--accent); transition: background .3s, transform .3s; }
  .pip.used { background: var(--line); transform: scaleY(.55); }
  .meter.low .pip:not(.used) { background: var(--danger); }

  .clear {
    background: none; border: 1px solid var(--line); color: var(--muted);
    padding: 6px 12px; border-radius: 999px; cursor: pointer; font-size: .85rem;
  }
  .clear:hover { color: var(--ink); border-color: var(--muted); }

  /* ---------- messages ---------- */
  .log { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 22px; scroll-behavior: smooth; }
  .hero { margin: auto; width: 100%; max-width: 520px; padding: 12px 0; }
  .hero h2 { margin: 0 0 8px; font-size: clamp(1.9rem, 5vw, 2.7rem); line-height: 1.05; font-weight: 800; letter-spacing: -.03em; }
  .hero p { margin: 0 0 22px; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    background: var(--soft); border: 1px solid var(--line); border-radius: 999px;
    padding: 8px 14px; cursor: pointer; font-size: .92rem;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }

  .row { display: flex; gap: 12px; }
  .row.user { justify-content: flex-end; }
  .avatar { width: 28px; height: 28px; flex: none; border-radius: 50%; background: var(--accent); position: relative; margin-top: 2px; }
  .avatar::after { content: ""; position: absolute; width: 11px; height: 11px; border-radius: 50%; background: var(--sun); top: 3px; right: 2px; }
  .bubble { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  .row.user .bubble {
    max-width: 82%; background: var(--accent); color: var(--accent-ink);
    padding: 10px 16px; border-radius: 20px 20px 6px 20px;
  }
  .row.bot .bubble { flex: 1; padding-top: 2px; }
  .row.notice .bubble { color: var(--danger); border: 1px solid var(--danger); border-radius: 14px; padding: 10px 14px; }
  .bubble strong { font-weight: 600; }
  .bubble code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .88em; background: var(--soft); border: 1px solid var(--line); padding: 1px 5px; border-radius: 6px; }
  .bubble pre { margin: 10px 0; padding: 14px 16px; background: var(--code-bg); color: var(--code-ink); border-radius: 14px; overflow-x: auto; white-space: pre; line-height: 1.5; }
  .bubble pre code { background: none; border: 0; padding: 0; color: inherit; }

  .dots { display: inline-flex; gap: 4px; padding: 8px 0; }
  .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); animation: bob 1s infinite ease-in-out; }
  .dots i:nth-child(2) { animation-delay: .15s; }
  .dots i:nth-child(3) { animation-delay: .3s; }
  @keyframes bob { 0%, 80%, 100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-4px); opacity: 1; } }

  /* ---------- composer ---------- */
  .composer { padding: 12px 16px 14px; }
  .box {
    display: flex; align-items: flex-end; gap: 8px;
    background: var(--soft); border: 1px solid var(--line); border-radius: 22px;
    padding: 8px 8px 8px 18px;
  }
  .box:focus-within { border-color: var(--accent); }
  .box textarea {
    flex: 1; resize: none; border: 0; outline: 0; background: transparent;
    max-height: 150px; padding: 8px 0; line-height: 1.45;
  }
  .box textarea::placeholder { color: var(--muted); }
  .send {
    width: 40px; height: 40px; flex: none; border: 0; border-radius: 50%;
    background: var(--accent); color: var(--accent-ink); cursor: pointer;
    display: grid; place-items: center;
  }
  .send:disabled { opacity: .4; cursor: not-allowed; }
  .fine { margin: 8px 6px 0; text-align: center; font-size: .75rem; color: var(--muted); }

  /* ---------- small screens: ads become strips above and below ---------- */
  @media (max-width: 980px) {
    .layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; padding: 10px; gap: 10px; }
    .rail { max-height: 110px; gap: 4px; }
    .rail-inner { min-height: 60px; }
    .rail-inner.extra { display: none; }
    .chat { border-radius: 18px; }
  }
  @media (max-width: 560px) {
    .pips { display: none; }
    .head { padding: 12px 14px; }
    .log { padding: 18px 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }
</style>
</head>
<body>
<div class="layout">

  <!-- LEFT SIDE ADVERTISEMENT (3 slots) -->
  <aside class="rail" aria-label="Advertisement">
    <span class="rail-tag">Advertisement</span>
    <div class="rail-inner">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
    <div class="rail-inner extra">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
    <div class="rail-inner extra">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
  </aside>

  <!-- CHAT -->
  <main class="chat">
    <header class="head">
      <div class="mark" aria-hidden="true"></div>
      <h1>Ask AI<small>Fast answers, any topic</small></h1>
      <div class="spacer"></div>
      <div class="meter" id="meter" title="Chats left today">
        <span class="meter-text"><b id="leftNum">__LEFT__</b> of __LIMIT__ chats left today</span>
        <div class="pips" id="pips" aria-hidden="true"></div>
      </div>
      <button type="button" class="clear" id="clear">New chat</button>
    </header>

    <div class="log" id="log" aria-live="polite">
      <section class="hero" id="hero">
        <h2>What can I help with?</h2>
        <p>Ask a question, get a draft, or work through a problem. You get __LIMIT__ chats every day.</p>
        <div class="chips">
          <button type="button" class="chip">Explain something simply</button>
          <button type="button" class="chip">Help me write a message</button>
          <button type="button" class="chip">Plan my day</button>
          <button type="button" class="chip">Find a bug in my code</button>
        </div>
      </section>
    </div>

    <div class="composer">
      <div class="box">
        <textarea id="input" rows="1" placeholder="Message Ask AI" aria-label="Message"></textarea>
        <button type="button" class="send" id="send" aria-label="Send message">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
      <p class="fine">AI can make mistakes. Check anything important.</p>
    </div>
  </main>

  <!-- RIGHT SIDE ADVERTISEMENT (3 slots) -->
  <aside class="rail" aria-label="Advertisement">
    <span class="rail-tag">Advertisement</span>
    <div class="rail-inner">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
    <div class="rail-inner extra">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
    <div class="rail-inner extra">
      <script>
      (function(eruj){
      var d = document,
          s = d.createElement('script'),
          l = d.currentScript || d.scripts[d.scripts.length - 1];
      s.settings = eruj || {};
      s.src = "\/\/quarrelsomebitter.com\/bHXKV.sTdvGMlc0\/YKWkcF\/OeGmy9wuuZNUcl\/kwPkTice1\/M_zKgozIM\/jaE-tvNnzzU\/zVOJDeM\/yqN\/Qj";
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      l.parentNode.insertBefore(s, l);
      })({})
      </script>
    </div>
  </aside>

</div>

<script>
(function () {
  var LIMIT = __LIMIT__;
  var left = __LEFT__;
  var log = document.getElementById("log");
  var input = document.getElementById("input");
  var sendBtn = document.getElementById("send");
  var clearBtn = document.getElementById("clear");
  var meter = document.getElementById("meter");
  var leftNum = document.getElementById("leftNum");
  var pipsEl = document.getElementById("pips");
  var heroHTML = document.getElementById("hero").outerHTML;
  var history = [];
  var busy = false;
  var pips = [];

  for (var p = 0; p < LIMIT; p++) {
    var pip = document.createElement("span");
    pip.className = "pip";
    pipsEl.appendChild(pip);
    pips.push(pip);
  }

  function resetTime() {
    var n = new Date();
    var next = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
    return next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function showLeft(n) {
    left = Math.max(0, n);
    leftNum.textContent = left;
    for (var i = 0; i < pips.length; i++) pips[i].classList.toggle("used", i >= left);
    meter.classList.toggle("low", left <= 3);
    var out = left === 0;
    input.disabled = out;
    sendBtn.disabled = out || busy;
    input.placeholder = out ? "Daily limit reached. Come back tomorrow." : "Message Ask AI";
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Safe mini-markdown: code blocks, inline code, bold. Everything is escaped first.
  function render(text) {
    return text.split(/\x60\x60\x60/).map(function (part, i) {
      if (i % 2 === 1) {
        var nl = part.indexOf("\n");
        var code = (nl > -1 && /^[\w+#.-]*$/.test(part.slice(0, nl).trim())) ? part.slice(nl + 1) : part;
        return "<pre><code>" + esc(code.replace(/\n$/, "")) + "</code></pre>";
      }
      var h = esc(part.replace(/^\n+|\n+$/g, ""));
      h = h.replace(/\x60([^\x60\n]+)\x60/g, "<code>$1</code>");
      h = h.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      return h;
    }).join("");
  }

  function removeHero() {
    var h = document.getElementById("hero");
    if (h) h.remove();
  }

  function addRow(kind, html) {
    removeHero();
    var row = document.createElement("div");
    row.className = "row " + kind;
    if (kind === "bot") {
      var av = document.createElement("div");
      av.className = "avatar";
      row.appendChild(av);
    }
    var b = document.createElement("div");
    b.className = "bubble";
    if (kind === "user" || kind === "notice") b.textContent = html; else b.innerHTML = html;
    row.appendChild(b);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  }

  function limitNotice() {
    addRow("notice", "You have used all " + LIMIT + " chats for today. Your chats come back at " + resetTime() + ".");
  }

  async function send(textOverride) {
    var text = (typeof textOverride === "string" ? textOverride : input.value).trim();
    if (!text || busy) return;
    if (left <= 0) { limitNotice(); return; }
    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    autosize();

    history.push({ role: "user", content: text });
    addRow("user", text);
    var botEl = addRow("bot", '<span class="dots"><i></i><i></i><i></i></span>');
    var reply = "";

    try {
      var res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      });

      if (!res.ok) {
        var info = {};
        try { info = await res.json(); } catch (e) {}
        if (res.status === 429) showLeft(0);
        throw new Error(res.status === 429
          ? "You have used all " + LIMIT + " chats for today. Your chats come back at " + resetTime() + "."
          : (info.error || "Request failed (" + res.status + "). Try again."));
      }

      var hdr = res.headers.get("X-Chats-Left");
      if (hdr !== null) showLeft(parseInt(hdr, 10));

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf("data:") !== 0) continue;
          var data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            var json = JSON.parse(data);
            var delta = json.choices && json.choices[0] && json.choices[0].delta;
            if (delta && delta.content) {
              reply += delta.content;
              botEl.innerHTML = render(reply);
              log.scrollTop = log.scrollHeight;
            }
          } catch (e) { /* partial chunk */ }
        }
      }

      if (!reply) throw new Error("The model sent an empty reply. Try again.");
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      botEl.closest(".row").remove();
      history.pop();
      addRow("notice", err.message || "Something went wrong. Try again.");
    } finally {
      busy = false;
      sendBtn.disabled = left <= 0;
      if (left > 0) input.focus();
    }
  }

  function bindChips() {
    var chips = document.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function (e) { send(e.currentTarget.textContent); });
    }
  }

  sendBtn.addEventListener("click", function () { send(); });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  clearBtn.addEventListener("click", function () {
    history = [];
    log.innerHTML = heroHTML;
    bindChips();
  });

  bindChips();
  showLeft(left);
})();
</script>
</body>
</html>
`;

// ---------- daily usage (signed cookie, resets at 00:00 UTC) ----------
const ipHits = new Map();
const today = () => new Date().toISOString().slice(0, 10);
const sign = (secret, v) => crypto.createHmac("sha256", secret).update(v).digest("hex").slice(0, 24);

function readUsed(req, secret) {
  const raw = String(req.headers.cookie || "")
    .split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "="));
  if (!raw) return 0;
  const [day, count, sig] = raw.slice(COOKIE.length + 1).split(".");
  const n = parseInt(count, 10);
  if (day !== today() || !(n >= 0) || !sig) return 0;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(secret, day + "." + n));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 0;
  return n;
}

function usageCookie(secret, n) {
  const day = today();
  const d = new Date();
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const secs = Math.max(60, Math.ceil((next - Date.now()) / 1000));
  return `${COOKIE}=${day}.${n}.${sign(secret, day + "." + n)}; Max-Age=${secs}; Path=/; HttpOnly; SameSite=Lax; Secure`;
}

const ipOf = (req) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  (req.socket && req.socket.remoteAddress) || "?";
const ipCount = (ip) => { const e = ipHits.get(ip); return e && e.day === today() ? e.n : 0; };
const ipBump = (ip) => {
  ipHits.set(ip, { day: today(), n: ipCount(ip) + 1 });
  if (ipHits.size > 5000) ipHits.clear();
};

// ---------- handler ----------
module.exports = async function handler(req, res) {
  const apiKey = process.env.GROQ_NEW_API_KEY;
  const secret = apiKey || "dev-secret";

  if (req.method === "GET" || req.method === "HEAD") {
    const left = Math.max(0, LIMIT - readUsed(req, secret));
    const html = PAGE.split("__LEFT__").join(String(left)).split("__LIMIT__").join(String(LIMIT));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_NEW_API_KEY is not set in Vercel environment variables." });
  }

  const incoming = req.body && req.body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }
  const messages = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages.length === 0) {
    return res.status(400).json({ error: "No valid messages" });
  }

  const ip = ipOf(req);
  const used = readUsed(req, secret);
  if (used >= LIMIT || ipCount(ip) >= IP_CAP) {
    res.setHeader("X-Chats-Left", "0");
    return res.status(429).json({ error: "Daily limit reached", left: 0 });
  }

  try {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return res.status(upstream.status || 502).json({ error: "Groq request failed", detail: detail.slice(0, 500) });
    }

    // Count the chat only now that Groq accepted it.
    ipBump(ip);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Set-Cookie": usageCookie(secret, used + 1),
      "X-Chats-Left": String(Math.max(0, LIMIT - used - 1)),
    });
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (err) {
    if (!res.headersSent) return res.status(502).json({ error: "Could not reach Groq" });
    res.end();
  }
};
