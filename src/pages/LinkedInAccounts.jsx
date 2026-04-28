import React, { useState, useEffect } from "react"
import { useWorkspaceStore } from "@/store/workspaceStore"
import { useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useUnipileAccounts,
  useReconnectAccount,
  useDeleteUnipileAccount,
  useSyncProfile,
} from "@/hooks/useUnipileAccounts"
import { useDeleteAccount } from "@/hooks/useLinkedInAccounts"
import { useToggleAccount } from "@/hooks/useLinkedInAccounts"
import { ConnectAccountModal } from "@/components/accounts/ConnectAccountModal"
import { AccountSettingsModal } from "@/components/accounts/AccountSettingsModal"
import { Dialog } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, RefreshCw, Trash2, Globe, RotateCcw, UserCheck, Settings } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "react-hot-toast"

export default function LinkedInAccounts() {
  const { workspaceId } = useWorkspaceStore()
  const { data: accounts = [], isLoading } = useUnipileAccounts(workspaceId)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const queryClient = useQueryClient()

  // Handle redirect back from Unipile hosted auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('unipile_connected') === '1') {
      toast.success('LinkedIn account connected successfully!')
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('unipile_error') === '1') {
      toast.error('LinkedIn connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [workspaceId, queryClient])

  const filtered = accounts

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your LinkedIn account connections</p>
        </div>

        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-foreground font-medium h-10 px-4 rounded-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add LinkedIn Account
        </Button>
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-0">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Account</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Unipile Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Type</TableHead>
                <TableHead className="text-muted-foreground font-medium">Connection Type</TableHead>
                <TableHead className="text-muted-foreground font-medium">Daily Connections</TableHead>
                <TableHead className="text-muted-foreground font-medium">Weekly Connections</TableHead>
                <TableHead className="text-muted-foreground font-medium">Daily Messages</TableHead>
                <TableHead className="text-muted-foreground font-medium">Last Sync</TableHead>
                <TableHead className="text-muted-foreground font-medium w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(account => (
                <AccountTableRow 
                  key={account.id} 
                  account={account} 
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground font-medium">No connected accounts found</p>
              <p className="text-sm text-muted-foreground">Connect your first LinkedIn profile to start your outreach.</p>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)}
              variant="outline" 
              className="border-border text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        )}
      </div>

      {/* Connection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ConnectAccountModal onClose={() => setIsModalOpen(false)} />
      </Dialog>
    </div>
  )
}

function AccountTableRow({ account }) {
  const [showSettings, setShowSettings] = useState(false)
  const toggleMutation = useToggleAccount()
  const deleteUnipileMutation = useDeleteUnipileAccount()
  const deleteLocalMutation = useDeleteAccount()
  const reconnectMutation = useReconnectAccount()
  const syncProfileMutation = useSyncProfile()

  const connLimit = account.daily_connection_limit || 15
  const weeklyConnLimit = account.weekly_connection_limit || 105
  const msgLimit = account.daily_message_limit || 30
  const requestsProgress = Math.round((account.today_connections / connLimit) * 100)
  const weeklyRequestsProgress = Math.round((account.this_week_connections / weeklyConnLimit) * 100)
  const messagesProgress = Math.round((account.today_messages / msgLimit) * 100)

  const getStatusBadge = () => {
    if (account.status === 'active') {
      return <Badge className="bg-success hover:bg-green-600 text-foreground border-0 text-xs">Active</Badge>
    }
    return <Badge variant="secondary" className="text-xs">Paused</Badge>
  }

  const getUnipileStatusBadge = () => {
    switch (account.unipile_status) {
      case 'CONNECTED':
        return (
          <Badge className="bg-success hover:bg-success/90 text-foreground border-0 text-xs">
            Connected
          </Badge>
        )
      case 'RECONNECT_REQUIRED':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500/90 text-foreground border-0 text-xs">
            Reconnect Required
          </Badge>
        )
      case 'ERROR':
        return (
          <Badge className="bg-destructive hover:bg-destructive/90 text-foreground border-0 text-xs">
            Error
          </Badge>
        )
      case 'CONNECTING':
        return (
          <Badge className="bg-info hover:bg-info/90 text-foreground border-0 text-xs">
            Connecting
          </Badge>
        )
      case 'UNKNOWN':
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            Unknown
          </Badge>
        )
    }
  }

  const getTypeBadge = () => {
    const accountType = account.account_type || 'free'
    
    switch (accountType) {
      case 'sales_navigator':
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">Sales Nav</Badge>
      case 'recruiter':
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs">Recruiter</Badge>
      case 'premium':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs">Premium</Badge>
      case 'free':
      default:
        return <Badge variant="outline" className="text-xs text-muted-foreground border-border">Free</Badge>
    }
  }

  const getConnectionTypeBadge = () => {
    const method = account.login_method || 'cookies'
    if (method === 'cookies') {
      return <Badge className="bg-info hover:bg-info/90 text-foreground border-0 text-xs">Cookies</Badge>
    }
    if (method === 'credentials') {
      return <Badge className="bg-primary hover:bg-primary/90 text-foreground border-0 text-xs">Credentials</Badge>
    }
    return <Badge variant="outline" className="text-xs capitalize">{method}</Badge>
  }

  const lastSyncText = account.last_synced_at 
    ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
    : 'Never'

  const handleDelete = () => {
    if (!confirm('Are you sure you want to remove this account?')) return

    if (account.unipile_account_id) {
      // Delete via Unipile first, then Supabase row on success
      deleteUnipileMutation.mutate({
        unipile_account_id: account.unipile_account_id,
        supabase_row_id: account.id,
      })
    } else {
      // Fallback: Supabase-only delete for legacy accounts without a Unipile ID
      deleteLocalMutation.mutate(account.id)
    }
  }

  const handleReconnect = () => {
    reconnectMutation.mutate({ unipile_account_id: account.unipile_account_id })
  }

  return (
    <TableRow className="border-border">
      {/* Account */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={account.avatar_url} alt={account.full_name} />
              <AvatarFallback className="bg-secondary text-foreground text-sm">
                {account.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {account.status === 'active' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{account.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">@{account.linkedin_handle || account.full_name?.toLowerCase().replace(/\s+/g, '_')}</p>
          </div>
        </div>
      </TableCell>

      {/* Local Status */}
      <TableCell>{getStatusBadge()}</TableCell>

      {/* Unipile Status */}
      <TableCell>{getUnipileStatusBadge()}</TableCell>

      {/* Type */}
      <TableCell>{getTypeBadge()}</TableCell>

      {/* Connection Type */}
      <TableCell>{getConnectionTypeBadge()}</TableCell>

      {/* Daily Connections Usage */}
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground whitespace-nowrap">
            {account.today_connections || 0}/{connLimit}
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-success rounded-full"
              style={{ width: `${Math.min(requestsProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">{requestsProgress}%</span>
        </div>
      </TableCell>

      {/* Weekly Connections Usage */}
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground whitespace-nowrap">
            {account.this_week_connections || 0}/{weeklyConnLimit}
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-info rounded-full"
              style={{ width: `${Math.min(weeklyRequestsProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">{weeklyRequestsProgress}%</span>
        </div>
      </TableCell>

      {/* Daily Messages Usage */}
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground whitespace-nowrap">
            {account.today_messages || 0}/{msgLimit}
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-success rounded-full"
              style={{ width: `${Math.min(messagesProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">{messagesProgress}%</span>
        </div>
      </TableCell>

      {/* Last Sync */}
      <TableCell>
        <span className="text-sm text-muted-foreground">{lastSyncText}</span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-secondary border-border">
            <DropdownMenuItem 
              onClick={() => toggleMutation.mutate({ id: account.id, status: account.status })}
              className="text-sm text-foreground focus:bg-secondary cursor-pointer"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {account.status === 'active' ? 'Pause' : 'Activate'}
            </DropdownMenuItem>
            {account.unipile_account_id && (
              <>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={handleReconnect}
                  disabled={reconnectMutation.isPending}
                  className="text-sm text-foreground focus:bg-secondary cursor-pointer"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => syncProfileMutation.mutate({
                    unipile_account_id: account.unipile_account_id,
                    supabase_row_id: account.id,
                  })}
                  disabled={syncProfileMutation.isPending}
                  className="text-sm text-foreground focus:bg-secondary cursor-pointer"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  {syncProfileMutation.isPending ? 'Syncing…' : 'Sync Profile'}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => setShowSettings(true)}
              className="text-sm text-foreground focus:bg-secondary cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={handleDelete}
              disabled={deleteUnipileMutation.isPending || deleteLocalMutation.isPending}
              className="text-sm text-destructive focus:bg-secondary cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Modal */}
        <AccountSettingsModal 
          account={account}
          open={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </TableCell>
    </TableRow>
  )
}
