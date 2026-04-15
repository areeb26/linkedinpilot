"use strict";
(() => {
  // contents/linkedin.ts
  window.__LINKEDIN_PILOT_LOADED__ = true;
  var randomDelay = (min = 2e3, max = 8e3) => new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
  var voyagerBuffer = {
    search: [],
    profiles: /* @__PURE__ */ new Map(),
    comments: [],
    reactions: []
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "VOYAGER_EXTRACT") return;
    const { url, data } = event.data;
    console.log(`[VoyagerBridge] Captured data from: ${url}`);
    if (url.includes("/voyager/api/search/hits")) {
      handleSearchData(data);
    } else if (url.includes("/voyager/api/identity/dash/profiles")) {
      handleProfileData(data);
    } else if (url.includes("/voyager/api/content/comments")) {
      handleCommentsData(data);
    } else if (url.includes("/voyager/api/feed/updates")) {
      handleReactionsData(data);
    } else if (url.includes("/voyager/api/groups/memberships") || url.includes("/voyager/api/events/event/members")) {
      handleGroupEventData(data);
    }
  });
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
  function normalizeCommenter(comment) {
    const profile = comment.commenter?.["com.linkedin.voyager.dash.identity.profile.Profile"] || {};
    const firstName = profile.firstName || "";
    const lastName = profile.lastName || "";
    const publicId = profile.publicIdentifier || "";
    return {
      full_name: `${firstName} ${lastName}`.trim(),
      profile_url: publicId ? `https://www.linkedin.com/in/${publicId}` : "",
      headline: profile.headline || "Commenter",
      avatar_url: extractAvatar(profile),
      source: "api-comments"
    };
  }
  function normalizeProfile(profile, source) {
    const firstName = profile.firstName || "";
    const lastName = profile.lastName || "";
    const publicId = profile.publicIdentifier || "";
    return {
      full_name: `${firstName} ${lastName}`.trim(),
      profile_url: publicId ? `https://www.linkedin.com/in/${publicId}` : "",
      headline: profile.headline || source,
      avatar_url: extractAvatar(profile),
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
        profile_url: profileUrl.split("?")[0],
        headline,
        avatar_url: avatarUrl,
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
    if (message.type === "PING") {
      sendResponse({ success: true, version: "1.0.0" });
      return true;
    }
    if (message.type === "EXECUTE_ACTION") {
      handleAction(message.action, message.payload).then(sendResponse).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
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
    const headline = lead.headline || "";
    let title = "";
    let company = "";
    if (headline.includes(" at ")) {
      const parts = headline.split(" at ");
      title = parts[0].trim();
      company = parts.slice(1).join(" at ").trim();
    } else if (headline.includes(" @ ")) {
      const parts = headline.split(" @ ");
      title = parts[0].trim();
      company = parts.slice(1).join(" @ ").trim();
    } else if (headline.includes(" | ")) {
      const parts = headline.split(" | ");
      title = parts[0].trim();
      company = parts.length > 1 ? parts[1].trim() : "";
    } else {
      title = headline;
    }
    return { ...lead, title, company };
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
    const targetUrl = payload?.url;
    if (targetUrl && !window.location.href.includes(targetUrl.split("?")[0])) {
      console.log("[Search] Navigating to target URL:", targetUrl);
      const navigationComplete = new Promise((resolve) => {
        const onLoad = () => {
          window.removeEventListener("load", onLoad);
          resolve();
        };
        window.addEventListener("load", onLoad);
        setTimeout(resolve, 1e4);
      });
      window.location.href = targetUrl;
      await navigationComplete;
      await randomDelay(3e3, 5e3);
    }
    if (!window.location.href.includes("/search/results/")) {
      if (targetUrl) {
        return { success: true, pending: true, status: "navigating" };
      }
      return { success: false, error: "Please go to a LinkedIn search page first." };
    }
    await autoScroll(void 0, 5);
    await randomDelay(1e3, 2e3);
    let leads = [...voyagerBuffer.search];
    voyagerBuffer.search = [];
    if (leads.length === 0) {
      console.log("[Search] Buffer empty, falling back to DOM scraping...");
      const profileLinks = document.querySelectorAll(".reusable-search__result-container .app-aware-link, .entity-result__title-text a");
      for (const link of Array.from(profileLinks)) {
        const href = link.href?.split("?")[0];
        if (!href || !href.includes("/in/")) continue;
        const container = link.closest(".reusable-search__result-container, .entity-result");
        const nameEl = link.querySelector('span[aria-hidden="true"], .entity-result__title-text');
        const headlineEl = container?.querySelector(".entity-result__primary-subtitle, .t-14.t-black--light");
        const avatarEl = container?.querySelector("img");
        const name = nameEl?.innerText?.split("\n")[0]?.trim() || "";
        if (name && name !== "LinkedIn Member" && name !== "LinkedIn") {
          leads.push({
            full_name: name,
            profile_url: href,
            headline: headlineEl?.textContent?.trim() || "",
            avatar_url: avatarEl?.src || "",
            source: "search-dom"
          });
        }
      }
    } else {
      console.log(`[Search] Success! Using ${leads.length} leads from API buffer`);
    }
    const uniqueLeads = Array.from(new Map(leads.map((l) => [l.profile_url, l])).values());
    console.log(`[Search] Final extraction count: ${uniqueLeads.length}`);
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
    console.log("[Network] Scraping network connections...");
    if (!window.location.href.includes("/mynetwork/invite-connect/connections/")) {
      return { success: true, pending: true, url: "https://www.linkedin.com/mynetwork/invite-connect/connections/" };
    }
    await autoScroll(void 0, 5);
    const leads = [];
    const connectionCards = document.querySelectorAll(".mn-connection-card");
    for (const card of Array.from(connectionCards)) {
      const link = card.querySelector('a[href*="/in/"]');
      if (!link) continue;
      const href = link.href.split("?")[0];
      const nameEl = card.querySelector(".mn-connection-card__name");
      const headlineEl = card.querySelector(".mn-connection-card__occupation");
      const name = nameEl?.textContent?.trim() || "";
      if (name) {
        leads.push({
          full_name: name,
          profile_url: href,
          headline: headlineEl?.textContent?.trim() || "Connection",
          source: "network"
        });
      }
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
      const resp = await fetch("/voyager/api/messaging/conversations?count=40&q=all", {
        headers: getVoyagerHeaders()
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      const data = await resp.json();
      const included = data.included || [];
      const conversations = data.elements || [];
      const normalized = conversations.map((conv) => {
        const threadId = conv.entityUrn?.split(":").pop();
        const lastMessage = conv.lastMessage;
        const participants = conv.participants || [];
        return {
          thread_id: threadId,
          last_message: lastMessage?.eventContent?.["com.linkedin.voyager.messaging.event.MessageEvent"]?.body,
          unread_count: conv.unreadCount,
          updated_at: conv.lastActivityAt,
          raw: conv
        };
      });
      console.log(`[Voyager] Fetched ${normalized.length} conversations`);
      return { success: true, conversations: normalized };
    } catch (err) {
      console.error("[Voyager] Failed to fetch conversations:", err);
      return { success: false, error: err.message };
    }
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vY29udGVudHMvbGlua2VkaW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEdsb2JhbCBmbGFnIHRvIGhlbHAgYmFja2dyb3VuZCBzY3JpcHQgZGV0ZWN0IGlmIHRoZSBzY3JpcHQgaXMgbG9hZGVkXG4od2luZG93IGFzIGFueSkuX19MSU5LRURJTl9QSUxPVF9MT0FERURfXyA9IHRydWU7XG5cbmNvbnN0IHJhbmRvbURlbGF5ID0gKG1pbiA9IDIwMDAsIG1heCA9IDgwMDApID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW4pKVxuXG4vLyBEYXRhIEJ1ZmZlciB0byBzdG9yZSBpbnRlcmNlcHRlZCBWb3lhZ2VyIEFQSSByZXNwb25zZXNcbmNvbnN0IHZveWFnZXJCdWZmZXI6IHtcbiAgc2VhcmNoOiBhbnlbXTtcbiAgcHJvZmlsZXM6IE1hcDxzdHJpbmcsIGFueT47XG4gIGNvbW1lbnRzOiBhbnlbXTtcbiAgcmVhY3Rpb25zOiBhbnlbXTtcbn0gPSB7XG4gIHNlYXJjaDogW10sXG4gIHByb2ZpbGVzOiBuZXcgTWFwKCksXG4gIGNvbW1lbnRzOiBbXSxcbiAgcmVhY3Rpb25zOiBbXVxufTtcblxuLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBmcm9tIHRoZSBNQUlOIHdvcmxkIGludGVyY2VwdG9yXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgKGV2ZW50KSA9PiB7XG4gIGlmIChldmVudC5zb3VyY2UgIT09IHdpbmRvdyB8fCBldmVudC5kYXRhPy50eXBlICE9PSBcIlZPWUFHRVJfRVhUUkFDVFwiKSByZXR1cm47XG4gIFxuICBjb25zdCB7IHVybCwgZGF0YSB9ID0gZXZlbnQuZGF0YTtcbiAgY29uc29sZS5sb2coYFtWb3lhZ2VyQnJpZGdlXSBDYXB0dXJlZCBkYXRhIGZyb206ICR7dXJsfWApO1xuICBcbiAgaWYgKHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9zZWFyY2gvaGl0c1wiKSkge1xuICAgIGhhbmRsZVNlYXJjaERhdGEoZGF0YSk7XG4gIH0gZWxzZSBpZiAodXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2lkZW50aXR5L2Rhc2gvcHJvZmlsZXNcIikpIHtcbiAgICBoYW5kbGVQcm9maWxlRGF0YShkYXRhKTtcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvY29udGVudC9jb21tZW50c1wiKSkge1xuICAgIGhhbmRsZUNvbW1lbnRzRGF0YShkYXRhKTtcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZmVlZC91cGRhdGVzXCIpKSB7XG4gICAgaGFuZGxlUmVhY3Rpb25zRGF0YShkYXRhKTtcbiAgfSBlbHNlIGlmICh1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZ3JvdXBzL21lbWJlcnNoaXBzXCIpIHx8IHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9ldmVudHMvZXZlbnQvbWVtYmVyc1wiKSkge1xuICAgIGhhbmRsZUdyb3VwRXZlbnREYXRhKGRhdGEpO1xuICB9XG59KTtcblxuZnVuY3Rpb24gaGFuZGxlU2VhcmNoRGF0YShkYXRhOiBhbnkpIHtcbiAgY29uc3QgZWxlbWVudHMgPSBkYXRhPy5kYXRhPy5lbGVtZW50cyB8fCBkYXRhPy5lbGVtZW50cyB8fCBbXTtcbiAgZWxlbWVudHMuZm9yRWFjaCgoZWw6IGFueSkgPT4ge1xuICAgIGNvbnN0IGhpdCA9IGVsLmhpdEluZm8/LltcImNvbS5saW5rZWRpbi52b3lhZ2VyLmRhc2guc2VhcmNoLkVudGl0eVJlc3VsdFZpZXdNb2RlbFwiXSB8fCBlbDtcbiAgICBpZiAoaGl0LnRpdGxlPy50ZXh0KSB7XG4gICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplU2VhcmNoSGl0KGhpdCk7XG4gICAgICBpZiAobm9ybWFsaXplZCkge1xuICAgICAgICB2b3lhZ2VyQnVmZmVyLnNlYXJjaC5wdXNoKG5vcm1hbGl6ZWQpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVByb2ZpbGVEYXRhKGRhdGE6IGFueSkge1xuICAgIGNvbnN0IGluY2x1ZGVkID0gZGF0YT8uaW5jbHVkZWQgfHwgW107XG4gICAgY29uc3QgcHJvZmlsZSA9IGluY2x1ZGVkLmZpbmQoKGk6IGFueSkgPT4gaS4kdHlwZT8uaW5jbHVkZXMoXCJpZGVudGl0eS5kYXNoLlByb2ZpbGVcIikpO1xuICAgIGlmIChwcm9maWxlKSB7XG4gICAgICAgIGNvbnN0IHB1YmxpY0lkID0gcHJvZmlsZS5wdWJsaWNJZGVudGlmaWVyO1xuICAgICAgICB2b3lhZ2VyQnVmZmVyLnByb2ZpbGVzLnNldChwdWJsaWNJZCwgcHJvZmlsZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVDb21tZW50c0RhdGEoZGF0YTogYW55KSB7XG4gICAgY29uc3QgZWxlbWVudHMgPSBkYXRhPy5lbGVtZW50cyB8fCBbXTtcbiAgICBlbGVtZW50cy5mb3JFYWNoKChlbDogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbW1lbnRlciA9IGVsLmNvbW1lbnRlcj8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5pZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIl0gfHwgZWwuY29tbWVudGVyO1xuICAgICAgICBpZiAoY29tbWVudGVyKSB7XG4gICAgICAgICAgICB2b3lhZ2VyQnVmZmVyLmNvbW1lbnRzLnB1c2gobm9ybWFsaXplQ29tbWVudGVyKGVsKSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlUmVhY3Rpb25zRGF0YShkYXRhOiBhbnkpIHtcbiAgICBjb25zdCBpbmNsdWRlZCA9IGRhdGE/LmluY2x1ZGVkIHx8IFtdO1xuICAgIGluY2x1ZGVkLmZvckVhY2goKGk6IGFueSkgPT4ge1xuICAgICAgICBpZiAoaS4kdHlwZT8uaW5jbHVkZXMoXCJpZGVudGl0eS5kYXNoLlByb2ZpbGVcIikgfHwgaS4kdHlwZT8uaW5jbHVkZXMoXCJpZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIikpIHtcbiAgICAgICAgICAgIHZveWFnZXJCdWZmZXIucmVhY3Rpb25zLnB1c2gobm9ybWFsaXplUHJvZmlsZShpLCBcInJlYWN0aW9uXCIpKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVHcm91cEV2ZW50RGF0YShkYXRhOiBhbnkpIHtcbiAgICBjb25zdCBpbmNsdWRlZCA9IGRhdGE/LmluY2x1ZGVkIHx8IFtdO1xuICAgIGluY2x1ZGVkLmZvckVhY2goKGk6IGFueSkgPT4ge1xuICAgICAgICBpZiAoaS4kdHlwZT8uaW5jbHVkZXMoXCJpZGVudGl0eS5kYXNoLlByb2ZpbGVcIikgfHwgaS4kdHlwZT8uaW5jbHVkZXMoXCJpZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIikpIHtcbiAgICAgICAgICAgIC8vIFN0b3JlIGJ5IG1lbWJlciBpZGVudGl0eSAocHVibGljIElEKVxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVByb2ZpbGUoaSwgXCJtZW1iZXJcIik7XG4gICAgICAgICAgICBpZiAobm9ybWFsaXplZC5wcm9maWxlX3VybCkge1xuICAgICAgICAgICAgICAgIHZveWFnZXJCdWZmZXIucHJvZmlsZXMuc2V0KGkucHVibGljSWRlbnRpZmllciB8fCBpLnZhbml0eU5hbWUsIG5vcm1hbGl6ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbW1lbnRlcihjb21tZW50OiBhbnkpIHtcbiAgICBjb25zdCBwcm9maWxlID0gY29tbWVudC5jb21tZW50ZXI/LltcImNvbS5saW5rZWRpbi52b3lhZ2VyLmRhc2guaWRlbnRpdHkucHJvZmlsZS5Qcm9maWxlXCJdIHx8IHt9O1xuICAgIGNvbnN0IGZpcnN0TmFtZSA9IHByb2ZpbGUuZmlyc3ROYW1lIHx8IFwiXCI7XG4gICAgY29uc3QgbGFzdE5hbWUgPSBwcm9maWxlLmxhc3ROYW1lIHx8IFwiXCI7XG4gICAgY29uc3QgcHVibGljSWQgPSBwcm9maWxlLnB1YmxpY0lkZW50aWZpZXIgfHwgXCJcIjtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBmdWxsX25hbWU6IGAke2ZpcnN0TmFtZX0gJHtsYXN0TmFtZX1gLnRyaW0oKSxcbiAgICAgICAgcHJvZmlsZV91cmw6IHB1YmxpY0lkID8gYGh0dHBzOi8vd3d3LmxpbmtlZGluLmNvbS9pbi8ke3B1YmxpY0lkfWAgOiBcIlwiLFxuICAgICAgICBoZWFkbGluZTogcHJvZmlsZS5oZWFkbGluZSB8fCBcIkNvbW1lbnRlclwiLFxuICAgICAgICBhdmF0YXJfdXJsOiBleHRyYWN0QXZhdGFyKHByb2ZpbGUpLFxuICAgICAgICBzb3VyY2U6IFwiYXBpLWNvbW1lbnRzXCJcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcm9maWxlKHByb2ZpbGU6IGFueSwgc291cmNlOiBzdHJpbmcpIHtcbiAgICBjb25zdCBmaXJzdE5hbWUgPSBwcm9maWxlLmZpcnN0TmFtZSB8fCBcIlwiO1xuICAgIGNvbnN0IGxhc3ROYW1lID0gcHJvZmlsZS5sYXN0TmFtZSB8fCBcIlwiO1xuICAgIGNvbnN0IHB1YmxpY0lkID0gcHJvZmlsZS5wdWJsaWNJZGVudGlmaWVyIHx8IFwiXCI7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZnVsbF9uYW1lOiBgJHtmaXJzdE5hbWV9ICR7bGFzdE5hbWV9YC50cmltKCksXG4gICAgICAgIHByb2ZpbGVfdXJsOiBwdWJsaWNJZCA/IGBodHRwczovL3d3dy5saW5rZWRpbi5jb20vaW4vJHtwdWJsaWNJZH1gIDogXCJcIixcbiAgICAgICAgaGVhZGxpbmU6IHByb2ZpbGUuaGVhZGxpbmUgfHwgc291cmNlLFxuICAgICAgICBhdmF0YXJfdXJsOiBleHRyYWN0QXZhdGFyKHByb2ZpbGUpLFxuICAgICAgICBzb3VyY2U6IGBhcGktJHtzb3VyY2V9YFxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RBdmF0YXIocHJvZmlsZTogYW55KSB7XG4gICAgY29uc3QgcGljID0gcHJvZmlsZS5wcm9maWxlUGljdHVyZT8uZGlzcGxheUltYWdlUmVmZXJlbmNlPy52ZWN0b3JJbWFnZSB8fCBwcm9maWxlLnBpY3R1cmU7XG4gICAgaWYgKHBpYz8ucm9vdFVybCAmJiBwaWM/LmFydGlmYWN0cz8ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBgJHtwaWMucm9vdFVybH0ke3BpYy5hcnRpZmFjdHNbcGljLmFydGlmYWN0cy5sZW5ndGggLSAxXS5maWxlSWRlbnRpZnlpbmdVcmxQYXRoU2VnbWVudH1gO1xuICAgIH1cbiAgICByZXR1cm4gXCJcIjtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplU2VhcmNoSGl0KGhpdDogYW55KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdGl0bGVUZXh0ID0gaGl0LnRpdGxlPy50ZXh0IHx8IGhpdC50aXRsZT8udG9TdHJpbmcoKSB8fCBcIkxpbmtlZEluIE1lbWJlclwiO1xuICAgICAgICBjb25zdCBoZWFkbGluZSA9IGhpdC5wcmltYXJ5U3VidGl0bGU/LnRleHQgfHwgaGl0LnN1YmxpbmU/LnRleHQgfHwgXCJcIjtcbiAgICAgICAgY29uc3QgcHJvZmlsZVVybCA9IGhpdC5uYXZpZ2F0aW9uQ29udGV4dD8udXJsIHx8IFwiXCI7XG4gICAgICAgIFxuICAgICAgICAvLyBTYWZldHkgY2hlY2sgdG8gcHJldmVudCBcInNwbGl0IG9mIHVuZGVmaW5lZFwiIGNyYXNoXG4gICAgICAgIGlmICghcHJvZmlsZVVybCB8fCAhcHJvZmlsZVVybC5pbmNsdWRlcygnL2luLycpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJbVm95YWdlckJyaWRnZV0gU2tpcHBpbmcgbm9uLXByb2ZpbGUgY2FuZGlkYXRlOlwiLCB0aXRsZVRleHQpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZW1iZXJJZCA9IHByb2ZpbGVVcmwuc3BsaXQoJy9pbi8nKVsxXT8uc3BsaXQoJy8nKVswXSB8fCBcIlwiO1xuICAgICAgICBcbiAgICAgICAgLy8gQXZhdGFyIGV4dHJhY3Rpb24gZnJvbSBjb21wbGV4IFZlY3RvckltYWdlXG4gICAgICAgIGxldCBhdmF0YXJVcmwgPSBcIlwiO1xuICAgICAgICBjb25zdCBpbWFnZUF0dHJpYnV0ZXMgPSBoaXQuaW1hZ2U/LmF0dHJpYnV0ZXMgfHwgW107XG4gICAgICAgIGNvbnN0IHBpYyA9IGltYWdlQXR0cmlidXRlc1swXT8uZGV0YWlsRGF0YT8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIuZGFzaC5jb21tb24uaW1hZ2UuTm9uRW50aXR5UHJvZmlsZUF2YXRhclwiXT8udmVjdG9ySW1hZ2U7XG4gICAgICAgIFxuICAgICAgICBpZiAocGljPy5yb290VXJsICYmIHBpYz8uYXJ0aWZhY3RzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGF2YXRhclVybCA9IGAke3BpYy5yb290VXJsfSR7cGljLmFydGlmYWN0c1twaWMuYXJ0aWZhY3RzLmxlbmd0aCAtIDFdLmZpbGVJZGVudGlmeWluZ1VybFBhdGhTZWdtZW50fWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZnVsbF9uYW1lOiB0aXRsZVRleHQsXG4gICAgICAgICAgICBwcm9maWxlX3VybDogcHJvZmlsZVVybC5zcGxpdCgnPycpWzBdLFxuICAgICAgICAgICAgaGVhZGxpbmUsXG4gICAgICAgICAgICBhdmF0YXJfdXJsOiBhdmF0YXJVcmwsXG4gICAgICAgICAgICBzb3VyY2U6IFwiYXBpLXNlYXJjaFwiXG4gICAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbVm95YWdlckJyaWRnZV0gRXJyb3Igbm9ybWFsaXppbmcgc2VhcmNoIGhpdDpcIiwgZXJyKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5jb25zdCB3YWl0Rm9yRWxlbWVudCA9IGFzeW5jIChzZWxlY3Rvcjogc3RyaW5nLCB0aW1lb3V0ID0gMTAwMDApID0+IHtcbiAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpXG4gIHdoaWxlIChEYXRlLm5vdygpIC0gc3RhcnQgPCB0aW1lb3V0KSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxuICAgIGlmIChlbCkgcmV0dXJuIGVsXG4gICAgYXdhaXQgcmFuZG9tRGVsYXkoNTAwLCAxMDAwKVxuICB9XG4gIHJldHVybiBudWxsXG59XG5cbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gXCJQSU5HXCIpIHtcbiAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCB2ZXJzaW9uOiBcIjEuMC4wXCIgfSlcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG4gIGlmIChtZXNzYWdlLnR5cGUgPT09IFwiRVhFQ1VURV9BQ1RJT05cIikge1xuICAgIGhhbmRsZUFjdGlvbihtZXNzYWdlLmFjdGlvbiwgbWVzc2FnZS5wYXlsb2FkKS50aGVuKHNlbmRSZXNwb25zZSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KVxuICAgIH0pXG4gICAgcmV0dXJuIHRydWVcbiAgfVxufSlcblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQWN0aW9uKGFjdGlvbjogc3RyaW5nLCBwYXlsb2FkOiBhbnkpIHtcbiAgY29uc29sZS5sb2coYFtoYW5kbGVBY3Rpb25dIFByb2Nlc3Npbmc6ICR7YWN0aW9ufWAsIHBheWxvYWQpO1xuICB0cnkge1xuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlIFwic2NyYXBlTGVhZHNcIjpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHNjcmFwZUxlYWRzKHBheWxvYWQpXG4gICAgICBjYXNlIFwidmlld1Byb2ZpbGVcIjpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHZpZXdQcm9maWxlKHBheWxvYWQudXJsKVxuICAgICAgY2FzZSBcInNlbmRDb25uZWN0aW9uUmVxdWVzdFwiOlxuICAgICAgICByZXR1cm4gYXdhaXQgc2VuZENvbm5lY3Rpb25SZXF1ZXN0KHBheWxvYWQudXJsLCBwYXlsb2FkLm5vdGUpXG4gICAgICBjYXNlIFwic2VuZE1lc3NhZ2VcIjpcbiAgICAgICAgcmV0dXJuIGF3YWl0IHNlbmRNZXNzYWdlVmlhQVBJKHBheWxvYWQudGhyZWFkSWQgfHwgcGF5bG9hZC51cmwsIHBheWxvYWQubWVzc2FnZSlcbiAgICAgIGNhc2UgXCJGRVRDSF9DT05WRVJTQVRJT05TXCI6XG4gICAgICAgIHJldHVybiBhd2FpdCBmZXRjaENvbnZlcnNhdGlvbnNWaWFBUEkoKVxuICAgICAgY2FzZSBcIlNZTkNfSU5CT1hcIjpcbiAgICAgICAgcmV0dXJuIGF3YWl0IGZldGNoQ29udmVyc2F0aW9uc1ZpYUFQSSgpXG4gICAgICBjYXNlIFwiZ2V0UHJvZmlsZUluZm9cIjpcbiAgICAgICAgcmV0dXJuIGF3YWl0IGdldFByb2ZpbGVJbmZvKClcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBhY3Rpb246ICR7YWN0aW9ufWApXG4gICAgfVxuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtoYW5kbGVBY3Rpb25dIENSSVRJQ0FMIEVSUk9SIGR1cmluZyAke2FjdGlvbn06YCwgZXJyKTtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvciBkdXJpbmcgYWN0aW9uIGV4ZWN1dGlvblwiIH07XG4gIH1cbn1cblxuLyoqXG4gKiBGZXRjaCBwcm9maWxlIHZpYSBMaW5rZWRJbidzIGludGVybmFsIFZveWFnZXIgQVBJLlxuICogVGhpcyBydW5zIEZST00gdGhlIGNvbnRlbnQgc2NyaXB0IChpbnNpZGUgbGlua2VkaW4uY29tKSwgc28gY29va2llc1xuICogYXJlIGF1dG9tYXRpY2FsbHkgYXR0YWNoZWQgYnkgdGhlIGJyb3dzZXIgXHUyMDE0IG5vIENPUlMsIG5vIGNvb2tpZSBoZWFkZXIgaXNzdWVzLlxuICovXG5hc3luYyBmdW5jdGlvbiBmZXRjaFByb2ZpbGVWaWFBUEkoKTogUHJvbWlzZTxhbnk+IHtcbiAgY29uc3QgY3NyZlRva2VuID0gZ2V0Q3NyZlRva2VuKCk7XG4gIGNvbnNvbGUubG9nKFwiW1ZveWFnZXJdIEZldGNoaW5nIHByb2ZpbGUgdmlhIEFQSSwgY3NyZjpcIiwgY3NyZlRva2VuID8gXCJmb3VuZFwiIDogXCJtaXNzaW5nXCIpO1xuXG4gIGNvbnN0IGNvbW1vbkhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgXCJhY2NlcHRcIjogXCJhcHBsaWNhdGlvbi92bmQubGlua2VkaW4ubm9ybWFsaXplZCtqc29uKzIuMVwiLFxuICAgIFwiY3NyZi10b2tlblwiOiBjc3JmVG9rZW4sXG4gICAgXCJ4LWxpLWxhbmdcIjogXCJlbl9VU1wiLFxuICAgIFwieC1yZXN0bGktcHJvdG9jb2wtdmVyc2lvblwiOiBcIjIuMC4wXCJcbiAgfTtcblxuICAvLyBUcnkgZW5kcG9pbnRzIGluIG9yZGVyIFx1MjAxNCBuZXdlc3QgZmlyc3RcbiAgY29uc3QgZW5kcG9pbnRzID0gW1xuICAgIHsgdXJsOiBcIi92b3lhZ2VyL2FwaS9pZGVudGl0eS9kYXNoL3Byb2ZpbGVzP3E9bWVtYmVySWRlbnRpdHkmbWVtYmVySWRlbnRpdHk9bWVcIiwgbGFiZWw6IFwiZGFzaC9wcm9maWxlc1wiIH0sXG4gICAgeyB1cmw6IFwiL3ZveWFnZXIvYXBpL2lkZW50aXR5L3Byb2ZpbGVzL21lXCIsIGxhYmVsOiBcImlkZW50aXR5L3Byb2ZpbGVzL21lXCIgfSxcbiAgICB7IHVybDogXCIvdm95YWdlci9hcGkvbWVcIiwgbGFiZWw6IFwiL21lIChsZWdhY3kpXCIgfVxuICBdO1xuXG4gIGZvciAoY29uc3QgZXAgb2YgZW5kcG9pbnRzKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gVHJ5aW5nICR7ZXAubGFiZWx9Li4uYCk7XG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goZXAudXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IGNvbW1vbkhlYWRlcnMsXG4gICAgICAgIGNyZWRlbnRpYWxzOiBcImluY2x1ZGVcIlxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzcC5vaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtWb3lhZ2VyXSAke2VwLmxhYmVsfSByZXR1cm5lZCAke3Jlc3Auc3RhdHVzfWApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgICAgY29uc3QgaW5jbHVkZWQ6IGFueVtdID0gZGF0YS5pbmNsdWRlZCB8fCBbXTtcbiAgICAgIGNvbnN0IGFsbCA9IFsuLi5pbmNsdWRlZCwgLi4uKGRhdGEuZWxlbWVudHMgfHwgW10pXTtcbiAgICAgIGlmIChhbGwubGVuZ3RoID09PSAwICYmIGRhdGEuZGF0YSkgYWxsLnB1c2goZGF0YS5kYXRhKTtcblxuICAgICAgY29uc3QgdHlwZXMgPSBhbGwubWFwKChpOiBhbnkpID0+IGkuJHR5cGUpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gJHtlcC5sYWJlbH0gdHlwZXM6YCwgWy4uLm5ldyBTZXQodHlwZXMpXSk7XG5cbiAgICAgIC8vIEZpbmQgcHJvZmlsZSBlbnRpdHlcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBhbGwuZmluZCgoaTogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHQgPSBpLiR0eXBlIHx8IFwiXCI7XG4gICAgICAgIHJldHVybiB0LmluY2x1ZGVzKFwiTWluaVByb2ZpbGVcIikgfHxcbiAgICAgICAgICAgICAgIHQuaW5jbHVkZXMoXCJpZGVudGl0eS5wcm9maWxlLlByb2ZpbGVcIikgfHxcbiAgICAgICAgICAgICAgIHQuaW5jbHVkZXMoXCJpZGVudGl0eS5kYXNoLlByb2ZpbGVcIikgfHxcbiAgICAgICAgICAgICAgIHQuaW5jbHVkZXMoXCJ2b3lhZ2VyLmlkZW50aXR5Lm1lLkNhcmRcIikgfHxcbiAgICAgICAgICAgICAgIChpLmZpcnN0TmFtZSAmJiBpLmxhc3ROYW1lICYmIGkucHVibGljSWRlbnRpZmllcik7XG4gICAgICB9KTtcblxuICAgICAgaWYgKCFwcm9maWxlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW1ZveWFnZXJdIE5vIHByb2ZpbGUgZW50aXR5IGluICR7ZXAubGFiZWx9IHJlc3BvbnNlYCk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBFeHRyYWN0IG5hbWUgKGhhbmRsZSBib3RoIHN0cmluZyBhbmQgbG9jYWxpemVkIG9iamVjdCBmb3JtYXRzKVxuICAgICAgY29uc3QgZmlyc3ROYW1lID0gdHlwZW9mIHByb2ZpbGUuZmlyc3ROYW1lID09PSAnc3RyaW5nJyA/IHByb2ZpbGUuZmlyc3ROYW1lIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2ZpbGUuZmlyc3ROYW1lPy5sb2NhbGl6ZWQ/LltPYmplY3Qua2V5cyhwcm9maWxlLmZpcnN0TmFtZT8ubG9jYWxpemVkIHx8IHt9KVswXV0gfHwgJyc7XG4gICAgICBjb25zdCBsYXN0TmFtZSA9IHR5cGVvZiBwcm9maWxlLmxhc3ROYW1lID09PSAnc3RyaW5nJyA/IHByb2ZpbGUubGFzdE5hbWUgOlxuICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlLmxhc3ROYW1lPy5sb2NhbGl6ZWQ/LltPYmplY3Qua2V5cyhwcm9maWxlLmxhc3ROYW1lPy5sb2NhbGl6ZWQgfHwge30pWzBdXSB8fCAnJztcbiAgICAgIGNvbnN0IGZ1bGxOYW1lID0gYCR7Zmlyc3ROYW1lfSAke2xhc3ROYW1lfWAudHJpbSgpO1xuICAgICAgY29uc3QgcHVibGljSWQgPSBwcm9maWxlLnB1YmxpY0lkZW50aWZpZXIgfHwgcHJvZmlsZS52YW5pdHlOYW1lIHx8ICcnO1xuXG4gICAgICBpZiAoIWZ1bGxOYW1lKSBjb250aW51ZTsgLy8gbm90IHVzZWZ1bCwgdHJ5IG5leHRcblxuICAgICAgLy8gRXh0cmFjdCBwaG90byBcdTIwMTQgdHJ5IG11bHRpcGxlIHNoYXBlc1xuICAgICAgbGV0IGF2YXRhclVybCA9ICcnO1xuICAgICAgY29uc3QgcGljID0gcHJvZmlsZS5waWN0dXJlIHx8IHByb2ZpbGUucHJvZmlsZVBpY3R1cmU/LmRpc3BsYXlJbWFnZVJlZmVyZW5jZT8udmVjdG9ySW1hZ2U7XG4gICAgICBpZiAocGljPy5yb290VXJsICYmIHBpYz8uYXJ0aWZhY3RzPy5sZW5ndGgpIHtcbiAgICAgICAgYXZhdGFyVXJsID0gYCR7cGljLnJvb3RVcmx9JHtwaWMuYXJ0aWZhY3RzW3BpYy5hcnRpZmFjdHMubGVuZ3RoIC0gMV0uZmlsZUlkZW50aWZ5aW5nVXJsUGF0aFNlZ21lbnR9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBob3RvRWxlbWVudHMgPSBwcm9maWxlLnByb2ZpbGVQaWN0dXJlPy5bXCJkaXNwbGF5SW1hZ2V+XCJdPy5lbGVtZW50cztcbiAgICAgICAgaWYgKHBob3RvRWxlbWVudHM/Lmxlbmd0aCkge1xuICAgICAgICAgIGF2YXRhclVybCA9IHBob3RvRWxlbWVudHNbcGhvdG9FbGVtZW50cy5sZW5ndGggLSAxXT8uaWRlbnRpZmllcnM/LlswXT8uaWRlbnRpZmllciB8fCBcIlwiO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGxiYWNrOiBzZWFyY2ggaW5jbHVkZWQgZm9yIFZlY3RvckltYWdlXG4gICAgICBpZiAoIWF2YXRhclVybCkge1xuICAgICAgICBjb25zdCB2ZWNJbWcgPSBhbGwuZmluZCgoaTogYW55KSA9PlxuICAgICAgICAgIChpLiR0eXBlIHx8IFwiXCIpLmluY2x1ZGVzKFwiVmVjdG9ySW1hZ2VcIikgfHwgKGkuJHR5cGUgfHwgXCJcIikuaW5jbHVkZXMoXCJQaG90b1wiKVxuICAgICAgICApO1xuICAgICAgICBpZiAodmVjSW1nPy5yb290VXJsICYmIHZlY0ltZz8uYXJ0aWZhY3RzPy5sZW5ndGgpIHtcbiAgICAgICAgICBhdmF0YXJVcmwgPSBgJHt2ZWNJbWcucm9vdFVybH0ke3ZlY0ltZy5hcnRpZmFjdHNbdmVjSW1nLmFydGlmYWN0cy5sZW5ndGggLSAxXS5maWxlSWRlbnRpZnlpbmdVcmxQYXRoU2VnbWVudH1gO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gRXh0cmFjdGVkIHZpYSAke2VwLmxhYmVsfTpgLCB7IGZ1bGxOYW1lLCBwdWJsaWNJZCwgaGFzQXZhdGFyOiAhIWF2YXRhclVybCB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZnVsbF9uYW1lOiBmdWxsTmFtZSB8fCBcIkxpbmtlZEluIFVzZXJcIixcbiAgICAgICAgYXZhdGFyX3VybDogYXZhdGFyVXJsLFxuICAgICAgICBwcm9maWxlX3VybDogcHVibGljSWQgPyBgaHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luLyR7cHVibGljSWR9YCA6IFwiXCIsXG4gICAgICAgIG1lbWJlcl9pZDogcHVibGljSWQgfHwgXCJtZVwiXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS53YXJuKGBbVm95YWdlcl0gJHtlcC5sYWJlbH0gZXJyb3I6YCwgZXJyKTtcbiAgICB9XG4gIH1cblxuICBjb25zb2xlLmVycm9yKFwiW1ZveWFnZXJdIEFsbCBlbmRwb2ludHMgZmFpbGVkXCIpO1xuICByZXR1cm4gbnVsbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0UHJvZmlsZUluZm8oKSB7XG4gIGNvbnNvbGUubG9nKFwiW2dldFByb2ZpbGVJbmZvXSBTdGFydGluZyBwcm9maWxlIGV4dHJhY3Rpb24uLi5cIik7XG5cbiAgLy8gPT09IFNUUkFURUdZIDE6IFZveWFnZXIgQVBJIChtb3N0IHJlbGlhYmxlLCBydW5zIGluIHBhZ2UgY29udGV4dCkgPT09XG4gIGNvbnN0IGFwaVJlc3VsdCA9IGF3YWl0IGZldGNoUHJvZmlsZVZpYUFQSSgpO1xuICBpZiAoYXBpUmVzdWx0Py5zdWNjZXNzICYmIGFwaVJlc3VsdC5tZW1iZXJfaWQgIT09IFwibWVcIikge1xuICAgIGNvbnNvbGUubG9nKFwiW2dldFByb2ZpbGVJbmZvXSBHb3QgcHJvZmlsZSBmcm9tIFZveWFnZXIgQVBJXCIpO1xuICAgIHJldHVybiBhcGlSZXN1bHQ7XG4gIH1cblxuICAvLyA9PT0gU1RSQVRFR1kgMjogRE9NIHNjcmFwaW5nIHdpdGggcmV0cmllcyA9PT1cbiAgY29uc29sZS5sb2coXCJbZ2V0UHJvZmlsZUluZm9dIEFQSSBmYWlsZWQsIHRyeWluZyBET00gc2NyYXBpbmcuLi5cIik7XG4gIFxuICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgIC8vIFRyeSBKU09OLUxEIGZpcnN0XG4gICAgY29uc3QganNvbkxkID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcignc2NyaXB0W3R5cGU9XCJhcHBsaWNhdGlvbi9sZCtqc29uXCJdJyk7XG4gICAgaWYgKGpzb25MZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoanNvbkxkLnRleHRDb250ZW50IHx8IFwie31cIik7XG4gICAgICAgIGlmIChkYXRhLm5hbWUgfHwgKGRhdGFbJ0B0eXBlJ10gPT09ICdQZXJzb24nICYmIGRhdGEubmFtZSkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIltnZXRQcm9maWxlSW5mb10gRm91bmQgaW5mbyBpbiBKU09OLUxEXCIpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZnVsbF9uYW1lOiBkYXRhLm5hbWUgfHwgXCJMaW5rZWRJbiBVc2VyXCIsXG4gICAgICAgICAgICBhdmF0YXJfdXJsOiBkYXRhLmltYWdlPy5jb250ZW50VXJsIHx8IGRhdGEuaW1hZ2UgfHwgXCJcIixcbiAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBkYXRhLnVybCB8fCB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdCgnPycpWzBdLFxuICAgICAgICAgICAgbWVtYmVyX2lkOiAoZGF0YS51cmwgfHwgd2luZG93LmxvY2F0aW9uLmhyZWYpLnNwbGl0KCcvaW4vJylbMV0/LnNwbGl0KCcvJylbMF0gfHwgXCJtZVwiXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge31cbiAgICB9XG5cbiAgICAvLyBET00gc2VsZWN0b3JzXG4gICAgY29uc3QgbmFtZVNlbGVjdG9ycyA9IFtcbiAgICAgICcudGV4dC1oZWFkaW5nLXhsYXJnZScsXG4gICAgICAnaDEudGV4dC1oZWFkaW5nLXhsYXJnZScsXG4gICAgICAnLmdsb2JhbC1uYXZfX21lLWFjdGl2ZS1zdGF0dXMgKyBzcGFuJyxcbiAgICAgICcudC0xNi50LWJsYWNrLnQtYm9sZCcsXG4gICAgICAnLnB2LXRvcC1jYXJkLWJlZm9yZS1leHBhbmRlZF9fbmFtZSdcbiAgICBdO1xuICAgIGNvbnN0IGF2YXRhclNlbGVjdG9ycyA9IFtcbiAgICAgICcuZ2xvYmFsLW5hdl9fbWUtcGhvdG8nLFxuICAgICAgJy5wdi10b3AtY2FyZC1wcm9maWxlLXBpY3R1cmVfX2ltYWdlJyxcbiAgICAgICdpbWcucHJvZmlsZS1waG90by1lZGl0X19wcmV2aWV3JyxcbiAgICAgICdpbWdbYWx0Kj1cInBob3RvXCJdJ1xuICAgIF07XG5cbiAgICBsZXQgbmFtZSA9IFwiXCI7XG4gICAgZm9yIChjb25zdCBzZWwgb2YgbmFtZVNlbGVjdG9ycykge1xuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbCk7XG4gICAgICBpZiAoZWw/LnRleHRDb250ZW50Py50cmltKCkpIHsgbmFtZSA9IGVsLnRleHRDb250ZW50LnRyaW0oKTsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICBsZXQgYXZhdGFyID0gXCJcIjtcbiAgICBmb3IgKGNvbnN0IHNlbCBvZiBhdmF0YXJTZWxlY3RvcnMpIHtcbiAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWwpIGFzIEhUTUxJbWFnZUVsZW1lbnQ7XG4gICAgICBpZiAoZWw/LnNyYyAmJiAhZWwuc3JjLmluY2x1ZGVzKCdkYXRhOicpKSB7IGF2YXRhciA9IGVsLnNyYzsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICBjb25zdCBwcm9maWxlTGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5nbG9iYWwtbmF2X19tZS1saW5rLCBhW2hyZWYqPVwiL2luL1wiXScpIGFzIEhUTUxBbmNob3JFbGVtZW50O1xuICAgIGNvbnN0IHByb2ZpbGVVcmwgPSBwcm9maWxlTGluaz8uaHJlZj8uc3BsaXQoJz8nKVswXSB8fCB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdCgnPycpWzBdO1xuXG4gICAgaWYgKHByb2ZpbGVVcmwuaW5jbHVkZXMoJy9pbi8nKSB8fCBuYW1lKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIltnZXRQcm9maWxlSW5mb10gRm91bmQgaW5mbyBpbiBET006XCIsIHsgbmFtZSwgaGFzQXZhdGFyOiAhIWF2YXRhciB9KTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGZ1bGxfbmFtZTogbmFtZSB8fCBcIkxpbmtlZEluIFVzZXJcIixcbiAgICAgICAgYXZhdGFyX3VybDogYXZhdGFyIHx8IFwiXCIsXG4gICAgICAgIHByb2ZpbGVfdXJsOiBwcm9maWxlVXJsLFxuICAgICAgICBtZW1iZXJfaWQ6IHByb2ZpbGVVcmwuc3BsaXQoJy9pbi8nKVsxXT8uc3BsaXQoJy8nKVswXSB8fCBcIm1lXCJcbiAgICAgIH07XG4gICAgfVxuXG4gICAgYXdhaXQgcmFuZG9tRGVsYXkoMTAwMCwgMjAwMCk7XG4gIH1cblxuICAvLyBJZiB3ZSBhbHNvIGhhdmUgYW4gQVBJIHJlc3VsdCB0aGF0IHN1Y2NlZWRlZCBidXQgaGFkIG1lbWJlcl9pZD1cIm1lXCIsIHN0aWxsIHJldHVybiBpdFxuICBpZiAoYXBpUmVzdWx0Py5zdWNjZXNzKSByZXR1cm4gYXBpUmVzdWx0O1xuXG4gIHJldHVybiB7XG4gICAgc3VjY2VzczogdHJ1ZSxcbiAgICBmdWxsX25hbWU6IFwiTGlua2VkSW4gVXNlclwiLFxuICAgIGF2YXRhcl91cmw6IFwiXCIsXG4gICAgcHJvZmlsZV91cmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCc/JylbMF0sXG4gICAgbWVtYmVyX2lkOiBcIm1lXCJcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXV0b1Njcm9sbChjb250YWluZXJTZWxlY3Rvcj86IHN0cmluZywgbWF4U2Nyb2xscyA9IDEwKSB7XG4gIGNvbnNvbGUubG9nKFwiW0F1dG9TY3JvbGxdIFN0YXJ0aW5nIHNjcm9sbCBzZXF1ZW5jZS4uLlwiKVxuICBjb25zdCBjb250YWluZXIgPSBjb250YWluZXJTZWxlY3RvciA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoY29udGFpbmVyU2VsZWN0b3IpIDogd2luZG93XG4gIGNvbnN0IHNjcm9sbFRhcmdldCA9IGNvbnRhaW5lclNlbGVjdG9yID8gKGNvbnRhaW5lciBhcyBIVE1MRWxlbWVudCkgOiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG1heFNjcm9sbHM7IGkrKykge1xuICAgIGNvbnN0IHN0YXJ0SGVpZ2h0ID0gc2Nyb2xsVGFyZ2V0LnNjcm9sbEhlaWdodFxuICAgIGlmIChjb250YWluZXIgPT09IHdpbmRvdykge1xuICAgICAgd2luZG93LnNjcm9sbFRvKDAsIGRvY3VtZW50LmJvZHkuc2Nyb2xsSGVpZ2h0KVxuICAgIH0gZWxzZSB7XG4gICAgICAoY29udGFpbmVyIGFzIEhUTUxFbGVtZW50KS5zY3JvbGxUb3AgPSAoY29udGFpbmVyIGFzIEhUTUxFbGVtZW50KS5zY3JvbGxIZWlnaHRcbiAgICB9XG4gICAgYXdhaXQgcmFuZG9tRGVsYXkoMTAwMCwgMjAwMClcbiAgICBpZiAoc2Nyb2xsVGFyZ2V0LnNjcm9sbEhlaWdodCA9PT0gc3RhcnRIZWlnaHQpIGJyZWFrIC8vIE5vIG1vcmUgY29udGVudFxuICB9XG59XG5cbi8qKlxuICogUGFyc2UgYSBMaW5rZWRJbiBoZWFkbGluZSBpbnRvIHN0cnVjdHVyZWQgdGl0bGUvY29tcGFueSBmaWVsZHMuXG4gKi9cbmZ1bmN0aW9uIGVucmljaExlYWQobGVhZDogYW55KSB7XG4gIGNvbnN0IGhlYWRsaW5lID0gbGVhZC5oZWFkbGluZSB8fCAnJztcbiAgbGV0IHRpdGxlID0gJyc7XG4gIGxldCBjb21wYW55ID0gJyc7XG5cbiAgaWYgKGhlYWRsaW5lLmluY2x1ZGVzKCcgYXQgJykpIHtcbiAgICBjb25zdCBwYXJ0cyA9IGhlYWRsaW5lLnNwbGl0KCcgYXQgJyk7XG4gICAgdGl0bGUgPSBwYXJ0c1swXS50cmltKCk7XG4gICAgY29tcGFueSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyBhdCAnKS50cmltKCk7XG4gIH0gZWxzZSBpZiAoaGVhZGxpbmUuaW5jbHVkZXMoJyBAICcpKSB7XG4gICAgY29uc3QgcGFydHMgPSBoZWFkbGluZS5zcGxpdCgnIEAgJyk7XG4gICAgdGl0bGUgPSBwYXJ0c1swXS50cmltKCk7XG4gICAgY29tcGFueSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJyBAICcpLnRyaW0oKTtcbiAgfSBlbHNlIGlmIChoZWFkbGluZS5pbmNsdWRlcygnIHwgJykpIHtcbiAgICBjb25zdCBwYXJ0cyA9IGhlYWRsaW5lLnNwbGl0KCcgfCAnKTtcbiAgICB0aXRsZSA9IHBhcnRzWzBdLnRyaW0oKTtcbiAgICBjb21wYW55ID0gcGFydHMubGVuZ3RoID4gMSA/IHBhcnRzWzFdLnRyaW0oKSA6ICcnO1xuICB9IGVsc2Uge1xuICAgIHRpdGxlID0gaGVhZGxpbmU7XG4gIH1cblxuICByZXR1cm4geyAuLi5sZWFkLCB0aXRsZSwgY29tcGFueSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVMZWFkcyhwYXlsb2FkPzogYW55KSB7XG4gIGNvbnN0IHR5cGUgPSBwYXlsb2FkPy5leHRyYWN0aW9uVHlwZSB8fCAnc2VhcmNoJ1xuICBjb25zb2xlLmxvZyhgW1NjcmFwZXJdIFN0YXJ0aW5nICR7dHlwZX0gZXh0cmFjdGlvbi4uLmApXG5cbiAgbGV0IHJlc3VsdDtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnY29tbWVudHMnOlxuICAgIGNhc2UgJ2VuZ2FnZW1lbnQnOiAgLy8gV2l6YXJkIHNlbmRzICdlbmdhZ2VtZW50JyBmb3IgcG9zdCBlbmdhZ2VtZW50IHNjcmFwaW5nXG4gICAgICByZXN1bHQgPSBhd2FpdCBzY3JhcGVDb21tZW50cygpXG4gICAgICBicmVhaztcbiAgICBjYXNlICdyZWFjdGlvbnMnOlxuICAgICAgcmVzdWx0ID0gYXdhaXQgc2NyYXBlUmVhY3Rpb25zKClcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2dyb3Vwcyc6XG4gICAgICByZXN1bHQgPSBhd2FpdCBzY3JhcGVHcm91cE1lbWJlcnMoKVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZXZlbnRzJzpcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHNjcmFwZUV2ZW50QXR0ZW5kZWVzKClcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ25ldHdvcmsnOlxuICAgICAgcmVzdWx0ID0gYXdhaXQgc2NyYXBlTmV0d29yaygpXG4gICAgICBicmVhaztcbiAgICBjYXNlICduYXYtc2VhcmNoJzpcbiAgICBjYXNlICduYXYtc2F2ZWQnOlxuICAgIGNhc2UgJ25hdi1saXN0JzpcbiAgICBjYXNlICdzZWFyY2gnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXN1bHQgPSBhd2FpdCBzY3JhcGVTZWFyY2hSZXN1bHRzKHBheWxvYWQpXG4gICAgICBicmVhaztcbiAgfVxuXG4gIC8vIEVucmljaCBhbGwgbGVhZHMgd2l0aCBwYXJzZWQgdGl0bGUvY29tcGFueSBmcm9tIGhlYWRsaW5lXG4gIGlmIChyZXN1bHQ/LnN1Y2Nlc3MgJiYgcmVzdWx0Py5sZWFkcykge1xuICAgIHJlc3VsdC5sZWFkcyA9IHJlc3VsdC5sZWFkcy5tYXAoZW5yaWNoTGVhZCk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVTZWFyY2hSZXN1bHRzKHBheWxvYWQ/OiBhbnkpIHtcbiAgY29uc3QgdGFyZ2V0VXJsID0gcGF5bG9hZD8udXJsXG5cbiAgLy8gSWYgd2UgbmVlZCB0byBuYXZpZ2F0ZSB0byB0aGUgdGFyZ2V0IFVSTCwgZG8gc28gYW5kIHdhaXQgZm9yIGxvYWRcbiAgaWYgKHRhcmdldFVybCAmJiAhd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXModGFyZ2V0VXJsLnNwbGl0KCc/JylbMF0pKSB7XG4gICAgY29uc29sZS5sb2coXCJbU2VhcmNoXSBOYXZpZ2F0aW5nIHRvIHRhcmdldCBVUkw6XCIsIHRhcmdldFVybClcbiAgICBcbiAgICAvLyBOYXZpZ2F0ZSBhbmQgd2FpdCBmb3IgdGhlIHBhZ2UgdG8gbG9hZFxuICAgIGNvbnN0IG5hdmlnYXRpb25Db21wbGV0ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBvbkxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfTtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgIC8vIFNhZmV0eSB0aW1lb3V0IGluIGNhc2UgJ2xvYWQnIGFscmVhZHkgZmlyZWRcbiAgICAgIHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMDApO1xuICAgIH0pO1xuXG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSB0YXJnZXRVcmw7XG4gICAgYXdhaXQgbmF2aWdhdGlvbkNvbXBsZXRlO1xuICAgIC8vIFdhaXQgZXh0cmEgdGltZSBmb3IgTGlua2VkSW4ncyBTUEEgdG8gcmVuZGVyIGNvbnRlbnRcbiAgICBhd2FpdCByYW5kb21EZWxheSgzMDAwLCA1MDAwKTtcbiAgfVxuXG4gIC8vIENoZWNrIGlmIHdlIGFyZSBvbiBhIHNlYXJjaCByZXN1bHQgcGFnZVxuICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCcvc2VhcmNoL3Jlc3VsdHMvJykpIHtcbiAgICAvLyBJZiB3ZSBuYXZpZ2F0ZWQgYnV0IGFyZW4ndCBvbiBzZWFyY2ggcmVzdWx0cyB5ZXQsIHJldHVybiBwZW5kaW5nXG4gICAgLy8gc28gdGhlIGJhY2tncm91bmQgc2NyaXB0IGNhbiByZXRyeVxuICAgIGlmICh0YXJnZXRVcmwpIHtcbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHBlbmRpbmc6IHRydWUsIHN0YXR1czogXCJuYXZpZ2F0aW5nXCIgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGxlYXNlIGdvIHRvIGEgTGlua2VkSW4gc2VhcmNoIHBhZ2UgZmlyc3QuXCIgfVxuICB9XG5cbiAgLy8gQXV0by1zY3JvbGwgdG8gdHJpZ2dlciBBUEkgY2FsbHMgYW5kIGxvYWQgcmVzdWx0c1xuICBhd2FpdCBhdXRvU2Nyb2xsKHVuZGVmaW5lZCwgNSlcbiAgLy8gR2l2ZSBhIG1vbWVudCBmb3IgaW50ZXJjZXB0b3IgdG8gY2FwdHVyZSBBUEkgZGF0YVxuICBhd2FpdCByYW5kb21EZWxheSgxMDAwLCAyMDAwKVxuXG4gIC8vIENSSVRJQ0FMOiBGaXJzdCwgY2hlY2sgaWYgd2UgaGF2ZSBhbnkgQVBJLWNhcHR1cmVkIGxlYWRzIGluIHRoZSBidWZmZXJcbiAgbGV0IGxlYWRzID0gWy4uLnZveWFnZXJCdWZmZXIuc2VhcmNoXVxuICBcbiAgLy8gQ2xlYXIgYnVmZmVyIGZvciBuZXh0IHJ1blxuICB2b3lhZ2VyQnVmZmVyLnNlYXJjaCA9IFtdXG5cbiAgaWYgKGxlYWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnNvbGUubG9nKFwiW1NlYXJjaF0gQnVmZmVyIGVtcHR5LCBmYWxsaW5nIGJhY2sgdG8gRE9NIHNjcmFwaW5nLi4uXCIpXG4gICAgLy8gU3RhbmRhcmQgU2VhcmNoIFJlc3VsdCBTZWxlY3RvcnMgZmFsbGJhY2tcbiAgICBjb25zdCBwcm9maWxlTGlua3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcucmV1c2FibGUtc2VhcmNoX19yZXN1bHQtY29udGFpbmVyIC5hcHAtYXdhcmUtbGluaywgLmVudGl0eS1yZXN1bHRfX3RpdGxlLXRleHQgYScpXG4gICAgXG4gICAgZm9yIChjb25zdCBsaW5rIG9mIEFycmF5LmZyb20ocHJvZmlsZUxpbmtzKSkge1xuICAgICAgICBjb25zdCBocmVmID0gKGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnQpLmhyZWY/LnNwbGl0KCc/JylbMF1cbiAgICAgICAgaWYgKCFocmVmIHx8ICFocmVmLmluY2x1ZGVzKCcvaW4vJykpIGNvbnRpbnVlXG5cbiAgICAgICAgY29uc3QgY29udGFpbmVyID0gbGluay5jbG9zZXN0KCcucmV1c2FibGUtc2VhcmNoX19yZXN1bHQtY29udGFpbmVyLCAuZW50aXR5LXJlc3VsdCcpXG4gICAgICAgIGNvbnN0IG5hbWVFbCA9IGxpbmsucXVlcnlTZWxlY3Rvcignc3BhblthcmlhLWhpZGRlbj1cInRydWVcIl0sIC5lbnRpdHktcmVzdWx0X190aXRsZS10ZXh0JylcbiAgICAgICAgY29uc3QgaGVhZGxpbmVFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignLmVudGl0eS1yZXN1bHRfX3ByaW1hcnktc3VidGl0bGUsIC50LTE0LnQtYmxhY2stLWxpZ2h0JylcbiAgICAgICAgY29uc3QgYXZhdGFyRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpIGFzIEhUTUxJbWFnZUVsZW1lbnRcblxuICAgICAgICBjb25zdCBuYW1lID0gbmFtZUVsPy5pbm5lclRleHQ/LnNwbGl0KCdcXG4nKVswXT8udHJpbSgpIHx8IFwiXCJcbiAgICAgICAgaWYgKG5hbWUgJiYgbmFtZSAhPT0gXCJMaW5rZWRJbiBNZW1iZXJcIiAmJiBuYW1lICE9PSBcIkxpbmtlZEluXCIpIHtcbiAgICAgICAgICAgIGxlYWRzLnB1c2goe1xuICAgICAgICAgICAgICAgIGZ1bGxfbmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICBwcm9maWxlX3VybDogaHJlZixcbiAgICAgICAgICAgICAgICBoZWFkbGluZTogaGVhZGxpbmVFbD8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBcIlwiLFxuICAgICAgICAgICAgICAgIGF2YXRhcl91cmw6IGF2YXRhckVsPy5zcmMgfHwgXCJcIixcbiAgICAgICAgICAgICAgICBzb3VyY2U6IFwic2VhcmNoLWRvbVwiXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKGBbU2VhcmNoXSBTdWNjZXNzISBVc2luZyAke2xlYWRzLmxlbmd0aH0gbGVhZHMgZnJvbSBBUEkgYnVmZmVyYClcbiAgfVxuXG4gIGNvbnN0IHVuaXF1ZUxlYWRzID0gQXJyYXkuZnJvbShuZXcgTWFwKGxlYWRzLm1hcChsID0+IFtsLnByb2ZpbGVfdXJsLCBsXSkpLnZhbHVlcygpKVxuICBjb25zb2xlLmxvZyhgW1NlYXJjaF0gRmluYWwgZXh0cmFjdGlvbiBjb3VudDogJHt1bmlxdWVMZWFkcy5sZW5ndGh9YClcbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlQ29tbWVudHMoKSB7XG4gIGNvbnNvbGUubG9nKFwiW0NvbW1lbnRzXSBTY29waW5nIGNvbW1lbnRzIHNlY3Rpb24uLi5cIilcbiAgXG4gIGNvbnN0IHNob3dNb3JlQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbW1lbnRzLWNvbW1lbnRzLWxpc3RfX2xvYWQtbW9yZS1jb21tZW50cy1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudFxuICBpZiAoc2hvd01vcmVCdG4pIHtcbiAgICBzaG93TW9yZUJ0bi5jbGljaygpXG4gICAgYXdhaXQgcmFuZG9tRGVsYXkoMjAwMCwgMzAwMClcbiAgfVxuXG4gIC8vIENoZWNrIGJ1ZmZlciBmaXJzdFxuICBsZXQgbGVhZHMgPSBbLi4udm95YWdlckJ1ZmZlci5jb21tZW50c11cbiAgdm95YWdlckJ1ZmZlci5jb21tZW50cyA9IFtdXG5cbiAgaWYgKGxlYWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnNvbGUubG9nKFwiW0NvbW1lbnRzXSBCdWZmZXIgZW1wdHksIHVzaW5nIERPTSBmYWxsYmFja1wiKVxuICAgIGNvbnN0IGNvbW1lbnRJdGVtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb21tZW50cy1jb21tZW50LWl0ZW0sIC5jb21tZW50cy1wb3N0LW1ldGFfX25hbWUnKVxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBBcnJheS5mcm9tKGNvbW1lbnRJdGVtcykpIHtcbiAgICAgIGNvbnN0IGxpbmsgPSBpdGVtLnF1ZXJ5U2VsZWN0b3IoJ2FbaHJlZio9XCIvaW4vXCJdJykgYXMgSFRNTEFuY2hvckVsZW1lbnQgfHwgKGl0ZW0udGFnTmFtZSA9PT0gJ0EnID8gaXRlbSA6IG51bGwpXG4gICAgICBpZiAoIWxpbmspIGNvbnRpbnVlXG5cbiAgICAgIGNvbnN0IGhyZWYgPSBsaW5rLmhyZWYuc3BsaXQoJz8nKVswXVxuICAgICAgY29uc3QgbmFtZSA9IGxpbmsuaW5uZXJUZXh0LnNwbGl0KCdcXG4nKVswXS50cmltKClcblxuICAgICAgaWYgKG5hbWUgJiYgaHJlZi5pbmNsdWRlcygnL2luLycpICYmIG5hbWUgIT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcbiAgICAgICAgbGVhZHMucHVzaCh7XG4gICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxuICAgICAgICAgIHByb2ZpbGVfdXJsOiBocmVmLFxuICAgICAgICAgIGhlYWRsaW5lOiBcIkNvbW1lbnRlclwiLFxuICAgICAgICAgIHNvdXJjZTogXCJjb21tZW50cy1kb21cIlxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmxvZyhgW0NvbW1lbnRzXSBTdWNjZXNzISBFeHRyYWN0ZWQgJHtsZWFkcy5sZW5ndGh9IGxlYWRzIGZyb20gQVBJIGJ1ZmZlcmApXG4gIH1cblxuICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlUmVhY3Rpb25zKCkge1xuICBjb25zb2xlLmxvZyhcIltSZWFjdGlvbnNdIFNjb3BpbmcgcmVhY3Rpb25zIG1vZGFsLi4uXCIpXG4gIFxuICBjb25zdCBtb2RhbCA9IGF3YWl0IHdhaXRGb3JFbGVtZW50KCcuc29jaWFsLWRldGFpbHMtcmVhY3RvcnMtbW9kYWxfX2NvbnRlbnQsIC5hcnRkZWNvLW1vZGFsX19jb250ZW50JylcbiAgaWYgKCFtb2RhbCkge1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQbGVhc2Ugb3BlbiB0aGUgcmVhY3Rpb25zIGxpc3QgKGNsaWNrIG9uIHRoZSByZWFjdGlvbiBpY29ucykgYmVmb3JlIGV4dHJhY3RpbmcuXCIgfVxuICB9XG5cbiAgYXdhaXQgYXV0b1Njcm9sbCgnLnNvY2lhbC1kZXRhaWxzLXJlYWN0b3JzLW1vZGFsX19jb250ZW50LCAuYXJ0ZGVjby1tb2RhbF9fY29udGVudCcsIDUpXG5cbiAgLy8gQ2hlY2sgYnVmZmVyXG4gIGxldCBsZWFkcyA9IFsuLi52b3lhZ2VyQnVmZmVyLnJlYWN0aW9uc11cbiAgdm95YWdlckJ1ZmZlci5yZWFjdGlvbnMgPSBbXVxuXG4gIGlmIChsZWFkcy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zb2xlLmxvZyhcIltSZWFjdGlvbnNdIEJ1ZmZlciBlbXB0eSwgdXNpbmcgRE9NIGZhbGxiYWNrXCIpXG4gICAgY29uc3QgcmVhY3Rvckl0ZW1zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnNvY2lhbC1kZXRhaWxzLXJlYWN0b3JzLW1vZGFsX19pdGVtLCAuYXJ0ZGVjby1tb2RhbF9fY29udGVudCBsaScpXG5cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgQXJyYXkuZnJvbShyZWFjdG9ySXRlbXMpKSB7XG4gICAgICBjb25zdCBsaW5rID0gaXRlbS5xdWVyeVNlbGVjdG9yKCdhW2hyZWYqPVwiL2luL1wiXScpIGFzIEhUTUxBbmNob3JFbGVtZW50XG4gICAgICBpZiAoIWxpbmspIGNvbnRpbnVlXG5cbiAgICAgIGNvbnN0IGhyZWYgPSBsaW5rLmhyZWYuc3BsaXQoJz8nKVswXVxuICAgICAgY29uc3QgbmFtZUVsID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcuYXJ0ZGVjby1lbnRpdHktbG9ja3VwX190aXRsZSwgLmFydGRlY28tZW50aXR5LWxvY2t1cF9fbmFtZScpXG4gICAgICBjb25zdCBoZWFkbGluZUVsID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcuYXJ0ZGVjby1lbnRpdHktbG9ja3VwX19zdWJ0aXRsZSwgLmFydGRlY28tZW50aXR5LWxvY2t1cF9fY2FwdGlvbicpXG4gICAgICBjb25zdCBuYW1lID0gbmFtZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8IFwiXCJcblxuICAgICAgaWYgKG5hbWUgJiYgaHJlZi5pbmNsdWRlcygnL2luLycpICYmIG5hbWUgIT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcbiAgICAgICAgbGVhZHMucHVzaCh7XG4gICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxuICAgICAgICAgIHByb2ZpbGVfdXJsOiBocmVmLFxuICAgICAgICAgIGhlYWRsaW5lOiBoZWFkbGluZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8IFwiUmVhY3RvclwiLFxuICAgICAgICAgIHNvdXJjZTogXCJyZWFjdGlvbnMtZG9tXCJcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5sb2coYFtSZWFjdGlvbnNdIFN1Y2Nlc3MhIEV4dHJhY3RlZCAke2xlYWRzLmxlbmd0aH0gbGVhZHMgZnJvbSBBUEkgYnVmZmVyYClcbiAgfVxuXG4gIGNvbnN0IHVuaXF1ZUxlYWRzID0gQXJyYXkuZnJvbShuZXcgTWFwKGxlYWRzLm1hcChsID0+IFtsLnByb2ZpbGVfdXJsLCBsXSkpLnZhbHVlcygpKVxuICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVHcm91cE1lbWJlcnMoKSB7XG4gICAgY29uc29sZS5sb2coXCJbR3JvdXBzXSBTY3JhcGluZyBncm91cCBtZW1iZXJzLi4uXCIpXG4gICAgaWYgKCF3aW5kb3cubG9jYXRpb24uaHJlZi5pbmNsdWRlcygnL2dyb3Vwcy8nKSkge1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IFwiUGxlYXNlIGdvIHRvIHRoZSBHcm91cCBtZW1iZXJzIHBhZ2UgZmlyc3QuXCIgfVxuICAgIH1cblxuICAgIGF3YWl0IGF1dG9TY3JvbGwodW5kZWZpbmVkLCA1KVxuXG4gICAgY29uc3QgbGVhZHMgPSBbXVxuICAgIGNvbnN0IHByb2ZpbGVMaW5rcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5lbnRpdHktcmVzdWx0X190aXRsZS10ZXh0IGEsIC5ncm91cHMtbWVtYmVycy1saXN0X19pdGVtIGEnKVxuXG4gICAgZm9yIChjb25zdCBsaW5rIG9mIEFycmF5LmZyb20ocHJvZmlsZUxpbmtzKSkge1xuICAgICAgICBjb25zdCBocmVmID0gKGxpbmsgYXMgSFRNTEFuY2hvckVsZW1lbnQpLmhyZWY/LnNwbGl0KCc/JylbMF1cbiAgICAgICAgaWYgKCFocmVmIHx8ICFocmVmLmluY2x1ZGVzKCcvaW4vJykpIGNvbnRpbnVlXG5cbiAgICAgICAgY29uc3QgcHVibGljSWQgPSBocmVmLnNwbGl0KCcvaW4vJylbMV0/LnNwbGl0KCcvJylbMF0gfHwgXCJcIlxuICAgICAgICBjb25zdCBjYWNoZWQgPSB2b3lhZ2VyQnVmZmVyLnByb2ZpbGVzLmdldChwdWJsaWNJZClcblxuICAgICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgICAgICBsZWFkcy5wdXNoKHsgLi4uY2FjaGVkLCBzb3VyY2U6IFwiYXBpLWdyb3VwXCIgfSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGxpbmsuY2xvc2VzdCgnLmVudGl0eS1yZXN1bHQsIC5ncm91cHMtbWVtYmVycy1saXN0X19pdGVtJylcbiAgICAgICAgICAgIGNvbnN0IG5hbWVFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignLmVudGl0eS1yZXN1bHRfX3RpdGxlLXRleHQsIC5ncm91cHMtbWVtYmVycy1saXN0X19uYW1lJylcbiAgICAgICAgICAgIGNvbnN0IGhlYWRsaW5lRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJy5lbnRpdHktcmVzdWx0X19wcmltYXJ5LXN1YnRpdGxlLCAuZ3JvdXBzLW1lbWJlcnMtbGlzdF9faGVhZGxpbmUnKVxuICAgICAgICAgICAgY29uc3QgYXZhdGFyRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpIGFzIEhUTUxJbWFnZUVsZW1lbnRcblxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IG5hbWVFbD8udGV4dENvbnRlbnQ/LnNwbGl0KCdcXG4nKVswXT8udHJpbSgpIHx8IFwiXCJcbiAgICAgICAgICAgIGlmIChuYW1lICYmIG5hbWUgIT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICBsZWFkcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcm9maWxlX3VybDogaHJlZixcbiAgICAgICAgICAgICAgICAgICAgaGVhZGxpbmU6IGhlYWRsaW5lRWw/LnRleHRDb250ZW50Py50cmltKCkgfHwgXCJHcm91cCBNZW1iZXJcIixcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyX3VybDogYXZhdGFyRWw/LnNyYyB8fCBcIlwiLFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IFwiZ3JvdXAtZG9tXCJcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdW5pcXVlTGVhZHMgPSBBcnJheS5mcm9tKG5ldyBNYXAobGVhZHMubWFwKGwgPT4gW2wucHJvZmlsZV91cmwsIGxdKSkudmFsdWVzKCkpXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY291bnQ6IHVuaXF1ZUxlYWRzLmxlbmd0aCwgbGVhZHM6IHVuaXF1ZUxlYWRzIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NyYXBlRXZlbnRBdHRlbmRlZXMoKSB7XG4gICAgY29uc29sZS5sb2coXCJbRXZlbnRzXSBTY3JhcGluZyBldmVudCBhdHRlbmRlZXMuLi5cIilcbiAgICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCcvZXZlbnRzLycpKSB7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJQbGVhc2UgZ28gdG8gdGhlIEV2ZW50IGF0dGVuZGVlcyBwYWdlIGZpcnN0LlwiIH1cbiAgICB9XG5cbiAgICBhd2FpdCBhdXRvU2Nyb2xsKHVuZGVmaW5lZCwgNSlcblxuICAgIGNvbnN0IGxlYWRzID0gW11cbiAgICBjb25zdCBwcm9maWxlTGlua3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZW50aXR5LXJlc3VsdF9fdGl0bGUtdGV4dCBhJylcblxuICAgIGZvciAoY29uc3QgbGluayBvZiBBcnJheS5mcm9tKHByb2ZpbGVMaW5rcykpIHtcbiAgICAgICAgY29uc3QgaHJlZiA9IChsaW5rIGFzIEhUTUxBbmNob3JFbGVtZW50KS5ocmVmPy5zcGxpdCgnPycpWzBdXG4gICAgICAgIGlmICghaHJlZiB8fCAhaHJlZi5pbmNsdWRlcygnL2luLycpKSBjb250aW51ZVxuXG4gICAgICAgIGNvbnN0IHB1YmxpY0lkID0gaHJlZi5zcGxpdCgnL2luLycpWzFdPy5zcGxpdCgnLycpWzBdIHx8IFwiXCJcbiAgICAgICAgY29uc3QgY2FjaGVkID0gdm95YWdlckJ1ZmZlci5wcm9maWxlcy5nZXQocHVibGljSWQpXG5cbiAgICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICAgICAgbGVhZHMucHVzaCh7IC4uLmNhY2hlZCwgc291cmNlOiBcImFwaS1ldmVudFwiIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSBsaW5rLmNsb3Nlc3QoJy5lbnRpdHktcmVzdWx0JylcbiAgICAgICAgICAgIGNvbnN0IG5hbWVFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignLmVudGl0eS1yZXN1bHRfX3RpdGxlLXRleHQnKVxuICAgICAgICAgICAgY29uc3QgaGVhZGxpbmVFbCA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcignLmVudGl0eS1yZXN1bHRfX3ByaW1hcnktc3VidGl0bGUnKVxuICAgICAgICAgICAgY29uc3QgYXZhdGFyRWwgPSBjb250YWluZXI/LnF1ZXJ5U2VsZWN0b3IoJ2ltZycpIGFzIEhUTUxJbWFnZUVsZW1lbnRcblxuICAgICAgICAgICAgY29uc3QgbmFtZSA9IG5hbWVFbD8udGV4dENvbnRlbnQ/LnNwbGl0KCdcXG4nKVswXT8udHJpbSgpIHx8IFwiXCJcbiAgICAgICAgICAgIGlmIChuYW1lICYmIG5hbWUgIT09IFwiTGlua2VkSW4gTWVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICBsZWFkcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcm9maWxlX3VybDogaHJlZixcbiAgICAgICAgICAgICAgICAgICAgaGVhZGxpbmU6IGhlYWRsaW5lRWw/LnRleHRDb250ZW50Py50cmltKCkgfHwgXCJFdmVudCBBdHRlbmRlZVwiLFxuICAgICAgICAgICAgICAgICAgICBhdmF0YXJfdXJsOiBhdmF0YXJFbD8uc3JjIHx8IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZTogXCJldmVudC1kb21cIlxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzY3JhcGVOZXR3b3JrKCkge1xuICAgIGNvbnNvbGUubG9nKFwiW05ldHdvcmtdIFNjcmFwaW5nIG5ldHdvcmsgY29ubmVjdGlvbnMuLi5cIilcbiAgICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCcvbXluZXR3b3JrL2ludml0ZS1jb25uZWN0L2Nvbm5lY3Rpb25zLycpKSB7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHBlbmRpbmc6IHRydWUsIHVybDogXCJodHRwczovL3d3dy5saW5rZWRpbi5jb20vbXluZXR3b3JrL2ludml0ZS1jb25uZWN0L2Nvbm5lY3Rpb25zL1wiIH1cbiAgICB9XG5cbiAgICBhd2FpdCBhdXRvU2Nyb2xsKHVuZGVmaW5lZCwgNSlcblxuICAgIGNvbnN0IGxlYWRzID0gW11cbiAgICBjb25zdCBjb25uZWN0aW9uQ2FyZHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubW4tY29ubmVjdGlvbi1jYXJkJylcblxuICAgIGZvciAoY29uc3QgY2FyZCBvZiBBcnJheS5mcm9tKGNvbm5lY3Rpb25DYXJkcykpIHtcbiAgICAgICAgY29uc3QgbGluayA9IGNhcmQucXVlcnlTZWxlY3RvcignYVtocmVmKj1cIi9pbi9cIl0nKSBhcyBIVE1MQW5jaG9yRWxlbWVudFxuICAgICAgICBpZiAoIWxpbmspIGNvbnRpbnVlXG5cbiAgICAgICAgY29uc3QgaHJlZiA9IGxpbmsuaHJlZi5zcGxpdCgnPycpWzBdXG4gICAgICAgIGNvbnN0IG5hbWVFbCA9IGNhcmQucXVlcnlTZWxlY3RvcignLm1uLWNvbm5lY3Rpb24tY2FyZF9fbmFtZScpXG4gICAgICAgIGNvbnN0IGhlYWRsaW5lRWwgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJy5tbi1jb25uZWN0aW9uLWNhcmRfX29jY3VwYXRpb24nKVxuXG4gICAgICAgIGNvbnN0IG5hbWUgPSBuYW1lRWw/LnRleHRDb250ZW50Py50cmltKCkgfHwgXCJcIlxuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgbGVhZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgZnVsbF9uYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgIHByb2ZpbGVfdXJsOiBocmVmLFxuICAgICAgICAgICAgICAgIGhlYWRsaW5lOiBoZWFkbGluZUVsPy50ZXh0Q29udGVudD8udHJpbSgpIHx8IFwiQ29ubmVjdGlvblwiLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogXCJuZXR3b3JrXCJcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB1bmlxdWVMZWFkcyA9IEFycmF5LmZyb20obmV3IE1hcChsZWFkcy5tYXAobCA9PiBbbC5wcm9maWxlX3VybCwgbF0pKS52YWx1ZXMoKSlcbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBjb3VudDogdW5pcXVlTGVhZHMubGVuZ3RoLCBsZWFkczogdW5pcXVlTGVhZHMgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB2aWV3UHJvZmlsZSh1cmw6IHN0cmluZykge1xuICBjb25zb2xlLmxvZyhcIlZpZXdpbmcgcHJvZmlsZTpcIiwgdXJsKVxuICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKHVybCkpIHtcbiAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybFxuICB9XG4gIGF3YWl0IHJhbmRvbURlbGF5KClcbiAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRDb25uZWN0aW9uUmVxdWVzdCh1cmw6IHN0cmluZywgbm90ZTogc3RyaW5nKSB7XG4gIGNvbnNvbGUubG9nKFwiU2VuZGluZyBjb25uZWN0aW9uIHJlcXVlc3QgdG9cIiwgdXJsKVxuICBcbiAgLy8gU3RyYXRlZ3k6IFRyeSBBUEkgZmlyc3QsIGZhbGxiYWNrIHRvIERPTVxuICBjb25zdCBwdWJsaWNJZCA9IHVybC5zcGxpdCgnL2luLycpWzFdPy5zcGxpdCgnLycpWzBdXG4gIGlmIChwdWJsaWNJZCkge1xuICAgIGNvbnN0IGFwaVJlc3VsdCA9IGF3YWl0IHNlbmRDb25uZWN0aW9uUmVxdWVzdFZpYUFQSShwdWJsaWNJZCwgbm90ZSlcbiAgICBpZiAoYXBpUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhcGlSZXN1bHRcbiAgICBjb25zb2xlLndhcm4oXCJbVm95YWdlcl0gQVBJIENvbm5lY3Rpb24gcmVxdWVzdCBmYWlsZWQsIGZhbGxpbmcgYmFjayB0byBET01cIilcbiAgfVxuXG4gIGlmICghd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXModXJsKSkge1xuICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybFxuICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBwZW5kaW5nOiB0cnVlLCBtZXNzYWdlOiBcIlJlZGlyZWN0ZWQgdG8gcHJvZmlsZVwiIH1cbiAgfVxuICBhd2FpdCByYW5kb21EZWxheSgzMDAwLCA1MDAwKVxuICBcbiAgY29uc3QgY29ubmVjdEJ0biA9IGF3YWl0IHdhaXRGb3JFbGVtZW50KCdidXR0b25bYXJpYS1sYWJlbF49XCJJbnZpdGVcIl1bY2xhc3MqPVwicHJpbWFyeS1hY3Rpb25cIl0nKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JFbGVtZW50KCdidXR0b25bYXJpYS1sYWJlbF49XCJDb25uZWN0XCJdW2NsYXNzKj1cInByaW1hcnktYWN0aW9uXCJdJylcbiAgICAgICAgICAgICAgICAgICAgIFxuICBpZiAoIWNvbm5lY3RCdG4pIHtcbiAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBcIkNvbm5lY3QgYnV0dG9uIG5vdCBmb3VuZFwiIH1cbiAgfVxuICBcbiAgKGNvbm5lY3RCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmNsaWNrKClcbiAgYXdhaXQgcmFuZG9tRGVsYXkoMTAwMCwgMjAwMClcbiAgXG4gIGlmIChub3RlKSB7XG4gICAgICBjb25zdCBhZGROb3RlQnRuID0gYXdhaXQgd2FpdEZvckVsZW1lbnQoJ2J1dHRvblthcmlhLWxhYmVsPVwiQWRkIGEgbm90ZVwiXScpXG4gICAgICBpZiAoYWRkTm90ZUJ0bikge1xuICAgICAgICAgKGFkZE5vdGVCdG4gYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmNsaWNrKClcbiAgICAgICAgIGF3YWl0IHJhbmRvbURlbGF5KDEwMDAsIDIwMDApXG4gICAgICAgICBcbiAgICAgICAgIGNvbnN0IHRleHRhcmVhID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndGV4dGFyZWFbbmFtZT1cIm1lc3NhZ2VcIl0nKVxuICAgICAgICAgaWYgKHRleHRhcmVhKSB7XG4gICAgICAgICAgICAodGV4dGFyZWEgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWUgPSBub3RlXG4gICAgICAgICAgICB0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG4gICAgICAgICB9XG4gICAgICAgICBhd2FpdCByYW5kb21EZWxheSgxMDAwLCAyMDAwKVxuICAgICAgfVxuICB9XG4gIFxuICBjb25zdCBzZW5kQnRuID0gYXdhaXQgd2FpdEZvckVsZW1lbnQoJ2J1dHRvblthcmlhLWxhYmVsPVwiU2VuZCBub3dcIl0nKSB8fCBhd2FpdCB3YWl0Rm9yRWxlbWVudCgnYnV0dG9uW2FyaWEtbGFiZWw9XCJTZW5kXCJdJylcbiAgaWYgKHNlbmRCdG4pIHtcbiAgICAgIChzZW5kQnRuIGFzIEhUTUxCdXR0b25FbGVtZW50KS5jbGljaygpXG4gICAgICBhd2FpdCByYW5kb21EZWxheSgyMDAwLCAzMDAwKVxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9XG4gIH1cbiAgXG4gIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogXCJTZW5kIGJ1dHRvbiBub3QgZm91bmRcIiB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRNZXNzYWdlKHVybDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgY29uc29sZS5sb2coXCJTZW5kaW5nIG1lc3NhZ2UgdG9cIiwgdXJsKVxuICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgdGhyZWFkSWQgZnJvbSB0aGUgVVJMIG9yIHBheWxvYWRcbiAgLy8gSWYgbm90LCB3ZSBtaWdodCBuZWVkIHRvIGZpbmQgaXRcbiAgcmV0dXJuIGF3YWl0IHNlbmRNZXNzYWdlVmlhQVBJKHVybCwgbWVzc2FnZSlcbn1cblxuLyoqXG4gKiAtLS0gVk9ZQUdFUiBBUEkgSU1QTEVNRU5UQVRJT05TIC0tLVxuICovXG5cbmZ1bmN0aW9uIGdldENzcmZUb2tlbigpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmNvb2tpZVxuICAgIC5zcGxpdCgnOyAnKVxuICAgIC5maW5kKGMgPT4gYy5zdGFydHNXaXRoKCdKU0VTU0lPTklEPScpKVxuICAgID8uc3BsaXQoJz0nKVsxXVxuICAgID8ucmVwbGFjZSgvXCIvZywgJycpIHx8ICcnO1xufVxuXG5mdW5jdGlvbiBnZXRWb3lhZ2VySGVhZGVycygpIHtcbiAgcmV0dXJuIHtcbiAgICBcImFjY2VwdFwiOiBcImFwcGxpY2F0aW9uL3ZuZC5saW5rZWRpbi5ub3JtYWxpemVkK2pzb24rMi4xXCIsXG4gICAgXCJjc3JmLXRva2VuXCI6IGdldENzcmZUb2tlbigpLFxuICAgIFwieC1saS1sYW5nXCI6IFwiZW5fVVNcIixcbiAgICBcIngtcmVzdGxpLXByb3RvY29sLXZlcnNpb25cIjogXCIyLjAuMFwiXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRNZXNzYWdlVmlhQVBJKHRocmVhZElkOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICBjb25zb2xlLmxvZyhgW1ZveWFnZXJdIFNlbmRpbmcgbWVzc2FnZSB0byB0aHJlYWQgJHt0aHJlYWRJZH1gKTtcbiAgXG4gIC8vIElmIHRocmVhZElkIGlzIGEgVVJMLCB3ZSBuZWVkIHRvIGV4dHJhY3QgdGhlIGFjdHVhbCB0aHJlYWQgSUQgb3IgZmluZCBpdFxuICBpZiAodGhyZWFkSWQuc3RhcnRzV2l0aCgnaHR0cCcpKSB7XG4gICAgLy8gQXR0ZW1wdCB0byBleHRyYWN0IHRocmVhZCBJRCBmcm9tIFVSTCBpZiBwb3NzaWJsZSwgb3RoZXJ3aXNlIHdlIG1pZ2h0IG5lZWQgdG8gZmV0Y2ggY29udmVyc2F0aW9ucyB0byBmaW5kIGl0XG4gICAgY29uc29sZS53YXJuKFwiW1ZveWFnZXJdIHNlbmRNZXNzYWdlVmlhQVBJIHJlY2VpdmVkIGEgVVJMIGluc3RlYWQgb2YgdGhyZWFkSWQuIEZpbmRpbmcgdGhyZWFkLi4uXCIpO1xuICAgIC8vIEZvciBub3csIGFzc3VtZSBpdCdzIGEgdGhyZWFkIElEIG9yIHdlJ2xsIG5lZWQgYSB3YXkgdG8gcmVzb2x2ZSBpdFxuICAgIGlmICh0aHJlYWRJZC5pbmNsdWRlcygnL3RocmVhZC8nKSkge1xuICAgICAgICB0aHJlYWRJZCA9IHRocmVhZElkLnNwbGl0KCcvdGhyZWFkLycpWzFdLnNwbGl0KCcvJylbMF1cbiAgICB9XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChgL3ZveWFnZXIvYXBpL21lc3NhZ2luZy9jb252ZXJzYXRpb25zLyR7dGhyZWFkSWR9L21lc3NhZ2VzYCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgLi4uZ2V0Vm95YWdlckhlYWRlcnMoKSxcbiAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICB0ZXh0OiBtZXNzYWdlXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZW5kZXJDb250ZW50UG9zdEFuY2hvcjogZmFsc2VcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KTtcblxuICAgIGlmICghcmVzcC5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYExpbmtlZEluIEFQSSByZXNwb25kZWQgd2l0aCAke3Jlc3Auc3RhdHVzfWApO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFwiW1ZveWFnZXJdIE1lc3NhZ2Ugc2VudCBzdWNjZXNzZnVsbHlcIik7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbVm95YWdlcl0gRmFpbGVkIHRvIHNlbmQgbWVzc2FnZSB2aWEgQVBJOlwiLCBlcnIpO1xuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kQ29ubmVjdGlvblJlcXVlc3RWaWFBUEkocHVibGljSWQ6IHN0cmluZywgbm90ZTogc3RyaW5nKSB7XG4gIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gU2VuZGluZyBjb25uZWN0aW9uIHJlcXVlc3QgdG8gJHtwdWJsaWNJZH1gKTtcbiAgXG4gIHRyeSB7XG4gICAgLy8gRmlyc3QsIHdlIG5lZWQgdGhlIHByb2ZpbGUgZGF0YSB0byBnZXQgdGhlIHRyYWNraW5nSWQgYW5kIHByb2ZpbGVJZFxuICAgIGNvbnN0IHByb2ZpbGVSZXNwID0gYXdhaXQgZmV0Y2goYC92b3lhZ2VyL2FwaS9pZGVudGl0eS9kYXNoL3Byb2ZpbGVzP3E9bWVtYmVySWRlbnRpdHkmbWVtYmVySWRlbnRpdHk9JHtwdWJsaWNJZH1gLCB7XG4gICAgICBoZWFkZXJzOiBnZXRWb3lhZ2VySGVhZGVycygpXG4gICAgfSk7XG4gICAgXG4gICAgaWYgKCFwcm9maWxlUmVzcC5vaykgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGZldGNoIHByb2ZpbGUgZm9yIGludml0YXRpb25cIik7XG4gICAgXG4gICAgY29uc3QgcHJvZmlsZURhdGEgPSBhd2FpdCBwcm9maWxlUmVzcC5qc29uKCk7XG4gICAgY29uc3QgcHJvZmlsZSA9IHByb2ZpbGVEYXRhLmluY2x1ZGVkPy5maW5kKChpOiBhbnkpID0+IGkuJHR5cGU/LmluY2x1ZGVzKFwiaWRlbnRpdHkuZGFzaC5Qcm9maWxlXCIpKTtcbiAgICBjb25zdCBlbnRpdHlVcm4gPSBwcm9maWxlPy5lbnRpdHlVcm4gfHwgXCJcIjtcbiAgICBjb25zdCBtZW1iZXJJZCA9IGVudGl0eVVybi5zcGxpdCgnOicpLnBvcCgpO1xuXG4gICAgaWYgKCFtZW1iZXJJZCkgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IHJlc29sdmUgbWVtYmVyIElEIGZvciBpbnZpdGF0aW9uXCIpO1xuXG4gICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xuICAgICAgdHJhY2tpbmdJZDogXCJcIiwgLy8gVXN1YWxseSBvcHRpb25hbCBvciBnZW5lcmF0ZWRcbiAgICAgIGludml0YXRpb25zOiBbe1xuICAgICAgICB0cmFja2luZ0lkOiBcIlwiLFxuICAgICAgICBpbnZpdGVlOiB7XG4gICAgICAgICAgXCJjb20ubGlua2VkaW4udm95YWdlci5ncm93dGguaW52aXRhdGlvbi5JbnZpdGVlUHJvZmlsZVwiOiB7XG4gICAgICAgICAgICBwcm9maWxlSWQ6IGB1cm46bGk6ZnNfbWluaVByb2ZpbGU6JHttZW1iZXJJZH1gXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH07XG5cbiAgICBpZiAobm90ZSkge1xuICAgICAgcGF5bG9hZC5pbnZpdGF0aW9uc1swXS5tZXNzYWdlID0gbm90ZTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goXCIvdm95YWdlci9hcGkvZ3Jvd3RoL25vcm1JbnZpdGF0aW9uc1wiLCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAuLi5nZXRWb3lhZ2VySGVhZGVycygpLFxuICAgICAgICBcImNvbnRlbnQtdHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgIGNvbnN0IGVyckRhdGEgPSBhd2FpdCByZXNwLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJEYXRhLm1lc3NhZ2UgfHwgYExpbmtlZEluIEFQSSByZXNwb25kZWQgd2l0aCAke3Jlc3Auc3RhdHVzfWApO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKFwiW1ZveWFnZXJdIENvbm5lY3Rpb24gcmVxdWVzdCBzZW50IHN1Y2Nlc3NmdWxseVwiKTtcbiAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgY29uc29sZS5lcnJvcihcIltWb3lhZ2VyXSBGYWlsZWQgdG8gc2VuZCBjb25uZWN0aW9uIHJlcXVlc3QgdmlhIEFQSTpcIiwgZXJyKTtcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hDb252ZXJzYXRpb25zVmlhQVBJKCkge1xuICBjb25zb2xlLmxvZyhcIltWb3lhZ2VyXSBGZXRjaGluZyBjb252ZXJzYXRpb25zLi4uXCIpO1xuICBcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goXCIvdm95YWdlci9hcGkvbWVzc2FnaW5nL2NvbnZlcnNhdGlvbnM/Y291bnQ9NDAmcT1hbGxcIiwge1xuICAgICAgaGVhZGVyczogZ2V0Vm95YWdlckhlYWRlcnMoKVxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXNwLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFN0YXR1cyAke3Jlc3Auc3RhdHVzfWApO1xuXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xuICAgIGNvbnN0IGluY2x1ZGVkID0gZGF0YS5pbmNsdWRlZCB8fCBbXTtcbiAgICBjb25zdCBjb252ZXJzYXRpb25zID0gZGF0YS5lbGVtZW50cyB8fCBbXTtcblxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBjb252ZXJzYXRpb25zLm1hcCgoY29udjogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHRocmVhZElkID0gY29udi5lbnRpdHlVcm4/LnNwbGl0KCc6JykucG9wKCk7XG4gICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gY29udi5sYXN0TWVzc2FnZTtcbiAgICAgICAgXG4gICAgICAgIC8vIEZpbmQgdGhlIG90aGVyIHBhcnRpY2lwYW50XG4gICAgICAgIGNvbnN0IHBhcnRpY2lwYW50cyA9IGNvbnYucGFydGljaXBhbnRzIHx8IFtdO1xuICAgICAgICAvLyBVc3VhbGx5LCB0aGUgZmlyc3QgcGFydGljaXBhbnQgdGhhdCBpc24ndCAnbWUnXG4gICAgICAgIC8vIFRoaXMgaXMgc2ltcGxpZmllZDsgcmVhbCBsb2dpYyBtaWdodCBuZWVkIHRvIG1hdGNoIGFnYWluc3QgdGhlIGN1cnJlbnQgdXNlcidzIElEXG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdGhyZWFkX2lkOiB0aHJlYWRJZCxcbiAgICAgICAgICAgIGxhc3RfbWVzc2FnZTogbGFzdE1lc3NhZ2U/LmV2ZW50Q29udGVudD8uW1wiY29tLmxpbmtlZGluLnZveWFnZXIubWVzc2FnaW5nLmV2ZW50Lk1lc3NhZ2VFdmVudFwiXT8uYm9keSxcbiAgICAgICAgICAgIHVucmVhZF9jb3VudDogY29udi51bnJlYWRDb3VudCxcbiAgICAgICAgICAgIHVwZGF0ZWRfYXQ6IGNvbnYubGFzdEFjdGl2aXR5QXQsXG4gICAgICAgICAgICByYXc6IGNvbnZcbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKGBbVm95YWdlcl0gRmV0Y2hlZCAke25vcm1hbGl6ZWQubGVuZ3RofSBjb252ZXJzYXRpb25zYCk7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgY29udmVyc2F0aW9uczogbm9ybWFsaXplZCB9O1xuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJbVm95YWdlcl0gRmFpbGVkIHRvIGZldGNoIGNvbnZlcnNhdGlvbnM6XCIsIGVycik7XG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7QUFDQSxFQUFDLE9BQWUsNEJBQTRCO0FBRTVDLE1BQU0sY0FBYyxDQUFDLE1BQU0sS0FBTSxNQUFNLFFBQVMsSUFBSSxRQUFRLENBQUMsWUFBWSxXQUFXLFNBQVMsS0FBSyxNQUFNLEtBQUssT0FBTyxLQUFLLE1BQU0sTUFBTSxFQUFFLElBQUksR0FBRyxDQUFDO0FBRy9JLE1BQU0sZ0JBS0Y7QUFBQSxJQUNGLFFBQVEsQ0FBQztBQUFBLElBQ1QsVUFBVSxvQkFBSSxJQUFJO0FBQUEsSUFDbEIsVUFBVSxDQUFDO0FBQUEsSUFD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
