import React, { useState, useEffect } from "react"
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkspaceStore } from "@/store/workspaceStore"
import { supabase } from "@/lib/supabase"
import {
  useConnectHostedAuth,
  useConnectCredentials,
  useConnectCookie,
  useSolveCheckpoint,
  useResendCheckpoint,
} from "@/hooks/useUnipileAccounts"
import {
  ShieldCheck,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
} from "lucide-react"

// ---------------------------------------------------------------------------
// CheckpointOverlay — shown when connectState === 'checkpoint'
// ---------------------------------------------------------------------------

function CheckpointOverlay({ checkpointData, onSuccess, onCancel }) {
  const [otpCode, setOtpCode] = useState("")
  const [errorMsg, setErrorMsg] = useState(null)
  const [resendSent, setResendSent] = useState(false)

  const solveCheckpoint = useSolveCheckpoint()
  const resendCheckpoint = useResendCheckpoint()

  const { account_id, checkpoint_type } = checkpointData ?? {}

  const isInAppValidation = checkpoint_type === "IN_APP_VALIDATION"
  const needsCode = !isInAppValidation

  const handleVerify = async () => {
    setErrorMsg(null)
    try {
      const result = await solveCheckpoint.mutateAsync({ account_id, code: otpCode })
      if (result?.checkpoint) {
        // Another checkpoint — update state in place
        onSuccess({ nextCheckpoint: result })
      } else {
        onSuccess({ done: true })
      }
    } catch (err) {
      setErrorMsg(err?.message ?? "Verification failed. Please try again.")
    }
  }

  const handleResend = async () => {
    setErrorMsg(null)
    setResendSent(false)
    try {
      await resendCheckpoint.mutateAsync({ account_id })
      setResendSent(true)
    } catch (err) {
      setErrorMsg(err?.message ?? "Failed to resend code. Please try again.")
    }
  }

  const checkpointLabel = () => {
    switch (checkpoint_type) {
      case "2FA":
        return "Two-Factor Authentication"
      case "OTP":
        return "One-Time Password"
      case "IN_APP_VALIDATION":
        return "In-App Validation"
      default:
        return checkpoint_type ?? "Verification Required"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
          <Smartphone className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mb-0.5">
            Checkpoint Required
          </p>
          <p className="text-sm font-semibold text-white">{checkpointLabel()}</p>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="p-4 bg-red-400/5 border border-red-500/10 rounded-xl flex gap-3 items-center">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-400 font-medium leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Resend confirmation */}
      {resendSent && (
        <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl flex gap-2 items-center">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-[11px] text-green-400 font-medium">Code resent successfully.</p>
        </div>
      )}

      {isInAppValidation ? (
        /* IN_APP_VALIDATION — no code input */
        <div className="p-5 bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl text-center space-y-3">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Check your LinkedIn mobile app</p>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            Open the LinkedIn app on your phone and approve the login request to continue.
          </p>
        </div>
      ) : (
        /* 2FA / OTP — code input */
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">
              Verification Code
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter code…"
              className="bg-[var(--color-input)] border-[var(--color-border)] h-11 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] text-center tracking-widest text-lg"
              onKeyDown={(e) => e.key === "Enter" && otpCode && handleVerify()}
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={solveCheckpoint.isPending || !otpCode}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 uppercase tracking-widest text-xs"
          >
            {solveCheckpoint.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Verify Code
          </Button>

          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resendCheckpoint.isPending}
            className="w-full text-[#555] hover:text-white text-[10px] uppercase tracking-widest font-bold h-9"
          >
            {resendCheckpoint.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-2" />
            )}
            Resend Code
          </Button>
        </div>
      )}

      {/* Cancel */}
      <Button
        variant="ghost"
        onClick={onCancel}
        className="w-full text-[#444] hover:text-white text-[10px] uppercase tracking-widest font-bold h-9"
      >
        Cancel
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConnectAccountModal
// ---------------------------------------------------------------------------

export function ConnectAccountModal({ onClose }) {
  const { workspaceId } = useWorkspaceStore()

  // Tab
  const [activeTab, setActiveTab] = useState("hosted")

  // Shared state machine
  const [connectState, setConnectState] = useState("idle") // idle | connecting | checkpoint | connected | error
  const [checkpointData, setCheckpointData] = useState(null) // { account_id, checkpoint_type }
  const [errorMsg, setErrorMsg] = useState(null)

  // Credentials form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Cookie form
  const [cookieValue, setCookieValue] = useState("")

  // Extension detection (Cookies tab)
  const [extAvailable, setExtAvailable] = useState(false)
  const [detectedProfile, setDetectedProfile] = useState(null)

  // Hooks
  const connectHostedAuth = useConnectHostedAuth()
  const connectCredentials = useConnectCredentials()
  const connectCookie = useConnectCookie()

  // Reset state when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setConnectState("idle")
    setCheckpointData(null)
    setErrorMsg(null)
  }

  // ---------------------------------------------------------------------------
  // Extension detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "PILOT_EXT_READY") {
        setExtAvailable(true)
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

  // ---------------------------------------------------------------------------
  // Hosted Auth
  // ---------------------------------------------------------------------------

  const handleHostedAuth = async () => {
    setConnectState("connecting")
    setErrorMsg(null)
    try {
      await connectHostedAuth.mutateAsync()
      setConnectState("connected")
      setTimeout(() => onClose(), 800)
    } catch (err) {
      setConnectState("error")
      setErrorMsg(err?.message ?? "Hosted auth failed. Please try again.")
    }
  }

  // ---------------------------------------------------------------------------
  // Credentials
  // ---------------------------------------------------------------------------

  const handleCredentialSubmit = async (e) => {
    e.preventDefault()
    setConnectState("connecting")
    setErrorMsg(null)
    try {
      const result = await connectCredentials.mutateAsync({ username: email, password })
      if (result?.checkpoint) {
        setCheckpointData({
          account_id: result.account_id,
          checkpoint_type: result.checkpoint_type,
        })
        setConnectState("checkpoint")
      } else {
        setConnectState("connected")
        setTimeout(() => onClose(), 800)
      }
    } catch (err) {
      setConnectState("error")
      setErrorMsg(err?.message ?? "Failed to connect. Please check your credentials.")
    }
  }

  // ---------------------------------------------------------------------------
  // Cookie — extension quick-connect
  // ---------------------------------------------------------------------------

  const handleSyncViaExtension = async () => {
    setConnectState("connecting")
    setErrorMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
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
        window.postMessage(
          { type: "SYNC_BROWSER_SESSION", workspaceId, accessToken: session?.access_token },
          "*"
        )
      })

      if (result.success) {
        setConnectState("connected")
        setTimeout(() => onClose(), 800)
      } else {
        throw new Error(result.error || "Extension sync failed")
      }
    } catch (err) {
      setConnectState("error")
      setErrorMsg(err?.message ?? "Extension sync failed.")
    }
  }

  // ---------------------------------------------------------------------------
  // Cookie — Unipile flow
  // ---------------------------------------------------------------------------

  const handleCookieSubmit = async (e) => {
    e.preventDefault()
    if (!cookieValue) return
    setConnectState("connecting")
    setErrorMsg(null)
    try {
      const result = await connectCookie.mutateAsync({ access_token: cookieValue })
      if (result?.checkpoint) {
        setCheckpointData({
          account_id: result.account_id,
          checkpoint_type: result.checkpoint_type,
        })
        setConnectState("checkpoint")
      } else {
        setConnectState("connected")
        setTimeout(() => onClose(), 800)
      }
    } catch (err) {
      setConnectState("error")
      setErrorMsg(err?.message ?? "Failed to connect. Please check your cookie value.")
    }
  }

  // ---------------------------------------------------------------------------
  // Checkpoint resolution callback
  // ---------------------------------------------------------------------------

  const handleCheckpointResult = ({ done, nextCheckpoint }) => {
    if (done) {
      setConnectState("connected")
      setTimeout(() => onClose(), 800)
    } else if (nextCheckpoint) {
      // Another checkpoint round
      setCheckpointData({
        account_id: nextCheckpoint.account_id,
        checkpoint_type: nextCheckpoint.checkpoint_type,
      })
    }
  }

  const handleCheckpointCancel = () => {
    setConnectState("idle")
    setCheckpointData(null)
    setErrorMsg(null)
  }

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------

  const isConnecting = connectState === "connecting"
  const isConnected = connectState === "connected"
  const isCheckpoint = connectState === "checkpoint"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DialogContent className="sm:max-w-[480px] bg-[#1e1e1e] border-white/5 p-0 overflow-hidden">
      <div className="p-8 pb-4">
        <DialogHeader className="space-y-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Connect LinkedIn Account
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--color-text-secondary)]">
            Select your preferred method to safely link your LinkedIn profile.
          </DialogDescription>
        </DialogHeader>

        {/* ------------------------------------------------------------------ */}
        {/* Checkpoint overlay — replaces tab content                           */}
        {/* ------------------------------------------------------------------ */}
        {isCheckpoint ? (
          <CheckpointOverlay
            checkpointData={checkpointData}
            onSuccess={handleCheckpointResult}
            onCancel={handleCheckpointCancel}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-3 bg-[var(--color-input)] border border-[var(--color-border)] p-1 rounded-xl mb-8 h-12">
              <TabsTrigger
                value="hosted"
                className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[var(--color-surface-raised)] data-[state=active]:text-white"
              >
                Hosted Auth
              </TabsTrigger>
              <TabsTrigger
                value="credentials"
                className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[var(--color-surface-raised)] data-[state=active]:text-white"
              >
                Credentials
              </TabsTrigger>
              <TabsTrigger
                value="cookies"
                className="rounded-lg text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[var(--color-surface-raised)] data-[state=active]:text-white"
              >
                Cookies
              </TabsTrigger>
            </TabsList>

            {/* Shared error box */}
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-400/5 border border-red-500/10 rounded-xl flex gap-3 items-center">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-[11px] text-red-400 font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* Success banner */}
            {isConnected && (
              <div className="mb-6 p-4 bg-green-500/5 border border-green-500/10 rounded-xl flex gap-3 items-center">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-[11px] text-green-400 font-medium">
                  Account connected successfully!
                </p>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Hosted Auth tab                                                   */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent
              value="hosted"
              className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="p-4 bg-blue-400/5 border border-blue-500/10 rounded-xl space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                  Secure OAuth Flow
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  You'll be redirected to LinkedIn's official login page. No credentials are
                  stored in LinkedPilot.
                </p>
              </div>

              {isConnecting ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-sm text-[var(--color-text-secondary)] text-center font-medium">
                    Complete the login in the new tab
                  </p>
                  <p className="text-[11px] text-[#666] text-center leading-relaxed">
                    After connecting on LinkedIn, come back to this tab — it will update automatically.
                  </p>
                  <p className="text-[10px] text-[#444] uppercase tracking-widest">
                    Times out after 120 seconds
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleHostedAuth}
                  disabled={isConnecting || isConnected}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 uppercase tracking-widest text-xs"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Connect with LinkedIn
                </Button>
              )}

              {/* Retry button shown after error */}
              {connectState === "error" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConnectState("idle")
                    setErrorMsg(null)
                  }}
                  className="w-full text-[#555] hover:text-white text-[10px] uppercase tracking-widest font-bold h-9"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Try Again
                </Button>
              )}
            </TabsContent>

            {/* ---------------------------------------------------------------- */}
            {/* Credentials tab                                                   */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent
              value="credentials"
              className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">
                    LinkedIn Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="bg-[var(--color-input)] border-[var(--color-border)] h-11 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                    disabled={isConnecting}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-bold ml-1">
                    Password
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-[var(--color-input)] border-[var(--color-border)] h-11 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
                    disabled={isConnecting}
                    onKeyDown={(e) =>
                      e.key === "Enter" && email && password && handleCredentialSubmit(e)
                    }
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-400/5 border border-blue-500/10 rounded-xl">
                <p className="text-[10px] text-blue-300 leading-relaxed font-medium">
                  <span className="font-bold flex items-center gap-1.5 mb-1.5 uppercase tracking-tighter text-blue-400">
                    <CheckCircle2 className="w-3 h-3" /> Secure Login
                  </span>
                  Your credentials are encrypted using AES-256 and never stored in plain text. We
                  use high-quality residential proxies to match your local IP.
                </p>
              </div>

              <Button
                onClick={handleCredentialSubmit}
                disabled={isConnecting || !email || !password}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 uppercase tracking-widest text-xs"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                {isConnecting ? "Connecting…" : "Initialize Connection"}
              </Button>
            </TabsContent>

            {/* ---------------------------------------------------------------- */}
            {/* Cookies tab                                                       */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent
              value="cookies"
              className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {/* Extension quick-connect when profile detected */}
              {extAvailable && detectedProfile ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl gap-4">
                    <div className="relative">
                      <img
                        src={
                          detectedProfile.avatar_url ||
                          "https://static.licdn.com/aero-v1/networks/ghost-agent-60x60.png"
                        }
                        className="w-20 h-20 rounded-full border-2 border-blue-500 shadow-2xl"
                        alt="Avatar"
                      />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-[var(--color-surface-base)] flex items-center justify-center">
                        <div className="w-2 h-2 bg-[var(--color-surface-muted)] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-blue-400 tracking-widest mb-1">
                        Detected LinkedIn Profile
                      </p>
                      <p className="text-xl font-bold text-white tracking-tight">
                        {detectedProfile.full_name}
                      </p>
                    </div>

                    <Button
                      onClick={handleSyncViaExtension}
                      disabled={isConnecting}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 group"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <span className="mr-2 text-xl group-hover:scale-125 transition-transform">
                          ⚡
                        </span>
                      )}
                      {isConnecting
                        ? "Syncing…"
                        : `Sync ${detectedProfile.full_name.split(" ")[0]}'s Account`}
                    </Button>
                  </div>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-[#1e1e1e] px-4 text-[#444] font-bold tracking-widest">
                        Or Manual Setup
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                    Quick Connect Guide
                  </p>
                  <ol className="text-[11px] text-[#666] space-y-2 ml-4 list-decimal leading-relaxed">
                    <li>
                      Log in to <span className="text-[#999]">linkedin.com</span>.
                    </li>
                    <li>
                      Copy your <span className="text-[#999]">li_at</span> cookie value from
                      DevTools.
                    </li>
                    <li>Paste it below and click connect.</li>
                  </ol>
                  {!extAvailable && (
                    <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex gap-2 items-start">
                      <AlertCircle className="w-3 h-4 text-amber-500 shrink-0" />
                      <p className="text-[10px] text-amber-500/80 font-medium leading-relaxed">
                        Install the <span className="font-bold">Pilot Extension</span> to enable
                        one-click sync with profile photo.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Manual cookie input — always shown as fallback */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold ml-1">
                    Paste Cookie Value
                  </Label>
                  <Input
                    value={cookieValue}
                    onChange={(e) => setCookieValue(e.target.value)}
                    placeholder="li_at value or entire cookie string…"
                    className="bg-white/5 border-white/10 h-11 text-white placeholder:text-[#333]"
                    disabled={isConnecting}
                  />
                  <p className="text-[9px] text-[#555] mt-1 px-1 italic">
                    Tip: Provide the entire string (including JSESSIONID) for better profile sync.
                  </p>
                </div>

                <Button
                  onClick={handleCookieSubmit}
                  disabled={isConnecting || !cookieValue}
                  className="w-full bg-[var(--color-input)] hover:bg-[var(--color-surface-raised)]/20 border border-[var(--color-border)] text-[var(--color-text-primary)] font-bold h-12 uppercase tracking-widest text-[10px]"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {isConnecting ? "Connecting…" : "Connect Profile Instantly"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <div className="p-4 bg-black/20 border-t border-white/5 flex justify-center">
        <p className="text-[9px] text-[#333] font-bold uppercase tracking-widest">
          LinkedPilot Infrastructure v2.1 • AES Optimized
        </p>
      </div>
    </DialogContent>
  )
}
