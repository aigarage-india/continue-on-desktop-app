var RedactionUtil = (function () {
  "use strict";

  // Deliberately precise, not a blanket "any long alphanumeric string"
  // catch — Claude Code/Cowork session content is full of legitimate
  // hashes, UUIDs and git SHAs that a broad entropy-based pattern would
  // mangle. Only well-recognized secret formats are matched.
  var PATTERNS = [
    { re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[REDACTED EMAIL]" },
    { re: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[- ]?\d{4}[- ]?\d{4}[- ]?\d{1,4}\b/g, replacement: "[REDACTED CARD]" },
    {
      re: /\b(sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{10,}|sk_live_[0-9A-Za-z]{10,}|pk_live_[0-9A-Za-z]{10,})\b/g,
      replacement: "[REDACTED KEY]",
    },
    // Phone last, after card/key patterns, so it doesn't eat digit runs
    // those already claimed.
    { re: /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, replacement: "[REDACTED PHONE]" },
  ];

  function redactText(text) {
    if (typeof text !== "string" || !text) return { text: text, count: 0 };
    var count = 0;
    var result = text;
    PATTERNS.forEach(function (p) {
      result = result.replace(p.re, function () {
        count++;
        return p.replacement;
      });
    });
    return { text: result, count: count };
  }

  function redactPayload(payload) {
    var totalCount = 0;
    var result = JSON.parse(JSON.stringify(payload));

    function applyTo(value) {
      var r = redactText(value);
      totalCount += r.count;
      return r.text;
    }

    if (typeof result.title === "string") result.title = applyTo(result.title);
    if (typeof result.name === "string") result.name = applyTo(result.name);

    if (Array.isArray(result.messages)) {
      result.messages.forEach(function (m) {
        if (typeof m.text === "string") m.text = applyTo(m.text);
      });
    }

    if (Array.isArray(result.docs)) {
      result.docs.forEach(function (d) {
        if (typeof d.content === "string") d.content = applyTo(d.content);
      });
    }

    if (typeof result.markdown === "string") result.markdown = applyTo(result.markdown);

    return { payload: result, count: totalCount };
  }

  return {
    redactPayload: redactPayload,
  };
})();
