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
      const response = await originalFetch.apply(this, arguments);
      const url = typeof input === "string" ? input : input.url;
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
      return url.includes("/voyager/api/identity/dash/profiles") || url.includes("/voyager/api/search/hits") || url.includes("/voyager/api/content/comments") || url.includes("/voyager/api/feed/updates") || url.includes("/voyager/api/identity/profiles") || url.includes("/voyager/api/groups/memberships") || url.includes("/voyager/api/events/event/members");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vY29udGVudHMvaW50ZXJjZXB0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQVBJIEludGVyY2VwdG9yOiBSdW5zIGluIHRoZSBMaW5rZWRJbiBwYWdlIGNvbnRleHQgKE1BSU4gd29ybGQpLlxuICogT3ZlcnJpZGVzIFhIUiBhbmQgRmV0Y2ggdG8gY2FwdHVyZSByYXcgVm95YWdlciBBUEkgcmVzcG9uc2VzLlxuICovXG5mdW5jdGlvbiBpbml0aWFsaXplSW50ZXJjZXB0b3IoKSB7XG4gIGNvbnNvbGUubG9nKFwiJWNbTGlua2VkSW4gUGlsb3RdIEludGVyY2VwdG9yIEFjdGl2ZVwiLCBcImNvbG9yOiAjM2I4MmY2OyBmb250LXdlaWdodDogYm9sZDsgZm9udC1zaXplOiAxNHB4O1wiKTtcblxuICBjb25zdCBvcmlnaW5hbFhIUiA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdDtcbiAgY29uc3Qgb3JpZ2luYWxGZXRjaCA9IHdpbmRvdy5mZXRjaDtcblxuICAvLyAxLiBJbnRlcmNlcHQgWE1MSHR0cFJlcXVlc3RcbiAgKHdpbmRvdyBhcyBhbnkpLlhNTEh0dHBSZXF1ZXN0ID0gZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgeGhyID0gbmV3IG9yaWdpbmFsWEhSKCk7XG4gICAgY29uc3Qgb3JpZ2luYWxPcGVuID0geGhyLm9wZW47XG4gICAgY29uc3Qgb3JpZ2luYWxTZW5kID0geGhyLnNlbmQ7XG4gICAgbGV0IHVybDogc3RyaW5nID0gXCJcIjtcblxuICAgIHhoci5vcGVuID0gZnVuY3Rpb24obWV0aG9kLCByZXF1ZXN0VXJsKSB7XG4gICAgICB1cmwgPSByZXF1ZXN0VXJsLnRvU3RyaW5nKCk7XG4gICAgICByZXR1cm4gb3JpZ2luYWxPcGVuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyBhcyBhbnkpO1xuICAgIH07XG5cbiAgICB4aHIuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoc2hvdWxkSW50ZXJ2ZW5lKHVybCkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50VHlwZSA9IHhoci5nZXRSZXNwb25zZUhlYWRlcihcImNvbnRlbnQtdHlwZVwiKSB8fCBcIlwiO1xuICAgICAgICAgIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcyhcImpzb25cIikgJiYgeGhyLnJlc3BvbnNlVGV4dCkge1xuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgIGJyb2FkY2FzdENhcHR1cmUodXJsLCByZXNwb25zZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gU2lsZW50bHkgZmFpbCB0byBub3QgZGlzcnVwdCBMaW5rZWRJbiBVSVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geGhyO1xuICB9O1xuXG4gIC8vIDIuIEludGVyY2VwdCBGZXRjaFxuICB3aW5kb3cuZmV0Y2ggPSBhc3luYyBmdW5jdGlvbihpbnB1dCwgaW5pdCkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgb3JpZ2luYWxGZXRjaC5hcHBseSh0aGlzLCBhcmd1bWVudHMgYXMgYW55KTtcbiAgICBjb25zdCB1cmwgPSB0eXBlb2YgaW5wdXQgPT09IFwic3RyaW5nXCIgPyBpbnB1dCA6IChpbnB1dCBhcyBSZXF1ZXN0KS51cmw7XG5cbiAgICBpZiAoc2hvdWxkSW50ZXJ2ZW5lKHVybCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gcmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgfHwgXCJcIjtcbiAgICAgICAgaWYgKGNvbnRlbnRUeXBlLmluY2x1ZGVzKFwianNvblwiKSkge1xuICAgICAgICAgICAgY29uc3QgY2xvbmVkUmVzcG9uc2UgPSByZXNwb25zZS5jbG9uZSgpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNsb25lZFJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgICAgIGJyb2FkY2FzdENhcHR1cmUodXJsLCBkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBFcnJvciBwYXJzaW5nXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHNob3VsZEludGVydmVuZSh1cmw6IHN0cmluZykge1xuICAgIHJldHVybiAoXG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvaWRlbnRpdHkvZGFzaC9wcm9maWxlc1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL3NlYXJjaC9oaXRzXCIpIHx8XG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvY29udGVudC9jb21tZW50c1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2ZlZWQvdXBkYXRlc1wiKSB8fFxuICAgICAgdXJsLmluY2x1ZGVzKFwiL3ZveWFnZXIvYXBpL2lkZW50aXR5L3Byb2ZpbGVzXCIpIHx8XG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZ3JvdXBzL21lbWJlcnNoaXBzXCIpIHx8XG4gICAgICB1cmwuaW5jbHVkZXMoXCIvdm95YWdlci9hcGkvZXZlbnRzL2V2ZW50L21lbWJlcnNcIilcbiAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24gYnJvYWRjYXN0Q2FwdHVyZSh1cmw6IHN0cmluZywgZGF0YTogYW55KSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKHtcbiAgICAgIHR5cGU6IFwiVk9ZQUdFUl9FWFRSQUNUXCIsXG4gICAgICB1cmwsXG4gICAgICBkYXRhLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpXG4gICAgfSwgXCIqXCIpO1xuICB9XG59XG5cbi8vIENoZWNrIGlmIGFscmVhZHkgaW5pdGlhbGl6ZWQgdG8gYXZvaWQgZG91YmxlIGhvb2tzXG5pZiAoISh3aW5kb3cgYXMgYW55KS5fX1BJTE9UX0lOVEVSQ0VQVE9SX0lOSVRfXykge1xuICAod2luZG93IGFzIGFueSkuX19QSUxPVF9JTlRFUkNFUFRPUl9JTklUX18gPSB0cnVlO1xuICBpbml0aWFsaXplSW50ZXJjZXB0b3IoKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUlBLFdBQVMsd0JBQXdCO0FBQy9CLFlBQVEsSUFBSSx5Q0FBeUMscURBQXFEO0FBRTFHLFVBQU0sY0FBYyxPQUFPO0FBQzNCLFVBQU0sZ0JBQWdCLE9BQU87QUFHN0IsSUFBQyxPQUFlLGlCQUFpQixXQUFXO0FBQzFDLFlBQU0sTUFBTSxJQUFJLFlBQVk7QUFDNUIsWUFBTSxlQUFlLElBQUk7QUFDekIsWUFBTSxlQUFlLElBQUk7QUFDekIsVUFBSSxNQUFjO0FBRWxCLFVBQUksT0FBTyxTQUFTLFFBQVEsWUFBWTtBQUN0QyxjQUFNLFdBQVcsU0FBUztBQUMxQixlQUFPLGFBQWEsTUFBTSxNQUFNLFNBQWdCO0FBQUEsTUFDbEQ7QUFFQSxVQUFJLGlCQUFpQixRQUFRLFdBQVc7QUFDdEMsWUFBSSxnQkFBZ0IsR0FBRyxHQUFHO0FBQ3hCLGNBQUk7QUFDRixrQkFBTSxjQUFjLElBQUksa0JBQWtCLGNBQWMsS0FBSztBQUM3RCxnQkFBSSxZQUFZLFNBQVMsTUFBTSxLQUFLLElBQUksY0FBYztBQUNsRCxvQkFBTSxXQUFXLEtBQUssTUFBTSxJQUFJLFlBQVk7QUFDNUMsK0JBQWlCLEtBQUssUUFBUTtBQUFBLFlBQ2xDO0FBQUEsVUFDRixTQUFTLEdBQUc7QUFBQSxVQUVaO0FBQUEsUUFDRjtBQUFBLE1BQ0YsQ0FBQztBQUVELGFBQU87QUFBQSxJQUNUO0FBR0EsV0FBTyxRQUFRLGVBQWUsT0FBTyxNQUFNO0FBQ3pDLFlBQU0sV0FBVyxNQUFNLGNBQWMsTUFBTSxNQUFNLFNBQWdCO0FBQ2pFLFlBQU0sTUFBTSxPQUFPLFVBQVUsV0FBVyxRQUFTLE1BQWtCO0FBRW5FLFVBQUksZ0JBQWdCLEdBQUcsR0FBRztBQUN4QixZQUFJO0FBQ0YsZ0JBQU0sY0FBYyxTQUFTLFFBQVEsSUFBSSxjQUFjLEtBQUs7QUFDNUQsY0FBSSxZQUFZLFNBQVMsTUFBTSxHQUFHO0FBQzlCLGtCQUFNLGlCQUFpQixTQUFTLE1BQU07QUFDdEMsa0JBQU0sT0FBTyxNQUFNLGVBQWUsS0FBSztBQUN2Qyw2QkFBaUIsS0FBSyxJQUFJO0FBQUEsVUFDOUI7QUFBQSxRQUNGLFNBQVMsR0FBRztBQUFBLFFBRVo7QUFBQSxNQUNGO0FBRUEsYUFBTztBQUFBLElBQ1Q7QUFFQSxhQUFTLGdCQUFnQixLQUFhO0FBQ3BDLGFBQ0UsSUFBSSxTQUFTLHFDQUFxQyxLQUNsRCxJQUFJLFNBQVMsMEJBQTBCLEtBQ3ZDLElBQUksU0FBUywrQkFBK0IsS0FDNUMsSUFBSSxTQUFTLDJCQUEyQixLQUN4QyxJQUFJLFNBQVMsZ0NBQWdDLEtBQzdDLElBQUksU0FBUyxpQ0FBaUMsS0FDOUMsSUFBSSxTQUFTLG1DQUFtQztBQUFBLElBRXBEO0FBRUEsYUFBUyxpQkFBaUIsS0FBYSxNQUFXO0FBQ2hELGFBQU8sWUFBWTtBQUFBLFFBQ2pCLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLFFBQ0EsV0FBVyxLQUFLLElBQUk7QUFBQSxNQUN0QixHQUFHLEdBQUc7QUFBQSxJQUNSO0FBQUEsRUFDRjtBQUdBLE1BQUksQ0FBRSxPQUFlLDRCQUE0QjtBQUMvQyxJQUFDLE9BQWUsNkJBQTZCO0FBQzdDLDBCQUFzQjtBQUFBLEVBQ3hCOyIsCiAgIm5hbWVzIjogW10KfQo=
