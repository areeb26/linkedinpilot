import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { Shield, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

// Google icon SVG component
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const { signIn, signUp, signInWithGoogle } = useAuthStore()
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const navigate = useNavigate()

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        await signIn(email, password)
        
        // Fetch workspace after login
        const { data: teamData } = await supabase
          .from('team_members')
          .select('workspace_id, workspaces(name)')
          .limit(1)
          .single()
        
        if (teamData) {
          setWorkspace(teamData.workspace_id, teamData.workspaces.name)
        }
      } else {
        const { data } = await signUp(email, password)
        if (data.user) {
          // Automatic onboarding for new user
          const workspaceId = crypto.randomUUID()
          
          // 1. Create Workspace
          await supabase.from('workspaces').insert({
            id: workspaceId,
            name: `${email.split('@')[0]}'s Workspace`,
            slug: `${email.split('@')[0]}-workspace-${Math.floor(Math.random() * 1000)}`,
            owner_id: data.user.id
          })

          // 2. Add as Owner
          await supabase.from('team_members').insert({
            workspace_id: workspaceId,
            user_id: data.user.id,
            role: 'owner',
            accepted_at: new Date().toISOString(),
          })

          setWorkspace(workspaceId, `${email.split('@')[0]}'s Workspace`)
        }
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
      // Redirect is handled by Supabase OAuth flow
    } catch (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 antialiased">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse-subtle" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] animate-pulse-subtle" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md space-y-8 relative animate-scale-in">
        {/* Logo/Brand */}
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card border border-border shadow-2xl mb-6 glow-primary">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {isLogin ? 'Welcome Back' : 'Join LinkedPilot'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isLogin
              ? 'Enter your credentials to access your dashboard'
              : 'Start your LinkedIn automation journey today'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center animate-slide-up">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl bg-background border border-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-medium text-foreground">Password</label>
                {isLogin && (
                  <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-background border border-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group hover-lift"
            >
              <div className="flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="mt-4 w-full flex items-center justify-center gap-3 rounded-xl border border-input bg-background px-6 py-3 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="mt-6 text-center pt-6 border-t border-border">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin
                ? "Don't have an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
