import React, { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAddAccount } from "@/hooks/useLinkedInAccounts"
import { useWorkspaceStore } from "@/store/workspaceStore"
import { supabase } from "@/lib/supabase"
import { ShieldCheck, Globe, Key, Loader2, CheckCircle2, AlertCircle, Settings } from "lucide-react"

export function ConnectAccountModal({ onClose }) {
  const { workspaceId, workspaceName } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [method, setMethod] = useState("credentials")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const addAccount = useAddAccount()

  // Form states
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cookieValue, setCookieValue] = useState("")

  const handleConnect = async (data) => {
    setLoading(true)
    setError(null)
    try {
      await addAccount.mutateAsync({
        ...data,
        workspace_id: workspaceId
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!workspaceId) throw new Error('No workspace selected. Please refresh and try again.')

      const { data, error: fnError } = await supabase.functions.invoke('connect-credentials', {
        body: { email, password, workspace_id: workspaceId }
      })

      if (data?.error) throw new Error(data.error)
      if (fnError) throw new Error(fnError.message || 'Failed to trigger connection worker')

      await queryClient.invalidateQueries(['linkedin-accounts', workspaceId])
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Detect if extension is available
  const [extAvailable, setExtAvailable] = useState(false)
  const [detectedProfile, setDetectedProfile] = useState(null)
  
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "PILOT_EXT_READY") {
        setExtAvailable(true)
        // Request session detection
        window.postMessage({ type: "DETECT_SESSION_REQUEST" }, "*")
      }
      if (event.data?.type === "DETECT_SESSION_RESPONSE") {
        if (event.data.success && event.data.profile) {
          setDetectedProfile(event.data.profile)
        }
      }
    }
    window.addEventListener("message", handler)
    window.postMessage({ type: "PILOT_EXT_PING" }, "*")
    return () => window.removeEventListener("message", handler)
  }, [])

  const handleSyncViaExtension = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Extension sync timed out")), 30000)
        const handler = (event) => {
          if (event.data?.type === "SYNC_BROWSER_RESULT") {
            clearTimeout(timeout)
            window.removeEventListener("message", handler)
            resolve(event.data)
          }
        }
        window.addEventListener("message", handler)
        window.postMessage({ type: "SYNC_BROWSER_SESSION", workspaceId }, "*")
      })

      if (result.success) {
        await queryClient.invalidateQueries(['linkedin-accounts', workspaceId])
        onClose()
      } else {
        throw new Error(result.error || "Extension sync failed")
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleCookieSubmit = async (e) => {
    e.preventDefault()
    if (!cookieValue) return

    setLoading(true)
    setError(null)

    // Strategy 1: Try extension relay (fetches profile in browser context)
    if (extAvailable) {
      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Extension timeout")), 30000)

          const handler = (event) => {
            if (event.data?.type === "CONNECT_COOKIE_RESULT") {
              clearTimeout(timeout)
              window.removeEventListener("message", handler)
              resolve(event.data)
            }
          }
          window.addEventListener("message", handler)

          window.postMessage({
            type: "CONNECT_COOKIE_RELAY",
            cookie: cookieValue,
            workspaceId
          }, "*")
        })

        if (result.success) {
          await queryClient.invalidateQueries(['linkedin-accounts', workspaceId])
          onClose()
          return
        }
      } catch (relayErr) {
        console.warn("Extension relay failed:", relayErr.message)
      }
    }

    // Strategy 2: Direct edge function call (profile sync may be limited)
    try {
      const { data, error: functionError } = await supabase.functions.invoke('connect-cookie', {
        body: { cookie: cookieValue, workspace_id: workspaceId }
      })

      if (functionError) {
        throw new Error(functionError.message || 'Failed to connect account.')
      }

      if (data?.success === false) {
        throw new Error(data.error || "Server error connecting account.")
      }
      
      // Ensure the query is invalidated before closing/allowing re-click
      await queryClient.invalidateQueries(['linkedin-accounts', workspaceId])
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[480px] bg-[#1e1e1e] border-white/5 p-0 overflow-hidden">
      <div className="p-8 pb-4">
        <DialogHeader className="space-y-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">Connect LinkedIn Account</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Select your preferred method to safely link your LinkedIn profile.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={method} onValueChange={setMethod} className="w-full">
          <TabsList className="grid grid-cols-2 bg-white/5 border border-white/5 p-1 rounded-xl mb-8 h-12">
            <TabsTrigger value="credentials" className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Credentials</TabsTrigger>
            <TabsTrigger value="cookies" className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-white">Cookies</TabsTrigger>
          </TabsList>

          {error && (
            <div className="mb-6 p-4 bg-red-400/5 border border-red-500/10 rounded-xl flex gap-3 items-center">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <TabsContent value="credentials" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">LinkedIn Email</Label>
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" 
                  className="bg-white/5 border-white/10 h-11 text-white placeholder:text-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">Password</Label>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="bg-white/5 border-white/10 h-11 text-white placeholder:text-[#333]"
                />
              </div>
            </div>
            <div className="p-4 bg-blue-400/5 border border-blue-500/10 rounded-xl">
              <p className="text-[10px] text-blue-300 leading-relaxed font-medium">
                <span className="font-bold flex items-center gap-1.5 mb-1.5 uppercase tracking-tighter text-blue-400"><CheckCircle2 className="w-3 h-3" /> Secure Login</span>
                Your credentials are encrypted using AES-256 and never stored in plain text. We use high-quality residential proxies to match your local IP.
              </p>
            </div>
            <Button 
               onClick={handleCredentialSubmit}
               disabled={loading || !email || !password}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 uppercase tracking-widest text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
              Initialize Connection
            </Button>
          </TabsContent>

          <TabsContent value="cookies" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {extAvailable && detectedProfile ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl gap-4">
                  <div className="relative">
                    <img 
                      src={detectedProfile.avatar_url || "https://static.licdn.com/aero-v1/networks/ghost-agent-60x60.png"} 
                      className="w-20 h-20 rounded-full border-2 border-blue-500 shadow-2xl"
                      alt="Avatar"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-[#1e1e1e] flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-blue-400 tracking-widest mb-1">Detected LinkedIn Profile</p>
                    <p className="text-xl font-bold text-white tracking-tight">{detectedProfile.full_name}</p>
                  </div>

                  <Button 
                    onClick={handleSyncViaExtension}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 group"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <span className="mr-2 text-xl group-hover:scale-125 transition-transform">⚡</span>}
                    {loading ? "Syncing..." : `Sync ${detectedProfile.full_name.split(' ')[0]}'s Account`}
                  </Button>
                </div>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-[#1e1e1e] px-4 text-[#444] font-bold tracking-widest">Or Manual Setup</span></div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Quick Connect Guide</p>
                <ol className="text-[11px] text-[#666] space-y-2 ml-4 list-decimal leading-relaxed">
                  <li>Log in to <span className="text-[#999]">linkedin.com</span>.</li>
                  <li>Copy your <span className="text-[#999]">li_at</span> cookie value from DevTools.</li>
                  <li>Paste it below and click connect.</li>
                </ol>
                {!extAvailable && (
                  <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex gap-2 items-start">
                    <AlertCircle className="w-3 h-4 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-500/80 font-medium leading-relaxed">
                      Install the <span className="font-bold">Pilot Extension</span> to enable one-click sync with profile photo.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">Paste Cookie Value</Label>
                <Input 
                  value={cookieValue}
                  onChange={(e) => setCookieValue(e.target.value)}
                  placeholder="li_at value or entire cookie string..." 
                  className="bg-white/5 border-white/10 h-11 text-white placeholder:text-[#333]"
                  disabled={loading}
                />
                <p className="text-[9px] text-[#555] mt-1 px-1 italic">
                  Tip: Provide the entire string (including JSESSIONID) for better profile sync.
                </p>
              </div>
              
              <Button 
                onClick={handleCookieSubmit}
                disabled={loading || !cookieValue}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold h-12 uppercase tracking-widest text-[10px]"
              >
                {loading && !extAvailable ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Connect Profile Instantly"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="p-4 bg-black/20 border-t border-white/5 flex justify-center">
        <p className="text-[9px] text-[#333] font-bold uppercase tracking-widest">LinkedPilot Infrastructure v2.1 • AES Optimized</p>
      </div>
    </DialogContent>
  )
}
