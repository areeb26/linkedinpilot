import { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { supabase } from "./lib/supabase"
import "./style.css"

function IndexPopup() {
  const [view, setView] = useState<'status' | 'extract'>('status')
  const [connected, setConnected] = useState(false)
  const [workspaceId, setWorkspaceId] = useState("")
  const [workspaceName, setWorkspaceName] = useState("Loading...")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [initLoading, setInitLoading] = useState(true)
  const [needRefresh, setNeedRefresh] = useState<{ active: boolean; tabId?: number }>({ active: false })
  
  const [detectedProfile, setDetectedProfile] = useState<{
    full_name?: string;
    avatar_url?: string;
    success?: boolean;
    member_id?: string;
  } | null>(null)

  useEffect(() => {
    chrome.storage.local.get(
      ["currentWorkspaceId", "currentWorkspaceName", "accountConnected"],
      async (result) => {
        let activeWorkspaceId: string | null = result.currentWorkspaceId as string ?? null;
        let activeWorkspaceName: string | null = result.currentWorkspaceName as string ?? null;

        if (!activeWorkspaceId || activeWorkspaceId === "ws-123") {
          try {
            const { data, error } = await supabase
              .from("workspaces")
              .select("id, name")
              .limit(1)
              .single()

            if (data && !error) {
              const wsId = data.id as string;
              const wsName = (data.name as string) || "Workspace";
              activeWorkspaceId = wsId;
              activeWorkspaceName = wsName;
              setWorkspaceId(wsId);
              setWorkspaceName(wsName);
              chrome.storage.local.set({
                currentWorkspaceId: wsId,
                currentWorkspaceName: wsName,
              })
            }
          } catch (err) {
            console.error("Failed to fetch workspace:", err)
          }
        } else {
          setWorkspaceId(activeWorkspaceId || "")
          setWorkspaceName(activeWorkspaceName || "Workspace")
        }
        setInitLoading(false)

        // Detect LinkedIn Session
        chrome.runtime.sendMessage({ type: "DETECT_SESSION" }, (response) => {
          if (response?.success && response.profile) {
            setDetectedProfile(response.profile)
            
            if (activeWorkspaceId) {
              chrome.runtime.sendMessage({ 
                type: "CHECK_ACCOUNT_SESSIONS", 
                workspaceId: activeWorkspaceId,
                memberId: response.profile.member_id 
              }, (checkResp) => {
                if (checkResp?.success) {
                  const isConnected = !!checkResp.connected
                  setConnected(isConnected)
                  chrome.storage.local.set({ accountConnected: isConnected })
                }
              })
            }
          } else {
            setDetectedProfile({ success: false })
            setConnected(false)
            chrome.storage.local.set({ accountConnected: false })
          }
        })
      }
    )
  }, [])

  const handleConnect = () => {
    if (!workspaceId) {
      alert("No workspace found. Please open the dashboard first.")
      return
    }
    setLoading(true)
    setStatus("Connecting...")
    chrome.runtime.sendMessage({ type: "CONNECT_ACCOUNT", workspaceId }, (response) => {
      setLoading(false)
      setStatus("")
      if (response?.success) {
        setConnected(true)
        chrome.storage.local.set({ accountConnected: true })
      } else {
        alert("Failed to connect: " + (response?.error || "Unknown error"))
      }
    })
  }

  const handleExtract = (type: string) => {
    setLoading(true)
    chrome.runtime.sendMessage({ type: "SCRAPE_LEADS", extractionType: type, workspaceId }, (response) => {
      setLoading(false)
      if (response?.success) {
        if (response.pending) {
          alert("Navigating to LinkedIn... Please open the extension and click Extract again once on the correct page.")
          return
        }
        // Store leads and show success - don't open new tab, user can check Lead Database
        chrome.storage.local.set({ extractedLeads: response.leads }, () => {
          alert(`✅ ${response.leads?.length || 0} leads extracted! Check the Lead Database in your dashboard.`)
        })
      } else {
        if (response?.needs_refresh) {
          setNeedRefresh({ active: true, tabId: response.tabId })
        } else {
          alert("Extraction failed: " + (response?.error || "Unknown error"))
        }
      }
    })
  }

  const handleFixConnection = () => {
    if (needRefresh.tabId) {
      setLoading(true)
      chrome.tabs.reload(needRefresh.tabId, {}, () => {
        setTimeout(() => {
          setLoading(false)
          setNeedRefresh({ active: false })
          window.close() // Close popup so user can see the refresh
        }, 1000)
      })
    }
  }

  if (view === 'extract') {
    return (
      <div className="w-[320px] h-[500px] bg-white text-gray-800 p-6 font-sans flex flex-col">
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg">👽</div>
            <h1 className="text-xl font-bold tracking-tight">Add prospects</h1>
          </div>
          <button onClick={() => setView('status')} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
          {needRefresh.active ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-3xl">🔌</div>
              <h2 className="font-bold text-amber-800">Connection Lost</h2>
              <p className="text-sm text-amber-700 leading-relaxed">LinkedIn needs a quick refresh to reconnect with the extension.</p>
              <button 
                onClick={handleFixConnection}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-900/20"
              >
                Fix Connection
              </button>
            </div>
          ) : (
            <>
              {[
                { id: 'search', label: 'From a search', icon: '🔍', color: 'bg-blue-50 text-blue-600' },
                { id: 'comments', label: 'Commented on post', icon: '💬', color: 'bg-purple-50 text-purple-600' },
                { id: 'reactions', label: 'Reacted on post', icon: '👍', color: 'bg-indigo-50 text-indigo-600' },
                { id: 'groups', label: 'From my groups', icon: '👥', color: 'bg-pink-50 text-pink-600' },
                { id: 'events', label: 'From an event', icon: '📅', color: 'bg-orange-50 text-orange-600' },
                { id: 'network', label: 'From my network', icon: '🔗', color: 'bg-cyan-50 text-cyan-600' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleExtract(item.id)}
                  disabled={loading}
                  className="w-full flex items-center p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 hover:border-blue-200 transition-all group group-active:scale-[0.98]"
                >
                  <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mr-4 text-2xl group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <span className="font-semibold text-gray-700">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {loading && (
          <div className="mt-4 flex items-center justify-center p-3 bg-blue-50 rounded-xl text-blue-600 text-sm font-bold animate-pulse">
            Extracting leads...
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-[320px] h-[500px] bg-[#1a1a1a] text-white p-6 font-sans flex flex-col shadow-2xl">
      <div className="flex items-center justify-between pb-6 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          LinkedIn Pilot
        </h1>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-600"}`} />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{connected ? "Active" : "Offline"}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-8">
        {!connected ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                {detectedProfile?.avatar_url ? (
                  <img src={detectedProfile.avatar_url} className="w-16 h-16 rounded-full" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {detectedProfile?.full_name ? `Welcome back, ` : "Connect your account to start automating."}
                {detectedProfile?.full_name && <span className="text-white font-bold block mt-1">{detectedProfile.full_name}</span>}
              </p>
            </div>

            <button
              onClick={handleConnect}
              disabled={loading || !detectedProfile?.success}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98]"
            >
              {loading ? "Syncing..." : detectedProfile?.success ? "One-Click Connect" : "Login to LinkedIn"}
            </button>
            
            {!detectedProfile?.success && !initLoading && (
              <p className="text-[10px] text-center text-red-400 font-medium">Please open LinkedIn and login to continue.</p>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-xl shadow-blue-900/20">
                <span className="text-2xl text-white">🚀</span>
              </div>
              <h2 className="text-lg font-bold mb-1">Account Ready</h2>
              <p className="text-xs text-gray-400">Everything is synced and ready to go.</p>
            </div>

            <button
              onClick={() => setView('extract')}
              className="w-full py-4 px-6 bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              Extract Leads
            </button>
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-gray-800 text-center">
        <button
          onClick={() => chrome.tabs.create({ url: "http://localhost:5173/dashboard" })}
          className="text-[10px] text-gray-500 hover:text-blue-400 font-bold uppercase tracking-[0.2em] transition-colors"
        >
          Open App Dashboard
        </button>
      </div>
    </div>
  )
}

const rootEl = document.getElementById("root")
if (rootEl) createRoot(rootEl).render(<IndexPopup />)
