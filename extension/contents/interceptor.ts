/**
 * API Interceptor: Runs in the LinkedIn page context (MAIN world).
 * Overrides XHR and Fetch to capture raw Voyager API responses.
 */
function initializeInterceptor() {
  console.log("%c[LinkedIn Pilot] Interceptor Active", "color: #3b82f6; font-weight: bold; font-size: 14px;");

  const originalXHR = window.XMLHttpRequest;
  const originalFetch = window.fetch;

  // 1. Intercept XMLHttpRequest
  (window as any).XMLHttpRequest = function() {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let url: string = "";

    xhr.open = function(method, requestUrl) {
      url = requestUrl.toString();
      return originalOpen.apply(this, arguments as any);
    };

    xhr.addEventListener("load", function() {
      if (shouldIntervene(url)) {
        try {
          const contentType = xhr.getResponseHeader("content-type") || "";
          if (contentType.includes("json") && xhr.responseText) {
              const response = JSON.parse(xhr.responseText);
              broadcastCapture(url, response);
          }
        } catch (e) {
          // Silently fail to not disrupt LinkedIn UI
        }
      }
    });

    return xhr;
  };

  // 2. Intercept Fetch
  window.fetch = async function(input, init) {
    let url: string;
    try {
      url = typeof input === "string" ? input : (input as Request).url;
    } catch (e) {
      // If we can't get the URL, just call original fetch without intercepting
      return await originalFetch.apply(this, arguments as any);
    }

    // Skip invalid/extension URLs that shouldn't be intercepted
    if (!url || url.startsWith("chrome-extension://") || url.startsWith("chrome://") || url.startsWith("blob:")) {
      try {
        return await originalFetch.apply(this, arguments as any);
      } catch (e) {
        // Suppress errors for extension URLs - these are internal calls we shouldn't interfere with
        console.warn("[LinkedIn Pilot] Suppressed fetch error for:", url?.substring(0, 50));
        return new Response(null, { status: 204, statusText: "No Content" });
      }
    }

    const response = await originalFetch.apply(this, arguments as any);

    if (shouldIntervene(url)) {
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("json")) {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            broadcastCapture(url, data);
        }
      } catch (e) {
        // Error parsing
      }
    }

    return response;
  };

  function shouldIntervene(url: string) {
    return (
      url.includes("/voyager/api/graphql") ||
      url.includes("/voyager/api/identity/dash/profiles") ||
      url.includes("/voyager/api/search/hits") ||
      url.includes("/voyager/api/content/comments") ||
      url.includes("/voyager/api/feed/updates") ||
      url.includes("/voyager/api/identity/profiles") ||
      url.includes("/voyager/api/groups/memberships") ||
      url.includes("/voyager/api/events/event/members") ||
      url.includes("/voyager/api/relationships/dash/connections")
    );
  }

  function broadcastCapture(url: string, data: any) {
    window.postMessage({
      type: "VOYAGER_EXTRACT",
      url,
      data,
      timestamp: Date.now()
    }, "*");
  }
}

// Check if already initialized to avoid double hooks
if (!(window as any).__PILOT_INTERCEPTOR_INIT__) {
  (window as any).__PILOT_INTERCEPTOR_INIT__ = true;
  initializeInterceptor();
}
