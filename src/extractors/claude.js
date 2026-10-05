var ClaudeExtractor = (function () {
  "use strict";

  // All requests below hit claude.ai's own same-origin API (the same endpoints
  // the claude.ai web app itself calls) using the browser's existing session
  // cookie — nothing is sent to any third-party or AI Garage server here.
  // These endpoints are not publicly documented and can change without notice.

  function fetchJson(url) {
    return fetch(url, { credentials: "include" }).then(function (res) {
      if (!res.ok) {
        throw new Error("claude.ai request failed: " + url + " (" + res.status + ")");
      }
      return res.json();
    });
  }

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

  function extractCodeSession(sessionId) {
    return Promise.reject(
      new Error(
        "Claude Code session export isn't implemented yet (Phase 8a) — " +
          "the same-origin API this session's transcript comes from hasn't " +
          "been confirmed yet."
      )
    );
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
