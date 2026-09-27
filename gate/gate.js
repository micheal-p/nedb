/* --------------------------------------------------------------------------
   NEIIA ACCESS GATE — portable script
   --------------------------------------------------------------------------
   Same contract as the main site gate in assets/js/neiia.js and the
   auth-check.js guard used across this site:

     - unlocked while sessionStorage["neiia_authenticated"] === "true"
     - accepts the same credential as the main site gate
     - exponential lockout in localStorage["neiia_lockout"], shared with the
       main site so a lockout on one is honoured by the other

   Unlike the main site gate there is deliberately NO ?preview=1 bypass:
   every visitor — including deep links from partner sites — must pass the
   gate. Drop-in usage:

       <link rel="stylesheet" href="gate/gate.css">
       <script src="gate/gate.js" defer></script>

   Any element with class "neiia-gate" is initialised; if none exists in the
   markup, one is created from the built-in template and appended to <body>.

   NOTE: presentation-layer only. The credential is readable in this file and
   the lockout is clearable from devtools — it deters casual visitors and
   nothing more. Real gating belongs at the edge (Vercel Password Protection
   or Cloudflare Access).
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var AUTH_KEY = "neiia_authenticated";
  var LOCKOUT_KEY = "neiia_lockout";
  var BASE_LOCKOUT_MS = 90 * 1000;
  var VALID = "bmVpaWFAZWNuOk5FTWlDMjAyNg==";

  function store(key, val, session) {
    try {
      (session ? sessionStorage : localStorage).setItem(key, val);
    } catch (e) {
      /* storage blocked — gate still works for this pageview */
    }
  }

  function read(key, session) {
    try {
      return (session ? sessionStorage : localStorage).getItem(key);
    } catch (e) {
      return null;
    }
  }

  function template() {
    var root = document.createElement("div");
    root.className = "neiia-gate";
    root.id = "neiia-gate";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "neiia-gate-title");
    root.hidden = true;
    root.innerHTML =
      '<div class="neiia-gate__card">' +
      '  <div class="neiia-gate__flag" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '  <div class="neiia-gate__head">' +
      '    <h2 id="neiia-gate-title">Restricted access</h2>' +
      "    <p>Sign in with your NEIIA credentials.</p>" +
      "  </div>" +
      '  <form class="neiia-gate__form">' +
      '    <div class="neiia-gate__field">' +
      '      <label for="neiia-gate-user">Username</label>' +
      '      <input type="text" id="neiia-gate-user" autocomplete="username" required>' +
      "    </div>" +
      '    <div class="neiia-gate__field">' +
      '      <label for="neiia-gate-pass">Password</label>' +
      '      <input type="password" id="neiia-gate-pass" autocomplete="current-password" required>' +
      "    </div>" +
      '    <div class="neiia-gate__msg" role="alert" hidden></div>' +
      '    <div class="neiia-gate__lock" hidden>' +
      '      <div class="neiia-gate__lock-title">Temporarily locked</div>' +
      '      <div class="neiia-gate__lock-timer"></div>' +
      "    </div>" +
      '    <button class="neiia-gate__submit" type="submit">Sign in</button>' +
      "  </form>" +
      '  <div class="neiia-gate__foot">' +
      "    <strong>Federal Republic of Nigeria</strong>" +
      "    <span>National Energy Investment &amp; Intelligence Administration</span>" +
      "  </div>" +
      "</div>";
    return root;
  }

  function init(gate) {
    if (gate.getAttribute("data-neiia-gate-ready") === "1") return;
    gate.setAttribute("data-neiia-gate-ready", "1");

    var form = gate.querySelector("form");
    var user = gate.querySelector('input[type="text"]');
    var pass = gate.querySelector('input[type="password"]');
    var msg = gate.querySelector('[class*="__msg"]');
    var lock = gate.querySelector('[class*="__lock"]');
    var timer = gate.querySelector('[class*="__lock-timer"]');
    var submit = gate.querySelector('button[type="submit"]');
    if (!form || !user || !pass || !submit) return;
    msg = msg || { hidden: true, textContent: "" };
    lock = lock || { hidden: true };
    timer = timer || { textContent: "" };

    function unlockUI() {
      submit.disabled = user.disabled = pass.disabled = false;
      lock.hidden = true;
    }

    function lockUI(until) {
      submit.disabled = user.disabled = pass.disabled = true;
      msg.hidden = true;
      lock.hidden = false;
      (function tick() {
        var left = until - Date.now();
        if (left <= 0) {
          unlockUI();
          return;
        }
        var m = Math.floor(left / 60000);
        var s = Math.floor((left % 60000) / 1000);
        timer.textContent = m + ":" + (s < 10 ? "0" : "") + s;
        setTimeout(tick, 1000);
      })();
    }

    function lockedNow() {
      var raw = read(LOCKOUT_KEY, false);
      if (!raw) return false;
      try {
        var d = JSON.parse(raw);
        if (Date.now() < d.until) {
          lockUI(d.until);
          return true;
        }
      } catch (e) {
        /* corrupt entry — treat as unlocked */
      }
      return false;
    }

    function multiplier() {
      var raw = read(LOCKOUT_KEY, false);
      try {
        return (raw && JSON.parse(raw).multiplier) || 1;
      } catch (e) {
        return 1;
      }
    }

    function close() {
      gate.hidden = true;
      document.body.style.removeProperty("overflow");
    }

    function open() {
      gate.hidden = false;
      document.body.style.setProperty("overflow", "hidden");
      lockedNow();
      user.focus();
    }

    if (read(AUTH_KEY, true) === "true") {
      close();
      return;
    }

    open();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (lockedNow()) return;

      var attempt;
      try {
        attempt = btoa(user.value.trim() + ":" + pass.value);
      } catch (err) {
        attempt = "";
      }

      if (attempt === VALID) {
        store(AUTH_KEY, "true", true);
        try {
          localStorage.removeItem(LOCKOUT_KEY);
        } catch (err) {}
        close();
        return;
      }

      var mult = multiplier();
      var until = Date.now() + BASE_LOCKOUT_MS * mult;
      store(LOCKOUT_KEY, JSON.stringify({ until: until, multiplier: mult * 2 }), false);

      msg.hidden = false;
      msg.textContent =
        "Invalid credentials. Locked for " +
        (BASE_LOCKOUT_MS * mult) / 60000 +
        " minute(s).";
      pass.value = "";
      setTimeout(function () {
        lockUI(until);
      }, 1200);
    });
  }

  function boot() {
    var gates = document.querySelectorAll(".neiia-gate");
    if (!gates.length) {
      document.body.appendChild(template());
      gates = document.querySelectorAll(".neiia-gate");
    }
    Array.prototype.forEach.call(gates, init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
