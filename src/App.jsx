import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AppShell } from '@/components/layout/AppShell'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { supabase } from '@/lib/supabase'

import Dashboard from '@/pages/Dashboard'
import Campaigns from '@/pages/Campaigns'
import CampaignBuilder from '@/pages/CampaignBuilder'
import CampaignDetail from '@/pages/CampaignDetail'
import LeadExtractor from '@/pages/LeadExtractor'
import LeadDatabase from '@/pages/LeadDatabase'
import Inbox from '@/pages/Inbox'
import ContentAssistant from '@/pages/ContentAssistant'
import InboundAutomations from '@/pages/InboundAutomations'
import LinkedInAccounts from '@/pages/LinkedInAccounts'
import Settings from '@/pages/Settings'
import Auth from '@/pages/Auth'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  
  return children
}

export default function App() {
  const setSession = useAuthStore((s) => s.setSession)
  const setLoading = useAuthStore((s) => s.setLoading)
  const user = useAuthStore((s) => s.user)
  const { workspaceId, setWorkspace, setWorkspaces } = useWorkspaceStore()

  // Auth initialization
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  // Workspace initialization - load workspace if not set
  useEffect(() => {
    if (!user || workspaceId) return

    console.log('[App] No workspace selected, fetching user workspaces...')

    const loadWorkspace = async () => {
      try {
        const { data: teamData, error } = await supabase
          .from('team_members')
          .select('workspace_id, workspaces(id, name)')
          .eq('user_id', user.id)

        if (error) {
          console.error('[App] Error fetching workspaces:', error)
          return
        }

        if (teamData && teamData.length > 0) {
          console.log('[App] Found', teamData.length, 'workspaces')
          const workspaces = teamData.map(t => ({ id: t.workspace_id, name: t.workspaces.name }))
          setWorkspaces(workspaces)

          // Set first workspace as active
          const first = teamData[0]
          setWorkspace(first.workspace_id, first.workspaces.name)
          console.log('[App] Set workspace:', first.workspaces.name)
        } else {
          console.warn('[App] No workspaces found for user')
        }
      } catch (err) {
        console.error('[App] Failed to load workspace:', err)
      }
    }

    loadWorkspace()
  }, [user, workspaceId, setWorkspace, setWorkspaces])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
          <div className="min-h-screen bg-background">
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="linkedin-accounts" element={<LinkedInAccounts />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/new" element={<CampaignBuilder />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="campaigns/:id/edit" element={<CampaignBuilder />} />
              <Route path="prospect-extractor" element={<LeadExtractor />} />
              <Route path="leads" element={<LeadDatabase />} />
              <Route path="content" element={<ContentAssistant />} />
              <Route path="inbound" element={<InboundAutomations />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
