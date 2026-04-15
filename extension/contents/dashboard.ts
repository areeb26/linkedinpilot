/**
 * This content script runs on the LinkedPilot dashboard page.
 * It reads the workspace ID from Zustand's localStorage persistence
 * and syncs it to chrome.storage.local so the popup can use it.
 * It also bridges cookie-connect requests from the web app to the extension.
 */

function syncWorkspace() {
  try {
    const raw = localStorage.getItem("linkedpilot-workspace")
    if (!raw) {
      console.log("[Pilot Ext] No workspace data in localStorage yet")
      return
    }

    const parsed = JSON.parse(raw)
    const workspaceId = parsed?.state?.workspaceId
    const workspaceName = parsed?.state?.workspaceName

    if (workspaceId && workspaceId !== "ws-123") {
      chrome.storage.local.set({
        currentWorkspaceId: workspaceId,
        currentWorkspaceName: workspaceName || "Workspace"
      }, () => {
        console.log("[Pilot Ext] Workspace synced to extension:", workspaceName, workspaceId)
      })
    }
  } catch (err) {
    console.error("[Pilot Ext] Error syncing workspace:", err)
  }
}

// Sync immediately on page load
syncWorkspace()

// Also re-sync periodically (in case user switches workspace)
setInterval(syncWorkspace, 5000)

// Listen for storage changes (when user logs in or switches workspace)
window.addEventListener("storage", (e) => {
  if (e.key === "linkedpilot-workspace") {
    syncWorkspace()
  }
})

// Bridge: relay messages from web app → extension background
window.addEventListener("message", (event) => {
  if (event.source !== window) return

  // 0. Respond to ping so the modal can detect the extension even after page load
  if (event.data?.type === "PILOT_EXT_PING") {
    window.postMessage({ type: "PILOT_EXT_READY" }, "*")
    return
  }

  // 1. Manual cookie relay (with profile fetch)
  if (event.data?.type === "CONNECT_COOKIE_RELAY") {
    console.log("[Pilot Ext] Relaying cookie connect to extension...")
    chrome.runtime.sendMessage(
      {
        type: "CONNECT_COOKIE_RELAY",
        cookie: event.data.cookie,
        workspaceId: event.data.workspaceId
      },
      (response) => {
        window.postMessage({ type: "CONNECT_COOKIE_RESULT", ...response }, "*")
      }
    )
  }

  // 2. Detect session (for preview)
  if (event.data?.type === "DETECT_SESSION_REQUEST") {
    chrome.runtime.sendMessage({ type: "DETECT_SESSION" }, (response) => {
      window.postMessage({ type: "DETECT_SESSION_RESPONSE", ...response }, "*")
    })
  }

  // 3. Automatic browser session sync (one-click)
  if (event.data?.type === "SYNC_BROWSER_SESSION") {
    console.log("[Pilot Ext] Relaying browser session sync...")
    chrome.runtime.sendMessage(
      {
        type: "CONNECT_ACCOUNT", // background handler already handles cookie capture
        workspaceId: event.data.workspaceId
      },
      (response) => {
        window.postMessage({ type: "SYNC_BROWSER_RESULT", ...response }, "*")
      }
    )
  }
})

// Announce that the extension is available so the web app can detect it
window.postMessage({ type: "PILOT_EXT_READY" }, "*")

