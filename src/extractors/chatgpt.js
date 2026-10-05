var ChatGPTExtractor = (function () {
  "use strict";

  // All requests below hit chatgpt.com's own same-origin API (the same
  // endpoints the chatgpt.com web app itself calls) using the browser's
  // existing session cookie — nothing is sent to any third-party or
  // AI Garage server here. These endpoints are not publicly documented
  // and can change without notice.

  function fetchJson(url, token) {
    var headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(url, { credentials: "include", headers: headers }).then(function (res) {
      if (!res.ok) {
        throw new Error("chatgpt.com request failed: " + url + " (" + res.status + ")");
      }
      return res.json();
    });
  }

  function getAccessToken() {
    return fetchJson("/api/auth/session").then(function (session) {
      if (!session || !session.accessToken) {
        throw new Error("Could not get chatgpt.com session token. Are you logged in?");
      }
      return session.accessToken;
    });
  }

  function partToText(part) {
    if (typeof part === "string") return part;
    return "";
  }

  function nodeToText(node) {
    var message = node.message;
    if (!message || !message.content) return "";

    var parts = message.content.parts;
    if (Array.isArray(parts)) {
      var text = parts.map(partToText).filter(Boolean).join("\n\n");
      if (text) return text;
    }

    if (message.recipient && message.recipient !== "all") {
      return "[tool call: " + message.recipient + "]";
    }

    return "";
  }

  function roleOf(node) {
    var message = node.message;
    if (!message || !message.author) return null;
    return message.author.role;
  }

  function roleLabel(role) {
    return role === "user" ? "User" : "Assistant";
  }

  function buildMarkdown(title, messages) {
    var lines = ["# " + title, ""];
    for (var i = 0; i < messages.length; i++) {
      lines.push("## " + roleLabel(messages[i].role));
      lines.push("");
      lines.push(messages[i].text);
      lines.push("");
    }
    return lines.join("\n");
  }

  function linearizeMapping(mapping, currentNodeId) {
    var chain = [];
    var nodeId = currentNodeId;
    while (nodeId) {
      var node = mapping[nodeId];
      if (!node) break;
      chain.push(node);
      nodeId = node.parent;
    }
    chain.reverse();
    return chain;
  }

  function extractChat(conversationId) {
    return getAccessToken().then(function (token) {
      return fetchJson("/backend-api/conversation/" + conversationId, token).then(function (conversation) {
        var chain = linearizeMapping(conversation.mapping || {}, conversation.current_node);

        var messages = [];
        for (var i = 0; i < chain.length; i++) {
          var node = chain[i];
          var role = roleOf(node);
          if (role !== "user" && role !== "assistant") continue;

          var text = nodeToText(node);
          if (!text) continue;

          messages.push({
            role: role === "user" ? "human" : "assistant",
            created_at: node.message.create_time
              ? new Date(node.message.create_time * 1000).toISOString()
              : null,
            text: text,
          });
        }

        var title = conversation.title || "Untitled chat";

        return {
          source: "chatgpt",
          type: "chat",
          id: conversationId,
          url: window.location.href,
          title: title,
          exported_at: new Date().toISOString(),
          messages: messages,
          markdown: buildMarkdown(title, messages),
        };
      });
    });
  }

  return {
    extractChat: extractChat,
  };
})();
