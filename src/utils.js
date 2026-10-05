var ContinueOnDesktop = (function () {
  "use strict";

  var MAPPINGS = [
    {
      site: "claude",
      pattern: /^https:\/\/claude\.ai\/(chat|project)\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function (match) {
        return "claude://claude.ai/" + match[1] + "/" + match[2];
      },
      type: function (match) {
        return match[1];
      },
    },
    {
      site: "claude",
      pattern: /^https:\/\/claude\.ai\/code\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function () {
        // No known desktop protocol handler for a specific web Code session.
        return null;
      },
      type: function () {
        return "code";
      },
    },
    {
      site: "claude",
      pattern: /^https:\/\/claude\.ai\/cowork\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function () {
        // Cowork is browser-only — no desktop protocol handler to link to.
        return null;
      },
      type: function () {
        return "cowork";
      },
    },
    {
      site: "chatgpt",
      pattern: /^https:\/\/chatgpt\.com\/(?:g\/g-p-[^/]+\/)?c\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function (match) {
        return "chatgpt://chatgpt.com/threads/" + match[1];
      },
      type: function () {
        return "chat";
      },
    },
    {
      site: "chatgpt",
      pattern: /^https:\/\/chatgpt\.com\/g\/(g-p-[a-zA-Z0-9]+)\/project/,
      buildDeepLink: function () {
        // No confirmed desktop protocol handler for a project page itself.
        return null;
      },
      type: function () {
        return "project";
      },
    },
  ];

  function getSiteInfo(url) {
    for (var i = 0; i < MAPPINGS.length; i++) {
      var m = MAPPINGS[i];
      var match = url.match(m.pattern);
      if (match) {
        return {
          site: m.site,
          type: m.type(match),
          deepLink: m.buildDeepLink(match),
          conversationId: match[match.length - 1],
        };
      }
    }
    return { site: detectSite(url), type: null, deepLink: null, conversationId: null };
  }

  function detectSite(url) {
    if (/^https:\/\/claude\.ai/.test(url)) return "claude";
    if (/^https:\/\/chatgpt\.com/.test(url)) return "chatgpt";
    return null;
  }

  function isSupported(url) {
    return getSiteInfo(url).deepLink !== null;
  }

  return {
    getSiteInfo: getSiteInfo,
    isSupported: isSupported,
  };
})();
