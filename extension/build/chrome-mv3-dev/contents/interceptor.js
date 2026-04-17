"use strict";
(() => {
  // contents/interceptor.ts
  function initializeInterceptor() {
    console.log("%c[LinkedIn Pilot] Interceptor Active", "color: #3b82f6; font-weight: bold; font-size: 14px;");
    const originalXHR = window.XMLHttpRequest;
    const originalFetch = window.fetch;
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      let url = "";
      xhr.open = function(method, requestUrl) {
        url = requestUrl.toString();
        return originalOpen.apply(this, arguments);
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
          }
        }
      });
      return xhr;
    };
    window.fetch = async function(input, init) {
      let url;
      try {
        url = typeof input === "string" ? input : input.url;
      } catch (e) {
        return await originalFetch.apply(this, arguments);
      }
      if (!url || url.startsWith("chrome-extension://") || url.startsWith("chrome://") || url.startsWith("blob:")) {
        try {
          return await originalFetch.apply(this, arguments);
        } catch (e) {
          console.warn("[LinkedIn Pilot] Suppressed fetch error for:", url?.substring(0, 50));
          return new Response(null, { status: 204, statusText: "No Content" });
        }
      }
      const response = await originalFetch.apply(this, arguments);
      if (shouldIntervene(url)) {
        try {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            broadcastCapture(url, data);
          }
        } catch (e) {
        }
      }
      return response;
    };
    function shouldIntervene(url) {
      return url.includes("/voyager/api/graphql") || url.includes("/voyager/api/identity/dash/profiles") || url.includes("/voyager/api/search/hits") || url.includes("/voyager/api/content/comments") || url.includes("/voyager/api/feed/updates") || url.includes("/voyager/api/identity/profiles") || url.includes("/voyager/api/groups/memberships") || url.includes("/voyager/api/events/event/members") || url.includes("/voyager/api/relationships/dash/connections");
    }
    function broadcastCapture(url, data) {
      window.postMessage({
        type: "VOYAGER_EXTRACT",
        url,
        data,
        timestamp: Date.now()
      }, "*");
    }
  }
  if (!window.__PILOT_INTERCEPTOR_INIT__) {
    window.__PILOT_INTERCEPTOR_INIT__ = true;
    initializeInterceptor();
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vY29udGVudHMvaW50ZXJjZXB0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQVBJIEludGVyY2VwdG9yOiBSdW5zIGluIHRoZSBMaW5rZWRJbiBwYWdlIGNvbnRleHQgKE1BSU4gd29ybGQpLlxuICogT3ZlcnJpZGVzIFhIUiBhbmQgRmV0Y2ggdG8gY2FwdHVyZSByYXcgVm95YWdlciBBUEkgcmVzcG9uc2VzLlxuICovXG5mdW5jdGlvbiBpbml0aWFsaXplSW50ZXJjZXB0b3IoKSB7XG4gIGNvbnNvbGUubG9nKFwiJWNbTGlua2VkSW4gUGlsb3RdIEludGVyY2VwdG9yIEFjdGl2ZVwiLCBcImNvbG9yOiAjM2I4MmY2OyBmb250LXdlaWdodDogYm9sZDsgZm9udC1zaXplOiAxNHB4O1wiKTtcblxuICBjb25zdCBvcmlnaW5hbFhIUiA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdDtcbiAgY29uc3Qgb3JpZ2luYWxGZXRjaCA9IHdpbmRvdy5mZXRjaDtcblxuICAvLyAxLiBJbnRlcmNlcHQgWE1MSHR0cFJlcXVlc3RcbiAgKHdpbmRvdyBhcyBhbnkpLlhNTEh0dHBSZXF1ZXN0ID0gZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgeGhyID0gbmV3IG9yaWdpbmFsWEhSKCk7XG4gICAgY29uc3Qgb3JpZ2luYWxPcGVuID0geGhyLm9wZW47XG4gICAgY29uc3Qgb3JpZ2luYWxTZW5kID0geGhyLnNlbmQ7XG4gICAgbGV0IHVybDogc3RyaW5nID0gXCJcIjtcblxuICAgIHhoci5vcGVuID0gZnVuY3Rpb24obWV0aG9kLCByZXF1ZXN0VXJsKSB7XG4gICAgICB1cmwgPSByZXF1ZXN0VXJsLnRvU3RyaW5nKCk7XG4gICAgICByZXR1cm4gb3JpZ2luYWxPcGVuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyBhcyBhbnkpO1xuICAgIH07XG5cbiAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2hvdWxkSW50ZXJ2ZW5lKHVybCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50VHlwZSA9IHhoci5nZXRSZXNwb25zZUhlYWRlcihcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiO1xuICAgICAgICAgIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcyhcImpzb25cIikgJiYgeGhyLnJlc3BvbnNlVGV4dCkge1xuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgIGJyb2FkY2FzdENhcHR1cmUodXJsLCByZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gU2lsZW50bHkgZmFpbCB0byBub3QgZGlzcnVwdCBMaW5rZWRJbiBVSVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geGhyO1xuICB9O1xuXG4gIC8vIDIuIEludGVyY2VwdCBGZXRjaFxuICB3aW5kb3cuZmV0Y2ggPSBhc3luYyBmdW5jdGlvbihpbnB1dCwgaW5pdCkge1xuICAgIGxldCB1cmw6IHN0cmluZztcbiAgICB0cnkge1xuICAgICAgdXJsID0gdHlwZW9mIGlucHV0ID09PSBcInN0cmluZ1wiID8gaW5wdXQgOiAoaW5wdXQgYXMgUmVxdWVzdCkudXJsO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIElmIHdlIGNhbid0IGdldCB0aGUgVVJMLCBqdXN0IGNhbGwgb3JpZ2luYWwgZmV0Y2ggd2l0aG91dCBpbnRlcmNlcHRpbmdcbiAgICAgIHJldHVybiBhd2FpdCBvcmlnaW5hbEZldGNoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyBhcyBhbnkpO1xuICAgIH1cblxuICAgIC8vIFNraXAgaW52YWxpZC9leHRlbnNpb24gVVJMcyB0aGF0IHNob3VsZG4ndCBiZSBpbnRlcmNlcHRlZFxuICAgIGlmICghdXJsIHx8IHVybC5zdGFydHNXaXRoKFwiY2hyb21lLWV4dGVuc2lvbjovL1wiKSB8fCB1cmwuc3RhcnRzV2l0aChcImNocm9tZTovL1wiKSB8fCB1cmwuc3RhcnRzV2l0aChcImJsb2I6XCIpKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gYXdhaXQgb3JpZ2luYWxGZXRjaC5hcHBseSh0aGlzLCBhcmd1bWVudHMgYXMgYW55KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gU3VwcHJlc3MgZXJyb3JzIGZvciBleHRlbnNpb24gVVJMcyAtIHRoZXNlIGFyZSBpbnRlcm5hbCBjYWxscyB3ZSBzaG91bGRuJ3QgaW50ZXJmZXJlIHdpdGhcbiAgICAgICAgY29uc29sZS53YXJuKFwiW0xpbmtlZEluIFBpbG90XSBTdXBwcmVzc2VkIGZldGNoIGVycm9yIGZvcjpcIiwgdXJsPy5zdWJzdHJpbmcoMCwgNTApKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogMjA0LCBzdGF0dXNUZXh0OiBcIk5vIENvbnRlbnRcIiB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG9yaWdpbmFsRmV0Y2guYXBwbHkodGhpcywgYXJndW1lbnRzIGFzIGFueSk7XG5cbiAgICBpZiAoc2hvdWxkSW50ZXJ2ZW5lKHVybCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIjtcbiAgICAgICAgaWYgKGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwianNvblwiKSkge1xuICAgICAgICAgICAgY29uc3QgY2xvbmVkUmVzcG9uc2UgPSByZXNwb25zZS5jbG9uZSgpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNsb25lZFJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIGJyb2FkY2FzdENhcHR1cmUodXJsLCBkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBFcnJvciBwYXJzaW5nXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHNob3VsZEludGVydmVuZSh1cmw6IHN0cmluZykge1xuICAgIHJldHVybiAoXG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZ3JhcGhxbFwiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2lkZW50aXR5L2Rhc2gvcHJvZmlsZXNcIikgfHxcbiAgICAgIHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9zZWFyY2gvaGl0c1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2NvbnRlbnQvY29tbWVudHNcIikgfHxcbiAgICAgIHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9mZWVkL3VwZGF0ZXNcIikgfHxcbiAgICAgIHVybC5pbmNsdWRlcyhcIi92b3lhZ2VyL2FwaS9pZGVudGl0eS9wcm9maWxlc1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2dyb3Vwcy9tZW1iZXJzaGlwc1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2V2ZW50cy9ldmVudC9tZW1iZXJzXCIpIHx8XG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvcmVsYXRpb25zaGlwcy9kYXNoL2Nvbm5lY3Rpb25zXCIpXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJyb2FkY2FzdENhcHR1cmUodXJsOiBzdHJpbmcsIGRhdGE6IGFueSkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZSh7XG4gICAgICB0eXBlOiBcIlZPWUFHRVJfRVhUUkFDVFwiLFxuICAgICAgdXJsLFxuICAgICAgZGF0YSxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgIH0sIFwiKlwiKTtcbiAgfVxufVxuXG4vLyBDaGVjayBpZiBhbHJlYWR5IGluaXRpYWxpemVkIHRvIGF2b2lkIGRvdWJsZSBob29rc1xuaWYgKCEod2luZG93IGFzIGFueSkuX19QSUxPVF9JTlRFUkNFUFRPUl9JTklUX18pIHtcbiAgKHdpbmRvdyBhcyBhbnkpLl9fUElMT1RfSU5URVJDRVBUT1JfSU5JVF9fID0gdHJ1ZTtcbiAgaW5pdGlhbGl6ZUludGVyY2VwdG9yKCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7QUFJQSxXQUFTLHdCQUF3QjtBQUMvQixZQUFRLElBQUkseUNBQXlDLHFEQUFxRDtBQUUxRyxVQUFNLGNBQWMsT0FBTztBQUMzQixVQUFNLGdCQUFnQixPQUFPO0FBRzdCLElBQUMsT0FBZSxpQkFBaUIsV0FBVztBQUMxQyxZQUFNLE1BQU0sSUFBSSxZQUFZO0FBQzVCLFlBQU0sZUFBZSxJQUFJO0FBQ3pCLFlBQU0sZUFBZSxJQUFJO0FBQ3pCLFVBQUksTUFBYztBQUVsQixVQUFJLE9BQU8sU0FBUyxRQUFRLFlBQVk7QUFDdEMsY0FBTSxXQUFXLFNBQVM7QUFDMUIsZUFBTyxhQUFhLE1BQU0sTUFBTSxTQUFnQjtBQUFBLE1BQ2xEO0FBRUEsVUFBSSxpQkFBaUIsUUFBUSxXQUFXO0FBQ3RDLFlBQUksZ0JBQWdCLEdBQUcsR0FBRztBQUN4QixjQUFJO0FBQ0Ysa0JBQU0sY0FBYyxJQUFJLGtCQUFrQixjQUFjLEtBQUs7QUFDN0QsZ0JBQUksWUFBWSxTQUFTLE1BQU0sS0FBSyxJQUFJLGNBQWM7QUFDbEQsb0JBQU0sV0FBVyxLQUFLLE1BQU0sSUFBSSxZQUFZO0FBQzVDLCtCQUFpQixLQUFLLFFBQVE7QUFBQSxZQUNsQztBQUFBLFVBQ0YsU0FBUyxHQUFHO0FBQUEsVUFFWjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFFRCxhQUFPO0FBQUEsSUFDVDtBQUdBLFdBQU8sUUFBUSxlQUFlLE9BQU8sTUFBTTtBQUN6QyxVQUFJO0FBQ0osVUFBSTtBQUNGLGNBQU0sT0FBTyxVQUFVLFdBQVcsUUFBUyxNQUFrQjtBQUFBLE1BQy9ELFNBQVMsR0FBRztBQUVWLGVBQU8sTUFBTSxjQUFjLE1BQU0sTUFBTSxTQUFnQjtBQUFBLE1BQ3pEO0FBR0EsVUFBSSxDQUFDLE9BQU8sSUFBSSxXQUFXLHFCQUFxQixLQUFLLElBQUksV0FBVyxXQUFXLEtBQUssSUFBSSxXQUFXLE9BQU8sR0FBRztBQUMzRyxZQUFJO0FBQ0YsaUJBQU8sTUFBTSxjQUFjLE1BQU0sTUFBTSxTQUFnQjtBQUFBLFFBQ3pELFNBQVMsR0FBRztBQUVWLGtCQUFRLEtBQUssZ0RBQWdELEtBQUssVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUNsRixpQkFBTyxJQUFJLFNBQVMsTUFBTSxFQUFFLFFBQVEsS0FBSyxZQUFZLGFBQWEsQ0FBQztBQUFBLFFBQ3JFO0FBQUEsTUFDRjtBQUVBLFlBQU0sV0FBVyxNQUFNLGNBQWMsTUFBTSxNQUFNLFNBQWdCO0FBRWpFLFVBQUksZ0JBQWdCLEdBQUcsR0FBRztBQUN4QixZQUFJO0FBQ0YsZ0JBQU0sY0FBYyxTQUFTLFFBQVEsSUFBSSxjQUFjLEtBQUs7QUFDNUQsY0FBSSxZQUFZLFNBQVMsTUFBTSxHQUFHO0FBQzlCLGtCQUFNLGlCQUFpQixTQUFTLE1BQU07QUFDdEMsa0JBQU0sT0FBTyxNQUFNLGVBQWUsS0FBSztBQUN2Qyw2QkFBaUIsS0FBSyxJQUFJO0FBQUEsVUFDOUI7QUFBQSxRQUNGLFNBQVMsR0FBRztBQUFBLFFBRVo7QUFBQSxNQUNGO0FBRUEsYUFBTztBQUFBLElBQ1Q7QUFFQSxhQUFTLGdCQUFnQixLQUFhO0FBQ3BDLGFBQ0UsSUFBSSxTQUFTLHNCQUFzQixLQUNuQyxJQUFJLFNBQVMscUNBQXFDLEtBQ2xELElBQUksU0FBUywwQkFBMEIsS0FDdkMsSUFBSSxTQUFTLCtCQUErQixLQUM1QyxJQUFJLFNBQVMsMkJBQTJCLEtBQ3hDLElBQUksU0FBUyxnQ0FBZ0MsS0FDN0MsSUFBSSxTQUFTLGlDQUFpQyxLQUM5QyxJQUFJLFNBQVMsbUNBQW1DLEtBQ2hELElBQUksU0FBUyw2Q0FBNkM7QUFBQSxJQUU5RDtBQUVBLGFBQVMsaUJBQWlCLEtBQWEsTUFBVztBQUNoRCxhQUFPLFlBQVk7QUFBQSxRQUNqQixNQUFNO0FBQUEsUUFDTjtBQUFBLFFBQ0E7QUFBQSxRQUNBLFdBQVcsS0FBSyxJQUFJO0FBQUEsTUFDdEIsR0FBRyxHQUFHO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFHQSxNQUFJLENBQUUsT0FBZSw0QkFBNEI7QUFDL0MsSUFBQyxPQUFlLDZCQUE2QjtBQUM3QywwQkFBc0I7QUFBQSxFQUN4QjsiLAogICJuYW1lcyI6IFtdCn0K
