"use strict";
(() => {
  // extension/contents/linkedin.ts
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
        case "sendConnectionRequest":
          return await sendConnectionRequest(payload.url, payload.note);
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
