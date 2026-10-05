var ClaudeExtractor = (function () {
  "use strict";

  // All requests below hit claude.ai's own same-origin API (the same endpoints
  // the claude.ai web app itself calls) using the browser's existing session
  // cookie — nothing is sent to any third-party or AI Garage server here.
  // These endpoints are not publicly documented and can change without notice.

  function fetchJson(url, headers) {
    return fetch(url, { credentials: "include", headers: headers || {} }).then(function (res) {
      if (!res.ok) {
        throw new Error("claude.ai request failed: " + url + " (" + res.status + ")");
      }
      return res.json();
    });
  }

  // The /v1/code/... session endpoints (unlike /api/organizations/...)
  // reject requests that don't carry this header.
  var CODE_API_HEADERS = { "anthropic-version": "2023-06-01" };

  function getActiveOrgUuid() {
    return fetchJson("/api/organizations").then(function (orgs) {
      if (!orgs || !orgs.length) {
        throw new Error("No claude.ai organization found for this account.");
      }
      return orgs[0].uuid;
    });
  }

  function blockToText(block) {
    if (!block) return "";
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
    if (block.type === "tool_use") {
      return "[tool use: " + (block.name || "unknown") + "]";
    }
    if (block.type === "tool_result") {
      return "[tool result]";
    }
    return "";
  }

  function messageToText(message) {
    if (typeof message.text === "string" && message.text.length) {
      return message.text;
    }
    if (Array.isArray(message.content)) {
      return message.content.map(blockToText).filter(Boolean).join("\n\n");
    }
    return "";
  }

  function roleLabel(sender) {
    return sender === "human" ? "User" : "Assistant";
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

  function extractChat(conversationId) {
    return getActiveOrgUuid().then(function (orgUuid) {
      var url =
        "/api/organizations/" +
        orgUuid +
        "/chat_conversations/" +
        conversationId +
        "?tree=True&rendering_mode=messages&render_all_tools=true";
      return fetchJson(url);
    }).then(function (conversation) {
      var rawMessages = conversation.chat_messages || [];
      var messages = rawMessages.map(function (m) {
        return {
          role: m.sender === "human" ? "human" : "assistant",
          created_at: m.created_at || null,
          text: messageToText(m),
        };
      });

      var title = conversation.name || "Untitled chat";

      return {
        source: "claude",
        type: "chat",
        id: conversationId,
        url: window.location.href,
        title: title,
        exported_at: new Date().toISOString(),
        messages: messages,
        markdown: buildMarkdown(title, messages),
      };
    });
  }

  function buildProjectMarkdown(name, docs) {
    var lines = ["# " + name, ""];
    for (var i = 0; i < docs.length; i++) {
      lines.push("## " + docs[i].name);
      lines.push("");
      lines.push(docs[i].content);
      lines.push("");
    }
    return lines.join("\n");
  }

  function extractProject(projectId) {
    return getActiveOrgUuid().then(function (orgUuid) {
      var base = "/api/organizations/" + orgUuid + "/projects/" + projectId;
      return Promise.all([
        fetchJson(base),
        fetchJson(base + "/docs"),
      ]);
    }).then(function (results) {
      var project = results[0];
      var rawDocs = results[1] || [];

      var docs = rawDocs.map(function (d) {
        return {
          name: d.file_name || "Untitled document",
          created_at: d.created_at || null,
          content: d.content || "",
        };
      });

      var name = project.name || "Untitled project";

      return {
        source: "claude",
        type: "project",
        id: projectId,
        url: window.location.href,
        name: name,
        exported_at: new Date().toISOString(),
        docs: docs,
        markdown: buildProjectMarkdown(name, docs),
      };
    });
  }

  var TOOL_INPUT_MAX_LEN = 150;
  var TOOL_RESULT_MAX_LEN = 400;
  var TOOL_INPUT_PREFERRED_KEYS = [
    "command", "file_path", "path", "pattern", "query", "url",
    "notebook_path", "description", "prompt",
  ];

  function truncateForDisplay(value, maxLen) {
    var str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "… (" + str.length + " chars)";
  }

  function condenseToolInput(input) {
    if (!input || typeof input !== "object") return "";

    var parts = [];
    TOOL_INPUT_PREFERRED_KEYS.forEach(function (key) {
      if (input[key] !== undefined && input[key] !== null) {
        parts.push(key + ": " + truncateForDisplay(input[key], TOOL_INPUT_MAX_LEN));
      }
    });

    if (!parts.length) {
      Object.keys(input).slice(0, 2).forEach(function (key) {
        parts.push(key + ": " + truncateForDisplay(input[key], TOOL_INPUT_MAX_LEN));
      });
    }

    return parts.join(", ");
  }

  function condenseToolResultContent(content) {
    var text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .map(function (item) {
          if (item && typeof item.text === "string") return item.text;
          if (item && item.type === "image") return "[image]";
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return text ? truncateForDisplay(text, TOOL_RESULT_MAX_LEN) : "";
  }

  function codeBlockToText(block) {
    if (!block) return "";
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
    if (block.type === "tool_use") {
      var argsSummary = condenseToolInput(block.input);
      return "[tool: " + (block.name || "unknown") + "]" + (argsSummary ? " " + argsSummary : "");
    }
    if (block.type === "tool_result") {
      var prefix = block.is_error ? "[tool result — error]" : "[tool result]";
      var resultSummary = condenseToolResultContent(block.content);
      return resultSummary ? prefix + " " + resultSummary : prefix;
    }
    return "";
  }

  function codeEventToText(message) {
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content.map(codeBlockToText).filter(Boolean).join("\n\n");
    }
    return "";
  }

  function extractCodeSession(sessionId) {
    var base = "/v1/code/sessions/" + sessionId;
    return Promise.all([
      fetchJson(base, CODE_API_HEADERS),
      fetchJson(base + "/events?limit=200&sort_order=desc", CODE_API_HEADERS),
    ]).then(function (results) {
      // Observed in the wild wrapped under a top-level "response_shape" key
      // on at least one response; fall back to the flat shape too.
      var session = results[0].response_shape || results[0];
      var rawEvents = (results[1] && results[1].data) || [];

      var sortedEvents = rawEvents.slice().sort(function (a, b) {
        return Number(a.sequence_num) - Number(b.sequence_num);
      });

      var messages = [];
      sortedEvents.forEach(function (event) {
        if (event.event_type !== "user" && event.event_type !== "assistant") return;
        var message = event.payload && event.payload.message;
        if (!message) return;

        var text = codeEventToText(message);
        if (!text) return;

        messages.push({
          role: event.event_type === "user" ? "human" : "assistant",
          created_at: event.created_at || null,
          text: text,
        });
      });

      var title = session.title || "Untitled Code session";

      return {
        source: "claude",
        type: "code",
        id: sessionId,
        url: window.location.href,
        title: title,
        exported_at: new Date().toISOString(),
        messages: messages,
        markdown: buildMarkdown(title, messages),
      };
    });
  }

  function extractCoworkSession(sessionId) {
    return Promise.reject(
      new Error(
        "Claude Cowork session export isn't implemented yet (Phase 8b) — " +
          "the same-origin API this session's transcript comes from hasn't " +
          "been confirmed yet."
      )
    );
  }

  return {
    extractChat: extractChat,
    extractProject: extractProject,
    extractCodeSession: extractCodeSession,
    extractCoworkSession: extractCoworkSession,
  };
})();
