var ContinueOnDesktop = (function () {
  "use strict";

  var MAPPINGS = [
    {
      site: "claude",
      pattern: /^https:\/\/claude\.ai\/(chat|project)\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function (match) {
        return "claude://claude.ai/" + match[1] + "/" + match[2];
      },
    },
    {
      site: "chatgpt",
      pattern: /^https:\/\/chatgpt\.com\/c\/([a-zA-Z0-9_-]+)/,
      buildDeepLink: function (match) {
        return "chatgpt://chatgpt.com/threads/" + match[1];
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
          deepLink: m.buildDeepLink(match),
          conversationId: match[match.length - 1],
        };
      }
    }
    return { site: detectSite(url), deepLink: null, conversationId: null };
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
