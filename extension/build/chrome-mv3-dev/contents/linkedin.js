"use strict";
(() => {
  // contents/linkedin.ts
  window.__LINKEDIN_PILOT_LOADED__ = true;
  console.log("[LinkedIn Pilot] Content script linkedin.js loaded!");
  if (typeof chrome === "undefined" || !chrome.runtime) {
    console.error("[LinkedIn Pilot] CRITICAL: chrome.runtime is not available! Content script may be running in wrong world.");
  }
  var randomDelay = (min = 2e3, max = 8e3) => new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
  var voyagerBuffer = {
    search: [],
    profiles: /* @__PURE__ */ new Map(),
    comments: [],
    reactions: [],
    connections: []
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "VOYAGER_EXTRACT") return;
    const { url, data } = event.data;
    console.log(`[VoyagerBridge] Captured data from: ${url}`);
    if (url.includes("/voyager/api/graphql")) {
      handleGraphQLData(data);
    } else if (url.includes("/voyager/api/search/hits")) {
      handleSearchData(data);
    } else if (url.includes("/voyager/api/identity/dash/profiles")) {
      handleProfileData(data);
    } else if (url.includes("/voyager/api/content/comments")) {
      handleCommentsData(data);
    } else if (url.includes("/voyager/api/feed/updates")) {
      handleReactionsData(data);
    } else if (url.includes("/voyager/api/groups/memberships") || url.includes("/voyager/api/events/event/members")) {
      handleGroupEventData(data);
    } else if (url.includes("/voyager/api/relationships/dash/connections")) {
      handleConnectionsData(data);
    }
  });
  function handleConnectionsData(data) {
    const elements = data?.elements || data?.included || [];
    elements.forEach((el) => {
      if (el.$type?.includes("relationships.dash.Connection") || el.connectedMember) {
        const profile = el.connectedMember || el;
        const normalized = normalizeProfile(profile, "connection");
        if (normalized.profile_url) {
          voyagerBuffer.connections.push(normalized);
        }
      }
    });
  }
  function handleSearchData(data) {
    const elements = data?.data?.elements || data?.elements || [];
    elements.forEach((el) => {
      const hit = el.hitInfo?.["com.linkedin.voyager.dash.search.EntityResultViewModel"] || el;
      if (hit.title?.text) {
        const normalized = normalizeSearchHit(hit);
        if (normalized) {
          voyagerBuffer.search.push(normalized);
        }
      }
    });
  }
  function handleProfileData(data) {
    const included = data?.included || [];
    const profile = included.find((i) => i.$type?.includes("identity.dash.Profile"));
    if (profile) {
      const publicId = profile.publicIdentifier;
      voyagerBuffer.profiles.set(publicId, profile);
    }
  }
  function handleCommentsData(data) {
    const elements = data?.elements || [];
    elements.forEach((el) => {
      const commenter = el.commenter?.["com.linkedin.voyager.dash.identity.profile.Profile"] || el.commenter;
      if (commenter) {
        voyagerBuffer.comments.push(normalizeCommenter(el));
      }
    });
  }
  function handleReactionsData(data) {
    const included = data?.included || [];
    included.forEach((i) => {
      if (i.$type?.includes("identity.dash.Profile") || i.$type?.includes("identity.profile.Profile")) {
        voyagerBuffer.reactions.push(normalizeProfile(i, "reaction"));
      }
    });
  }
  function handleGroupEventData(data) {
    const included = data?.included || [];
    included.forEach((i) => {
      if (i.$type?.includes("identity.dash.Profile") || i.$type?.includes("identity.profile.Profile")) {
        const normalized = normalizeProfile(i, "member");
        if (normalized.profile_url) {
          voyagerBuffer.profiles.set(i.publicIdentifier || i.vanityName, normalized);
        }
      }
    });
  }
  function cleanProfileUrl(url) {
    if (!url) return "";
    const cleaned = url.split("?")[0].split("#")[0].replace(/\/$/, "");
    return cleaned.includes("/in/") ? cleaned : "";
  }
  async function pollBuffer(key, timeoutMs = 5e3) {
    const start = Date.now();
    let lastCount = 0;
    let stableFor = 0;
    while (Date.now() - start < timeoutMs) {
      const current = voyagerBuffer[key].length;
      if (current > 0 && current === lastCount) {
        stableFor += 300;
        if (stableFor >= 600) break;
      } else {
        stableFor = 0;
        lastCount = current;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    const result = [...voyagerBuffer[key]];
    voyagerBuffer[key] = [];
    return result;
  }
  function normalizeCommenter(comment) {
    const profile = comment.commenter?.["com.linkedin.voyager.dash.identity.profile.Profile"] || {};
    const firstName = profile.firstName || "";
    const lastName = profile.lastName || "";
    const publicId = profile.publicIdentifier || "";
    return {
      full_name: `${firstName} ${lastName}`.trim(),
      profile_url: cleanProfileUrl(publicId ? `https://www.linkedin.com/in/${publicId}` : ""),
      headline: profile.headline || "Commenter",
      avatar_url: extractAvatar(profile),
      location: profile.locationName || profile.geoLocation?.geo?.defaultLocalizedName || "",
      member_id: publicId || "",
      source: "api-comments"
    };
  }
  function normalizeProfile(profile, source) {
    const firstName = profile.firstName || "";
    const lastName = profile.lastName || "";
    const publicId = profile.publicIdentifier || profile.vanityName || "";
    return {
      full_name: `${firstName} ${lastName}`.trim(),
      profile_url: cleanProfileUrl(publicId ? `https://www.linkedin.com/in/${publicId}` : ""),
      headline: profile.headline || source,
      avatar_url: extractAvatar(profile),
      location: profile.locationName || profile.geoLocation?.geo?.defaultLocalizedName || "",
      member_id: publicId || profile.entityUrn?.split(":").pop() || "",
      industry: profile.industry || "",
      source: `api-${source}`
    };
  }
  function extractAvatar(profile) {
    const pic = profile.profilePicture?.displayImageReference?.vectorImage || profile.picture;
    if (pic?.rootUrl && pic?.artifacts?.length) {
      return `${pic.rootUrl}${pic.artifacts[pic.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
    }
    return "";
  }
  function handleGraphQLData(data) {
    const dataArray = Array.isArray(data) ? data : [data];
    dataArray.forEach((payload) => {
      const searchCluster = payload?.data?.searchDashClustersByAll;
      const profile = payload?.data?.identityDashProfileByPublicIdentifier;
      const comments = payload?.data?.commentDashCommentsByPost;
      if (searchCluster) {
        console.log("[VoyagerBridge] Detected GraphQL Search Cluster");
        const elements = searchCluster.elements || [];
        elements.forEach((cluster) => {
          const items = cluster.items || [];
          items.forEach((item) => {
            const entityResult = item.item?.entityResult || item.entityResult;
            if (entityResult) {
              const normalized = normalizeGraphQLSearchHit(entityResult);
              if (normalized) {
                if (!voyagerBuffer.search.some((s) => s.profile_url === normalized.profile_url)) {
                  voyagerBuffer.search.push(normalized);
                }
              }
            }
          });
        });
      }
      if (profile) {
        console.log("[VoyagerBridge] Detected GraphQL Profile");
        const publicId = profile.publicIdentifier;
        if (publicId) voyagerBuffer.profiles.set(publicId, profile);
      }
    });
  }
  function normalizeGraphQLSearchHit(hit) {
    try {
      const titleText = hit.title?.text || "LinkedIn Member";
      const headline = hit.primarySubtitle?.text || hit.summary?.text || "";
      const profileUrl = hit.navigationContext?.url?.split("?")[0] || "";
      if (!profileUrl || !profileUrl.includes("/in/")) return null;
      let avatarUrl = "";
      const pic = hit.image?.attributes?.[0]?.detailData?.["com.linkedin.voyager.dash.common.image.NonEntityProfileAvatar"]?.vectorImage || hit.image?.attributes?.[0]?.detailData?.["com.linkedin.voyager.dash.common.image.ProfileTokenAvatar"]?.vectorImage;
      if (pic?.rootUrl && pic?.artifacts?.length) {
        avatarUrl = `${pic.rootUrl}${pic.artifacts[pic.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
      }
      return {
        full_name: titleText,
        profile_url: cleanProfileUrl(profileUrl),
        headline,
        avatar_url: avatarUrl,
        location: hit.secondarySubtitle?.text || "",
        member_id: hit.targetUrn?.split(":").pop() || hit.trackingUrn?.split(":").pop() || "",
        source: "api-graphql-search"
      };
    } catch (err) {
      console.error("[VoyagerBridge] Error normalizing GraphQL hit:", err);
      return null;
    }
  }
  function normalizeSearchHit(hit) {
    try {
      const titleText = hit.title?.text || hit.title?.toString() || "LinkedIn Member";
      const headline = hit.primarySubtitle?.text || hit.subline?.text || "";
      const profileUrl = hit.navigationContext?.url || "";
      if (!profileUrl || !profileUrl.includes("/in/")) {
        console.warn("[VoyagerBridge] Skipping non-profile candidate:", titleText);
        return null;
      }
      const memberId = profileUrl.split("/in/")[1]?.split("/")[0] || "";
      let avatarUrl = "";
      const imageAttributes = hit.image?.attributes || [];
      const pic = imageAttributes[0]?.detailData?.["com.linkedin.voyager.dash.common.image.NonEntityProfileAvatar"]?.vectorImage;
      if (pic?.rootUrl && pic?.artifacts?.length) {
        avatarUrl = `${pic.rootUrl}${pic.artifacts[pic.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
      }
      return {
        full_name: titleText,
        profile_url: cleanProfileUrl(profileUrl),
        headline,
        avatar_url: avatarUrl,
        location: hit.secondarySubtitle?.text || hit.subline?.text || "",
        member_id: hit.targetUrn?.split(":").pop() || hit.trackingUrn?.split(":").pop() || memberId || "",
        source: "api-search"
      };
    } catch (err) {
      console.error("[VoyagerBridge] Error normalizing search hit:", err);
      return null;
    }
  }
  var waitForElement = async (selector, timeout = 1e4) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await randomDelay(500, 1e3);
    }
    return null;
  };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[linkedin.js] Received message:", message.type, message.action);
    let responded = false;
    const safeSendResponse = (response) => {
      if (!responded) {
        responded = true;
        try {
          sendResponse(response);
        } catch (e) {
          console.error("[linkedin.js] Failed to send response:", e);
        }
      }
    };
    if (message.type === "PING") {
      safeSendResponse({ success: true, version: "1.0.0" });
      return true;
    }
    if (message.type === "EXECUTE_ACTION") {
      console.log("[linkedin.js] Executing action:", message.action);
      const timeoutId = setTimeout(() => {
        safeSendResponse({ success: false, error: "Action timed out after 30 seconds" });
      }, 3e4);
      try {
        handleAction(message.action, message.payload).then((result) => {
          clearTimeout(timeoutId);
          console.log("[linkedin.js] Action result:", result);
          safeSendResponse(result);
        }).catch((err) => {
          clearTimeout(timeoutId);
          console.error("[linkedin.js] Action error:", err);
          safeSendResponse({ success: false, error: err.message || "Unknown error" });
        });
      } catch (syncErr) {
        clearTimeout(timeoutId);
        console.error("[linkedin.js] Synchronous error:", syncErr);
        safeSendResponse({ success: false, error: syncErr.message || "Synchronous error" });
      }
      return true;
    }
    safeSendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    return true;
  });
  async function handleAction(action, payload) {
    console.log(`[handleAction] Processing: ${action}`, payload);
    try {
      switch (action) {
        case "scrapeLeads":
          return await scrapeLeads(payload);
        case "viewProfile":
          return await viewProfile(payload.url);
        case "connect":
        case "sendConnectionRequest":
          return await sendConnectionRequest(payload.profile_url || payload.url, payload.message || payload.note);
        case "sendMessage":
          return await sendMessageViaAPI(payload.threadId || payload.url, payload.message);
        case "FETCH_CONVERSATIONS":
          return await fetchConversationsViaAPI();
        case "SYNC_INBOX":
          return await fetchConversationsViaAPI();
        case "getProfileInfo":
          return await getProfileInfo();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (err) {
      console.error(`[handleAction] CRITICAL ERROR during ${action}:`, err);
      return { success: false, error: err.message || "Unknown error during action execution" };
    }
  }
  async function fetchProfileViaAPI() {
    const csrfToken = getCsrfToken();
    console.log("[Voyager] Fetching profile via API, csrf:", csrfToken ? "found" : "missing");
    const commonHeaders = {
      "accept": "application/vnd.linkedin.normalized+json+2.1",
      "csrf-token": csrfToken,
      "x-li-lang": "en_US",
      "x-restli-protocol-version": "2.0.0"
    };
    const endpoints = [
      { url: "/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=me", label: "dash/profiles" },
      { url: "/voyager/api/identity/profiles/me", label: "identity/profiles/me" },
      { url: "/voyager/api/me", label: "/me (legacy)" }
    ];
    for (const ep of endpoints) {
      try {
        console.log(`[Voyager] Trying ${ep.label}...`);
        const resp = await fetch(ep.url, {
          headers: commonHeaders,
          credentials: "include"
        });
        if (!resp.ok) {
          console.warn(`[Voyager] ${ep.label} returned ${resp.status}`);
          continue;
        }
        const data = await resp.json();
        const included = data.included || [];
        const all = [...included, ...data.elements || []];
        if (all.length === 0 && data.data) all.push(data.data);
        const types = all.map((i) => i.$type).filter(Boolean);
        console.log(`[Voyager] ${ep.label} types:`, [...new Set(types)]);
        const profile = all.find((i) => {
          const t = i.$type || "";
          return t.includes("MiniProfile") || t.includes("identity.profile.Profile") || t.includes("identity.dash.Profile") || t.includes("voyager.identity.me.Card") || i.firstName && i.lastName && i.publicIdentifier;
        });
        if (!profile) {
          console.warn(`[Voyager] No profile entity in ${ep.label} response`);
          continue;
        }
        const firstName = typeof profile.firstName === "string" ? profile.firstName : profile.firstName?.localized?.[Object.keys(profile.firstName?.localized || {})[0]] || "";
        const lastName = typeof profile.lastName === "string" ? profile.lastName : profile.lastName?.localized?.[Object.keys(profile.lastName?.localized || {})[0]] || "";
        const fullName = `${firstName} ${lastName}`.trim();
        const publicId = profile.publicIdentifier || profile.vanityName || "";
        if (!fullName) continue;
        let avatarUrl = "";
        const pic = profile.picture || profile.profilePicture?.displayImageReference?.vectorImage;
        if (pic?.rootUrl && pic?.artifacts?.length) {
          avatarUrl = `${pic.rootUrl}${pic.artifacts[pic.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
        } else {
          const photoElements = profile.profilePicture?.["displayImage~"]?.elements;
          if (photoElements?.length) {
            avatarUrl = photoElements[photoElements.length - 1]?.identifiers?.[0]?.identifier || "";
          }
        }
        if (!avatarUrl) {
          const vecImg = all.find(
            (i) => (i.$type || "").includes("VectorImage") || (i.$type || "").includes("Photo")
          );
          if (vecImg?.rootUrl && vecImg?.artifacts?.length) {
            avatarUrl = `${vecImg.rootUrl}${vecImg.artifacts[vecImg.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
          }
        }
        console.log(`[Voyager] Extracted via ${ep.label}:`, { fullName, publicId, hasAvatar: !!avatarUrl });
        return {
          success: true,
          full_name: fullName || "LinkedIn User",
          avatar_url: avatarUrl,
          profile_url: publicId ? `https://www.linkedin.com/in/${publicId}` : "",
          member_id: publicId || "me"
        };
      } catch (err) {
        console.warn(`[Voyager] ${ep.label} error:`, err);
      }
    }
    console.error("[Voyager] All endpoints failed");
    return null;
  }
  async function getProfileInfo() {
    console.log("[getProfileInfo] Starting profile extraction...");
    const apiResult = await fetchProfileViaAPI();
    if (apiResult?.success && apiResult.member_id !== "me") {
      console.log("[getProfileInfo] Got profile from Voyager API");
      return apiResult;
    }
    console.log("[getProfileInfo] API failed, trying DOM scraping...");
    for (let i = 0; i < 3; i++) {
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd.textContent || "{}");
          if (data.name || data["@type"] === "Person" && data.name) {
            console.log("[getProfileInfo] Found info in JSON-LD");
            return {
              success: true,
              full_name: data.name || "LinkedIn User",
              avatar_url: data.image?.contentUrl || data.image || "",
              profile_url: data.url || window.location.href.split("?")[0],
              member_id: (data.url || window.location.href).split("/in/")[1]?.split("/")[0] || "me"
            };
          }
        } catch (e) {
        }
      }
      const nameSelectors = [
        ".text-heading-xlarge",
        "h1.text-heading-xlarge",
        ".global-nav__me-active-status + span",
        ".t-16.t-black.t-bold",
        ".pv-top-card-before-expanded__name"
      ];
      const avatarSelectors = [
        ".global-nav__me-photo",
        ".pv-top-card-profile-picture__image",
        "img.profile-photo-edit__preview",
        'img[alt*="photo"]'
      ];
      let name = "";
      for (const sel of nameSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          name = el.textContent.trim();
          break;
        }
      }
      let avatar = "";
      for (const sel of avatarSelectors) {
        const el = document.querySelector(sel);
        if (el?.src && !el.src.includes("data:")) {
          avatar = el.src;
          break;
        }
      }
      const profileLink = document.querySelector('.global-nav__me-link, a[href*="/in/"]');
      const profileUrl = profileLink?.href?.split("?")[0] || window.location.href.split("?")[0];
      if (profileUrl.includes("/in/") || name) {
        console.log("[getProfileInfo] Found info in DOM:", { name, hasAvatar: !!avatar });
        return {
          success: true,
          full_name: name || "LinkedIn User",
          avatar_url: avatar || "",
          profile_url: profileUrl,
          member_id: profileUrl.split("/in/")[1]?.split("/")[0] || "me"
        };
      }
      await randomDelay(1e3, 2e3);
    }
    if (apiResult?.success) return apiResult;
    return {
      success: true,
      full_name: "LinkedIn User",
      avatar_url: "",
      profile_url: window.location.href.split("?")[0],
      member_id: "me"
    };
  }
  async function autoScroll(containerSelector, maxScrolls = 10) {
    console.log("[AutoScroll] Starting scroll sequence...");
    const container = containerSelector ? document.querySelector(containerSelector) : window;
    const scrollTarget = containerSelector ? container : document.documentElement;
    for (let i = 0; i < maxScrolls; i++) {
      const startHeight = scrollTarget.scrollHeight;
      if (container === window) {
        window.scrollTo(0, document.body.scrollHeight);
      } else {
        container.scrollTop = container.scrollHeight;
      }
      await randomDelay(1e3, 2e3);
      if (scrollTarget.scrollHeight === startHeight) break;
    }
  }
  function enrichLead(lead) {
    const raw = (lead.headline || "").trim();
    const headline = raw.replace(/\s*[•·]\s*(1st|2nd|3rd|\d+th)\s*$/i, "").trim();
    const separators = [" at ", " @ ", " | ", " \u2022 ", " \xB7 ", " - ", " \u2014 "];
    for (const sep of separators) {
      if (headline.includes(sep)) {
        const idx = headline.indexOf(sep);
        return {
          ...lead,
          headline: raw,
          title: headline.slice(0, idx).trim(),
          company: headline.slice(idx + sep.length).trim()
        };
      }
    }
    return { ...lead, headline: raw, title: headline, company: lead.company || "" };
  }
  async function scrapeLeads(payload) {
    const type = payload?.extractionType || "search";
    console.log(`[Scraper] Starting ${type} extraction...`);
    let result;
    switch (type) {
      case "comments":
      case "engagement":
        result = await scrapeComments();
        break;
      case "reactions":
        result = await scrapeReactions();
        break;
      case "groups":
        result = await scrapeGroupMembers();
        break;
      case "events":
        result = await scrapeEventAttendees();
        break;
      case "network":
        result = await scrapeNetwork();
        break;
      case "nav-search":
      case "nav-saved":
      case "nav-list":
      case "search":
      default:
        result = await scrapeSearchResults(payload);
        break;
    }
    if (result?.success && result?.leads) {
      result.leads = result.leads.map(enrichLead);
    }
    return result;
  }
  async function scrapeSearchResults(payload) {
    if (window.self !== window.top) {
      console.log("[Scraper] Skipping - running in iframe:", window.location.href);
      return { success: false, error: "Cannot scrape from iframe" };
    }
    if (window.location.href.includes("/mynetwork/invite-connect/connections/")) {
      console.log("[Scraper] On connections page, delegating to scrapeNetwork");
      return await scrapeNetwork();
    }
    const targetUrl = payload?.url;
    if (targetUrl && !window.location.href.includes(targetUrl.split("?")[0])) {
      console.log("[Search] Navigating to target URL:", targetUrl);
      window.location.href = targetUrl;
      return { success: true, pending: true, status: "navigating" };
    }
    await randomDelay(500, 1e3);
    const currentUrl = window.location.href;
    const isLinkedIn = currentUrl.includes("linkedin.com");
    const hasSearchResults = !!document.querySelector(
      '.reusable-search__result-container, .entity-result, .search-results-container, div[data-view-name="search-result-entity"], .search-results__list, .artdeco-list, [class*="search-result"]'
    );
    const hasPeopleResults = !!document.querySelector('a[href*="/in/"]');
    console.log("[Scraper] Validation - URL:", window.location.pathname, "isLinkedIn:", isLinkedIn, "hasResults:", hasSearchResults, "hasPeople:", hasPeopleResults);
    if (!isLinkedIn) {
      console.warn("[Scraper] Not on LinkedIn. URL:", currentUrl);
      return { success: false, error: `Please go to LinkedIn first. Current page: ${window.location.pathname}` };
    }
    if (!hasSearchResults && !hasPeopleResults) {
      const fallbackUrl = "https://www.linkedin.com/mynetwork/invite-connect/connections/";
      console.log("[Scraper] No results detected on current page. Auto-navigating to:", fallbackUrl);
      window.location.href = fallbackUrl;
      return { success: true, pending: true, status: "navigating", message: "Navigating to connections page..." };
    }
    await autoScroll(void 0, 5);
    let leads = await pollBuffer("search", 5e3);
    if (leads.length === 0) {
      console.log("[Scraper] Using link-based container discovery");
      const allProfileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      console.log(`[Scraper] Found ${allProfileLinks.length} profile links total`);
      const containerMap = /* @__PURE__ */ new Map();
      for (const link of allProfileLinks) {
        const href = link.href || "";
        if (href.includes("/company/") || href.includes("/jobs/") || href.includes("/school/")) {
          continue;
        }
        let isMutualConnection = false;
        let parent = link.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
          const text = parent.textContent?.toLowerCase() || "";
          if (text.includes("is a mutual connection") || text.includes("mutual connections") || parent.classList.contains("reusable-search-simple-insight__text") || parent.classList.contains("reusable-search-simple-insight")) {
            isMutualConnection = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (isMutualConnection) {
          console.log("[Scraper DEBUG] Skipping mutual connection link");
          continue;
        }
        let container = link;
        for (let i = 0; i < 6 && container; i++) {
          if (container.tagName === "LI" || container.getAttribute("data-view-name")?.includes("search-result") || container.classList.contains("entity-result") || container.classList.contains("reusable-search__result-container") || container.getAttribute("data-chameleon-result-urn")) {
            break;
          }
          container = container.parentElement;
        }
        if (container && container !== link) {
          if (!containerMap.has(container)) {
            containerMap.set(container, []);
          }
          containerMap.get(container).push(link);
        }
      }
      console.log(`[Scraper] Grouped into ${containerMap.size} unique containers`);
      let index = 0;
      for (const [container, links] of containerMap) {
        try {
          const titleLink = links[0];
          if (!titleLink?.href) continue;
          const href = titleLink.href;
          if (href.includes("/company/") || href.includes("/jobs/")) {
            console.log(`[Scraper DEBUG] Container ${index}: Skipping non-person link`);
            continue;
          }
          let nameText = "";
          const ariaSpan = titleLink.querySelector('span[aria-hidden="true"]');
          if (ariaSpan?.textContent) {
            const txt = ariaSpan.textContent.trim();
            if (txt && !txt.match(/Status is/i) && !txt.match(/Provides services/i)) {
              nameText = txt;
            }
          }
          if (!nameText) {
            const walker = document.createTreeWalker(titleLink, NodeFilter.SHOW_TEXT, null);
            let node;
            while (node = walker.nextNode()) {
              const txt = node.textContent?.trim();
              if (txt && !txt.match(/Status is/i) && !txt.match(/Provides services/i) && !txt.match(/^View/i) && !txt.match(/^[•·]/) && txt.length > 1) {
                nameText = txt;
                break;
              }
            }
          }
          if (!nameText && titleLink.innerText) {
            nameText = titleLink.innerText.replace(/Status is.*$/gmi, "").replace(/Provides services.*$/gmi, "").replace(/View.*profile/gi, "").replace(/[•·]\s*\d+/g, "").replace(/[\n\s]+/g, " ").trim().split(" ").slice(0, 3).join(" ");
          }
          if (!nameText || nameText === "LinkedIn Member") {
            console.log(`[Scraper DEBUG] Container ${index}: No valid name, skipping`);
            index++;
            continue;
          }
          const profileUrl = href.split("?")[0];
          let headlineText = "";
          const subtitleEl = container.querySelector(
            'div[data-view-name="search-result-subtitle"], [data-view-name="search-result-entity-sublabel"], .entity-result__primary-subtitle, div.t-14.t-black'
            // Common LinkedIn headline style
          );
          if (subtitleEl) {
            headlineText = subtitleEl.textContent?.trim() || "";
          }
          let locationText = "";
          const locationEl = container.querySelector(
            "div.t-14.t-normal:not(.t-black)"
            // Location is t-normal without t-black
          );
          if (locationEl) {
            const text = locationEl.textContent?.trim() || "";
            if (text && !text.includes("mutual") && !text.includes("connection")) {
              locationText = text;
            }
          }
          let servicesText = "";
          const servicesStrong = container.querySelector("strong");
          if (servicesStrong?.textContent?.includes("Provides services")) {
            servicesText = servicesStrong.textContent.trim();
          }
          if (!servicesText) {
            const allElements = container.querySelectorAll("*");
            for (const el of Array.from(allElements)) {
              const text = el.textContent?.trim() || "";
              if (text.startsWith("Provides services")) {
                servicesText = text;
                break;
              }
            }
          }
          let avatarUrl = "";
          const allImages = Array.from(container.querySelectorAll("img"));
          for (const img of allImages) {
            const src = img.src || "";
            if (src.includes("licdn.com") && (src.includes("profile-displayphoto") || src.includes("/dms/image"))) {
              avatarUrl = src;
              break;
            }
          }
          if (!avatarUrl) {
            const parent = container.parentElement;
            if (parent) {
              const siblingImgs = Array.from(parent.querySelectorAll("img"));
              for (const img of siblingImgs) {
                const src = img.src || "";
                if (src.includes("profile-displayphoto") || src.includes("/dms/image")) {
                  avatarUrl = src;
                  break;
                }
              }
            }
          }
          leads.push({
            full_name: nameText,
            profile_url: profileUrl,
            headline: headlineText,
            location: locationText,
            services: servicesText,
            avatar_url: avatarUrl,
            source: "lead-extractor"
          });
          console.log(`[Scraper] Extracted lead ${index}: ${nameText}`);
          index++;
        } catch (err) {
          console.warn(`[Scraper] Failed to parse container ${index}:`, err);
          index++;
        }
      }
    } else {
      console.log(`[Search] Success! Using ${leads.length} leads from API buffer`);
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    console.log(`[Search] Final extraction count: ${uniqueLeads.length}`);
    console.log(`[Search] Raw leads before dedup: ${leads.length}`);
    if (uniqueLeads.length === 0) {
      console.log("[Search] DEBUG: Checking page structure...");
      console.log("[Search] DEBUG: document.querySelector('li.reusable-search__result-container')", document.querySelector("li.reusable-search__result-container"));
      console.log("[Search] DEBUG: document.querySelector('[data-view-name=search-entity-result-universal-template]')", document.querySelector('div[data-view-name="search-entity-result-universal-template"]'));
      console.log("[Search] DEBUG: All a[href*='/in/'] links:", document.querySelectorAll('a[href*="/in/"]').length);
      console.log("[Search] DEBUG: Current URL:", window.location.href);
      console.log("[Search] DEBUG: document.body.innerHTML sample:", document.body.innerHTML.substring(0, 500));
    }
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function scrapeComments() {
    console.log("[Comments] Scoping comments section...");
    const showMoreBtn = document.querySelector("button.comments-comments-list__load-more-comments-button");
    if (showMoreBtn) {
      showMoreBtn.click();
      await randomDelay(2e3, 3e3);
    }
    let leads = [...voyagerBuffer.comments];
    voyagerBuffer.comments = [];
    if (leads.length === 0) {
      console.log("[Comments] Buffer empty, using DOM fallback");
      const commentItems = document.querySelectorAll(".comments-comment-item, .comments-post-meta__name");
      for (const item of Array.from(commentItems)) {
        const link = item.querySelector('a[href*="/in/"]') || (item.tagName === "A" ? item : null);
        if (!link) continue;
        const href = link.href.split("?")[0];
        const name = link.innerText.split("\n")[0].trim();
        if (name && href.includes("/in/") && name !== "LinkedIn Member") {
          leads.push({
            full_name: name,
            profile_url: href,
            headline: "Commenter",
            source: "comments-dom"
          });
        }
      }
    } else {
      console.log(`[Comments] Success! Extracted ${leads.length} leads from API buffer`);
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function scrapeReactions() {
    console.log("[Reactions] Scoping reactions modal...");
    const modal = await waitForElement(".social-details-reactors-modal__content, .artdeco-modal__content");
    if (!modal) {
      return { success: false, error: "Please open the reactions list (click on the reaction icons) before extracting." };
    }
    await autoScroll(".social-details-reactors-modal__content, .artdeco-modal__content", 5);
    let leads = [...voyagerBuffer.reactions];
    voyagerBuffer.reactions = [];
    if (leads.length === 0) {
      console.log("[Reactions] Buffer empty, using DOM fallback");
      const reactorItems = document.querySelectorAll(".social-details-reactors-modal__item, .artdeco-modal__content li");
      for (const item of Array.from(reactorItems)) {
        const link = item.querySelector('a[href*="/in/"]');
        if (!link) continue;
        const href = link.href.split("?")[0];
        const nameEl = item.querySelector(".artdeco-entity-lockup__title, .artdeco-entity-lockup__name");
        const headlineEl = item.querySelector(".artdeco-entity-lockup__subtitle, .artdeco-entity-lockup__caption");
        const name = nameEl?.textContent?.trim() || "";
        if (name && href.includes("/in/") && name !== "LinkedIn Member") {
          leads.push({
            full_name: name,
            profile_url: href,
            headline: headlineEl?.textContent?.trim() || "Reactor",
            source: "reactions-dom"
          });
        }
      }
    } else {
      console.log(`[Reactions] Success! Extracted ${leads.length} leads from API buffer`);
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function scrapeGroupMembers() {
    console.log("[Groups] Scraping group members...");
    if (!window.location.href.includes("/groups/")) {
      return { success: false, error: "Please go to the Group members page first." };
    }
    await autoScroll(void 0, 5);
    const leads = [];
    const profileLinks = document.querySelectorAll(".entity-result__title-text a, .groups-members-list__item a");
    for (const link of Array.from(profileLinks)) {
      const href = link.href?.split("?")[0];
      if (!href || !href.includes("/in/")) continue;
      const publicId = href.split("/in/")[1]?.split("/")[0] || "";
      const cached = voyagerBuffer.profiles.get(publicId);
      if (cached) {
        leads.push({ ...cached, source: "api-group" });
      } else {
        const container = link.closest(".entity-result, .groups-members-list__item");
        const nameEl = container?.querySelector(".entity-result__title-text, .groups-members-list__name");
        const headlineEl = container?.querySelector(".entity-result__primary-subtitle, .groups-members-list__headline");
        const avatarEl = container?.querySelector("img");
        const name = nameEl?.textContent?.split("\n")[0]?.trim() || "";
        if (name && name !== "LinkedIn Member") {
          leads.push({
            full_name: name,
            profile_url: href,
            headline: headlineEl?.textContent?.trim() || "Group Member",
            avatar_url: avatarEl?.src || "",
            source: "group-dom"
          });
        }
      }
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function scrapeEventAttendees() {
    console.log("[Events] Scraping event attendees...");
    if (!window.location.href.includes("/events/")) {
      return { success: false, error: "Please go to the Event attendees page first." };
    }
    await autoScroll(void 0, 5);
    const leads = [];
    const profileLinks = document.querySelectorAll(".entity-result__title-text a");
    for (const link of Array.from(profileLinks)) {
      const href = link.href?.split("?")[0];
      if (!href || !href.includes("/in/")) continue;
      const publicId = href.split("/in/")[1]?.split("/")[0] || "";
      const cached = voyagerBuffer.profiles.get(publicId);
      if (cached) {
        leads.push({ ...cached, source: "api-event" });
      } else {
        const container = link.closest(".entity-result");
        const nameEl = container?.querySelector(".entity-result__title-text");
        const headlineEl = container?.querySelector(".entity-result__primary-subtitle");
        const avatarEl = container?.querySelector("img");
        const name = nameEl?.textContent?.split("\n")[0]?.trim() || "";
        if (name && name !== "LinkedIn Member") {
          leads.push({
            full_name: name,
            profile_url: href,
            headline: headlineEl?.textContent?.trim() || "Event Attendee",
            avatar_url: avatarEl?.src || "",
            source: "event-dom"
          });
        }
      }
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function scrapeNetwork() {
    if (voyagerBuffer.connections.length > 0) {
      const leads2 = [...voyagerBuffer.connections];
      voyagerBuffer.connections = [];
      const uniqueLeads2 = Array.from(new Map(leads2.map((l) => [l.profile_url, l])).values());
      return { success: true, count: uniqueLeads2.length, leads: uniqueLeads2 };
    }
    if (!window.location.href.includes("/mynetwork/invite-connect/connections/")) {
      window.location.href = "https://www.linkedin.com/mynetwork/invite-connect/connections/";
      return { success: true, pending: true, url: "https://www.linkedin.com/mynetwork/invite-connect/connections/" };
    }
    await autoScroll(void 0, 5);
    let leads = await pollBuffer("connections", 5e3);
    if (leads.length === 0) {
      console.log("[Network] Buffer empty, using DOM fallback");
      const connectionCards = document.querySelectorAll(
        '.mn-connection-card, .mn-connections__card, li[class*="connection"], .scaffold-finite-scroll__content li'
      );
      for (const card of Array.from(connectionCards)) {
        const link = card.querySelector('a[href*="/in/"]');
        if (!link) continue;
        const nameLink = card.querySelector('a[href*="/in/"]');
        const ariaNameSpan = nameLink?.querySelector('span[aria-hidden="true"]');
        const fullName = ariaNameSpan?.textContent?.trim() || card.querySelector('[class*="name"]')?.textContent?.replace(/Status is (online|offline|away|recently active)/gi, "")?.trim() || "";
        const headlineEl = card.querySelector(
          '[class*="occupation"], [class*="subtitle"], [class*="headline"], [class*="subline"]'
        );
        leads.push({
          full_name: fullName,
          profile_url: cleanProfileUrl(link.href),
          headline: headlineEl?.textContent?.trim() || "Connection",
          avatar_url: card.querySelector("img")?.src || "",
          source: "network-dom"
        });
      }
    } else {
      console.log(`[Network] Success! Extracted ${leads.length} leads from API buffer`);
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    return { success: true, count: uniqueLeads.length, leads: uniqueLeads };
  }
  async function viewProfile(url) {
    console.log("Viewing profile:", url);
    if (!window.location.href.includes(url)) {
      window.location.href = url;
    }
    await randomDelay();
    return { success: true };
  }
  async function sendConnectionRequest(url, note) {
    console.log("Sending connection request to", url);
    const publicId = url.split("/in/")[1]?.split("/")[0];
    if (publicId) {
      const apiResult = await sendConnectionRequestViaAPI(publicId, note);
      if (apiResult.success) return apiResult;
      console.warn("[Voyager] API Connection request failed, falling back to DOM");
    }
    if (!window.location.href.includes(url)) {
      window.location.href = url;
      return { success: true, pending: true, message: "Redirected to profile" };
    }
    await randomDelay(3e3, 5e3);
    const connectBtn = await waitForElement('button[aria-label^="Invite"][class*="primary-action"]') || await waitForElement('button[aria-label^="Connect"][class*="primary-action"]');
    if (!connectBtn) {
      return { success: false, error: "Connect button not found" };
    }
    connectBtn.click();
    await randomDelay(1e3, 2e3);
    if (note) {
      const addNoteBtn = await waitForElement('button[aria-label="Add a note"]');
      if (addNoteBtn) {
        addNoteBtn.click();
        await randomDelay(1e3, 2e3);
        const textarea = document.querySelector('textarea[name="message"]');
        if (textarea) {
          textarea.value = note;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await randomDelay(1e3, 2e3);
      }
    }
    const sendBtn = await waitForElement('button[aria-label="Send now"]') || await waitForElement('button[aria-label="Send"]');
    if (sendBtn) {
      sendBtn.click();
      await randomDelay(2e3, 3e3);
      return { success: true };
    }
    return { success: false, error: "Send button not found" };
  }
  function getCsrfToken() {
    return document.cookie.split("; ").find((c) => c.startsWith("JSESSIONID="))?.split("=")[1]?.replace(/"/g, "") || "";
  }
  function getVoyagerHeaders() {
    return {
      "accept": "application/vnd.linkedin.normalized+json+2.1",
      "csrf-token": getCsrfToken(),
      "x-li-lang": "en_US",
      "x-restli-protocol-version": "2.0.0"
    };
  }
  async function sendMessageViaAPI(threadId, message) {
    console.log(`[Voyager] Sending message to thread ${threadId}`);
    if (threadId.startsWith("http")) {
      console.warn("[Voyager] sendMessageViaAPI received a URL instead of threadId. Finding thread...");
      if (threadId.includes("/thread/")) {
        threadId = threadId.split("/thread/")[1].split("/")[0];
      }
    }
    try {
      const resp = await fetch(`/voyager/api/messaging/conversations/${threadId}/messages`, {
        method: "POST",
        headers: {
          ...getVoyagerHeaders(),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: {
            body: {
              text: message
            },
            renderContentPostAnchor: false
          }
        })
      });
      if (!resp.ok) {
        throw new Error(`LinkedIn API responded with ${resp.status}`);
      }
      console.log("[Voyager] Message sent successfully");
      return { success: true };
    } catch (err) {
      console.error("[Voyager] Failed to send message via API:", err);
      return { success: false, error: err.message };
    }
  }
  async function sendConnectionRequestViaAPI(publicId, note) {
    console.log(`[Voyager] Sending connection request to ${publicId}`);
    try {
      const profileResp = await fetch(`/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${publicId}`, {
        headers: getVoyagerHeaders()
      });
      if (!profileResp.ok) throw new Error("Could not fetch profile for invitation");
      const profileData = await profileResp.json();
      const profile = profileData.included?.find((i) => i.$type?.includes("identity.dash.Profile"));
      const entityUrn = profile?.entityUrn || "";
      const memberId = entityUrn.split(":").pop();
      if (!memberId) throw new Error("Could not resolve member ID for invitation");
      const payload = {
        trackingId: "",
        // Usually optional or generated
        invitations: [{
          trackingId: "",
          invitee: {
            "com.linkedin.voyager.growth.invitation.InviteeProfile": {
              profileId: `urn:li:fs_miniProfile:${memberId}`
            }
          }
        }]
      };
      if (note) {
        payload.invitations[0].message = note;
      }
      const resp = await fetch("/voyager/api/growth/normInvitations", {
        method: "POST",
        headers: {
          ...getVoyagerHeaders(),
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `LinkedIn API responded with ${resp.status}`);
      }
      console.log("[Voyager] Connection request sent successfully");
      return { success: true };
    } catch (err) {
      console.error("[Voyager] Failed to send connection request via API:", err);
      return { success: false, error: err.message };
    }
  }
  async function fetchConversationsViaAPI() {
    console.log("[Voyager] Fetching conversations...");
    try {
      const meResp = await fetch("/voyager/api/me", { headers: getVoyagerHeaders() });
      const meData = await meResp.json();
      const myUrn = meData.data?.["*miniProfile"] || meData.included?.find((i) => i.$type?.includes("MiniProfile"))?.entityUrn;
      console.log("[Voyager] My URN:", myUrn);
      const resp = await fetch("/voyager/api/messaging/conversations?count=40&q=all", {
        headers: getVoyagerHeaders()
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      const included = data.included || [];
      const conversations = data.elements || [];
      const profileMap = /* @__PURE__ */ new Map();
      included.forEach((item) => {
        if (item.$type?.includes("MiniProfile") || item.$type?.includes("identity.profile.Profile")) {
          profileMap.set(item.entityUrn, item);
        }
      });
      const normalized = conversations.map((conv) => {
        const threadId = conv.entityUrn?.split(":").pop();
        const lastMessage = conv.lastMessage;
        const participants = conv.participants || [];
        const otherParticipantUrn = participants.find((p) => {
          const urn = p["*messagingMember"] || p.messagingMember;
          return urn !== myUrn;
        });
        const profileUrn = otherParticipantUrn ? otherParticipantUrn["*messagingMember"] || otherParticipantUrn : null;
        const memberIdPart = profileUrn?.split(":").pop();
        const participantProfile = included.find(
          (i) => i.entityUrn?.endsWith(memberIdPart) && (i.$type?.includes("MiniProfile") || i.$type?.includes("Profile"))
        );
        let leadName = "LinkedIn Member";
        let leadAvatar = "";
        let profileUrl = "";
        let publicId = "";
        if (participantProfile) {
          const firstName = participantProfile.firstName || "";
          const lastName = participantProfile.lastName || "";
          leadName = `${firstName} ${lastName}`.trim() || leadName;
          publicId = participantProfile.publicIdentifier || "";
          profileUrl = publicId ? `https://www.linkedin.com/in/${publicId}` : "";
          const pic = participantProfile.picture || participantProfile.profilePicture?.displayImageReference?.vectorImage;
          if (pic?.rootUrl && pic?.artifacts?.length) {
            leadAvatar = `${pic.rootUrl}${pic.artifacts[pic.artifacts.length - 1].fileIdentifyingUrlPathSegment}`;
          }
        }
        return {
          thread_id: threadId,
          lead_name: leadName,
          lead_avatar: leadAvatar,
          profile_url: profileUrl,
          public_id: publicId,
          last_message: lastMessage?.eventContent?.["com.linkedin.voyager.messaging.event.MessageEvent"]?.body,
          unread_count: conv.unreadCount,
          updated_at: conv.lastActivityAt
          // raw: conv // Avoid sending too much data over message bridge
        };
      });
      console.log(`[Voyager] Fetched ${normalized.length} conversations with metadata`);
      return { success: true, conversations: normalized };
    } catch (err) {
      console.error("[Voyager] Failed to fetch conversations:", err);
      return { success: false, error: err.message };
    }
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vY29udGVudHMvbGlua2VkaW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEdsb2JhbCBmbGFnIHRvIGhlbHAgYmFja2dyb3VuZCBzY3JpcHQgZGV0ZWN0IGlmIHRoZSBzY3JpcHQgaXMgbG9hZGVkXHJcbih3aW5kb3cgYXMgYW55KS5fX0xJTktFRElOX1BJTE9UX0xPQURFRF9fID0gdHJ1ZTtcclxuY29uc29sZS5sb2coXCJbTGlua2VkSW4gUGlsb3RdIENvbnRlbnQgc2NyaXB0IGxpbmtlZGluLmpzIGxvYWRlZCFcIik7XHJcblxyXG4vLyBDaGVjayBpZiBjaHJvbWUucnVudGltZSBpcyBhdmFpbGFibGUgKHNob3VsZCBiZSBpbiBJU09MQVRFRCB3b3JsZClcclxuaWYgKHR5cGVvZiBjaHJvbWUgPT09ICd1bmRlZmluZWQnIHx8ICFjaHJvbWUucnVudGltZSkge1xyXG4gIGNvbnNvbGUuZXJyb3IoXCJbTGlua2VkSW4gUGlsb3RdIENSSVRJQ0FMOiBjaHJvbWUucnVudGltZSBpcyBub3QgYXZhaWxhYmxlISBDb250ZW50IHNjcmlwdCBtYXkgYmUgcnVubmluZyBpbiB3cm9uZyB3b3JsZC5cIik7XHJcbn1cclxuXHJcbmNvbnN0IHJhbmRvbURlbGF5ID0gKG1pbiA9IDIwMDAsIG1heCA9IDgwMDApID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW4pKVxyXG5cclxuLy8gRGF0YSBCdWZmZXIgdG8gc3RvcmUgaW50ZXJjZXB0ZWQgVm95YWdlciBBUEkgcmVzcG9uc2VzXHJcbmNvbnN0IHZveWFnZXJCdWZmZXI6IHtcclxuICBzZWFyY2g6IGFueVtdO1xyXG4gIHByb2ZpbGVzOiBNYXA8c3RyaW5nLCBhbnk+O1xyXG4gIGNvbW1lbnRzOiBhbnlbXTtcclxuICByZWFjdGlvbnM6IGFueVtdO1xyXG4gIGNvbm5lY3Rpb25zOiBhbnlbXTtcclxufSA9IHtcclxuICBzZWFyY2g6IFtdLFxyXG4gIHByb2ZpbGVzOiBuZXcgTWFwKCksXHJcbiAgY29tbWVudHM6IFtdLFxyXG4gIHJlYWN0aW9uczogW10sXHJcbiAgY29ubmVjdGlvbnM6IFtdXHJcbn07XHJcblxyXG4vLyBMaXN0ZW4gZm9yIG1lc3NhZ2VzIGZyb20gdGhlIE1BSU4gd29ybGQgaW50ZXJjZXB0b3Jcclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChldmVudCkgPT4ge1xyXG4gIGlmIChldmVudC5zb3VyY2UgIT09IHdpbmRvdyB8fCBldmVudC5kYXRhPy50eXBlICE9PSBcIlZPWUFHRVJfRVhUUkFDVFwiKSByZXR1cm47XHJcbiAgXHJcbiAgY29uc3QgeyB1cmwsIGRhdGEgfSA9IGV2ZW50LmRhdGE7XHJcbiAgY29uc29sZS5sb2coYFtWb3lhZ2VyQnJpZGdlXSBDYXB0dXJlZCBkYXRhIGZyb206ICR7dXJsfWApO1xyXG4gIFxyXG4gIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZ3JhcGhxbFwiKSkge1xyXG4gICAgaGFuZGxlR3JhcGhRTERhdGEoZGF0YSk7XHJcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvc2VhcmNoL2hpdHNcIikpIHtcclxuICAgIGhhbmRsZVNlYXJjaERhdGEoZGF0YSk7XHJcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvaWRlbnRpdHkvZGFzaC9wcm9maWxlc1wiKSkge1xyXG4gICAgaGFuZGxlUHJvZmlsZURhdGEoZGF0YSk7XHJcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvY29udGVudC9jb21tZW50c1wiKSkge1xyXG4gICAgaGFuZGxlQ29tbWVudHNEYXRhKGRhdGEpO1xyXG4gIH0gZWxzZSBpZiAodXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2ZlZWQvdXBkYXRlc1wiKSkge1xyXG4gICAgaGFuZGxlUmVhY3Rpb25zRGF0YShkYXRhKTtcclxuICB9IGVsc2UgaWYgKHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9ncm91cHMvbWVtYmVyc2hpcHNcIikgfHwgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2V2ZW50cy9ldmVudC9tZW1iZXJzXCIpKSB7XHJcbiAgICBoYW5kbGVHcm91cEV2ZW50RGF0YShkYXRhKTtcclxuICB9IGVsc2UgaWYgKHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9yZWxhdGlvbnNoaXBzL2Rhc2gvY29ubmVjdGlvbnNcIikpIHtcclxuICAgIGhhbmRsZUNvbm5lY3Rpb25zRGF0YShkYXRhKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gaGFuZGxlQ29ubmVjdGlvbnNEYXRhKGRhdGE6IGFueSkge1xyXG4gIGNvbnN0IGVsZW1lbnRzID0gZGF0YT8uZWxlbWVudHMgfHwgZGF0YT8uaW5jbHVkZWQgfHwgW107XHJcbiAgZWxlbWVudHMuZm9yRWFjaCgoZWw6IGFueSkgPT4ge1xyXG4gICAgaWYgKGVsLiR0eXBlPy5pbmNsdWRlcyhcInJlbGF0aW9uc2hpcHMuZGFzaC5Db25uZWN0aW9uXCIpIHx8IGVsLmNvbm5lY3RlZE1lbWJlcikge1xyXG4gICAgICBjb25zdCBwcm9maWxlID0gZWwuY29ubmVjdGVkTWVtYmVyIHx8IGVsO1xyXG4gICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUHJvZmlsZShwcm9maWxlLCBcImNvbm5lY3Rpb25cIik7XHJcbiAgICAgIGlmIChub3JtYWxpemVkLnByb2ZpbGVfdXJsKSB7XHJcbiAgICAgICAgdm95YWdlckJ1ZmZlci5jb25uZWN0aW9ucy5wdXNoKG5vcm1hbGl6ZWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZVNlYXJjaERhdGEoZGF0YTogYW55KSB7XHJcbiAgY29uc3QgZWxlbWVudHMgPSBkYXRhPy5kYXRhPy5lbGVtZW50cyB8fCBkYXRhPy5lbGVtZW50cyB8fCBbXTtcclxuICBlbGVtZW50cy5mb3JFYWNoKChlbDogYW55KSA9PiB7XHJcbiAgICBjb25zdCBoaXQgPSBlbC5oaXRJbmZvPy5bXCJjb20ubGlua2VkaW4udm95YWdlci5kYXNoLnNlYXJjaC5FbnRpdHlSZXN1bHRWaWV3TW9kZWxcIl0gfHwgZWw7XHJcbiAgICBpZiAoaGl0LnRpdGxlPy50ZXh0KSB7XHJcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVTZWFyY2hIaXQoaGl0KTtcclxuICAgICAgaWYgKG5vcm1hbGl6ZWQpIHtcclxuICAgICAgICB2b3lhZ2VyQnVmZmVyLnNlYXJjaC5wdXNoKG5vcm1hbGl6ZWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZVByb2ZpbGVEYXRhKGRhdGE6IGFueSkge1xyXG4gICAgY29uc3QgaW5jbHVkZWQgPSBkYXRhPy5pbmNsdWRlZCB8fCBbXTtcclxuICAgIGNvbnN0IHByb2ZpbGUgPSBpbmNsdWRlZC5maW5kKChpOiBhbnkpID0+IGkuJHR5cGU/LmluY2x1ZGVzKFwiaWRlbnRpdHkuZGFzaC5Qcm9maWxlXCIpKTtcclxuICAgIGlmIChwcm9maWxlKSB7XHJcbiAgICAgICAgY29uc3QgcHVibGljSWQgPSBwcm9maWxlLnB1YmxpY0lkZW50aWZpZXI7XHJcbiAgICAgICAgdm95YWdlckJ1ZmZlci5wcm9maWxlcy5zZXQocHVibGljSWQsIHByb2ZpbGUpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBoYW5kbGVDb21tZW50c0RhdGEoZGF0YTogYW55KSB7XHJcbiAgICBjb25zdCBlbGVtZW50cyA9IGRhdGE/LmVsZW1lbnRzIHx8IFtdO1xyXG4gICAgZWxlbWVudHMuZm9yRWFjaCgoZWw6IGFueSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGNvbW1lbnRlciA9IGVsLmNvbW1lbnRlcj8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5pZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIl0gfHwgZWwuY29tbWVudGVyO1xyXG4gICAgICAgIGlmIChjb21tZW50ZXIpIHtcclxuICAgICAgICAgICAgdm95YWdlckJ1ZmZlci5jb21tZW50cy5wdXNoKG5vcm1hbGl6ZUNvbW1lbnRlcihlbCkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBoYW5kbGVSZWFjdGlvbnNEYXRhKGRhdGE6IGFueSkge1xyXG4gICAgY29uc3QgaW5jbHVkZWQgPSBkYXRhPy5pbmNsdWRlZCB8fCBbXTtcclxuICAgIGluY2x1ZGVkLmZvckVhY2goKGk6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmIChpLiR0eXBlPy5pbmNsdWRlcyhcImlkZW50aXR5LmRhc2guUHJvZmlsZVwiKSB8fCBpLiR0eXBlPy5pbmNsdWRlcyhcImlkZW50aXR5LnByb2ZpbGUuUHJvZmlsZVwiKSkge1xyXG4gICAgICAgICAgICB2b3lhZ2VyQnVmZmVyLnJlYWN0aW9ucy5wdXNoKG5vcm1hbGl6ZVByb2ZpbGUoaSwgXCJyZWFjdGlvblwiKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZUdyb3VwRXZlbnREYXRhKGRhdGE6IGFueSkge1xyXG4gICAgY29uc3QgaW5jbHVkZWQgPSBkYXRhPy5pbmNsdWRlZCB8fCBbXTtcclxuICAgIGluY2x1ZGVkLmZvckVhY2goKGk6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmIChpLiR0eXBlPy5pbmNsdWRlcyhcImlkZW50aXR5LmRhc2guUHJvZmlsZVwiKSB8fCBpLiR0eXBlPy5pbmNsdWRlcyhcImlkZW50aXR5LnByb2ZpbGUuUHJvZmlsZVwiKSkge1xyXG4gICAgICAgICAgICAvLyBTdG9yZSBieSBtZW1iZXIgaWRlbnRpdHkgKHB1YmxpYyBJRClcclxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVByb2ZpbGUoaSwgXCJtZW1iZXJcIik7XHJcbiAgICAgICAgICAgIGlmIChub3JtYWxpemVkLnByb2ZpbGVfdXJsKSB7XHJcbiAgICAgICAgICAgICAgICB2b3lhZ2VyQnVmZmVyLnByb2ZpbGVzLnNldChpLnB1YmxpY0lkZW50aWZpZXIgfHwgaS52YW5pdHlOYW1lLCBub3JtYWxpemVkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVXRpbGl0aWVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG5cclxuLyoqXHJcbiAqIFN0cmlwcyBxdWVyeSBwYXJhbXMsIGhhc2gsIGFuZCB0cmFpbGluZyBzbGFzaC4gUmV0dXJucyBcIlwiIGlmIG5vdCBhIC9pbi8gVVJMLlxyXG4gKi9cclxuZnVuY3Rpb24gY2xlYW5Qcm9maWxlVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBpZiAoIXVybCkgcmV0dXJuICcnO1xyXG4gIGNvbnN0IGNsZWFuZWQgPSB1cmwuc3BsaXQoJz8nKVswXS5zcGxpdCgnIycpWzBdLnJlcGxhY2UoL1xcLyQvLCAnJyk7XHJcbiAgcmV0dXJuIGNsZWFuZWQuaW5jbHVkZXMoJy9pbi8nKSA/IGNsZWFuZWQgOiAnJztcclxufVxyXG5cclxuLyoqXHJcbiAqIFBvbGxzIGEgdm95YWdlciBidWZmZXIgdW50aWwgaXQgc3RvcHMgZ3Jvd2luZyAoc3RhYmxlIGZvciA2MDBtcykgb3IgdGltZXMgb3V0LlxyXG4gKiBEcmFpbnMgYW5kIHJldHVybnMgdGhlIGJ1ZmZlciBjb250ZW50cy5cclxuICovXHJcbmFzeW5jIGZ1bmN0aW9uIHBvbGxCdWZmZXIoa2V5OiAnc2VhcmNoJyB8ICdjb21tZW50cycgfCAncmVhY3Rpb25zJyB8ICdjb25uZWN0aW9ucycsIHRpbWVvdXRNcyA9IDUwMDApOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xyXG4gIGxldCBsYXN0Q291bnQgPSAwO1xyXG4gIGxldCBzdGFibGVGb3IgPSAwO1xyXG5cclxuICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgdGltZW91dE1zKSB7XHJcbiAgICBjb25zdCBjdXJyZW50ID0gKHZveWFnZXJCdWZmZXJba2V5XSBhcyBhbnlbXSkubGVuZ3RoO1xyXG4gICAgaWYgKGN1cnJlbnQgPiAwICYmIGN1cnJlbnQgPT09IGxhc3RDb3VudCkge1xyXG4gICAgICBzdGFibGVGb3IgKz0gMzAwO1xyXG4gICAgICBpZiAoc3RhYmxlRm9yID49IDYwMCkgYnJlYWs7ICAvLyBzdGFibGUgZm9yIDYwMG1zIFx1MjAxNCBBUEkgZG9uZSBsb2FkaW5nXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdGFibGVGb3IgPSAwO1xyXG4gICAgICBsYXN0Q291bnQgPSBjdXJyZW50O1xyXG4gICAgfVxyXG4gICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDMwMCkpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcmVzdWx0ID0gWy4uLih2b3lhZ2VyQnVmZmVyW2tleV0gYXMgYW55W10pXTtcclxuICAodm95YWdlckJ1ZmZlcltrZXldIGFzIGFueVtdKSA9IFtdO1xyXG4gIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbW1lbnRlcihjb21tZW50OiBhbnkpIHtcclxuICAgIGNvbnN0IHByb2ZpbGUgPSBjb21tZW50LmNvbW1lbnRlcj8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5pZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIl0gfHwge307XHJcbiAgICBjb25zdCBmaXJzdE5hbWUgPSBwcm9maWxlLmZpcnN0TmFtZSB8fCBcIlwiO1xyXG4gICAgY29uc3QgbGFzdE5hbWUgPSBwcm9maWxlLmxhc3ROYW1lIHx8IFwiXCI7XHJcbiAgICBjb25zdCBwdWJsaWNJZCA9IHByb2ZpbGUucHVibGljSWRlbnRpZmllciB8fCBcIlwiO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgZnVsbF9uYW1lOiBgJHtmaXJzdE5hbWV9ICR7bGFzdE5hbWV9YC50cmltKCksXHJcbiAgICAgICAgcHJvZmlsZV91cmw6IGNsZWFuUHJvZmlsZVVybChwdWJsaWNJZCA/IGBodHRwczovL3d3dy5saW5rZWRpbi5jb20vaW4vJHtwdWJsaWNJZH1gIDogXCJcIiksXHJcbiAgICAgICAgaGVhZGxpbmU6IHByb2ZpbGUuaGVhZGxpbmUgfHwgXCJDb21tZW50ZXJcIixcclxuICAgICAgICBhdmF0YXJfdXJsOiBleHRyYWN0QXZhdGFyKHByb2ZpbGUpLFxyXG4gICAgICAgIGxvY2F0aW9uOiBwcm9maWxlLmxvY2F0aW9uTmFtZSB8fCBwcm9maWxlLmdlb0xvY2F0aW9uPy5nZW8/LmRlZmF1bHRMb2NhbGl6ZWROYW1lIHx8IFwiXCIsXHJcbiAgICAgICAgbWVtYmVyX2lkOiBwdWJsaWNJZCB8fCBcIlwiLFxyXG4gICAgICAgIHNvdXJjZTogXCJhcGktY29tbWVudHNcIlxyXG4gICAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gbm9ybWFsaXplUHJvZmlsZShwcm9maWxlOiBhbnksIHNvdXJjZTogc3RyaW5nKSB7XHJcbiAgICBjb25zdCBmaXJzdE5hbWUgPSBwcm9maWxlLmZpcnN0TmFtZSB8fCBcIlwiO1xyXG4gICAgY29uc3QgbGFzdE5hbWUgPSBwcm9maWxlLmxhc3ROYW1lIHx8IFwiXCI7XHJcbiAgICBjb25zdCBwdWJsaWNJZCA9IHByb2ZpbGUucHVibGljSWRlbnRpZmllciB8fCBwcm9maWxlLnZhbml0eU5hbWUgfHwgXCJcIjtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGZ1bGxfbmFtZTogYCR7Zmlyc3ROYW1lfSAke2xhc3ROYW1lfWAudHJpbSgpLFxyXG4gICAgICAgIHByb2ZpbGVfdXJsOiBjbGVhblByb2ZpbGVVcmwocHVibGljSWQgPyBgaHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luLyR7cHVibGljSWR9YCA6IFwiXCIpLFxyXG4gICAgICAgIGhlYWRsaW5lOiBwcm9maWxlLmhlYWRsaW5lIHx8IHNvdXJjZSxcclxuICAgICAgICBhdmF0YXJfdXJsOiBleHRyYWN0QXZhdGFyKHByb2ZpbGUpLFxyXG4gICAgICAgIGxvY2F0aW9uOiBwcm9maWxlLmxvY2F0aW9uTmFtZSB8fCBwcm9maWxlLmdlb0xvY2F0aW9uPy5nZW8/LmRlZmF1bHRMb2NhbGl6ZWROYW1lIHx8IFwiXCIsXHJcbiAgICAgICAgbWVtYmVyX2lkOiBwdWJsaWNJZCB8fCBwcm9maWxlLmVudGl0eVVybj8uc3BsaXQoJzonKS5wb3AoKSB8fCBcIlwiLFxyXG4gICAgICAgIGluZHVzdHJ5OiBwcm9maWxlLmluZHVzdHJ5IHx8IFwiXCIsXHJcbiAgICAgICAgc291cmNlOiBgYXBpLSR7c291cmNlfWBcclxuICAgIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RBdmF0YXIocHJvZmlsZTogYW55KSB7XHJcbiAgICBjb25zdCBwaWMgPSBwcm9maWxlLnByb2ZpbGVQaWN0dXJlPy5kaXNwbGF5SW1hZ2VSZWZlcmVuY2U/LnZlY3RvckltYWdlIHx8IHByb2ZpbGUucGljdHVyZTtcclxuICAgIGlmIChwaWM/LnJvb3RVcmwgJiYgcGljPy5hcnRpZmFjdHM/Lmxlbmd0aCkge1xyXG4gICAgICAgIHJldHVybiBgJHtwaWMucm9vdFVybH0ke3BpYy5hcnRpZmFjdHNbcGljLmFydGlmYWN0cy5sZW5ndGggLSAxXS5maWxlSWRlbnRpZnlpbmdVcmxQYXRoU2VnbWVudH1gO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIFwiXCI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhbmRsZUdyYXBoUUxEYXRhKGRhdGE6IGFueSkge1xyXG4gICAgY29uc3QgZGF0YUFycmF5ID0gQXJyYXkuaXNBcnJheShkYXRhKSA/IGRhdGEgOiBbZGF0YV07XHJcblxyXG4gICAgZGF0YUFycmF5LmZvckVhY2gocGF5bG9hZCA9PiB7XHJcbiAgICAgICAgLy8gTGlua2VkSW4gR3JhcGhRTCBvZnRlbiByZXNwb25kcyB3aXRoIGRhdGEgd3JhcHBpbmcgU2VhcmNoIHJlc3VsdHMgb3IgSWRlbnRpdHkgcHJvZmlsZXNcclxuICAgICAgICBjb25zdCBzZWFyY2hDbHVzdGVyID0gcGF5bG9hZD8uZGF0YT8uc2VhcmNoRGFzaENsdXN0ZXJzQnlBbGw7XHJcbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IHBheWxvYWQ/LmRhdGE/LmlkZW50aXR5RGFzaFByb2ZpbGVCeVB1YmxpY0lkZW50aWZpZXI7XHJcbiAgICAgICAgY29uc3QgY29tbWVudHMgPSBwYXlsb2FkPy5kYXRhPy5jb21tZW50RGFzaENvbW1lbnRzQnlQb3N0O1xyXG5cclxuICAgICAgICBpZiAoc2VhcmNoQ2x1c3Rlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIltWb3lhZ2VyQnJpZGdlXSBEZXRlY3RlZCBHcmFwaFFMIFNlYXJjaCBDbHVzdGVyXCIpO1xyXG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHNlYXJjaENsdXN0ZXIuZWxlbWVudHMgfHwgW107XHJcbiAgICAgICAgICAgIGVsZW1lbnRzLmZvckVhY2goKGNsdXN0ZXI6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gR3JhcGhRTCByZXN1bHRzIGFyZSBvZnRlbiBuZXN0ZWQgaW4gaXRlbXNbXSAtPiBpdGVtLmVudGl0eVJlc3VsdFxyXG4gICAgICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBjbHVzdGVyLml0ZW1zIHx8IFtdO1xyXG4gICAgICAgICAgICAgICAgaXRlbXMuZm9yRWFjaCgoaXRlbTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW50aXR5UmVzdWx0ID0gaXRlbS5pdGVtPy5lbnRpdHlSZXN1bHQgfHwgaXRlbS5lbnRpdHlSZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eVJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplR3JhcGhRTFNlYXJjaEhpdChlbnRpdHlSZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGVkdXBsaWNhdGUgYnkgcHJvZmlsZSBVUkxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdm95YWdlckJ1ZmZlci5zZWFyY2guc29tZShzID0+IHMucHJvZmlsZV91cmwgPT09IG5vcm1hbGl6ZWQucHJvZmlsZV91cmwpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdm95YWdlckJ1ZmZlci5zZWFyY2gucHVzaChub3JtYWxpemVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChwcm9maWxlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW1ZveWFnZXJCcmlkZ2VdIERldGVjdGVkIEdyYXBoUUwgUHJvZmlsZVwiKTtcclxuICAgICAgICAgICAgY29uc3QgcHVibGljSWQgPSBwcm9maWxlLnB1YmxpY0lkZW50aWZpZXI7XHJcbiAgICAgICAgICAgIGlmIChwdWJsaWNJZCkgdm95YWdlckJ1ZmZlci5wcm9maWxlcy5zZXQocHVibGljSWQsIHByb2ZpbGUpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVHcmFwaFFMU2VhcmNoSGl0KGhpdDogYW55KSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHRpdGxlVGV4dCA9IGhpdC50aXRsZT8udGV4dCB8fCBcIkxpbmtlZEluIE1lbWJlclwiO1xyXG4gICAgICAgIGNvbnN0IGhlYWRsaW5lID0gaGl0LnByaW1hcnlTdWJ0aXRsZT8udGV4dCB8fCBoaXQuc3VtbWFyeT8udGV4dCB8fCBcIlwiO1xyXG4gICAgICAgIGNvbnN0IHByb2ZpbGVVcmwgPSBoaXQubmF2aWdhdGlvbkNvbnRleHQ/LnVybD8uc3BsaXQoJz8nKVswXSB8fCBcIlwiO1xyXG5cclxuICAgICAgICBpZiAoIXByb2ZpbGVVcmwgfHwgIXByb2ZpbGVVcmwuaW5jbHVkZXMoJy9pbi8nKSkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIC8vIEV4dHJhY3QgQXZhdGFyIGZyb20gR3JhcGhRTCBWZWN0b3JJbWFnZVxyXG4gICAgICAgIGxldCBhdmF0YXJVcmwgPSBcIlwiO1xyXG4gICAgICAgIGNvbnN0IHBpYyA9IGhpdC5pbWFnZT8uYXR0cmlidXRlcz8uWzBdPy5kZXRhaWxEYXRhPy5bXCJjb20ubGlua2VkaW4udm95YWdlci5kYXNoLmNvbW1vbi5pbWFnZS5Ob25FbnRpdHlQcm9maWxlQXZhdGFyXCJdPy52ZWN0b3JJbWFnZSB8fCBoaXQuaW1hZ2U/LmF0dHJpYnV0ZXM/LlswXT8uZGV0YWlsRGF0YT8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5jb21tb24uaW1hZ2UuUHJvZmlsZVRva2VuQXZhdGFyXCJdPy52ZWN0b3JJbWFnZTtcclxuXHJcbiAgICAgICAgaWYgKHBpYz8ucm9vdFVybCAmJiBwaWM/LmFydGlmYWN0cz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGF2YXRhclVybCA9IGAke3BpYy5yb290VXJsfSR7cGljLmFydGlmYWN0c1twaWMuYXJ0aWZhY3RzLmxlbmd0aCAtIDFdLmZpbGVJZGVudGlmeWluZ1VybFBhdGhTZWdtZW50fWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBmdWxsX25hbWU6IHRpdGxlVGV4dCxcclxuICAgICAgICAgICAgcHJvZmlsZV91cmw6IGNsZWFuUHJvZmlsZVVybChwcm9maWxlVXJsKSxcclxuICAgICAgICAgICAgaGVhZGxpbmUsXHJcbiAgICAgICAgICAgIGF2YXRhcl91cmw6IGF2YXRhclVybCxcclxuICAgICAgICAgICAgbG9jYXRpb246IGhpdC5zZWNvbmRhcnlTdWJ0aXRsZT8udGV4dCB8fCBcIlwiLFxyXG4gICAgICAgICAgICBtZW1iZXJfaWQ6IGhpdC50YXJnZXRVcm4/LnNwbGl0KCc6JykucG9wKCkgfHwgaGl0LnRyYWNraW5nVXJuPy5zcGxpdCgnOicpLnBvcCgpIHx8IFwiXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZTogXCJhcGktZ3JhcGhxbC1zZWFyY2hcIlxyXG4gICAgICAgIH07XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiW1ZveWFnZXJCcmlkZ2VdIEVycm9yIG5vcm1hbGl6aW5nIEdyYXBoUUwgaGl0OlwiLCBlcnIpO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVTZWFyY2hIaXQoaGl0OiBhbnkpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgdGl0bGVUZXh0ID0gaGl0LnRpdGxlPy50ZXh0IHx8IGhpdC50aXRsZT8udG9TdHJpbmcoKSB8fCBcIkxpbmtlZEluIE1lbWJlclwiO1xyXG4gICAgICAgIGNvbnN0IGhlYWRsaW5lID0gaGl0LnByaW1hcnlTdWJ0aXRsZT8udGV4dCB8fCBoaXQuc3VibGluZT8udGV4dCB8fCBcIlwiO1xyXG4gICAgICAgIGNvbnN0IHByb2ZpbGVVcmwgPSBoaXQubmF2aWdhdGlvbkNvbnRleHQ/LnVybCB8fCBcIlwiO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNhZmV0eSBjaGVjayB0byBwcmV2ZW50IFwic3BsaXQgb2YgdW5kZWZpbmVkXCIgY3Jhc2hcclxuICAgICAgICBpZiAoIXByb2ZpbGVVcmwgfHwgIXByb2ZpbGVVcmwuaW5jbHVkZXMoJy9pbi8nKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJbVm95YWdlckJyaWRnZV0gU2tpcHBpbmcgbm9uLXByb2ZpbGUgY2FuZGlkYXRlOlwiLCB0aXRsZVRleHQpO1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IG1lbWJlcklkID0gcHJvZmlsZVVybC5zcGxpdCgnL2luLycpWzFdPy5zcGxpdCgnLycpWzBdIHx8IFwiXCI7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQXZhdGFyIGV4dHJhY3Rpb24gZnJvbSBjb21wbGV4IFZlY3RvckltYWdlXHJcbiAgICAgICAgbGV0IGF2YXRhclVybCA9IFwiXCI7XHJcbiAgICAgICAgY29uc3QgaW1hZ2VBdHRyaWJ1dGVzID0gaGl0LmltYWdlPy5hdHRyaWJ1dGVzIHx8IFtdO1xyXG4gICAgICAgIGNvbnN0IHBpYyA9IGltYWdlQXR0cmlidXRlc1swXT8uZGV0YWlsRGF0YT8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5jb21tb24uaW1hZ2UuTm9uRW50aXR5UHJvZmlsZUF2YXRhclwiXT8udmVjdG9ySW1hZ2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBpYz8ucm9vdFVybCAmJiBwaWM/LmFydGlmYWN0cz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGF2YXRhclVybCA9IGAke3BpYy5yb290VXJsfSR7cGljLmFydGlmYWN0c1twaWMuYXJ0aWZhY3RzLmxlbmd0aCAtIDFdLmZpbGVJZGVudGlmeWluZ1VybFBhdGhTZWdtZW50fWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBmdWxsX25hbWU6IHRpdGxlVGV4dCxcclxuICAgICAgICAgICAgcHJvZmlsZV91cmw6IGNsZWFuUHJvZmlsZVVybChwcm9maWxlVXJsKSxcclxuICAgICAgICAgICAgaGVhZGxpbmUsXHJcbiAgICAgICAgICAgIGF2YXRhcl91cmw6IGF2YXRhclVybCxcclxuICAgICAgICAgICAgbG9jYXRpb246IGhpdC5zZWNvbmRhcnlTdWJ0aXRsZT8udGV4dCB8fCBoaXQuc3VibGluZT8udGV4dCB8fCBcIlwiLFxyXG4gICAgICAgICAgICBtZW1iZXJfaWQ6IGhpdC50YXJnZXRVcm4/LnNwbGl0KCc6JykucG9wKCkgfHwgaGl0LnRyYWNraW5nVXJuPy5zcGxpdCgnOicpLnBvcCgpIHx8IG1lbWJlcklkIHx8IFwiXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZTogXCJhcGktc2VhcmNoXCJcclxuICAgICAgICB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltWb3lhZ2VyQnJpZGdlXSBFcnJvciBub3JtYWxpemluZyBzZWFyY2ggaGl0OlwiLCBlcnIpO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG59XHJcblxyXG5jb25zdCB3YWl0Rm9yRWxlbWVudCA9IGFzeW5jIChzZWxlY3Rvcjogc3RyaW5nLCB0aW1lb3V0ID0gMTAwMDApID0+IHtcclxuICBjb25zdCBzdGFydCA9IERhdGUubm93KClcclxuICB3aGlsZSAoRGF0ZS5ub3coKSAtIHN0YXJ0IDwgdGltZW91dCkge1xyXG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxyXG4gICAgaWYgKGVsKSByZXR1cm4gZWxcclxuICAgIGF3YWl0IHJhbmRvbURlbGF5KDUwMCwgMTAwMClcclxuICB9XHJcbiAgcmV0dXJuIG51bGxcclxufVxyXG5cclxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xyXG4gIGNvbnNvbGUubG9nKFwiW2xpbmtlZGluLmpzXSBSZWNlaXZlZCBtZXNzYWdlOlwiLCBtZXNzYWdlLnR5cGUsIG1lc3NhZ2UuYWN0aW9uKTtcclxuXHJcbiAgLy8gU2FmZWd1YXJkOiB3cmFwIHNlbmRSZXNwb25zZSB0byBwcmV2ZW50IGRvdWJsZS1jYWxsaW5nXHJcbiAgbGV0IHJlc3BvbmRlZCA9IGZhbHNlO1xyXG4gIGNvbnN0IHNhZmVTZW5kUmVzcG9uc2UgPSAocmVzcG9uc2U6IGFueSkgPT4ge1xyXG4gICAgaWYgKCFyZXNwb25kZWQpIHtcclxuICAgICAgcmVzcG9uZGVkID0gdHJ1ZTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBzZW5kUmVzcG9uc2UocmVzcG9uc2UpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltsaW5rZWRpbi5qc10gRmFpbGVkIHRvIHNlbmQgcmVzcG9uc2U6XCIsIGUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gXCJQSU5HXCIpIHtcclxuICAgIHNhZmVTZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCB2ZXJzaW9uOiBcIjEuMC4wXCIgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGlmIChtZXNzYWdlLnR5cGUgPT09IFwiRVhFQ1VURV9BQ1RJT05cIikge1xyXG4gICAgY29uc29sZS5sb2coXCJbbGlua2VkaW4uanNdIEV4ZWN1dGluZyBhY3Rpb246XCIsIG1lc3NhZ2UuYWN0aW9uKTtcclxuXHJcbiAgICAvLyBBZGQgdGltZW91dCB0byBlbnN1cmUgcmVzcG9uc2UgaXMgc2VudCBldmVuIGlmIGFjdGlvbiBoYW5nc1xyXG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHNhZmVTZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiQWN0aW9uIHRpbWVkIG91dCBhZnRlciAzMCBzZWNvbmRzXCIgfSk7XHJcbiAgICB9LCAzMDAwMCk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgaGFuZGxlQWN0aW9uKG1lc3NhZ2UuYWN0aW9uLCBtZXNzYWdlLnBheWxvYWQpLnRoZW4oKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiW2xpbmtlZGluLmpzXSBBY3Rpb24gcmVzdWx0OlwiLCByZXN1bHQpO1xyXG4gICAgICAgIHNhZmVTZW5kUmVzcG9uc2UocmVzdWx0KTtcclxuICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbbGlua2VkaW4uanNdIEFjdGlvbiBlcnJvcjpcIiwgZXJyKTtcclxuICAgICAgICBzYWZlU2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3JcIiB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9IGNhdGNoIChzeW5jRXJyOiBhbnkpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJbbGlua2VkaW4uanNdIFN5bmNocm9ub3VzIGVycm9yOlwiLCBzeW5jRXJyKTtcclxuICAgICAgc2FmZVNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc3luY0Vyci5tZXNzYWdlIHx8IFwiU3luY2hyb25vdXMgZXJyb3JcIiB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLy8gVW5rbm93biBtZXNzYWdlIHR5cGUgLSByZXNwb25kIHdpdGggZXJyb3JcclxuICBzYWZlU2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBtZXNzYWdlIHR5cGU6ICR7bWVzc2FnZS50eXBlfWAgfSk7XHJcbiAgcmV0dXJuIHRydWU7XHJcbn0pO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQWN0aW9uKGFjdGlvbjogc3RyaW5nLCBwYXlsb2FkOiBhbnkpIHtcclxuICBjb25zb2xlLmxvZyhgW2hhbmRsZUFjdGlvbl0gUHJvY2Vzc2luZzogJHthY3Rpb259YCwgcGF5bG9hZCk7XHJcbiAgdHJ5IHtcclxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgIGNhc2UgXCJzY3JhcGVMZWFkc1wiOlxyXG4gICAgICAgIHJldHVybiBhd2FpdCBzY3JhcGVMZWFkcyhwYXlsb2FkKVxyXG4gICAgICBjYXNlIFwidmlld1Byb2ZpbGVcIjpcclxuICAgICAgICByZXR1cm4gYXdhaXQgdmlld1Byb2ZpbGUocGF5bG9hZC51cmwpXHJcbiAgICAgIGNhc2UgXCJjb25uZWN0XCI6XHJcbiAgICAgIGNhc2UgXCJzZW5kQ29ubmVjdGlvblJlcXVlc3RcIjpcclxuICAgICAgICByZXR1cm4gYXdhaXQgc2VuZENvbm5lY3Rpb25SZXF1ZXN0KHBheWxvYWQucHJvZmlsZV91cmwgfHwgcGF5bG9hZC51cmwsIHBheWxvYWQubWVzc2FnZSB8fCBwYXlsb2FkLm5vdGUpXHJcbiAgICAgIGNhc2UgXCJzZW5kTWVzc2FnZVwiOlxyXG4gICAgICAgIHJldHVybiBhd2FpdCBzZW5kTWVzc2FnZVZpYUFQSShwYXlsb2FkLnRocmVhZElkIHx8IHBheWxvYWQudXJsLCBwYXlsb2FkLm1lc3NhZ2UpXHJcbiAgICAgIGNhc2UgXCJGRVRDSF9DT05WRVJTQVRJT05TXCI6XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZldGNoQ29udmVyc2F0aW9uc1ZpYUFQSSgpXHJcbiAgICAgIGNhc2UgXCJTWU5DX0lOQk9YXCI6XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZldGNoQ29udmVyc2F0aW9uc1ZpYUFQSSgpXHJcbiAgICAgIGNhc2UgXCJnZXRQcm9maWxlSW5mb1wiOlxyXG4gICAgICAgIHJldHVybiBhd2FpdCBnZXRQcm9maWxlSW5mbygpXHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFjdGlvbjogJHthY3Rpb259YClcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgY29uc29sZS5lcnJvcihgW2hhbmRsZUFjdGlvbl0gQ1JJVElDQUwgRVJST1IgZHVyaW5nICR7YWN0aW9ufTpgLCBlcnIpO1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB8fCBcIlVua25vd24gZXJyb3IgZHVyaW5nIGFjdGlvbiBleGVjdXRpb25cIiB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEZldGNoIHByb2ZpbGUgdmlhIExpbmtlZEluJ3MgaW50ZXJuYWwgVm95YWdlciBBUEkuXHJcbiAqIFRoaXMgcnVucyBGUk9NIHRoZSBjb250ZW50IHNjcmlwdCAoaW5zaWRlIGxpbmtlZGluLmNvbSksIHNvIGNvb2tpZXNcclxuICogYXJlIGF1dG9tYXRpY2FsbHkgYXR0YWNoZWQgYnkgdGhlIGJyb3dzZXIgXHUyMDE0IG5vIENPUlMsIG5vIGNvb2tpZSBoZWFkZXIgaXNzdWVzLlxyXG4gKi9cclxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hQcm9maWxlVmlhQVBJKCk6IFByb21pc2U8YW55PiB7XHJcbiAgY29uc3QgY3NyZlRva2VuID0gZ2V0Q3NyZlRva2VuKCk7XHJcbiAgY29uc29sZS5sb2coXCJbVm95YWdlcl0gRmV0Y2hpbmcgcHJvZmlsZSB2aWEgQVBJLCBjc3JmOlwiLCBjc3JmVG9rZW4gPyBcImZvdW5kXCIgOiBcIm1pc3NpbmdcIik7XHJcblxyXG4gIGNvbnN0IGNvbW1vbkhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgICBcImFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5saW5rZWRpbi5ub3JtYWxpemVkK2pzb24rMi4xXCIsXHJcbiAgICBcImNzcmYtdG9rZW5cIjogY3NyZlRva2VuLFxyXG4gICAgXCJ4LWxpLWxhbmdcIjogXCJlbl9VU1wiLFxyXG4gICAgXCJ4LXJlc3RsaS1wcm90b2NvbC12ZXJzaW9uXCI6IFwiMi4wLjBcIlxyXG4gIH07XHJcblxyXG4gIC8vIFRyeSBlbmRwb2ludHMgaW4gb3JkZXIgXHUyMDE0IG5ld2VzdCBmaXJzdFxyXG4gIGNvbnN0IGVuZHBvaW50cyA9IFtcclxuICAgIHsgdXJsOiBcIi92b3lhZ2VyL2FwaS9pZGVudGl0eS9kYXNoL3Byb2ZpbGVzP3E9bWVtYmVySWRlbnRpdHkmbWVtYmVySWRlbnRpdHk9bWVcIiwgbGFiZWw6IFwiZGFzaC9wcm9maWxlc1wiIH0sXHJcbiAgICB7IHVybDogXCIvdm95YWdlci9hcGkvaWRlbnRpdHkvcHJvZmlsZXMvbWVcIiwgbGFiZWw6IFwiaWRlbnRpdHkvcHJvZmlsZXMvbWVcIiB9LFxyXG4gICAgeyB1cmw6IFwiL3ZveWFnZXIvYXBpL21lXCIsIGxhYmVsOiBcIi9tZSAobGVnYWN5KVwiIH1cclxuICBdO1xyXG5cclxuICBmb3IgKGNvbnN0IGVwIG9mIGVuZHBvaW50cykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc29sZS5sb2coYFtWb3lhZ2VyXSBUcnlpbmcgJHtlcC5sYWJlbH0uLi5gKTtcclxuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGVwLnVybCwge1xyXG4gICAgICAgIGhlYWRlcnM6IGNvbW1vbkhlYWRlcnMsXHJcbiAgICAgICAgY3JlZGVudGlhbHM6IFwiaW5jbHVkZVwiXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFyZXNwLm9rKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKGBbVm95YWdlcl0gJHtlcC5sYWJlbH0gcmV0dXJuZWQgJHtyZXNwLnN0YXR1c31gKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xyXG4gICAgICBjb25zdCBpbmNsdWRlZDogYW55W10gPSBkYXRhLmluY2x1ZGVkIHx8IFtdO1xyXG4gICAgICBjb25zdCBhbGwgPSBbLi4uaW5jbHVkZWQsIC4uLihkYXRhLmVsZW1lbnRzIHx8IFtdKV07XHJcbiAgICAgIGlmIChhbGwubGVuZ3RoID09PSAwICYmIGRhdGEuZGF0YSkgYWxsLnB1c2goZGF0YS5kYXRhKTtcclxuXHJcbiAgICAgIGNvbnN0IHR5cGVzID0gYWxsLm1hcCgoaTogYW55KSA9PiBpLiR0eXBlKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gJHtlcC5sYWJlbH0gdHlwZXM6YCwgWy4uLm5ldyBTZXQodHlwZXMpXSk7XHJcblxyXG4gICAgICAvLyBGaW5kIHByb2ZpbGUgZW50aXR5XHJcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBhbGwuZmluZCgoaTogYW55KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdCA9IGkuJHR5cGUgfHwgXCJcIjtcclxuICAgICAgICByZXR1cm4gdC5pbmNsdWRlcyhcIk1pbmlQcm9maWxlXCIpIHx8XHJcbiAgICAgICAgICAgICAgIHQuaW5jbHVkZXMoXCJpZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIikgfHxcclxuICAgICAgICAgICAgICAgdC5pbmNsdWRlcyhcImlkZW50aXR5LmRhc2guUHJvZmlsZVwiKSB8fFxyXG4gICAgICAgICAgICAgICB0LmluY2x1ZGVzKFwidm95YWdlci5pZGVudGl0eS5tZS5DYXJkXCIpIHx8XHJcbiAgICAgICAgICAgICAgIChpLmZpcnN0TmFtZSAmJiBpLmxhc3ROYW1lICYmIGkucHVibGljSWRlbnRpZmllcik7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFwcm9maWxlKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKGBbVm95YWdlcl0gTm8gcHJvZmlsZSBlbnRpdHkgaW4gJHtlcC5sYWJlbH0gcmVzcG9uc2VgKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gRXh0cmFjdCBuYW1lIChoYW5kbGUgYm90aCBzdHJpbmcgYW5kIGxvY2FsaXplZCBvYmplY3QgZm9ybWF0cylcclxuICAgICAgY29uc3QgZmlyc3ROYW1lID0gdHlwZW9mIHByb2ZpbGUuZmlyc3ROYW1lID09PSAnc3RyaW5nJyA/IHByb2ZpbGUuZmlyc3ROYW1lIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZS5maXJzdE5hbWU/LmxvY2FsaXplZD8uW09iamVjdC5rZXlzKHByb2ZpbGUuZmlyc3ROYW1lPy5sb2NhbGl6ZWQgfHwge30pWzBdXSB8fCAnJztcclxuICAgICAgY29uc3QgbGFzdE5hbWUgPSB0eXBlb2YgcHJvZmlsZS5sYXN0TmFtZSA9PT0gJ3N0cmluZycgPyBwcm9maWxlLmxhc3ROYW1lIDpcclxuICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlLmxhc3ROYW1lPy5sb2NhbGl6ZWQ/LltPYmplY3Qua2V5cyhwcm9maWxlLmxhc3ROYW1lPy5sb2NhbGl6ZWQgfHwge30pWzBdXSB8fCAnJztcclxuICAgICAgY29uc3QgZnVsbE5hbWUgPSBgJHtmaXJzdE5hbWV9ICR7bGFzdE5hbWV9YC50cmltKCk7XHJcbiAgICAgIGNvbnN0IHB1YmxpY0lkID0gcHJvZmlsZS5wdWJsaWNJZGVudGlmaWVyIHx8IHByb2ZpbGUudmFuaXR5TmFtZSB8fCAnJztcclxuXHJcbiAgICAgIGlmICghZnVsbE5hbWUpIGNvbnRpbnVlOyAvLyBub3QgdXNlZnVsLCB0cnkgbmV4dFxyXG5cclxuICAgICAgLy8gRXh0cmFjdCBwaG90byBcdTIwMTQgdHJ5IG11bHRpcGxlIHNoYXBlc1xyXG4gICAgICBsZXQgYXZhdGFyVXJsID0gJyc7XHJcbiAgICAgIGNvbnN0IHBpYyA9IHByb2ZpbGUucGljdHVyZSB8fCBwcm9maWxlLnByb2ZpbGVQaWN0dXJlPy5kaXNwbGF5SW1hZ2VSZWZlcmVuY2U/LnZlY3RvckltYWdlO1xyXG4gICAgICBpZiAocGljPy5yb290VXJsICYmIHBpYz8uYXJ0aWZhY3RzPy5sZW5ndGgpIHtcclxuICAgICAgICBhdmF0YXJVcmwgPSBgJHtwaWMucm9vdFVybH0ke3BpYy5hcnRpZmFjdHNbcGljLmFydGlmYWN0cy5sZW5ndGggLSAxXS5maWxlSWRlbnRpZnlpbmdVcmxQYXRoU2VnbWVudH1gO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHBob3RvRWxlbWVudHMgPSBwcm9maWxlLnByb2ZpbGVQaWN0dXJlPy5bXCJkaXNwbGF5SW1hZ2V+XCJdPy5lbGVtZW50cztcclxuICAgICAgICBpZiAocGhvdG9FbGVtZW50cz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICBhdmF0YXJVcmwgPSBwaG90b0VsZW1lbnRzW3Bob3RvRWxlbWVudHMubGVuZ3RoIC0gMV0/LmlkZW50aWZpZXJzPy5bMF0/LmlkZW50aWZpZXIgfHwgXCJcIjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEZhbGxiYWNrOiBzZWFyY2ggaW5jbHVkZWQgZm9yIFZlY3RvckltYWdlXHJcbiAgICAgIGlmICghYXZhdGFyVXJsKSB7XHJcbiAgICAgICAgY29uc3QgdmVjSW1nID0gYWxsLmZpbmQoKGk6IGFueSkgPT5cclxuICAgICAgICAgIChpLiR0eXBlIHx8IFwiXCIpLmluY2x1ZGVzKFwiVmVjdG9ySW1hZ2VcIikgfHwgKGkuJHR5cGUgfHwgXCJcIikuaW5jbHVkZXMoXCJQaG90b1wiKVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgaWYgKHZlY0ltZz8ucm9vdFVybCAmJiB2ZWNJbWc/LmFydGlmYWN0cz8ubGVuZ3RoKSB7XHJcbiAgICAgICAgICBhdmF0YXJVcmwgPSBgJHt2ZWNJbWcucm9vdFVybH0ke3ZlY0ltZy5hcnRpZmFjdHNbdmVjSW1nLmFydGlmYWN0cy5sZW5ndGggLSAxXS5maWxlSWRlbnRpZnlpbmdVcmxQYXRoU2VnbWVudH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc29sZS5sb2coYFtWb3lhZ2VyXSBFeHRyYWN0ZWQgdmlhICR7ZXAubGFiZWx9OmAsIHsgZnVsbE5hbWUsIHB1YmxpY0lkLCBoYXNBdmF0YXI6ICEhYXZhdGFyVXJsIH0pO1xyXG5cclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgIGZ1bGxfbmFtZTogZnVsbE5hbWUgfHwgXCJMaW5rZWRJbiBVc2VyXCIsXHJcbiAgICAgICAgYXZhdGFyX3VybDogYXZhdGFyVXJsLFxyXG4gICAgICAgIHByb2ZpbGVfdXJsOiBwdWJsaWNJZCA/IGBodHRwczovL3d3dy5saW5rZWRpbi5jb20vaW4vJHtwdWJsaWNJZH1gIDogXCJcIixcclxuICAgICAgICBtZW1iZXJfaWQ6IHB1YmxpY0lkIHx8IFwibWVcIlxyXG4gICAgICB9O1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihgW1ZveWFnZXJdICR7ZXAubGFiZWx9IGVycm9yOmAsIGVycik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zb2xlLmVycm9yKFwiW1ZveWFnZXJdIEFsbCBlbmRwb2ludHMgZmFpbGVkXCIpO1xyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRQcm9maWxlSW5mbygpIHtcclxuICBjb25zb2xlLmxvZyhcIltnZXRQcm9maWxlSW5mb10gU3RhcnRpbmcgcHJvZmlsZSBleHRyYWN0aW9uLi4uXCIpO1xyXG5cclxuICAvLyA9PT0gU1RSQVRFR1kgMTogVm95YWdlciBBUEkgKG1vc3QgcmVsaWFibGUsIHJ1bnMgaW4gcGFnZSBjb250ZXh0KSA9PT1cclxuICBjb25zdCBhcGlSZXN1bHQgPSBhd2FpdCBmZXRjaFByb2ZpbGVWaWFBUEkoKTtcclxuICBpZiAoYXBpUmVzdWx0Py5zdWNjZXNzICYmIGFwaVJlc3VsdC5tZW1iZXJfaWQgIT09IFwibWVcIikge1xyXG4gICAgY29uc29sZS5sb2coXCJbZ2V0UHJvZmlsZUluZm9dIEdvdCBwcm9maWxlIGZyb20gVm95YWdlciBBUElcIik7XHJcbiAgICByZXR1cm4gYXBpUmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLy8gPT09IFNUUkFURUdZIDI6IERPTSBzY3JhcGluZyB3aXRoIHJldHJpZXMgPT09XHJcbiAgY29uc29sZS5sb2coXCJbZ2V0UHJvZmlsZUluZm9dIEFQSSBmYWlsZWQsIHRyeWluZyBET00gc2NyYXBpbmcuLi5cIik7XHJcbiAgXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcclxuICAgIC8vIFRyeSBKU09OLUxEIGZpcnN0XHJcbiAgICBjb25zdCBqc29uTGQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdzY3JpcHRbdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIl0nKTtcclxuICAgIGlmIChqc29uTGQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShqc29uTGQudGV4dENvbnRlbnQgfHwgXCJ7fVwiKTtcclxuICAgICAgICBpZiAoZGF0YS5uYW1lIHx8IChkYXRhWydAdHlwZSddID09PSAnUGVyc29uJyAmJiBkYXRhLm5hbWUpKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltnZXRQcm9maWxlSW5mb10gRm91bmQgaW5mbyBpbiBKU09OLUxEXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgZnVsbF9uYW1lOiBkYXRhLm5hbWUgfHwgXCJMaW5rZWRJbiBVc2VyXCIsXHJcbiAgICAgICAgICAgIGF2YXRhcl91cmw6IGRhdGEuaW1hZ2U/LmNvbnRlbnRVcmwgfHwgZGF0YS5pbWFnZSB8fCBcIlwiLFxyXG4gICAgICAgICAgICBwcm9maWxlX3VybDogZGF0YS51cmwgfHwgd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoJz8nKVswXSxcclxuICAgICAgICAgICAgbWVtYmVyX2lkOiAoZGF0YS51cmwgfHwgd2luZG93LmxvY2F0aW9uLmhyZWYpLnNwbGl0KCcvaW4vJylbMV0/LnNwbGl0KCcvJylbMF0gfHwgXCJtZVwiXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZSkge31cclxuICAgIH1cclxuXHJcbiAgICAvLyBET00gc2VsZWN0b3JzXHJcbiAgICBjb25zdCBuYW1lU2VsZWN0b3JzID0gW1xyXG4gICAgICAnLnRleHQtaGVhZGluZy14bGFyZ2UnLFxyXG4gICAgICAnaDEudGV4dC1oZWFkaW5nLXhsYXJnZScsXHJcbiAgICAgICcuZ2xvYmFsLW5hdl9fbWUtYWN0aXZlLXN0YXR1cyArIHNwYW4nLFxyXG4gICAgICAnLnQtMTYudC1ibGFjay50LWJvbGQnLFxyXG4gICAgICAnLnB2LXRvcC1jYXJkLWJlZm9yZS1leHBhbmRlZF9fbmFtZSdcclxuICAgIF07XHJcbiAgICBjb25zdCBhdmF0YXJTZWxlY3RvcnMgPSBbXHJcbiAgICAgICcuZ2xvYmFsLW5hdl9fbWUtcGhvdG8nLFxyXG4gICAgICAnLnB2LXRvcC1jYXJkLXByb2ZpbGUtcGljdHVyZV9faW1hZ2UnLFxyXG4gICAgICAnaW1nLnByb2ZpbGUtcGhvdG8tZWRpdF9fcHJldmlldycsXHJcbiAgICAgICdpbWdbYWx0Kj1cInBob3RvXCJdJ1xyXG4gICAgXTtcclxuXHJcbiAgICBsZXQgbmFtZSA9IFwiXCI7XHJcbiAgICBmb3IgKGNvbnN0IHNlbCBvZiBuYW1lU2VsZWN0b3JzKSB7XHJcbiAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWwpO1xyXG4gICAgICBpZiAoZWw/LnRleHRDb250ZW50Py50cmltKCkpIHsgbmFtZSA9IGVsLnRleHRDb250ZW50LnRyaW0oKTsgYnJlYWs7IH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgYXZhdGFyID0gXCJcIjtcclxuICAgIGZvciAoY29uc3Qgc2VsIG9mIGF2YXRhclNlbGVjdG9ycykge1xyXG4gICAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKSBhcyBIVE1MSW1hZ2VFbGVtZW50O1xyXG4gICAgICBpZiAoZWw/LnNyYyAmJiAhZWwuc3JjLmluY2x1ZGVzKCdkYXRhOicpKSB7IGF2YXRhciA9IGVsLnNyYzsgYnJlYWs7IH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcm9maWxlTGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5nbG9iYWwtbmF2X19tZS1saW5rLCBhW2hyZWYqPVwiL2luL1wiXScpIGFzIEhUTUxBbmNob3JFbGVtZW50O1xyXG4gICAgY29uc3QgcHJvZmlsZVVybCA9IHByb2ZpbGVMaW5rPy5ocmVmPy5zcGxpdCgnPycpWzBdIHx8IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCc/JylbMF07XHJcblxyXG4gICAgaWYgKHByb2ZpbGVVcmwuaW5jbHVkZXMoJy9pbi8nKSB8fCBuYW1lKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwiW2dldFByb2ZpbGVJbmZvXSBGb3VuZCBpbmZvIGluIERPTTpcIiwgeyBuYW1lLCBoYXNBdmF0YXI6ICEhYXZhdGFyIH0pO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgZnVsbF9uYW1lOiBuYW1lIHx8IFwiTGlua2VkSW4gVXNlclwiLFxyXG4gICAgICAgIGF2YXRhcl91cmw6IGF2YXRhciB8fCBcIlwiLFxyXG4gICAgICAgIHByb2ZpbGVfdXJsOiBwcm9maWxlVXJsLFxyXG4gICAgICAgIG1lbWJlcl9pZDogcHJvZmlsZVVybC5zcGxpdCgnL2luLycpWzFdPy5zcGxpdCgnLycpWzBdIHx8IFwibWVcIlxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHJhbmRvbURlbGF5KDEwMDAsIDIwMDApO1xyXG4gIH1cclxuXHJcbiAgLy8gSWYgd2UgYWxzbyBoYXZlIGFuIEFQSSByZXN1bHQgdGhhdCBzdWNjZWVkZWQgYnV0IGhhZCBtZW1iZXJfaWQ9XCJtZVwiLCBzdGlsbCByZXR1cm4gaXRcclxuICBpZiAoYXBpUmVzdWx0Py5zdWNjZXNzKSByZXR1cm4gYXBpUmVzdWx0O1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc3VjY2VzczogdHJ1ZSxcclxuICAgIGZ1bGxfbmFtZTogXCJMaW5rZWRJbiBVc2VyXCIsXHJcbiAgICBhdmF0YXJfdXJsOiBcIlwiLFxyXG4gICAgcHJvZmlsZV91cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCc/JylbMF0sXHJcbiAgICBtZW1iZXJfaWQ6IFwibWVcIlxyXG4gIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGF1dG9TY3JvbGwoY29udGFpbmVyU2VsZWN0b3I/OiBzdHJpbmcsIG1heFNjcm9sbHMgPSAxMCkge1xyXG4gIGNvbnNvbGUubG9nKFwiW0F1dG9TY3JvbGxdIFN0YXJ0aW5nIHNjcm9sbCBzZXF1ZW5jZS4uLlwiKVxyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGNvbnRhaW5lclNlbGVjdG9yID8gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcihjb250YWluZXJTZWxlY3RvcikgOiB3aW5kb3dcclxuICBjb25zdCBzY3JvbGxUYXJnZXQgPSBjb250YWluZXJTZWxlY3RvciA/IChjb250YWluZXIgYXMgSFRNTEVsZW1lbnQpIDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XHJcblxyXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4U2Nyb2xsczsgaSsrKSB7XHJcbiAgICBjb25zdCBzdGFydEhlaWdodCA9IHNjcm9sbFRhcmdldC5zY3JvbGxIZWlnaHRcclxuICAgIGlmIChjb250YWluZXIgPT09IHdpbmRvdykge1xyXG4gICAgICB3aW5kb3cuc2Nyb2xsVG8oMCwgZG9jdW1lbnQuYm9keS5zY3JvbGxIZWlnaHQpXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAoY29udGFpbmVyIGFzIEhUTUxFbGVtZW50KS5zY3JvbGxUb3AgPSAoY29udGFpbmVyIGFzIEhUTUxFbGVtZW50KS5zY3JvbGxIZWlnaHRcclxuICAgIH1cclxuICAgIGF3YWl0IHJhbmRvbURlbGF5KDEwMDAsIDIwMDApXHJcbiAgICBpZiAoc2Nyb2xsVGFyZ2V0LnNjcm9sbEhlaWdodCA9PT0gc3RhcnRIZWlnaHQpIGJyZWFrIC8vIE5vIG1vcmUgY29udGVudFxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFBhcnNlIGEgTGlua2VkSW4gaGVhZGxpbmUgaW50byBzdHJ1Y3R1cmVkIHRpdGxlL2NvbXBhbnkgZmllbGRzLlxyXG4gKi9cclxuZnVuY3Rpb24gZW5yaWNoTGVhZChsZWFkOiBhbnkpIHtcclxuICBjb25zdCByYXcgPSAobGVhZC5oZWFkbGluZSB8fCAnJykudHJpbSgpO1xyXG4gIC8vIFN0cmlwIExpbmtlZEluIGRlZ3JlZSBiYWRnZXMgYXBwZW5kZWQgdG8gaGVhZGxpbmVzIChcIlx1MjAyMiAybmRcIiwgXCJcdTAwQjcgM3JkXCIsIGV0Yy4pXHJcbiAgY29uc3QgaGVhZGxpbmUgPSByYXcucmVwbGFjZSgvXFxzKltcdTIwMjJcdTAwQjddXFxzKigxc3R8Mm5kfDNyZHxcXGQrdGgpXFxzKiQvaSwgJycpLnRyaW0oKTtcclxuXHJcbiAgLy8gVHJ5IHNlcGFyYXRvcnMgaW4gcHJpb3JpdHkgb3JkZXJcclxuICBjb25zdCBzZXBhcmF0b3JzID0gWycgYXQgJywgJyBAICcsICcgfCAnLCAnIFx1MjAyMiAnLCAnIFx1MDBCNyAnLCAnIC0gJywgJyBcdTIwMTQgJ107XHJcbiAgZm9yIChjb25zdCBzZXAgb2Ygc2VwYXJhdG9ycykge1xyXG4gICAgaWYgKGhlYWRsaW5lLmluY2x1ZGVzKHNlcCkpIHtcclxuICAgICAgY29uc3QgaWR4ID0gaGVhZGxpbmUuaW5kZXhPZihzZXApO1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIC4uLmxlYWQsXHJcbiAgICAgICAgaGVhZGxpbmU6IHJhdyxcclxuICAgICAgICB0aXRsZTogaGVhZGxpbmUuc2xpY2UoMCwgaWR4KS50cmltKCksXHJcbiAgICAgICAgY29tcGFueTogaGVhZGxpbmUuc2xpY2UoaWR4ICsgc2VwLmxlbmd0aCkudHJpbSgpLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHsgLi4ubGVhZCwgaGVhZGxpbmU6IHJhdywgdGl0bGU6IGhlYWRsaW5lLCBjb21wYW55OiBsZWFkLmNvbXBhbnkgfHwgJycgfTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlTGVhZHMocGF5bG9hZD86IGFueSkge1xyXG4gIGNvbnN0IHR5cGUgPSBwYXlsb2FkPy5leHRyYWN0aW9uVHlwZSB8fCAnc2VhcmNoJ1xyXG4gIGNvbnNvbGUubG9nKGBbU2NyYXBlcl0gU3RhcnRpbmcgJHt0eXBlfSBleHRyYWN0aW9uLi4uYClcclxuXHJcbiAgbGV0IHJlc3VsdDtcclxuICBzd2l0Y2ggKHR5cGUpIHtcclxuICAgIGNhc2UgJ2NvbW1lbnRzJzpcclxuICAgIGNhc2UgJ2VuZ2FnZW1lbnQnOiAgLy8gV2l6YXJkIHNlbmRzICdlbmdhZ2VtZW50JyBmb3IgcG9zdCBlbmdhZ2VtZW50IHNjcmFwaW5nXHJcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHNjcmFwZUNvbW1lbnRzKClcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdyZWFjdGlvbnMnOlxyXG4gICAgICByZXN1bHQgPSBhd2FpdCBzY3JhcGVSZWFjdGlvbnMoKVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ2dyb3Vwcyc6XHJcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHNjcmFwZUdyb3VwTWVtYmVycygpXHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAnZXZlbnRzJzpcclxuICAgICAgcmVzdWx0ID0gYXdhaXQgc2NyYXBlRXZlbnRBdHRlbmRlZXMoKVxyXG4gICAgICBicmVhaztcclxuICAgIGNhc2UgJ25ldHdvcmsnOlxyXG4gICAgICByZXN1bHQgPSBhd2FpdCBzY3JhcGVOZXR3b3JrKClcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICduYXYtc2VhcmNoJzpcclxuICAgIGNhc2UgJ25hdi1zYXZlZCc6XHJcbiAgICBjYXNlICduYXYtbGlzdCc6XHJcbiAgICBjYXNlICdzZWFyY2gnOlxyXG4gICAgZGVmYXVsdDpcclxuICAgICAgcmVzdWx0ID0gYXdhaXQgc2NyYXBlU2VhcmNoUmVzdWx0cyhwYXlsb2FkKVxyXG4gICAgICBicmVhaztcclxuICB9XHJcblxyXG4gIC8vIEVucmljaCBhbGwgbGVhZHMgd2l0aCBwYXJzZWQgdGl0bGUvY29tcGFueSBmcm9tIGhlYWRsaW5lXHJcbiAgaWYgKHJlc3VsdD8uc3VjY2VzcyAmJiByZXN1bHQ/LmxlYWRzKSB7XHJcbiAgICByZXN1bHQubGVhZHMgPSByZXN1bHQubGVhZHMubWFwKGVucmljaExlYWQpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlU2VhcmNoUmVzdWx0cyhwYXlsb2FkPzogYW55KSB7XHJcbiAgLy8gQ1JJVElDQUw6IE9ubHkgcnVuIGluIG1haW4gZnJhbWUsIG5vdCBpbiBpZnJhbWVzIChhZHMsIHRyYWNraW5nLCBldGMuKVxyXG4gIGlmICh3aW5kb3cuc2VsZiAhPT0gd2luZG93LnRvcCkge1xyXG4gICAgY29uc29sZS5sb2coXCJbU2NyYXBlcl0gU2tpcHBpbmcgLSBydW5uaW5nIGluIGlmcmFtZTpcIiwgd2luZG93LmxvY2F0aW9uLmhyZWYpO1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIkNhbm5vdCBzY3JhcGUgZnJvbSBpZnJhbWVcIiB9O1xyXG4gIH1cclxuXHJcbiAgLy8gQ29ubmVjdGlvbnMgcGFnZSBoYXMgYSBjb21wbGV0ZWx5IGRpZmZlcmVudCBET00gXHUyMDE0IGRlbGVnYXRlIHRvIHRoZSBkZWRpY2F0ZWQgc2NyYXBlclxyXG4gIGlmICh3aW5kb3cubG9jYXRpb24uaHJlZi5pbmNsdWRlcygnL215bmV0d29yay9pbnZpdGUtY29ubmVjdC9jb25uZWN0aW9ucy8nKSkge1xyXG4gICAgY29uc29sZS5sb2coXCJbU2NyYXBlcl0gT24gY29ubmVjdGlvbnMgcGFnZSwgZGVsZWdhdGluZyB0byBzY3JhcGVOZXR3b3JrXCIpO1xyXG4gICAgcmV0dXJuIGF3YWl0IHNjcmFwZU5ldHdvcmsoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHRhcmdldFVybCA9IHBheWxvYWQ/LnVybFxyXG5cclxuICAvLyBJZiB3ZSBuZWVkIHRvIG5hdmlnYXRlIHRvIHRoZSB0YXJnZXQgVVJMLCBkbyBzbyBhbmQgcmV0dXJuICduYXZpZ2F0aW5nJ1xyXG4gIGlmICh0YXJnZXRVcmwgJiYgIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKHRhcmdldFVybC5zcGxpdCgnPycpWzBdKSkge1xyXG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBOYXZpZ2F0aW5nIHRvIHRhcmdldCBVUkw6XCIsIHRhcmdldFVybClcclxuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdGFyZ2V0VXJsO1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgcGVuZGluZzogdHJ1ZSwgc3RhdHVzOiBcIm5hdmlnYXRpbmdcIiB9XHJcbiAgfVxyXG5cclxuICAvLyBXYWl0IGEgbW9tZW50IGZvciBTUEEgdG8gc2V0dGxlIGlmIGp1c3QgbmF2aWdhdGVkXHJcbiAgYXdhaXQgcmFuZG9tRGVsYXkoNTAwLCAxMDAwKVxyXG5cclxuICAvLyBTaW1wbGlmaWVkIHZhbGlkYXRpb246IGp1c3QgY2hlY2sgaWYgd2UncmUgb24gTGlua2VkSW4gYW5kIGhhdmUgcHJvZmlsZSBsaW5rc1xyXG4gIGNvbnN0IGN1cnJlbnRVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZlxyXG4gIGNvbnN0IGlzTGlua2VkSW4gPSBjdXJyZW50VXJsLmluY2x1ZGVzKCdsaW5rZWRpbi5jb20nKVxyXG5cclxuICAvLyBNb3JlIGNvbXByZWhlbnNpdmUgc2VsZWN0b3JzIGZvciBzZWFyY2ggcmVzdWx0c1xyXG4gIGNvbnN0IGhhc1NlYXJjaFJlc3VsdHMgPSAhIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXHJcbiAgICAnLnJldXNhYmxlLXNlYXJjaF9fcmVzdWx0LWNvbnRhaW5lciwgJyArXHJcbiAgICAnLmVudGl0eS1yZXN1bHQsICcgK1xyXG4gICAgJy5zZWFyY2gtcmVzdWx0cy1jb250YWluZXIsICcgK1xyXG4gICAgJ2RpdltkYXRhLXZpZXctbmFtZT1cInNlYXJjaC1yZXN1bHQtZW50aXR5XCJdLCAnICtcclxuICAgICcuc2VhcmNoLXJlc3VsdHNfX2xpc3QsICcgK1xyXG4gICAgJy5hcnRkZWNvLWxpc3QsICcgK1xyXG4gICAgJ1tjbGFzcyo9XCJzZWFyY2gtcmVzdWx0XCJdJ1xyXG4gIClcclxuXHJcbiAgLy8gQWxzbyBjaGVjayBpZiB3ZSdyZSBvbiBhIHBhZ2Ugd2l0aCByZXN1bHRzIGV2ZW4gaWYgVVJMIGRvZXNuJ3QgbWF0Y2ggZXhhY3RseVxyXG4gIGNvbnN0IGhhc1Blb3BsZVJlc3VsdHMgPSAhIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2FbaHJlZio9XCIvaW4vXCJdJylcclxuXHJcbiAgY29uc29sZS5sb2coXCJbU2NyYXBlcl0gVmFsaWRhdGlvbiAtIFVSTDpcIiwgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLCBcImlzTGlua2VkSW46XCIsIGlzTGlua2VkSW4sIFwiaGFzUmVzdWx0czpcIiwgaGFzU2VhcmNoUmVzdWx0cywgXCJoYXNQZW9wbGU6XCIsIGhhc1Blb3BsZVJlc3VsdHMpXHJcblxyXG4gIC8vIE5vdCBvbiBMaW5rZWRJbiBhdCBhbGwgLSBjYW4ndCBzY3JhcGVcclxuICBpZiAoIWlzTGlua2VkSW4pIHtcclxuICAgIGNvbnNvbGUud2FybihcIltTY3JhcGVyXSBOb3Qgb24gTGlua2VkSW4uIFVSTDpcIiwgY3VycmVudFVybClcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFBsZWFzZSBnbyB0byBMaW5rZWRJbiBmaXJzdC4gQ3VycmVudCBwYWdlOiAke3dpbmRvdy5sb2NhdGlvbi5wYXRobmFtZX1gIH1cclxuICB9XHJcblxyXG4gIC8vIE9uIExpbmtlZEluIGJ1dCBub3Qgb24gYSBzZWFyY2gvcmVzdWx0cyBwYWdlIC0gYXV0by1uYXZpZ2F0ZSB0byBjb25uZWN0aW9ucyBwYWdlXHJcbiAgaWYgKCFoYXNTZWFyY2hSZXN1bHRzICYmICFoYXNQZW9wbGVSZXN1bHRzKSB7XHJcbiAgICBjb25zdCBmYWxsYmFja1VybCA9IFwiaHR0cHM6Ly93d3cubGlua2VkaW4uY29tL215bmV0d29yay9pbnZpdGUtY29ubmVjdC9jb25uZWN0aW9ucy9cIlxyXG4gICAgY29uc29sZS5sb2coXCJbU2NyYXBlcl0gTm8gcmVzdWx0cyBkZXRlY3RlZCBvbiBjdXJyZW50IHBhZ2UuIEF1dG8tbmF2aWdhdGluZyB0bzpcIiwgZmFsbGJhY2tVcmwpXHJcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGZhbGxiYWNrVXJsXHJcbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBwZW5kaW5nOiB0cnVlLCBzdGF0dXM6IFwibmF2aWdhdGluZ1wiLCBtZXNzYWdlOiBcIk5hdmlnYXRpbmcgdG8gY29ubmVjdGlvbnMgcGFnZS4uLlwiIH1cclxuICB9XHJcblxyXG4gIC8vIEF1dG8tc2Nyb2xsIHRvIHRyaWdnZXIgQVBJIGNhbGxzIGFuZCBsb2FkIHJlc3VsdHNcclxuICBhd2FpdCBhdXRvU2Nyb2xsKHVuZGVmaW5lZCwgNSlcclxuXHJcbiAgLy8gUG9sbCBidWZmZXIgdW50aWwgc3RhYmxlICh3YWl0cyBmb3IgYWxsIEFQSSByZXNwb25zZXMpIGluc3RlYWQgb2YgYSBmaXhlZCBkZWxheVxyXG4gIGxldCBsZWFkcyA9IGF3YWl0IHBvbGxCdWZmZXIoJ3NlYXJjaCcsIDUwMDApXHJcblxyXG4gIGlmIChsZWFkcy5sZW5ndGggPT09IDApIHtcclxuICAgIC8vIFNUUkFURUdZOiBGaW5kIGFsbCBwcm9maWxlIGxpbmtzIG9uIHRoZSBwYWdlLCBncm91cCBieSBjb250YWluZXIsIGFuZCBleHRyYWN0IGRhdGFcclxuICAgIGNvbnNvbGUubG9nKCdbU2NyYXBlcl0gVXNpbmcgbGluay1iYXNlZCBjb250YWluZXIgZGlzY292ZXJ5Jyk7XHJcbiAgICBcclxuICAgIC8vIEZpbmQgYWxsIHByb2ZpbGUgbGlua3Mgb24gdGhlIHBhZ2VcclxuICAgIGNvbnN0IGFsbFByb2ZpbGVMaW5rcyA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYVtocmVmKj1cIi9pbi9cIl0nKSkgYXMgSFRNTEFuY2hvckVsZW1lbnRbXTtcclxuICAgIGNvbnNvbGUubG9nKGBbU2NyYXBlcl0gRm91bmQgJHthbGxQcm9maWxlTGlua3MubGVuZ3RofSBwcm9maWxlIGxpbmtzIHRvdGFsYCk7XHJcbiAgICBcclxuICAgIC8vIEdyb3VwIGxpbmtzIGJ5IHRoZWlyIGNsb3Nlc3QgbGlzdCBpdGVtIG9yIGNvbnRhaW5lciBhbmNlc3RvclxyXG4gICAgY29uc3QgY29udGFpbmVyTWFwID0gbmV3IE1hcDxFbGVtZW50LCBIVE1MQW5jaG9yRWxlbWVudFtdPigpO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGxpbmsgb2YgYWxsUHJvZmlsZUxpbmtzKSB7XHJcbiAgICAgICAgLy8gU2tpcCBsaW5rcyB0aGF0IGFyZSBjbGVhcmx5IG5vdCBwZW9wbGUgKGNvbXBhbmllcywgam9icywgZXRjKVxyXG4gICAgICAgIGNvbnN0IGhyZWYgPSBsaW5rLmhyZWYgfHwgJyc7XHJcbiAgICAgICAgaWYgKGhyZWYuaW5jbHVkZXMoJy9jb21wYW55LycpIHx8IGhyZWYuaW5jbHVkZXMoJy9qb2JzLycpIHx8IGhyZWYuaW5jbHVkZXMoJy9zY2hvb2wvJykpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNraXAgbGlua3MgaW5zaWRlIFwibXV0dWFsIGNvbm5lY3Rpb25cIiBlbGVtZW50c1xyXG4gICAgICAgIGxldCBpc011dHVhbENvbm5lY3Rpb24gPSBmYWxzZTtcclxuICAgICAgICBsZXQgcGFyZW50ID0gbGluay5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNCAmJiBwYXJlbnQ7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0ID0gcGFyZW50LnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpIHx8ICcnO1xyXG4gICAgICAgICAgICBpZiAodGV4dC5pbmNsdWRlcygnaXMgYSBtdXR1YWwgY29ubmVjdGlvbicpIHx8IFxyXG4gICAgICAgICAgICAgICAgdGV4dC5pbmNsdWRlcygnbXV0dWFsIGNvbm5lY3Rpb25zJykgfHxcclxuICAgICAgICAgICAgICAgIHBhcmVudC5jbGFzc0xpc3QuY29udGFpbnMoJ3JldXNhYmxlLXNlYXJjaC1zaW1wbGUtaW5zaWdodF9fdGV4dCcpIHx8XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdyZXVzYWJsZS1zZWFyY2gtc2ltcGxlLWluc2lnaHQnKSkge1xyXG4gICAgICAgICAgICAgICAgaXNNdXR1YWxDb25uZWN0aW9uID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnRFbGVtZW50O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaXNNdXR1YWxDb25uZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbU2NyYXBlciBERUJVR10gU2tpcHBpbmcgbXV0dWFsIGNvbm5lY3Rpb24gbGluaycpO1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gRmluZCB0aGUgY2xvc2VzdCBjb250YWluZXIgKGxpLCBvciBkaXYgd2l0aCBzcGVjaWZpYyBhdHRyaWJ1dGVzKVxyXG4gICAgICAgIGxldCBjb250YWluZXI6IEVsZW1lbnQgfCBudWxsID0gbGluaztcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDYgJiYgY29udGFpbmVyOyBpKyspIHtcclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIGdvb2QgY29udGFpbmVyXHJcbiAgICAgICAgICAgIGlmIChjb250YWluZXIudGFnTmFtZSA9PT0gJ0xJJyB8fCBcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtdmlldy1uYW1lJyk/LmluY2x1ZGVzKCdzZWFyY2gtcmVzdWx0JykgfHxcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ2VudGl0eS1yZXN1bHQnKSB8fFxyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucygncmV1c2FibGUtc2VhcmNoX19yZXN1bHQtY29udGFpbmVyJykgfHxcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2hhbWVsZW9uLXJlc3VsdC11cm4nKSkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29udGFpbmVyID0gY29udGFpbmVyLnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChjb250YWluZXIgJiYgY29udGFpbmVyICE9PSBsaW5rKSB7XHJcbiAgICAgICAgICAgIGlmICghY29udGFpbmVyTWFwLmhhcyhjb250YWluZXIpKSB7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXJNYXAuc2V0KGNvbnRhaW5lciwgW10pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnRhaW5lck1hcC5nZXQoY29udGFpbmVyKSEucHVzaChsaW5rKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbU2NyYXBlcl0gR3JvdXBlZCBpbnRvICR7Y29udGFpbmVyTWFwLnNpemV9IHVuaXF1ZSBjb250YWluZXJzYCk7XHJcbiAgICBcclxuICAgIGxldCBpbmRleCA9IDA7XHJcbiAgICBmb3IgKGNvbnN0IFtjb250YWluZXIsIGxpbmtzXSBvZiBjb250YWluZXJNYXApIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBVc2UgdGhlIGZpcnN0IHZhbGlkIGxpbmtcclxuICAgICAgICAgICAgY29uc3QgdGl0bGVMaW5rID0gbGlua3NbMF07XHJcbiAgICAgICAgICAgIGlmICghdGl0bGVMaW5rPy5ocmVmKSBjb250aW51ZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFNraXAgY29tcGFueS9qb2IgbGlua3NcclxuICAgICAgICAgICAgY29uc3QgaHJlZiA9IHRpdGxlTGluay5ocmVmO1xyXG4gICAgICAgICAgICBpZiAoaHJlZi5pbmNsdWRlcygnL2NvbXBhbnkvJykgfHwgaHJlZi5pbmNsdWRlcygnL2pvYnMvJykpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU2NyYXBlciBERUJVR10gQ29udGFpbmVyICR7aW5kZXh9OiBTa2lwcGluZyBub24tcGVyc29uIGxpbmtgKTtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBFeHRyYWN0IG5hbWUgZnJvbSB0aGUgbGlua1xyXG4gICAgICAgICAgICBsZXQgbmFtZVRleHQgPSBcIlwiO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gU3RyYXRlZ3kgMTogYXJpYS1oaWRkZW4gc3BhbiAodmlzaWJsZSBuYW1lKVxyXG4gICAgICAgICAgICBjb25zdCBhcmlhU3BhbiA9IHRpdGxlTGluay5xdWVyeVNlbGVjdG9yKCdzcGFuW2FyaWEtaGlkZGVuPVwidHJ1ZVwiXScpO1xyXG4gICAgICAgICAgICBpZiAoYXJpYVNwYW4/LnRleHRDb250ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0eHQgPSBhcmlhU3Bhbi50ZXh0Q29udGVudC50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodHh0ICYmICF0eHQubWF0Y2goL1N0YXR1cyBpcy9pKSAmJiAhdHh0Lm1hdGNoKC9Qcm92aWRlcyBzZXJ2aWNlcy9pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWVUZXh0ID0gdHh0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBTdHJhdGVneSAyOiBXYWxrIHRleHQgbm9kZXNcclxuICAgICAgICAgICAgaWYgKCFuYW1lVGV4dCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcih0aXRsZUxpbmssIE5vZGVGaWx0ZXIuU0hPV19URVhULCBudWxsKTtcclxuICAgICAgICAgICAgICAgIGxldCBub2RlO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKG5vZGUgPSB3YWxrZXIubmV4dE5vZGUoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR4dCA9IG5vZGUudGV4dENvbnRlbnQ/LnRyaW0oKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHh0ICYmICF0eHQubWF0Y2goL1N0YXR1cyBpcy9pKSAmJiAhdHh0Lm1hdGNoKC9Qcm92aWRlcyBzZXJ2aWNlcy9pKSAmJiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgIXR4dC5tYXRjaCgvXlZpZXcvaSkgJiYgIXR4dC5tYXRjaCgvXltcdTIwMjJcdTAwQjddLykgJiYgdHh0Lmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZVRleHQgPSB0eHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gU3RyYXRlZ3kgMzogaW5uZXJUZXh0IGNsZWFudXBcclxuICAgICAgICAgICAgaWYgKCFuYW1lVGV4dCAmJiB0aXRsZUxpbmsuaW5uZXJUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBuYW1lVGV4dCA9IHRpdGxlTGluay5pbm5lclRleHRcclxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvU3RhdHVzIGlzLiokL2dtaSwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1Byb3ZpZGVzIHNlcnZpY2VzLiokL2dtaSwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1ZpZXcuKnByb2ZpbGUvZ2ksICcnKVxyXG4gICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9bXHUyMDIyXHUwMEI3XVxccypcXGQrL2csICcnKVxyXG4gICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9bXFxuXFxzXSsvZywgJyAnKVxyXG4gICAgICAgICAgICAgICAgICAgIC50cmltKClcclxuICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyAnKVxyXG4gICAgICAgICAgICAgICAgICAgIC5zbGljZSgwLCAzKVxyXG4gICAgICAgICAgICAgICAgICAgIC5qb2luKCcgJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghbmFtZVRleHQgfHwgbmFtZVRleHQgPT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU2NyYXBlciBERUJVR10gQ29udGFpbmVyICR7aW5kZXh9OiBObyB2YWxpZCBuYW1lLCBza2lwcGluZ2ApO1xyXG4gICAgICAgICAgICAgICAgaW5kZXgrKztcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBFeHRyYWN0IHByb2ZpbGUgVVJMXHJcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGVVcmwgPSBocmVmLnNwbGl0KCc/JylbMF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBGaW5kIGhlYWRsaW5lIC0gbG9vayBpbiBjb250YWluZXIgZm9yIHN1YnRpdGxlLWxpa2UgZWxlbWVudHNcclxuICAgICAgICAgICAgbGV0IGhlYWRsaW5lVGV4dCA9IFwiXCI7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1YnRpdGxlRWwgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcihcclxuICAgICAgICAgICAgICAgICdkaXZbZGF0YS12aWV3LW5hbWU9XCJzZWFyY2gtcmVzdWx0LXN1YnRpdGxlXCJdLCAnICtcclxuICAgICAgICAgICAgICAgICdbZGF0YS12aWV3LW5hbWU9XCJzZWFyY2gtcmVzdWx0LWVudGl0eS1zdWJsYWJlbFwiXSwgJyArXHJcbiAgICAgICAgICAgICAgICAnLmVudGl0eS1yZXN1bHRfX3ByaW1hcnktc3VidGl0bGUsICcgK1xyXG4gICAgICAgICAgICAgICAgJ2Rpdi50LTE0LnQtYmxhY2snICAvLyBDb21tb24gTGlua2VkSW4gaGVhZGxpbmUgc3R5bGVcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgaWYgKHN1YnRpdGxlRWwpIHtcclxuICAgICAgICAgICAgICAgIGhlYWRsaW5lVGV4dCA9IHN1YnRpdGxlRWwudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBcIlwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBGaW5kIGxvY2F0aW9uIC0gdHlwaWNhbGx5IGluIHQtMTQudC1ub3JtYWwgZGl2cyBhZnRlciBoZWFkbGluZVxyXG4gICAgICAgICAgICBsZXQgbG9jYXRpb25UZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgY29uc3QgbG9jYXRpb25FbCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKFxyXG4gICAgICAgICAgICAgICAgJ2Rpdi50LTE0LnQtbm9ybWFsOm5vdCgudC1ibGFjayknICAvLyBMb2NhdGlvbiBpcyB0LW5vcm1hbCB3aXRob3V0IHQtYmxhY2tcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgaWYgKGxvY2F0aW9uRWwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBsb2NhdGlvbkVsLnRleHRDb250ZW50Py50cmltKCkgfHwgXCJcIjtcclxuICAgICAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgbm9uLWxvY2F0aW9uIHRleHQgKGxpa2UgY29ubmVjdGlvbiBjb3VudHMpXHJcbiAgICAgICAgICAgICAgICBpZiAodGV4dCAmJiAhdGV4dC5pbmNsdWRlcygnbXV0dWFsJykgJiYgIXRleHQuaW5jbHVkZXMoJ2Nvbm5lY3Rpb24nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uVGV4dCA9IHRleHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEZpbmQgc2VydmljZXMvYWJvdXQgLSBmcm9tIFwiUHJvdmlkZXMgc2VydmljZXNcIiBlbGVtZW50c1xyXG4gICAgICAgICAgICBsZXQgc2VydmljZXNUZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgY29uc3Qgc2VydmljZXNTdHJvbmcgPSBjb250YWluZXIucXVlcnlTZWxlY3Rvcignc3Ryb25nJyk7XHJcbiAgICAgICAgICAgIGlmIChzZXJ2aWNlc1N0cm9uZz8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdQcm92aWRlcyBzZXJ2aWNlcycpKSB7XHJcbiAgICAgICAgICAgICAgICBzZXJ2aWNlc1RleHQgPSBzZXJ2aWNlc1N0cm9uZy50ZXh0Q29udGVudC50cmltKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gQWxzbyBjaGVjayBmb3Igc2VydmljZXMgaW4gb3RoZXIgZWxlbWVudHNcclxuICAgICAgICAgICAgaWYgKCFzZXJ2aWNlc1RleHQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGFsbEVsZW1lbnRzID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJyonKTtcclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShhbGxFbGVtZW50cykpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gZWwudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dC5zdGFydHNXaXRoKCdQcm92aWRlcyBzZXJ2aWNlcycpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZpY2VzVGV4dCA9IHRleHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gRmluZCBhdmF0YXIgLSBsb29rIGZvciBwcm9maWxlIGltYWdlc1xyXG4gICAgICAgICAgICBsZXQgYXZhdGFyVXJsID0gXCJcIjtcclxuICAgICAgICAgICAgY29uc3QgYWxsSW1hZ2VzID0gQXJyYXkuZnJvbShjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCgnaW1nJykpO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGltZyBvZiBhbGxJbWFnZXMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHNyYyA9IGltZy5zcmMgfHwgJyc7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3JjLmluY2x1ZGVzKCdsaWNkbi5jb20nKSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgc3JjLmluY2x1ZGVzKCdwcm9maWxlLWRpc3BsYXlwaG90bycpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgIHNyYy5pbmNsdWRlcygnL2Rtcy9pbWFnZScpXHJcbiAgICAgICAgICAgICAgICApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyVXJsID0gc3JjO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBJZiBubyBhdmF0YXIgaW4gY29udGFpbmVyLCBjaGVjayBzaWJsaW5nc1xyXG4gICAgICAgICAgICBpZiAoIWF2YXRhclVybCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gY29udGFpbmVyLnBhcmVudEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2libGluZ0ltZ3MgPSBBcnJheS5mcm9tKHBhcmVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbWcnKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBpbWcgb2Ygc2libGluZ0ltZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3JjID0gaW1nLnNyYyB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNyYy5pbmNsdWRlcygncHJvZmlsZS1kaXNwbGF5cGhvdG8nKSB8fCBzcmMuaW5jbHVkZXMoJy9kbXMvaW1hZ2UnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhdGFyVXJsID0gc3JjO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxlYWRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBuYW1lVGV4dCxcclxuICAgICAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBwcm9maWxlVXJsLFxyXG4gICAgICAgICAgICAgICAgaGVhZGxpbmU6IGhlYWRsaW5lVGV4dCxcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uOiBsb2NhdGlvblRleHQsXHJcbiAgICAgICAgICAgICAgICBzZXJ2aWNlczogc2VydmljZXNUZXh0LFxyXG4gICAgICAgICAgICAgICAgYXZhdGFyX3VybDogYXZhdGFyVXJsLFxyXG4gICAgICAgICAgICAgICAgc291cmNlOiBcImxlYWQtZXh0cmFjdG9yXCJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU2NyYXBlcl0gRXh0cmFjdGVkIGxlYWQgJHtpbmRleH06ICR7bmFtZVRleHR9YCk7XHJcbiAgICAgICAgICAgIGluZGV4Kys7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtTY3JhcGVyXSBGYWlsZWQgdG8gcGFyc2UgY29udGFpbmVyICR7aW5kZXh9OmAsIGVycik7XHJcbiAgICAgICAgICAgIGluZGV4Kys7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICBjb25zb2xlLmxvZyhgW1NlYXJjaF0gU3VjY2VzcyEgVXNpbmcgJHtsZWFkcy5sZW5ndGh9IGxlYWRzIGZyb20gQVBJIGJ1ZmZlcmApXHJcbiAgfVxyXG5cclxuICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcclxuICBjb25zb2xlLmxvZyhgW1NlYXJjaF0gRmluYWwgZXh0cmFjdGlvbiBjb3VudDogJHt1bmlxdWVMZWFkcy5sZW5ndGh9YClcclxuICBjb25zb2xlLmxvZyhgW1NlYXJjaF0gUmF3IGxlYWRzIGJlZm9yZSBkZWR1cDogJHtsZWFkcy5sZW5ndGh9YClcclxuICBcclxuICBpZiAodW5pcXVlTGVhZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAvLyBEZWJ1Zzogc2hvdyB3aGF0IHRoZSBhY3R1YWwgcGFnZSBzdHJ1Y3R1cmUgbG9va3MgbGlrZVxyXG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBERUJVRzogQ2hlY2tpbmcgcGFnZSBzdHJ1Y3R1cmUuLi5cIilcclxuICAgIGNvbnNvbGUubG9nKFwiW1NlYXJjaF0gREVCVUc6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpLnJldXNhYmxlLXNlYXJjaF9fcmVzdWx0LWNvbnRhaW5lcicpXCIsIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpLnJldXNhYmxlLXNlYXJjaF9fcmVzdWx0LWNvbnRhaW5lcicpKVxyXG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBERUJVRzogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtdmlldy1uYW1lPXNlYXJjaC1lbnRpdHktcmVzdWx0LXVuaXZlcnNhbC10ZW1wbGF0ZV0nKVwiLCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdkaXZbZGF0YS12aWV3LW5hbWU9XCJzZWFyY2gtZW50aXR5LXJlc3VsdC11bml2ZXJzYWwtdGVtcGxhdGVcIl0nKSlcclxuICAgIGNvbnNvbGUubG9nKFwiW1NlYXJjaF0gREVCVUc6IEFsbCBhW2hyZWYqPScvaW4vJ10gbGlua3M6XCIsIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2FbaHJlZio9XCIvaW4vXCJdJykubGVuZ3RoKVxyXG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBERUJVRzogQ3VycmVudCBVUkw6XCIsIHdpbmRvdy5sb2NhdGlvbi5ocmVmKVxyXG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBERUJVRzogZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgc2FtcGxlOlwiLCBkb2N1bWVudC5ib2R5LmlubmVySFRNTC5zdWJzdHJpbmcoMCwgNTAwKSlcclxuICB9XHJcbiAgXHJcbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlQ29tbWVudHMoKSB7XHJcbiAgY29uc29sZS5sb2coXCJbQ29tbWVudHNdIFNjb3BpbmcgY29tbWVudHMgc2VjdGlvbi4uLlwiKVxyXG4gIFxyXG4gIGNvbnN0IHNob3dNb3JlQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbW1lbnRzLWNvbW1lbnRzLWxpc3RfX2xvYWQtbW9yZS1jb21tZW50cy1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudFxyXG4gIGlmIChzaG93TW9yZUJ0bikge1xyXG4gICAgc2hvd01vcmVCdG4uY2xpY2soKVxyXG4gICAgYXdhaXQgcmFuZG9tRGVsYXkoMjAwMCwgMzAwMClcclxuICB9XHJcblxyXG4gIC8vIENoZWNrIGJ1ZmZlciBmaXJzdFxyXG4gIGxldCBsZWFkcyA9IFsuLi52b3lhZ2VyQnVmZmVyLmNvbW1lbnRzXVxyXG4gIHZveWFnZXJCdWZmZXIuY29tbWVudHMgPSBbXVxyXG5cclxuICBpZiAobGVhZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcIltDb21tZW50c10gQnVmZmVyIGVtcHR5LCB1c2luZyBET00gZmFsbGJhY2tcIilcclxuICAgIGNvbnN0IGNvbW1lbnRJdGVtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb21tZW50cy1jb21tZW50LWl0ZW0sIC5jb21tZW50cy1wb3N0LW1ldGFfX25hbWUnKVxyXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIEFycmF5LmZyb20oY29tbWVudEl0ZW1zKSkge1xyXG4gICAgICBjb25zdCBsaW5rID0gaXRlbS5xdWVyeVNlbGVjdG9yKCdhW2hyZWYqPVwiL2luL1wiXScpIGFzIEhUTUxBbmNob3JFbGVtZW50IHx8IChpdGVtLnRhZ05hbWUgPT09ICdBJyA/IGl0ZW0gOiBudWxsKVxyXG4gICAgICBpZiAoIWxpbmspIGNvbnRpbnVlXHJcblxyXG4gICAgICBjb25zdCBocmVmID0gbGluay5ocmVmLnNwbGl0KCc/JylbMF1cclxuICAgICAgY29uc3QgbmFtZSA9IGxpbmsuaW5uZXJUZXh0LnNwbGl0KCdcXG4nKVswXS50cmltKClcclxuXHJcbiAgICAgIGlmIChuYW1lICYmIGhyZWYuaW5jbHVkZXMoJy9pbi8nKSAmJiBuYW1lICE9PSBcIkxpbmtlZEluIE1lbWJlclwiKSB7XHJcbiAgICAgICAgbGVhZHMucHVzaCh7XHJcbiAgICAgICAgICBmdWxsX25hbWU6IG5hbWUsXHJcbiAgICAgICAgICBwcm9maWxlX3VybDogaHJlZixcclxuICAgICAgICAgIGhlYWRsaW5lOiBcIkNvbW1lbnRlclwiLFxyXG4gICAgICAgICAgc291cmNlOiBcImNvbW1lbnRzLWRvbVwiXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICBjb25zb2xlLmxvZyhgW0NvbW1lbnRzXSBTdWNjZXNzISBFeHRyYWN0ZWQgJHtsZWFkcy5sZW5ndGh9IGxlYWRzIGZyb20gQVBJIGJ1ZmZlcmApXHJcbiAgfVxyXG5cclxuICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcclxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVSZWFjdGlvbnMoKSB7XHJcbiAgY29uc29sZS5sb2coXCJbUmVhY3Rpb25zXSBTY29waW5nIHJlYWN0aW9ucyBtb2RhbC4uLlwiKVxyXG4gIFxyXG4gIGNvbnN0IG1vZGFsID0gYXdhaXQgd2FpdEZvckVsZW1lbnQoJy5zb2NpYWwtZGV0YWlscy1yZWFjdG9ycy1tb2RhbF9fY29udGVudCwgLmFydGRlY28tbW9kYWxfX2NvbnRlbnQnKVxyXG4gIGlmICghbW9kYWwpIHtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQbGVhc2Ugb3BlbiB0aGUgcmVhY3Rpb25zIGxpc3QgKGNsaWNrIG9uIHRoZSByZWFjdGlvbiBpY29ucykgYmVmb3JlIGV4dHJhY3RpbmcuXCIgfVxyXG4gIH1cclxuXHJcbiAgYXdhaXQgYXV0b1Njcm9sbCgnLnNvY2lhbC1kZXRhaWxzLXJlYWN0b3JzLW1vZGFsX19jb250ZW50LCAuYXJ0ZGVjby1tb2RhbF9fY29udGVudCcsIDUpXHJcblxyXG4gIC8vIENoZWNrIGJ1ZmZlclxyXG4gIGxldCBsZWFkcyA9IFsuLi52b3lhZ2VyQnVmZmVyLnJlYWN0aW9uc11cclxuICB2b3lhZ2VyQnVmZmVyLnJlYWN0aW9ucyA9IFtdXHJcblxyXG4gIGlmIChsZWFkcy5sZW5ndGggPT09IDApIHtcclxuICAgIGNvbnNvbGUubG9nKFwiW1JlYWN0aW9uc10gQnVmZmVyIGVtcHR5LCB1c2luZyBET00gZmFsbGJhY2tcIilcclxuICAgIGNvbnN0IHJlYWN0b3JJdGVtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5zb2NpYWwtZGV0YWlscy1yZWFjdG9ycy1tb2RhbF9faXRlbSwgLmFydGRlY28tbW9kYWxfX2NvbnRlbnQgbGknKVxyXG5cclxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBBcnJheS5mcm9tKHJlYWN0b3JJdGVtcykpIHtcclxuICAgICAgY29uc3QgbGluayA9IGl0ZW0ucXVlcnlTZWxlY3RvcignYVtocmVmKj1cIi9pbi9cIl0nKSBhcyBIVE1MQW5jaG9yRWxlbWVudFxyXG4gICAgICBpZiAoIWxpbmspIGNvbnRpbnVlXHJcblxyXG4gICAgICBjb25zdCBocmVmID0gbGluay5ocmVmLnNwbGl0KCc/JylbMF1cclxuICAgICAgY29uc3QgbmFtZUVsID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcuYXJ0ZGVjby1lbnRpdHktbG9ja3VwX190aXRsZSwgLmFydGRlY28tZW50aXR5LWxvY2t1cF9fbmFtZScpXHJcbiAgICAgIGNvbnN0IGhlYWRsaW5lRWwgPSBpdGVtLnF1ZXJ5U2VsZWN0b3IoJy5hcnRkZWNvLWVudGl0eS1sb2NrdXBfX3N1YnRpdGxlLCAuYXJ0ZGVjby1lbnRpdHktbG9ja3VwX19jYXB0aW9uJylcclxuICAgICAgY29uc3QgbmFtZSA9IG5hbWVFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBcIlwiXHJcblxyXG4gICAgICBpZiAobmFtZSAmJiBocmVmLmluY2x1ZGVzKCcvaW4vJykgJiYgbmFtZSAhPT0gXCJMaW5rZWRJbiBNZW1iZXJcIikge1xyXG4gICAgICAgIGxlYWRzLnB1c2goe1xyXG4gICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxyXG4gICAgICAgICAgcHJvZmlsZV91cmw6IGhyZWYsXHJcbiAgICAgICAgICBoZWFkbGluZTogaGVhZGxpbmVFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBcIlJlYWN0b3JcIixcclxuICAgICAgICAgIHNvdXJjZTogXCJyZWFjdGlvbnMtZG9tXCJcclxuICAgICAgICB9KVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIGNvbnNvbGUubG9nKGBbUmVhY3Rpb25zXSBTdWNjZXNzISBFeHRyYWN0ZWQgJHtsZWFkcy5sZW5ndGh9IGxlYWRzIGZyb20gQVBJIGJ1ZmZlcmApXHJcbiAgfVxyXG5cclxuICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcclxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVHcm91cE1lbWJlcnMoKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcIltHcm91cHNdIFNjcmFwaW5nIGdyb3VwIG1lbWJlcnMuLi5cIilcclxuICAgIGlmICghd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXMoJy9ncm91cHMvJykpIHtcclxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGxlYXNlIGdvIHRvIHRoZSBHcm91cCBtZW1iZXJzIHBhZ2UgZmlyc3QuXCIgfVxyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IGF1dG9TY3JvbGwodW5kZWZpbmVkLCA1KVxyXG5cclxuICAgIGNvbnN0IGxlYWRzID0gW11cclxuICAgIGNvbnN0IHByb2ZpbGVMaW5rcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbnRpdHktcmVzdWx0X190aXRsZS10ZXh0IGEsIC5ncm91cHMtbWVtYmVycy1saXN0X19pdGVtIGEnKVxyXG5cclxuICAgIGZvciAoY29uc3QgbGluayBvZiBBcnJheS5mcm9tKHByb2ZpbGVMaW5rcykpIHtcclxuICAgICAgICBjb25zdCBocmVmID0gKGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnQpLmhyZWY/LnNwbGl0KCc/JylbMF1cclxuICAgICAgICBpZiAoIWhyZWYgfHwgIWhyZWYuaW5jbHVkZXMoJy9pbi8nKSkgY29udGludWVcclxuXHJcbiAgICAgICAgY29uc3QgcHVibGljSWQgPSBocmVmLnNwbGl0KCcvaW4vJylbMV0/LnNwbGl0KCcvJylbMF0gfHwgXCJcIlxyXG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IHZveWFnZXJCdWZmZXIucHJvZmlsZXMuZ2V0KHB1YmxpY0lkKVxyXG5cclxuICAgICAgICBpZiAoY2FjaGVkKSB7XHJcbiAgICAgICAgICAgIGxlYWRzLnB1c2goeyAuLi5jYWNoZWQsIHNvdXJjZTogXCJhcGktZ3JvdXBcIiB9KVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGxpbmsuY2xvc2VzdCgnLmVudGl0eS1yZXN1bHQsIC5ncm91cHMtbWVtYmVycy1saXN0X19pdGVtJylcclxuICAgICAgICAgICAgY29uc3QgbmFtZUVsID0gY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yKCcuZW50aXR5LXJlc3VsdF9fdGl0bGUtdGV4dCwgLmdyb3Vwcy1tZW1iZXJzLWxpc3RfX25hbWUnKVxyXG4gICAgICAgICAgICBjb25zdCBoZWFkbGluZUVsID0gY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yKCcuZW50aXR5LXJlc3VsdF9fcHJpbWFyeS1zdWJ0aXRsZSwgLmdyb3Vwcy1tZW1iZXJzLWxpc3RfX2hlYWRsaW5lJylcclxuICAgICAgICAgICAgY29uc3QgYXZhdGFyRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpIGFzIEhUTUxJbWFnZUVsZW1lbnRcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBuYW1lRWw/LnRleHRDb250ZW50Py5zcGxpdCgnXFxuJylbMF0/LnRyaW0oKSB8fCBcIlwiXHJcbiAgICAgICAgICAgIGlmIChuYW1lICYmIG5hbWUgIT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcclxuICAgICAgICAgICAgICAgIGxlYWRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGZ1bGxfbmFtZTogbmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBwcm9maWxlX3VybDogaHJlZixcclxuICAgICAgICAgICAgICAgICAgICBoZWFkbGluZTogaGVhZGxpbmVFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBcIkdyb3VwIE1lbWJlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGF2YXRhcl91cmw6IGF2YXRhckVsPy5zcmMgfHwgXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IFwiZ3JvdXAtZG9tXCJcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdW5pcXVlTGVhZHMgPSBBcnJheS5mcm9tKG5ldyBNYXAobGVhZHMubWFwKGwgPT4gW2wucHJvZmlsZV91cmwsIGxdKSkudmFsdWVzKCkpXHJcbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVFdmVudEF0dGVuZGVlcygpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiW0V2ZW50c10gU2NyYXBpbmcgZXZlbnQgYXR0ZW5kZWVzLi4uXCIpXHJcbiAgICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCcvZXZlbnRzLycpKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIlBsZWFzZSBnbyB0byB0aGUgRXZlbnQgYXR0ZW5kZWVzIHBhZ2UgZmlyc3QuXCIgfVxyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IGF1dG9TY3JvbGwodW5kZWZpbmVkLCA1KVxyXG5cclxuICAgIGNvbnN0IGxlYWRzID0gW11cclxuICAgIGNvbnN0IHByb2ZpbGVMaW5rcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbnRpdHktcmVzdWx0X190aXRsZS10ZXh0IGEnKVxyXG5cclxuICAgIGZvciAoY29uc3QgbGluayBvZiBBcnJheS5mcm9tKHByb2ZpbGVMaW5rcykpIHtcclxuICAgICAgICBjb25zdCBocmVmID0gKGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnQpLmhyZWY/LnNwbGl0KCc/JylbMF1cclxuICAgICAgICBpZiAoIWhyZWYgfHwgIWhyZWYuaW5jbHVkZXMoJy9pbi8nKSkgY29udGludWVcclxuXHJcbiAgICAgICAgY29uc3QgcHVibGljSWQgPSBocmVmLnNwbGl0KCcvaW4vJylbMV0/LnNwbGl0KCcvJylbMF0gfHwgXCJcIlxyXG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IHZveWFnZXJCdWZmZXIucHJvZmlsZXMuZ2V0KHB1YmxpY0lkKVxyXG5cclxuICAgICAgICBpZiAoY2FjaGVkKSB7XHJcbiAgICAgICAgICAgIGxlYWRzLnB1c2goeyAuLi5jYWNoZWQsIHNvdXJjZTogXCJhcGktZXZlbnRcIiB9KVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGxpbmsuY2xvc2VzdCgnLmVudGl0eS1yZXN1bHQnKVxyXG4gICAgICAgICAgICBjb25zdCBuYW1lRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJy5lbnRpdHktcmVzdWx0X190aXRsZS10ZXh0JylcclxuICAgICAgICAgICAgY29uc3QgaGVhZGxpbmVFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignLmVudGl0eS1yZXN1bHRfX3ByaW1hcnktc3VidGl0bGUnKVxyXG4gICAgICAgICAgICBjb25zdCBhdmF0YXJFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignaW1nJykgYXMgSFRNTEltYWdlRWxlbWVudFxyXG5cclxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IG5hbWVFbD8udGV4dENvbnRlbnQ/LnNwbGl0KCdcXG4nKVswXT8udHJpbSgpIHx8IFwiXCJcclxuICAgICAgICAgICAgaWYgKG5hbWUgJiYgbmFtZSAhPT0gXCJMaW5rZWRJbiBNZW1iZXJcIikge1xyXG4gICAgICAgICAgICAgICAgbGVhZHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBocmVmLFxyXG4gICAgICAgICAgICAgICAgICAgIGhlYWRsaW5lOiBoZWFkbGluZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8IFwiRXZlbnQgQXR0ZW5kZWVcIixcclxuICAgICAgICAgICAgICAgICAgICBhdmF0YXJfdXJsOiBhdmF0YXJFbD8uc3JjIHx8IFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgc291cmNlOiBcImV2ZW50LWRvbVwiXHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVuaXF1ZUxlYWRzID0gQXJyYXkuZnJvbShuZXcgTWFwKGxlYWRzLm1hcChsID0+IFtsLnByb2ZpbGVfdXJsLCBsXSkpLnZhbHVlcygpKVxyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlTmV0d29yaygpIHtcclxuICAgIC8vIElmIHdlIGFscmVhZHkgaGF2ZSBBUEktY2FwdHVyZWQgY29ubmVjdGlvbnMsIHVzZSB0aGVtIHJlZ2FyZGxlc3Mgb2YgcGFnZVxyXG4gICAgaWYgKHZveWFnZXJCdWZmZXIuY29ubmVjdGlvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGxlYWRzID0gWy4uLnZveWFnZXJCdWZmZXIuY29ubmVjdGlvbnNdO1xyXG4gICAgICAgIHZveWFnZXJCdWZmZXIuY29ubmVjdGlvbnMgPSBbXTtcclxuICAgICAgICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSk7XHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTmF2aWdhdGUgdG8gY29ubmVjdGlvbnMgcGFnZSB0byB0cmlnZ2VyIHRoZSBBUEkgY2FsbFxyXG4gICAgaWYgKCF3aW5kb3cubG9jYXRpb24uaHJlZi5pbmNsdWRlcygnL215bmV0d29yay9pbnZpdGUtY29ubmVjdC9jb25uZWN0aW9ucy8nKSkge1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gXCJodHRwczovL3d3dy5saW5rZWRpbi5jb20vbXluZXR3b3JrL2ludml0ZS1jb25uZWN0L2Nvbm5lY3Rpb25zL1wiO1xyXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHBlbmRpbmc6IHRydWUsIHVybDogXCJodHRwczovL3d3dy5saW5rZWRpbi5jb20vbXluZXR3b3JrL2ludml0ZS1jb25uZWN0L2Nvbm5lY3Rpb25zL1wiIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT24gdGhlIGNvbm5lY3Rpb25zIHBhZ2UgXHUyMDE0IHNjcm9sbCB0byB0cmlnZ2VyIEFQSSB0aGVuIHBvbGwgYnVmZmVyXHJcbiAgICBhd2FpdCBhdXRvU2Nyb2xsKHVuZGVmaW5lZCwgNSk7XHJcbiAgICBsZXQgbGVhZHMgPSBhd2FpdCBwb2xsQnVmZmVyKCdjb25uZWN0aW9ucycsIDUwMDApO1xyXG5cclxuICAgIC8vIERPTSBmYWxsYmFjayBpZiBBUEkgZ2F2ZSBub3RoaW5nXHJcbiAgICBpZiAobGVhZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJbTmV0d29ya10gQnVmZmVyIGVtcHR5LCB1c2luZyBET00gZmFsbGJhY2tcIik7XHJcbiAgICAgICAgY29uc3QgY29ubmVjdGlvbkNhcmRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcclxuICAgICAgICAgICAgJy5tbi1jb25uZWN0aW9uLWNhcmQsICcgK1xyXG4gICAgICAgICAgICAnLm1uLWNvbm5lY3Rpb25zX19jYXJkLCAnICtcclxuICAgICAgICAgICAgJ2xpW2NsYXNzKj1cImNvbm5lY3Rpb25cIl0sICcgK1xyXG4gICAgICAgICAgICAnLnNjYWZmb2xkLWZpbml0ZS1zY3JvbGxfX2NvbnRlbnQgbGknXHJcbiAgICAgICAgKTtcclxuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgQXJyYXkuZnJvbShjb25uZWN0aW9uQ2FyZHMpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxpbmsgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ2FbaHJlZio9XCIvaW4vXCJdJykgYXMgSFRNTEFuY2hvckVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmICghbGluaykgY29udGludWU7XHJcbiAgICAgICAgICAgIC8vIFVzZSBhcmlhLWhpZGRlbiBzcGFuIHRvIGF2b2lkIHBpY2tpbmcgdXAgdmlzdWFsbHktaGlkZGVuIHN0YXR1cyB0ZXh0XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVMaW5rID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdhW2hyZWYqPVwiL2luL1wiXScpO1xyXG4gICAgICAgICAgICBjb25zdCBhcmlhTmFtZVNwYW4gPSBuYW1lTGluaz8ucXVlcnlTZWxlY3Rvcignc3BhblthcmlhLWhpZGRlbj1cInRydWVcIl0nKTtcclxuICAgICAgICAgICAgY29uc3QgZnVsbE5hbWUgPSBhcmlhTmFtZVNwYW4/LnRleHRDb250ZW50Py50cmltKCkgfHxcclxuICAgICAgICAgICAgICAgIGNhcmQucXVlcnlTZWxlY3RvcignW2NsYXNzKj1cIm5hbWVcIl0nKT8udGV4dENvbnRlbnRcclxuICAgICAgICAgICAgICAgICAgICA/LnJlcGxhY2UoL1N0YXR1cyBpcyAob25saW5lfG9mZmxpbmV8YXdheXxyZWNlbnRseSBhY3RpdmUpL2dpLCAnJylcclxuICAgICAgICAgICAgICAgICAgICA/LnRyaW0oKSB8fCBcIlwiO1xyXG4gICAgICAgICAgICBjb25zdCBoZWFkbGluZUVsID0gY2FyZC5xdWVyeVNlbGVjdG9yKFxyXG4gICAgICAgICAgICAgICAgJ1tjbGFzcyo9XCJvY2N1cGF0aW9uXCJdLCBbY2xhc3MqPVwic3VidGl0bGVcIl0sIFtjbGFzcyo9XCJoZWFkbGluZVwiXSwgW2NsYXNzKj1cInN1YmxpbmVcIl0nXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGxlYWRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBmdWxsTmFtZSxcclxuICAgICAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBjbGVhblByb2ZpbGVVcmwobGluay5ocmVmKSxcclxuICAgICAgICAgICAgICAgIGhlYWRsaW5lOiBoZWFkbGluZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8IFwiQ29ubmVjdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgYXZhdGFyX3VybDogKGNhcmQucXVlcnlTZWxlY3RvcignaW1nJykgYXMgSFRNTEltYWdlRWxlbWVudCk/LnNyYyB8fCBcIlwiLFxyXG4gICAgICAgICAgICAgICAgc291cmNlOiBcIm5ldHdvcmstZG9tXCJcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW05ldHdvcmtdIFN1Y2Nlc3MhIEV4dHJhY3RlZCAke2xlYWRzLmxlbmd0aH0gbGVhZHMgZnJvbSBBUEkgYnVmZmVyYCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdW5pcXVlTGVhZHMgPSBBcnJheS5mcm9tKG5ldyBNYXAobGVhZHMubWFwKGwgPT4gW2wucHJvZmlsZV91cmwsIGxdKSkudmFsdWVzKCkpO1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHZpZXdQcm9maWxlKHVybDogc3RyaW5nKSB7XHJcbiAgY29uc29sZS5sb2coXCJWaWV3aW5nIHByb2ZpbGU6XCIsIHVybClcclxuICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKHVybCkpIHtcclxuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsXHJcbiAgfVxyXG4gIGF3YWl0IHJhbmRvbURlbGF5KClcclxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc2VuZENvbm5lY3Rpb25SZXF1ZXN0KHVybDogc3RyaW5nLCBub3RlOiBzdHJpbmcpIHtcclxuICBjb25zb2xlLmxvZyhcIlNlbmRpbmcgY29ubmVjdGlvbiByZXF1ZXN0IHRvXCIsIHVybClcclxuICBcclxuICAvLyBTdHJhdGVneTogVHJ5IEFQSSBmaXJzdCwgZmFsbGJhY2sgdG8gRE9NXHJcbiAgY29uc3QgcHVibGljSWQgPSB1cmwuc3BsaXQoJy9pbi8nKVsxXT8uc3BsaXQoJy8nKVswXVxyXG4gIGlmIChwdWJsaWNJZCkge1xyXG4gICAgY29uc3QgYXBpUmVzdWx0ID0gYXdhaXQgc2VuZENvbm5lY3Rpb25SZXF1ZXN0VmlhQVBJKHB1YmxpY0lkLCBub3RlKVxyXG4gICAgaWYgKGFwaVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gYXBpUmVzdWx0XHJcbiAgICBjb25zb2xlLndhcm4oXCJbVm95YWdlcl0gQVBJIENvbm5lY3Rpb24gcmVxdWVzdCBmYWlsZWQsIGZhbGxpbmcgYmFjayB0byBET01cIilcclxuICB9XHJcblxyXG4gIGlmICghd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXModXJsKSkge1xyXG4gICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsXHJcbiAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgcGVuZGluZzogdHJ1ZSwgbWVzc2FnZTogXCJSZWRpcmVjdGVkIHRvIHByb2ZpbGVcIiB9XHJcbiAgfVxyXG4gIGF3YWl0IHJhbmRvbURlbGF5KDMwMDAsIDUwMDApXHJcbiAgXHJcbiAgY29uc3QgY29ubmVjdEJ0biA9IGF3YWl0IHdhaXRGb3JFbGVtZW50KCdidXR0b25bYXJpYS1sYWJlbF49XCJJbnZpdGVcIl1bY2xhc3MqPVwicHJpbWFyeS1hY3Rpb25cIl0nKSB8fCBcclxuICAgICAgICAgICAgICAgICAgICAgYXdhaXQgd2FpdEZvckVsZW1lbnQoJ2J1dHRvblthcmlhLWxhYmVsXj1cIkNvbm5lY3RcIl1bY2xhc3MqPVwicHJpbWFyeS1hY3Rpb25cIl0nKVxyXG4gICAgICAgICAgICAgICAgICAgICBcclxuICBpZiAoIWNvbm5lY3RCdG4pIHtcclxuICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiQ29ubmVjdCBidXR0b24gbm90IGZvdW5kXCIgfVxyXG4gIH1cclxuICBcclxuICAoY29ubmVjdEJ0biBhcyBIVE1MQnV0dG9uRWxlbWVudCkuY2xpY2soKVxyXG4gIGF3YWl0IHJhbmRvbURlbGF5KDEwMDAsIDIwMDApXHJcbiAgXHJcbiAgaWYgKG5vdGUpIHtcclxuICAgICAgY29uc3QgYWRkTm90ZUJ0biA9IGF3YWl0IHdhaXRGb3JFbGVtZW50KCdidXR0b25bYXJpYS1sYWJlbD1cIkFkZCBhIG5vdGVcIl0nKVxyXG4gICAgICBpZiAoYWRkTm90ZUJ0bikge1xyXG4gICAgICAgICAoYWRkTm90ZUJ0biBhcyBIVE1MQnV0dG9uRWxlbWVudCkuY2xpY2soKVxyXG4gICAgICAgICBhd2FpdCByYW5kb21EZWxheSgxMDAwLCAyMDAwKVxyXG4gICAgICAgICBcclxuICAgICAgICAgY29uc3QgdGV4dGFyZWEgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYVtuYW1lPVwibWVzc2FnZVwiXScpXHJcbiAgICAgICAgIGlmICh0ZXh0YXJlYSkge1xyXG4gICAgICAgICAgICAodGV4dGFyZWEgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWUgPSBub3RlXHJcbiAgICAgICAgICAgIHRleHRhcmVhLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSlcclxuICAgICAgICAgfVxyXG4gICAgICAgICBhd2FpdCByYW5kb21EZWxheSgxMDAwLCAyMDAwKVxyXG4gICAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIGNvbnN0IHNlbmRCdG4gPSBhd2FpdCB3YWl0Rm9yRWxlbWVudCgnYnV0dG9uW2FyaWEtbGFiZWw9XCJTZW5kIG5vd1wiXScpIHx8IGF3YWl0IHdhaXRGb3JFbGVtZW50KCdidXR0b25bYXJpYS1sYWJlbD1cIlNlbmRcIl0nKVxyXG4gIGlmIChzZW5kQnRuKSB7XHJcbiAgICAgIChzZW5kQnRuIGFzIEhUTUxCdXR0b25FbGVtZW50KS5jbGljaygpXHJcbiAgICAgIGF3YWl0IHJhbmRvbURlbGF5KDIwMDAsIDMwMDApXHJcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfVxyXG4gIH1cclxuICBcclxuICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiU2VuZCBidXR0b24gbm90IGZvdW5kXCIgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzZW5kTWVzc2FnZSh1cmw6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XHJcbiAgY29uc29sZS5sb2coXCJTZW5kaW5nIG1lc3NhZ2UgdG9cIiwgdXJsKVxyXG4gIC8vIENoZWNrIGlmIHdlIGhhdmUgYSB0aHJlYWRJZCBmcm9tIHRoZSBVUkwgb3IgcGF5bG9hZFxyXG4gIC8vIElmIG5vdCwgd2UgbWlnaHQgbmVlZCB0byBmaW5kIGl0XHJcbiAgcmV0dXJuIGF3YWl0IHNlbmRNZXNzYWdlVmlhQVBJKHVybCwgbWVzc2FnZSlcclxufVxyXG5cclxuLyoqXHJcbiAqIC0tLSBWT1lBR0VSIEFQSSBJTVBMRU1FTlRBVElPTlMgLS0tXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gZ2V0Q3NyZlRva2VuKCkge1xyXG4gIHJldHVybiBkb2N1bWVudC5jb29raWVcclxuICAgIC5zcGxpdCgnOyAnKVxyXG4gICAgLmZpbmQoYyA9PiBjLnN0YXJ0c1dpdGgoJ0pTRVNTSU9OSUQ9JykpXHJcbiAgICA/LnNwbGl0KCc9JylbMV1cclxuICAgID8ucmVwbGFjZSgvXCIvZywgJycpIHx8ICcnO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRWb3lhZ2VySGVhZGVycygpIHtcclxuICByZXR1cm4ge1xyXG4gICAgXCJhY2NlcHRcIjogXCJhcHBsaWNhdGlvbi92bmQubGlua2VkaW4ubm9ybWFsaXplZCtqc29uKzIuMVwiLFxyXG4gICAgXCJjc3JmLXRva2VuXCI6IGdldENzcmZUb2tlbigpLFxyXG4gICAgXCJ4LWxpLWxhbmdcIjogXCJlbl9VU1wiLFxyXG4gICAgXCJ4LXJlc3RsaS1wcm90b2NvbC12ZXJzaW9uXCI6IFwiMi4wLjBcIlxyXG4gIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNlbmRNZXNzYWdlVmlhQVBJKHRocmVhZElkOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xyXG4gIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gU2VuZGluZyBtZXNzYWdlIHRvIHRocmVhZCAke3RocmVhZElkfWApO1xyXG4gIFxyXG4gIC8vIElmIHRocmVhZElkIGlzIGEgVVJMLCB3ZSBuZWVkIHRvIGV4dHJhY3QgdGhlIGFjdHVhbCB0aHJlYWQgSUQgb3IgZmluZCBpdFxyXG4gIGlmICh0aHJlYWRJZC5zdGFydHNXaXRoKCdodHRwJykpIHtcclxuICAgIC8vIEF0dGVtcHQgdG8gZXh0cmFjdCB0aHJlYWQgSUQgZnJvbSBVUkwgaWYgcG9zc2libGUsIG90aGVyd2lzZSB3ZSBtaWdodCBuZWVkIHRvIGZldGNoIGNvbnZlcnNhdGlvbnMgdG8gZmluZCBpdFxyXG4gICAgY29uc29sZS53YXJuKFwiW1ZveWFnZXJdIHNlbmRNZXNzYWdlVmlhQVBJIHJlY2VpdmVkIGEgVVJMIGluc3RlYWQgb2YgdGhyZWFkSWQuIEZpbmRpbmcgdGhyZWFkLi4uXCIpO1xyXG4gICAgLy8gRm9yIG5vdywgYXNzdW1lIGl0J3MgYSB0aHJlYWQgSUQgb3Igd2UnbGwgbmVlZCBhIHdheSB0byByZXNvbHZlIGl0XHJcbiAgICBpZiAodGhyZWFkSWQuaW5jbHVkZXMoJy90aHJlYWQvJykpIHtcclxuICAgICAgICB0aHJlYWRJZCA9IHRocmVhZElkLnNwbGl0KCcvdGhyZWFkLycpWzFdLnNwbGl0KCcvJylbMF1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goYC92b3lhZ2VyL2FwaS9tZXNzYWdpbmcvY29udmVyc2F0aW9ucy8ke3RocmVhZElkfS9tZXNzYWdlc2AsIHtcclxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgIC4uLmdldFZveWFnZXJIZWFkZXJzKCksXHJcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIG1lc3NhZ2U6IHtcclxuICAgICAgICAgIGJvZHk6IHtcclxuICAgICAgICAgICAgdGV4dDogbWVzc2FnZVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHJlbmRlckNvbnRlbnRQb3N0QW5jaG9yOiBmYWxzZVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghcmVzcC5vaykge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTGlua2VkSW4gQVBJIHJlc3BvbmRlZCB3aXRoICR7cmVzcC5zdGF0dXN9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc29sZS5sb2coXCJbVm95YWdlcl0gTWVzc2FnZSBzZW50IHN1Y2Nlc3NmdWxseVwiKTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgY29uc29sZS5lcnJvcihcIltWb3lhZ2VyXSBGYWlsZWQgdG8gc2VuZCBtZXNzYWdlIHZpYSBBUEk6XCIsIGVycik7XHJcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzZW5kQ29ubmVjdGlvblJlcXVlc3RWaWFBUEkocHVibGljSWQ6IHN0cmluZywgbm90ZTogc3RyaW5nKSB7XHJcbiAgY29uc29sZS5sb2coYFtWb3lhZ2VyXSBTZW5kaW5nIGNvbm5lY3Rpb24gcmVxdWVzdCB0byAke3B1YmxpY0lkfWApO1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICAvLyBGaXJzdCwgd2UgbmVlZCB0aGUgcHJvZmlsZSBkYXRhIHRvIGdldCB0aGUgdHJhY2tpbmdJZCBhbmQgcHJvZmlsZUlkXHJcbiAgICBjb25zdCBwcm9maWxlUmVzcCA9IGF3YWl0IGZldGNoKGAvdm95YWdlci9hcGkvaWRlbnRpdHkvZGFzaC9wcm9maWxlcz9xPW1lbWJlcklkZW50aXR5Jm1lbWJlcklkZW50aXR5PSR7cHVibGljSWR9YCwge1xyXG4gICAgICBoZWFkZXJzOiBnZXRWb3lhZ2VySGVhZGVycygpXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaWYgKCFwcm9maWxlUmVzcC5vaykgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGZldGNoIHByb2ZpbGUgZm9yIGludml0YXRpb25cIik7XHJcbiAgICBcclxuICAgIGNvbnN0IHByb2ZpbGVEYXRhID0gYXdhaXQgcHJvZmlsZVJlc3AuanNvbigpO1xyXG4gICAgY29uc3QgcHJvZmlsZSA9IHByb2ZpbGVEYXRhLmluY2x1ZGVkPy5maW5kKChpOiBhbnkpID0+IGkuJHR5cGU/LmluY2x1ZGVzKFwiaWRlbnRpdHkuZGFzaC5Qcm9maWxlXCIpKTtcclxuICAgIGNvbnN0IGVudGl0eVVybiA9IHByb2ZpbGU/LmVudGl0eVVybiB8fCBcIlwiO1xyXG4gICAgY29uc3QgbWVtYmVySWQgPSBlbnRpdHlVcm4uc3BsaXQoJzonKS5wb3AoKTtcclxuXHJcbiAgICBpZiAoIW1lbWJlcklkKSB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgcmVzb2x2ZSBtZW1iZXIgSUQgZm9yIGludml0YXRpb25cIik7XHJcblxyXG4gICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xyXG4gICAgICB0cmFja2luZ0lkOiBcIlwiLCAvLyBVc3VhbGx5IG9wdGlvbmFsIG9yIGdlbmVyYXRlZFxyXG4gICAgICBpbnZpdGF0aW9uczogW3tcclxuICAgICAgICB0cmFja2luZ0lkOiBcIlwiLFxyXG4gICAgICAgIGludml0ZWU6IHtcclxuICAgICAgICAgIFwiY29tLmxpbmtlZGluLnZveWFnZXIuZ3Jvd3RoLmludml0YXRpb24uSW52aXRlZVByb2ZpbGVcIjoge1xyXG4gICAgICAgICAgICBwcm9maWxlSWQ6IGB1cm46bGk6ZnNfbWluaVByb2ZpbGU6JHttZW1iZXJJZH1gXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XVxyXG4gICAgfTtcclxuXHJcbiAgICBpZiAobm90ZSkge1xyXG4gICAgICBwYXlsb2FkLmludml0YXRpb25zWzBdLm1lc3NhZ2UgPSBub3RlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChcIi92b3lhZ2VyL2FwaS9ncm93dGgvbm9ybUludml0YXRpb25zXCIsIHtcclxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgIC4uLmdldFZveWFnZXJIZWFkZXJzKCksXHJcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcclxuICAgICAgfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZClcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghcmVzcC5vaykge1xyXG4gICAgICBjb25zdCBlcnJEYXRhID0gYXdhaXQgcmVzcC5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJEYXRhLm1lc3NhZ2UgfHwgYExpbmtlZEluIEFQSSByZXNwb25kZWQgd2l0aCAke3Jlc3Auc3RhdHVzfWApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnNvbGUubG9nKFwiW1ZveWFnZXJdIENvbm5lY3Rpb24gcmVxdWVzdCBzZW50IHN1Y2Nlc3NmdWxseVwiKTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgY29uc29sZS5lcnJvcihcIltWb3lhZ2VyXSBGYWlsZWQgdG8gc2VuZCBjb25uZWN0aW9uIHJlcXVlc3QgdmlhIEFQSTpcIiwgZXJyKTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ29udmVyc2F0aW9uc1ZpYUFQSSgpIHtcclxuICBjb25zb2xlLmxvZyhcIltWb3lhZ2VyXSBGZXRjaGluZyBjb252ZXJzYXRpb25zLi4uXCIpO1xyXG4gIFxyXG4gIHRyeSB7XHJcbiAgICAvLyAxLiBHZXQgbXkgb3duIHByb2ZpbGUgdG8gaWRlbnRpZnkgd2hpY2ggcGFydGljaXBhbnQgaXMgXCJtZVwiXHJcbiAgICBjb25zdCBtZVJlc3AgPSBhd2FpdCBmZXRjaChcIi92b3lhZ2VyL2FwaS9tZVwiLCB7IGhlYWRlcnM6IGdldFZveWFnZXJIZWFkZXJzKCkgfSk7XHJcbiAgICBjb25zdCBtZURhdGEgPSBhd2FpdCBtZVJlc3AuanNvbigpO1xyXG4gICAgY29uc3QgbXlVcm4gPSBtZURhdGEuZGF0YT8uW1wiKm1pbmlQcm9maWxlXCJdIHx8IG1lRGF0YS5pbmNsdWRlZD8uZmluZCgoaTogYW55KSA9PiBpLiR0eXBlPy5pbmNsdWRlcyhcIk1pbmlQcm9maWxlXCIpKT8uZW50aXR5VXJuO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhcIltWb3lhZ2VyXSBNeSBVUk46XCIsIG15VXJuKTtcclxuXHJcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goXCIvdm95YWdlci9hcGkvbWVzc2FnaW5nL2NvbnZlcnNhdGlvbnM/Y291bnQ9NDAmcT1hbGxcIiwge1xyXG4gICAgICBoZWFkZXJzOiBnZXRWb3lhZ2VySGVhZGVycygpXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIXJlc3Aub2spIHRocm93IG5ldyBFcnJvcihgU3RhdHVzICR7cmVzcC5zdGF0dXN9YCk7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xyXG4gICAgY29uc3QgaW5jbHVkZWQgPSBkYXRhLmluY2x1ZGVkIHx8IFtdO1xyXG4gICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGRhdGEuZWxlbWVudHMgfHwgW107XHJcblxyXG4gICAgLy8gQ3JlYXRlIGEgbG9va3VwIG1hcCBmb3IgbWluaVByb2ZpbGVzXHJcbiAgICBjb25zdCBwcm9maWxlTWFwID0gbmV3IE1hcCgpO1xyXG4gICAgaW5jbHVkZWQuZm9yRWFjaCgoaXRlbTogYW55KSA9PiB7XHJcbiAgICAgIGlmIChpdGVtLiR0eXBlPy5pbmNsdWRlcyhcIk1pbmlQcm9maWxlXCIpIHx8IGl0ZW0uJHR5cGU/LmluY2x1ZGVzKFwiaWRlbnRpdHkucHJvZmlsZS5Qcm9maWxlXCIpKSB7XHJcbiAgICAgICAgcHJvZmlsZU1hcC5zZXQoaXRlbS5lbnRpdHlVcm4sIGl0ZW0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gY29udmVyc2F0aW9ucy5tYXAoKGNvbnY6IGFueSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRocmVhZElkID0gY29udi5lbnRpdHlVcm4/LnNwbGl0KCc6JykucG9wKCk7XHJcbiAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBjb252Lmxhc3RNZXNzYWdlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEZpbmQgdGhlIG90aGVyIHBhcnRpY2lwYW50XHJcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnRzID0gY29udi5wYXJ0aWNpcGFudHMgfHwgW107XHJcbiAgICAgICAgY29uc3Qgb3RoZXJQYXJ0aWNpcGFudFVybiA9IHBhcnRpY2lwYW50cy5maW5kKChwOiBhbnkpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHVybiA9IHBbXCIqbWVzc2FnaW5nTWVtYmVyXCJdIHx8IHAubWVzc2FnaW5nTWVtYmVyO1xyXG4gICAgICAgICAgcmV0dXJuIHVybiAhPT0gbXlVcm47XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIFJlc29sdmUgcGFydGljaXBhbnQgZGV0YWlsc1xyXG4gICAgICAgIGNvbnN0IHByb2ZpbGVVcm4gPSBvdGhlclBhcnRpY2lwYW50VXJuID8gKG90aGVyUGFydGljaXBhbnRVcm5bXCIqbWVzc2FnaW5nTWVtYmVyXCJdIHx8IG90aGVyUGFydGljaXBhbnRVcm4pIDogbnVsbDtcclxuICAgICAgICAvLyBJbiBtZXNzYWdpbmcsIFVSTnMgbWlnaHQgYmUgbWVzc2FnaW5nTWVtYmVyLCB3ZSBuZWVkIHRvIG1hcCB0byBNaW5pUHJvZmlsZVxyXG4gICAgICAgIC8vIE9mdGVuIE1pbmlQcm9maWxlIFVSTnMgaGF2ZSB0aGUgc2FtZSBJRCBwYXJ0LlxyXG4gICAgICAgIGNvbnN0IG1lbWJlcklkUGFydCA9IHByb2ZpbGVVcm4/LnNwbGl0KCc6JykucG9wKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gTG9vayB0aHJvdWdoIGluY2x1ZGVkIGZvciBhIHByb2ZpbGUgbWF0Y2hpbmcgdGhpcyBJRCBvciBVUk5cclxuICAgICAgICBjb25zdCBwYXJ0aWNpcGFudFByb2ZpbGUgPSBpbmNsdWRlZC5maW5kKChpOiBhbnkpID0+IFxyXG4gICAgICAgICAgaS5lbnRpdHlVcm4/LmVuZHNXaXRoKG1lbWJlcklkUGFydCkgJiYgKGkuJHR5cGU/LmluY2x1ZGVzKFwiTWluaVByb2ZpbGVcIikgfHwgaS4kdHlwZT8uaW5jbHVkZXMoXCJQcm9maWxlXCIpKVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGxldCBsZWFkTmFtZSA9IFwiTGlua2VkSW4gTWVtYmVyXCI7XHJcbiAgICAgICAgbGV0IGxlYWRBdmF0YXIgPSBcIlwiO1xyXG4gICAgICAgIGxldCBwcm9maWxlVXJsID0gXCJcIjtcclxuICAgICAgICBsZXQgcHVibGljSWQgPSBcIlwiO1xyXG5cclxuICAgICAgICBpZiAocGFydGljaXBhbnRQcm9maWxlKSB7XHJcbiAgICAgICAgICBjb25zdCBmaXJzdE5hbWUgPSBwYXJ0aWNpcGFudFByb2ZpbGUuZmlyc3ROYW1lIHx8IFwiXCI7XHJcbiAgICAgICAgICBjb25zdCBsYXN0TmFtZSA9IHBhcnRpY2lwYW50UHJvZmlsZS5sYXN0TmFtZSB8fCBcIlwiO1xyXG4gICAgICAgICAgbGVhZE5hbWUgPSBgJHtmaXJzdE5hbWV9ICR7bGFzdE5hbWV9YC50cmltKCkgfHwgbGVhZE5hbWU7XHJcbiAgICAgICAgICBwdWJsaWNJZCA9IHBhcnRpY2lwYW50UHJvZmlsZS5wdWJsaWNJZGVudGlmaWVyIHx8IFwiXCI7XHJcbiAgICAgICAgICBwcm9maWxlVXJsID0gcHVibGljSWQgPyBgaHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luLyR7cHVibGljSWR9YCA6IFwiXCI7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGNvbnN0IHBpYyA9IHBhcnRpY2lwYW50UHJvZmlsZS5waWN0dXJlIHx8IHBhcnRpY2lwYW50UHJvZmlsZS5wcm9maWxlUGljdHVyZT8uZGlzcGxheUltYWdlUmVmZXJlbmNlPy52ZWN0b3JJbWFnZTtcclxuICAgICAgICAgIGlmIChwaWM/LnJvb3RVcmwgJiYgcGljPy5hcnRpZmFjdHM/Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICBsZWFkQXZhdGFyID0gYCR7cGljLnJvb3RVcmx9JHtwaWMuYXJ0aWZhY3RzW3BpYy5hcnRpZmFjdHMubGVuZ3RoIC0gMV0uZmlsZUlkZW50aWZ5aW5nVXJsUGF0aFNlZ21lbnR9YDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgdGhyZWFkX2lkOiB0aHJlYWRJZCxcclxuICAgICAgICAgICAgbGVhZF9uYW1lOiBsZWFkTmFtZSxcclxuICAgICAgICAgICAgbGVhZF9hdmF0YXI6IGxlYWRBdmF0YXIsXHJcbiAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBwcm9maWxlVXJsLFxyXG4gICAgICAgICAgICBwdWJsaWNfaWQ6IHB1YmxpY0lkLFxyXG4gICAgICAgICAgICBsYXN0X21lc3NhZ2U6IGxhc3RNZXNzYWdlPy5ldmVudENvbnRlbnQ/LltcImNvbS5saW5rZWRpbi52b3lhZ2VyLm1lc3NhZ2luZy5ldmVudC5NZXNzYWdlRXZlbnRcIl0/LmJvZHksXHJcbiAgICAgICAgICAgIHVucmVhZF9jb3VudDogY29udi51bnJlYWRDb3VudCxcclxuICAgICAgICAgICAgdXBkYXRlZF9hdDogY29udi5sYXN0QWN0aXZpdHlBdCxcclxuICAgICAgICAgICAgLy8gcmF3OiBjb252IC8vIEF2b2lkIHNlbmRpbmcgdG9vIG11Y2ggZGF0YSBvdmVyIG1lc3NhZ2UgYnJpZGdlXHJcbiAgICAgICAgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gRmV0Y2hlZCAke25vcm1hbGl6ZWQubGVuZ3RofSBjb252ZXJzYXRpb25zIHdpdGggbWV0YWRhdGFgKTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGNvbnZlcnNhdGlvbnM6IG5vcm1hbGl6ZWQgfTtcclxuICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgY29uc29sZS5lcnJvcihcIltWb3lhZ2VyXSBGYWlsZWQgdG8gZmV0Y2ggY29udmVyc2F0aW9uczpcIiwgZXJyKTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBQ0EsRUFBQyxPQUFlLDRCQUE0QjtBQUM1QyxVQUFRLElBQUkscURBQXFEO0FBR2pFLE1BQUksT0FBTyxXQUFXLGVBQWUsQ0FBQyxPQUFPLFNBQVM7QUFDcEQsWUFBUSxNQUFNLDJHQUEyRztBQUFBLEVBQzNIO0FBRUEsTUFBTSxjQUFjLENBQUMsTUFBTSxLQUFNLE1BQU0sUUFBUyxJQUFJLFFBQVEsQ0FBQyxZQUFZLFdBQVcsU0FBUyxLQUFLLE1BQU0sS0FBSyxPQUFPLEtBQUssTUFBTSxNQUFNLEVBQUUsSUFBSSxHQUFHLENBQUM7QUFHL0ksTUFBTSxnQkFNRjtBQUFBLElBQ0YsUUFBUSxDQUFDO0FBQUEsSUFDVCxVQUFVLG9CQUFJLElBQUk7QUFBQSxJQUNsQixVQUFVLENBQUM7QUFBQSxJQUNYLFdBQVcsQ0FBQztBQUFBLElBQ1osYUFBYSxDQUFDO0FBQUEsRUFDaEI7QUFHQSxTQUFPLGlCQUFpQixXQUFXLENBQUMs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
