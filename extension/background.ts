import { supabase as rawSupabase } from "./lib/supabase"
import type { SupabaseClient } from "./types/supabase"

// Cast supabase to our extension-specific type
const supabase = rawSupabase as unknown as SupabaseClient

/**
 * Generates a stable unique ID for a LinkedIn account based on its cookie.
 * Ensures that the same account always maps to the same ID even if scraping fails.
 */
async function getStableId(cookieStr: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(cookieStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

function getCookieValue(cookieStr: string, name: string): string | null {
  const match = cookieStr.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

console.log("Background service worker initialized.")

// Tracks which workspaces already have an active Realtime subscription
const subscribedWorkspaces = new Set<string>();

// Tracks actions waiting for navigation retry
const pendingNavigationActions = new Map<string, any>();

// Re-subscribe on service worker restart (subscriptions don't survive SW sleep)
/*
chrome.storage.local.get(["currentWorkspaceId"], (result) => {
  if (result.currentWorkspaceId) {
    subscribeToQueue(result.currentWorkspaceId);
  }
});
*/

// Setup periodic inbox sync and queue polling
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Alarm] Setting up background alarms...");
  chrome.alarms.create("sync-inbox", {
    periodInMinutes: 15,
    delayInMinutes: 1
  });
  chrome.alarms.create("poll-action-queue", {
    periodInMinutes: 1, // Poll every minute to handle cases where Realtime dies
    delayInMinutes: 0.5
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-inbox") {
    console.log("[Alarm] Triggering inbox sync...");
    syncInboxAcrossAllTabs();
  }
  
  if (alarm.name === "poll-action-queue") {
    console.log("[Alarm] Polling action queue...");
    chrome.storage.local.get(["currentWorkspaceId"], (result) => {
      const workspaceId = result.currentWorkspaceId as string;
      if (workspaceId) {
        checkPendingActions(workspaceId);
        // Ensure subscription is also active
        subscribeToQueue(workspaceId);
      }
    });
  }

  // Handle navigation retry alarms
  if (alarm.name.startsWith("retry-scrape-")) {
    const actionId = alarm.name.replace("retry-scrape-", "");
    const pendingAction = pendingNavigationActions.get(actionId);
    if (pendingAction) {
      console.log(`[Retry] Retrying scrape for action ${actionId}`);
      pendingNavigationActions.delete(actionId);
      processAction(pendingAction);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CONNECT_ACCOUNT") {
    const currentWorkspaceId = message.workspaceId
    if (!currentWorkspaceId) {
      sendResponse({ success: false, error: "No workspace ID provided" })
      return true
    }

    // 1. Get all LinkedIn cookies
    chrome.cookies.getAll({ domain: "linkedin.com" }, async (cookies) => {
      const cookieMap = new Map(cookies.map(c => [c.name, c.value]));
      const li_at = cookieMap.get("li_at");
      
      if (!li_at) {
        sendResponse({ success: false, error: "Not logged in to LinkedIn (li_at cookie missing)" })
        return
      }

      const fullCookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

      // 2. Fetch profile — try background direct fetch first, then content script fallback
      const resolveProfile = (): Promise<any> => new Promise(async (resolve) => {
        // Strategy 1: direct Voyager fetch from background (host_permissions covers linkedin.com)
        try {
          const result = await fetchProfileData(fullCookieStr);
          if (result?.success && result.full_name && result.full_name !== "LinkedIn User") {
            console.log("[CONNECT] Got profile via direct fetch:", result.full_name);
            return resolve(result);
          }
        } catch (e) {
          console.warn("[CONNECT] Direct profile fetch failed:", e);
        }

        // Strategy 2: ask content script (runs in page context, best for cookies)
        chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
          if (tabs.length === 0) { 
              console.warn("[CONNECT] No LinkedIn tab found for content script fallback");
              return resolve(undefined); 
          }
          chrome.tabs.sendMessage(
            tabs[0].id!,
            { type: "EXECUTE_ACTION", action: "getProfileInfo" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn("[CONNECT] Content script error:", chrome.runtime.lastError.message);
                return resolve(undefined);
              }
              console.log("[CONNECT] Got profile via content script:", response?.full_name);
              resolve(response?.success ? response : undefined);
            }
          );
        });
      });

      resolveProfile().then(async (profileData) => {
        console.log("[CONNECT] Final profile:", JSON.stringify(profileData));

        // 3. Call the Edge Function
        const SUPABASE_URL = process.env.EXT_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.EXT_SUPABASE_ANON_KEY;

        try {
          console.log("[CONNECT] Calling Edge Function...");
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/connect-cookie`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              cookie: fullCookieStr,
              workspace_id: currentWorkspaceId,
              profile: profileData ?? undefined
            })
          });

          const result = await resp.json();
          console.log("[CONNECT] Edge Function response:", JSON.stringify(result));

          if (result.success) {
            sendResponse({ success: true, account: result.account });
            subscribeToQueue(currentWorkspaceId);
          } else {
            sendResponse({ success: false, error: result.error || "Edge function failed" });
          }
        } catch (err) {
          console.error("[CONNECT] Edge Function error:", err);
          sendResponse({ success: false, error: (err as Error).message });
        }
      });
    }
    )


    return true // async response
  }

  if (message.type === "VALIDATE_COOKIE") {
    const { cookieValue } = message
    if (!cookieValue) {
      sendResponse({ success: false, error: "No cookie provided" })
      return true
    }

    // Try to fetch profile info directly from LinkedIn API using the cookie
    fetchProfileData(cookieValue).then(profResponse => {
      sendResponse(profResponse)
    }).catch(err => {
      // Fallback: try content script if direct fetch fails (e.g. CORS)
      chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ success: false, error: "Validation failed and no LinkedIn tab open." })
          return
        }
        chrome.tabs.sendMessage(tabs[0].id!, { type: "EXECUTE_ACTION", action: "getProfileInfo" }, (profResponse) => {
          sendResponse(profResponse)
        })
      })
    })
    return true
  }

  if (message.type === "SET_CONTEXT") {
    const { workspaceId, workspaceName } = message
    chrome.storage.local.set({ 
      currentWorkspaceId: workspaceId,
      currentWorkspaceName: workspaceName
    }, () => {
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === "SCRAPE_LEADS") {
    console.log("Starting lead scraping...")
    const { extractionType = 'search', payload, workspaceId } = message
    console.log("[SCRAPE_LEADS handler] Received payload with action_queue_id:", payload?.action_queue_id);
    
    chrome.tabs.query({ url: "*://*.linkedin.com/*" }, async (tabs) => {
      // Filter out ad/tracking iframes - only target main LinkedIn pages
      const validTabs = tabs.filter(t => {
        const url = t.url || "";
        // Skip ad/tracking iframes
        if (url.includes('/tscp-serving/') || 
            url.includes('/ads/') || 
            url.includes('merchantpool') ||
            url.includes('/dtag?')) {
          return false;
        }
        // Must be a main LinkedIn page (has /search/, /feed/, /in/, etc. or is just linkedin.com)
        return url.match(/linkedin\.com\/(search|feed|in|mynetwork|messaging|notifications|home)/);
      });
      
      if (validTabs.length === 0) {
          sendResponse({ success: false, error: "Please open LinkedIn search results page first." });
          return;
      }

      const targetTab = validTabs.find(t => t.active) || validTabs[0];
      const tabId = targetTab.id!;
      console.log("[Scraper] Targeting tab:", targetTab.url);
      
      const sendScrapeMessage = async (retryCount = 0) => {
        chrome.tabs.sendMessage(
          tabId, 
          { type: "EXECUTE_ACTION", action: "scrapeLeads", payload: { ...payload, extractionType } }, 
          async (response) => {
            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || "";
              console.error("[Bridge] Messaging error:", errMsg);
              
              if (errMsg.includes("Receiving end does not exist") && retryCount < 2) {
                  console.log("[Bridge] Content script not found, trying to inject...");
                  // Try to inject content script manually
                  try {
                    await chrome.scripting.executeScript({
                      target: { tabId },
                      files: ['contents/linkedin.js']
                    });
                    console.log("[Bridge] Content script injected, retrying...");
                    await new Promise(r => setTimeout(r, 1000));
                    sendScrapeMessage(retryCount + 1);
                  } catch (injectErr) {
                    console.error("[Bridge] Failed to inject:", injectErr);
                    sendResponse({ success: false, error: "Content script not loaded. Please refresh the LinkedIn page." });
                  }
              } else if (errMsg.includes("Receiving end does not exist") && retryCount >= 2) {
                  console.log("[Bridge] Connection lost, waiting for reload...");
                  waitForNavigationAndRetry(tabId, () => sendScrapeMessage(retryCount + 1));
              } else {
                  sendResponse({ success: false, error: errMsg });
              }
            } else {
              if (response?.status === "navigating" && retryCount < 3) {
                console.log("[Bridge] Script reported navigation. Waiting for reload...");
                waitForNavigationAndRetry(tabId, () => sendScrapeMessage(retryCount + 1));
              } else {
                console.log("[Bridge] Success response received");
                console.log(`[Bridge] Extracted ${response?.leads?.length || 0} leads, workspaceId: ${workspaceId}`);
                if (response?.success && response?.leads && workspaceId) {
                  console.log(`[Bridge] Saving leads to workspace: ${workspaceId}`);
                  saveLeadsViaEdgeFunction(response.leads, workspaceId, payload?.campaign_id, payload?.action_queue_id);
                } else {
                  console.warn("[Bridge] Skipping lead save - missing workspaceId or leads", { hasLeads: !!response?.leads, workspaceId });
                }
                sendResponse(response);
              }
            }
          }
        );
      }

      sendScrapeMessage(0);
    })
    return true
  }

  // Relay cookie connection from web dashboard — fetches profile in browser context
  if (message.type === "CONNECT_COOKIE_RELAY") {
    const { cookie, workspaceId } = message
    if (!cookie || !workspaceId) {
      sendResponse({ success: false, error: "Missing cookie or workspaceId" })
      return true
    }

    console.log("[RELAY] Cookie connect from dashboard, fetching profile...");

    (async () => {
      // Fetch profile using the provided cookie (runs from extension = browser context)
      const profileData = await fetchProfileData(cookie);
      console.log("[RELAY] Profile result:", (profileData?.success && profileData.full_name) || "failed");

      // Call edge function with profile data
      const SUPABASE_URL = process.env.EXT_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXT_SUPABASE_ANON_KEY;

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/connect-cookie`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            cookie,
            workspace_id: workspaceId,
            profile: profileData?.success ? profileData : undefined
          })
        });

        const result = await resp.json();
        console.log("[RELAY] Edge Function result:", result?.success);

        if (result.success) {
          sendResponse({ success: true, account: result.account, synced: result.synced });
          subscribeToQueue(workspaceId);
        } else {
          sendResponse({ success: false, error: result.error || "Edge function failed" });
        }
      } catch (err) {
        console.error("[RELAY] Edge Function error:", err);
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();

    return true
  }

  // Detect session: checks for li_at cookie and fetches profile info if found
  if (message.type === "DETECT_SESSION") {
    chrome.cookies.getAll({ domain: "linkedin.com" }, async (cookies) => {
      const cookieMap = new Map(cookies.map(c => [c.name, c.value]));
      const li_at = cookieMap.get("li_at");
      
      if (!li_at) {
        sendResponse({ success: false, error: "Not logged in" });
        return;
      }

      const fullCookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      const profileData = await fetchProfileData(fullCookieStr);
      
      if (profileData?.success && profileData?.full_name && profileData.full_name !== "LinkedIn User") {
        sendResponse({ success: true, profile: profileData });
      } else {
        // Fallback to content script
        chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
          if (tabs.length === 0) {
            sendResponse({ success: true, profile: null });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id!, { type: "EXECUTE_ACTION", action: "getProfileInfo" }, (profResponse) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: true, profile: null });
            } else {
              sendResponse({ success: true, profile: profResponse?.success ? profResponse : null });
            }
          });
        });
      }
    });
    return true;
  }

  // Verify if a specific LinkedIn account is connected in Supabase for a workspace
  if (message.type === "CHECK_ACCOUNT_SESSIONS") {
    const { workspaceId, memberId } = message;
    if (!workspaceId) {
      sendResponse({ success: false, error: "Missing workspaceId" });
      return true;
    }

    (async () => {
      try {
        const query = supabase
          .from("linkedin_accounts")
          .select("id, linkedin_member_id")
          .eq("workspace_id", workspaceId);
        
        if (memberId) {
          query.eq("linkedin_member_id", memberId);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        const isConnected = data && data.length > 0;
        sendResponse({ 
          success: true, 
          connected: isConnected, 
          accounts: data 
        });
      } catch (err) {
        console.error("[CHECK_SESSIONS] Error:", err);
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }
})

/**
 * Save leads via the Edge Function to bypass RLS.
 * The extension has no authenticated user session, so direct Supabase
 * writes would be blocked by row-level security policies.
 */
async function saveLeadsViaEdgeFunction(
  leads: any[], 
  workspaceId: string, 
  campaignId?: string,
  actionQueueId?: string,
  actionStatus?: string
) {
  if (!leads || !leads.length || !workspaceId) {
    console.warn("[Sync] Skipping lead save: missing data or workspaceId");
    return;
  }

  const SUPABASE_URL = process.env.EXT_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.EXT_SUPABASE_ANON_KEY;

  console.log(`[Sync] Saving ${leads.length} leads via Edge Function...`);

  // Map leads to include new fields (location, member_id, industry)
  const enrichedLeads = leads.map(lead => ({
    full_name: lead.full_name,
    profile_url: lead.profile_url,
    headline: lead.headline,
    avatar_url: lead.avatar_url,
    title: lead.title,
    company: lead.company,
    // NEW fields for extended lead data
    location: lead.location,
    member_id: lead.member_id,
    industry: lead.industry,
    source: lead.source
  }));

  try {
    const requestBody = {
      workspace_id: workspaceId,
      leads: enrichedLeads,
      campaign_id: campaignId,
      action_queue_id: actionQueueId,
      action_status: actionStatus
    };
    
    console.log("[Sync] Sending to Edge Function:", JSON.stringify(requestBody, null, 2));
    
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const result = await resp.json();
    console.log("[Sync] Edge Function result:", JSON.stringify(result));
    
    if (!resp.ok) {
      console.error("[Sync] Edge Function returned error status:", resp.status, result);
    } else if (result.success) {
      console.log(`[Sync] Successfully saved ${result.saved || 0} leads to workspace ${workspaceId}`);
      if (result.lead_ids?.length > 0) {
        console.log(`[Sync] Lead IDs: ${result.lead_ids.join(', ')}`);
      }
    }
    
    return result;
  } catch (err) {
    console.error("[Sync] Edge Function error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Update action_queue status via Edge Function (RLS bypass).
 */
async function updateActionStatus(actionId: string, workspaceId: string, status: string, result?: any) {
  const SUPABASE_URL = process.env.EXT_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.EXT_SUPABASE_ANON_KEY;

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        action_queue_id: actionId,
        action_status: status,
        leads: [] // empty — just updating status
      })
    });
    const data = await resp.json();
    console.log(`[Queue] Updated action ${actionId} to ${status}`);
    return data;
  } catch (err) {
    console.error(`[Queue] Failed to update action ${actionId}:`, err);
  }
}

/**
 * Manually checks for pending actions in the database.
 * Used as a fallback when Realtime subscriptions are lost due to SW sleep.
 */
async function checkPendingActions(workspaceId: string) {
  try {
    const { data, error } = await supabase
      .from('action_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .limit(5);

    if (error) {
      console.error("[Queue] Error polling pending actions:", error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`[Queue] Found ${data.length} pending actions via polling.`);
      for (const action of data) {
        await processAction(action);
      }
    }
  } catch (err) {
    console.error("[Queue] Crash in checkPendingActions:", err);
  }
}

function subscribeToQueue(workspaceId: string) {
  if (subscribedWorkspaces.has(workspaceId)) {
    console.log("[Queue] Already subscribed for workspace", workspaceId);
    return;
  }
  subscribedWorkspaces.add(workspaceId);
  console.log("Subscribing to action_queue for workspace", workspaceId)

  supabase
    .channel(`ext_action_queue_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'action_queue',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          const action = payload.new
          console.log("[Realtime] New action_queue INSERT, payload.new.id:", payload.new.id, "payload.new.payload.action_queue_id:", payload.new.payload?.action_queue_id);
          if (action.status === 'pending') {
            processAction(action)
          }
        }
      )
    .subscribe()
}

async function processAction(initialAction: any) {
  chrome.tabs.query({ url: "*://*.linkedin.com/*" }, async (tabs) => {
    // Re-fetch the action to ensure we have the latest payload (after potential updates from frontend)
    const { data: action, error: fetchError } = await supabase
      .from('action_queue')
      .select('*')
      .eq('id', initialAction.id)
      .single();

    if (fetchError || !action) {
      console.error("[Queue] Error re-fetching action:", initialAction.id, fetchError);
      // If we can't fetch the action, we can't proceed. Mark as failed.
      updateActionStatus(initialAction.id, initialAction.workspace_id, "failed", {
        success: false,
        error: fetchError?.message || "Failed to re-fetch action details"
      });
      return;
    }

    console.log("[ProcessAction] Re-fetched action.id:", action.id, "action.payload.action_queue_id:", action.payload?.action_queue_id);

    // Filter out ad/tracking iframes — same logic as SCRAPE_LEADS handler
    const validTabs = tabs.filter(t => {
      const url = t.url || "";
      if (url.includes('/tscp-serving/') || url.includes('/ads/') || url.includes('merchantpool') || url.includes('/dtag?')) return false;
      return true;
    });

    if (validTabs.length > 0) {
      const targetTab = validTabs.find(t => t.active) || validTabs[0];

      // Mark as processing first
      updateActionStatus(action.id, action.workspace_id, "processing");

      chrome.tabs.sendMessage(targetTab.id!, { type: "EXECUTE_ACTION", action: action.action_type, payload: action.payload }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Queue] Content script error:", chrome.runtime.lastError.message);
          updateActionStatus(action.id, action.workspace_id, "failed", {
            success: false,
            error: chrome.runtime.lastError.message || "Content script unreachable"
          });
          return;
        }

        // Handle navigation/pending responses — schedule a retry
        if (response?.pending === true) {
          console.log(`[Queue] Action ${action.id} is pending navigation, scheduling retry...`);
          pendingNavigationActions.set(action.id, action);
          // If the content script returned a target URL, navigate the tab there
          if (response.url) {
            chrome.tabs.update(targetTab.id!, { url: response.url });
          }
          chrome.alarms.create(`retry-scrape-${action.id}`, { delayInMinutes: 0.5 }); // 30 seconds — enough time for navigation + page load
          // Keep status as "processing" — don't mark completed yet
          return;
        }

        // If it was a scrapeLeads action and it succeeded, save the leads via Edge Function
        if (action.action_type === 'scrapeLeads' && response?.success && response?.leads) {
          console.log(`[Queue] Processing ${response.leads.length} scraped leads via Edge Function...`);
          console.log("[ProcessAction] Calling saveLeadsViaEdgeFunction with action.id:", action.id);
          
          await saveLeadsViaEdgeFunction(
            response.leads,
            action.workspace_id,
            action.campaign_id,
            action.id,        // action_queue_id — so EF updates status too
            "completed"
          );
        } else {
          // For non-scrape actions or failed scrapes, just update the status
          updateActionStatus(
            action.id,
            action.workspace_id,
            response?.success ? "completed" : "failed",
            response || { success: false, error: "No response from content script" }
          );
        }
      })
    } else {
      updateActionStatus(action.id, action.workspace_id, "failed", {
        success: false,
        error: "No LinkedIn tab open"
      });
    }
  })
}

async function fetchProfileData(cookieStr: string): Promise<
  { success: true; full_name: string; avatar_url?: string; profile_url?: string; member_id?: string } |
  { success: false; error: string }
> {
  const jsessionid = getCookieValue(cookieStr, "JSESSIONID")?.replace(/"/g, '');

  const commonHeaders: Record<string, string> = {
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "accept-language": "en-US,en;q=0.9",
    "cookie": cookieStr,
    "csrf-token": jsessionid || "",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-li-lang": "en_US",
    "x-restli-protocol-version": "2.0.0",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  };

  // Ordered list of endpoints to try — newest first
  const endpoints = [
    {
      url: "https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=me",
      label: "dash/profiles"
    },
    {
      url: "https://www.linkedin.com/voyager/api/identity/profiles/me",
      label: "identity/profiles/me"
    },
    {
      url: "https://www.linkedin.com/voyager/api/me",
      label: "/me (legacy)"
    }
  ];

  for (const ep of endpoints) {
    try {
      console.log(`Fetching profile from Voyager ${ep.label}...`);
      const response = await fetch(ep.url, { headers: commonHeaders });

      if (!response.ok) {
        console.warn(`LinkedIn ${ep.label} API error: ${response.status}`);
        continue; // try next endpoint
      }

      const data = await response.json();
      const result = extractProfileFromVoyager(data);

      if (result) {
        console.log(`Successfully extracted profile via ${ep.label}:`, result.full_name);
        return { success: true, ...result };
      }

      console.warn(`${ep.label} returned OK but no usable profile data`);
    } catch (err) {
      console.warn(`${ep.label} fetch error:`, (err as Error).message);
    }
  }

  // All endpoints failed — return failure so caller can try content script
  console.error("fetchProfileData: all Voyager endpoints failed");
  return { success: false, error: "All LinkedIn API endpoints failed" };
}

/**
 * Extracts profile info from any Voyager response shape.
 * Returns null if no usable profile found.
 */
function extractProfileFromVoyager(data: any): { full_name: string; avatar_url: string; profile_url: string; member_id: string } | null {
  // Collect all included entities and the top-level data
  const included: any[] = data.included || [];
  const elements: any[] = data.data?.["*elements"] ? included : (data.elements || []);
  const all = [...included, ...elements];

  if (all.length === 0 && data.data) {
    // Some endpoints return flat data at top level
    all.push(data.data);
  }

  const types = all.map((i: any) => i.$type).filter(Boolean);
  console.log("Voyager response types:", [...new Set(types)]);

  // Find profile entity — try multiple $type patterns
  const profile = all.find((i: any) => {
    const t = i.$type || "";
    return t.includes("MiniProfile") ||
           t.includes("identity.profile.Profile") ||
           t.includes("identity.dash.Profile") ||
           t.includes("voyager.identity.me.Card") ||
           (i.firstName && i.lastName && i.publicIdentifier);
  });

  if (!profile) return null;

  // Handle both string and localized name formats
  const firstName = typeof profile.firstName === "string"
    ? profile.firstName
    : profile.firstName?.localized?.[Object.keys(profile.firstName?.localized || {})[0]] || "";
  const lastName = typeof profile.lastName === "string"
    ? profile.lastName
    : profile.lastName?.localized?.[Object.keys(profile.lastName?.localized || {})[0]] || "";
  const publicIdentifier = profile.publicIdentifier || profile.vanityName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (!fullName || fullName === "LinkedIn User") return null; // not useful

  // Extract avatar — try multiple picture shapes
  let avatarUrl = "";
  const pic = profile.picture || profile.profilePicture?.displayImageReference?.vectorImage;
  if (pic?.rootUrl && pic?.artifacts?.length) {
    const best = pic.artifacts[pic.artifacts.length - 1];
    avatarUrl = `${pic.rootUrl}${best.fileIdentifyingUrlPathSegment}`;
  } else {
    // Try displayImage~ pattern
    const photoElements = profile.profilePicture?.["displayImage~"]?.elements;
    if (photoElements?.length) {
      avatarUrl = photoElements[photoElements.length - 1]?.identifiers?.[0]?.identifier || "";
    }
  }

  // Also search for VectorImage in included[]
  if (!avatarUrl) {
    const vecImg = all.find((i: any) =>
      (i.$type || "").includes("VectorImage") || (i.$type || "").includes("Photo")
    );
    if (vecImg?.rootUrl && vecImg?.artifacts?.length) {
      avatarUrl = `${vecImg.rootUrl}${vecImg.artifacts[vecImg.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
    }
  }

  return {
    full_name: fullName,
    avatar_url: avatarUrl,
    profile_url: publicIdentifier
      ? `https://www.linkedin.com/in/${publicIdentifier}`
      : "https://www.linkedin.com/in/",
    member_id: publicIdentifier || "me"
  };
}
async function syncInboxAcrossAllTabs() {
  console.log("[Sync] Discovering LinkedIn tabs for inbox sync...");
  
  chrome.storage.local.get(["currentWorkspaceId"], (result) => {
    const workspaceId = result.currentWorkspaceId;
    if (!workspaceId) {
      console.warn("[Sync] No workspaceId found in storage, skipping sync.");
      return;
    }

    chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
      if (tabs.length === 0) {
        console.log("[Sync] No LinkedIn tabs open, skipping.");
        return;
      }

      // We only need one tab to perform the sync via API
      const targetTab = tabs.find(t => t.active) || tabs[0];
      console.log(`[Sync] Requesting sync from tab ${targetTab.id}`);

      // 1. First get the profile info to identify the LinkedIn account
      chrome.tabs.sendMessage(
        targetTab.id!,
        { type: "EXECUTE_ACTION", action: "getProfileInfo" },
        (profileResp) => {
          if (chrome.runtime.lastError || !profileResp?.success) {
            console.error("[Sync] Could not identify LinkedIn account:", chrome.runtime.lastError?.message);
            return;
          }

          const memberId = profileResp.member_id;
          
          // 2. Resolve the account ID from Supabase
          supabase.from("linkedin_accounts")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("linkedin_member_id", memberId)
            .single()
            .then((result: { data: any }) => {
              const accountId: string = result.data?.id;
              if (!accountId) {
                console.warn("[Sync] LinkedIn account not found in Supabase for workspace.");
                return;
              }

              // 3. Fetch conversations
              chrome.tabs.sendMessage(
                targetTab.id!,
                { type: "EXECUTE_ACTION", action: "SYNC_INBOX" },
                (syncResp) => {
                  if (syncResp?.success && syncResp?.conversations) {
                    // @ts-ignore - Supabase type inference issue, runtime check ensures accountId is valid
                    saveMessagesToSupabase(syncResp.conversations, workspaceId, accountId);
                  }
                }
              );
            });
        }
      );
    });
  });
}

async function saveMessagesToSupabase(conversations: any[], workspaceId: string, accountId: string) {
  if (!conversations || conversations.length === 0) return;
  
  console.log(`[Sync] Processing ${conversations.length} enriched conversations for account ${accountId}...`);
  
  for (const conv of conversations) {
    try {
      if (!conv.profile_url) {
        console.warn("[Sync] Skipping conversation without profile_url:", conv.thread_id);
        continue;
      }

      // 1. Standardize profile URL
      const cleanUrl = conv.profile_url.split("?")[0].replace(/\/$/, "");

      // 2. Find or Create Lead
      // Using service role logic via Edge Function is preferred for complex data, 
      // but here we can do it directly if RLS allows or if using service role key (which background script does)
      
      const { data: lead, error: leadError } = await (supabase as any)
        .from("leads")
        .upsert([{
          workspace_id: workspaceId,
          profile_url: cleanUrl,
          full_name: conv.lead_name,
          avatar_url: conv.lead_avatar,
          headline: conv.headline || "LinkedIn Participant",
          status: "connected", // Assume connected if we are messaging
          updated_at: new Date().toISOString()
        }], { onConflict: 'workspace_id,profile_url', ignoreDuplicates: false })
        .select("id")
        .single();

      if (leadError) {
        console.error("[Sync] Error upserting lead for sync:", cleanUrl, leadError);
        continue;
      }

      const leadId = lead?.id;

      // 3. Upsert into messages table using thread_id for deduplication
      const { error: msgError } = await (supabase as any)
        .from("messages")
        .upsert([{
          workspace_id: workspaceId,
          linkedin_account_id: accountId,
          lead_id: leadId,
          thread_id: conv.thread_id,
          body: typeof conv.last_message === 'string' ? conv.last_message : (conv.last_message?.text || ""),
          direction: "inbound", // Default to inbound for sync
          sent_at: new Date(conv.updated_at).toISOString(),
          is_read: conv.unread_count === 0,
          updated_at: new Date().toISOString()
        }], { onConflict: 'thread_id' }); 

      if (msgError) {
        console.error("[Sync] Error saving conversation message:", conv.thread_id, msgError);
      } else {
        console.log(`[Sync] Successfully synced thread ${conv.thread_id} for lead ${conv.lead_name}`);
      }
    } catch (err) {
      console.error("[Sync] Error processing conversation:", err);
    }
  }
}

/**
 * Helper to wait for a tab to finish navigating and then execute a callback.
 */
function waitForNavigationAndRetry(tabId: number, callback: () => void) {
  const listener = (updatedTabId: number, changeInfo: { status?: string; [key: string]: any }) => {
    if (updatedTabId === tabId && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      console.log(`[Bridge] Tab ${tabId} reloaded, waiting for SPA settle...`);
      // Wait 4-6 seconds for LinkedIn's heavy SPA to render and scripts to initialize
      setTimeout(callback, 5000);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
  
  // Safety timeout: if navigation fails or takes too long, remove listener
  setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(listener);
  }, 30000);
}
