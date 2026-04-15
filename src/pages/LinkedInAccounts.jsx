import React, { useState } from "react"
import { useLinkedInAccounts, useToggleAccount, useDeleteAccount } from "@/hooks/useLinkedInAccounts"
import { ConnectAccountModal } from "@/components/accounts/ConnectAccountModal"
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
import { Plus, MoreVertical, RefreshCw, Settings, Trash2, Globe } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function LinkedInAccounts() {
  const { data: accounts = [], isLoading } = useLinkedInAccounts()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filtered = accounts

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Connected Accounts</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Manage your LinkedIn account connections</p>
        </div>

        <Button 
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white font-medium h-10 px-4 rounded-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add LinkedIn Account
        </Button>
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl bg-[#1e1e1e] border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[#94a3b8] font-medium">Account</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Status</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Type</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Connection Type</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Daily Requests Usage</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Daily Messages Usage</TableHead>
                <TableHead className="text-[#94a3b8] font-medium">Last Sync</TableHead>
                <TableHead className="text-[#94a3b8] font-medium w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(account => (
                <AccountTableRow key={account.id} account={account} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center">
              <Globe className="w-8 h-8 text-[#444]" />
            </div>
            <div className="space-y-1">
              <p className="text-white font-medium">No connected accounts found</p>
              <p className="text-sm text-[#666]">Connect your first LinkedIn profile to start your outreach.</p>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)}
              variant="outline" 
              className="border-white/10 text-sm"
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
  const toggleMutation = useToggleAccount()
  const deleteMutation = useDeleteAccount()

  const requestsProgress = Math.round((account.today_connections / (account.daily_connection_limit || 1)) * 100)
  const messagesProgress = Math.round((account.today_messages / (account.daily_message_limit || 1)) * 100)

  const getStatusBadge = () => {
    if (account.status === 'active') {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs">Active</Badge>
    }
    return <Badge variant="secondary" className="text-xs">Paused</Badge>
  }

  const getConnectionTypeBadge = () => {
    const method = account.login_method || 'cookies'
    if (method === 'cookies') {
      return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 text-xs">Cookies</Badge>
    }
    if (method === 'credentials') {
      return <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0 text-xs">Credentials</Badge>
    }
    return <Badge variant="outline" className="text-xs capitalize">{method}</Badge>
  }

  const lastSyncText = account.last_synced_at 
    ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
    : 'Never'

  return (
    <TableRow className="border-white/5">
      {/* Account */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border border-white/10">
              <AvatarImage src={account.avatar_url} alt={account.full_name} />
              <AvatarFallback className="bg-[#2a2a2a] text-white text-sm">
                {account.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {account.status === 'active' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1e1e1e]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white text-sm truncate">{account.full_name}</p>
            <p className="text-xs text-[#666] truncate">@{account.linkedin_handle || account.full_name?.toLowerCase().replace(/\s+/g, '_')}</p>
          </div>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>{getStatusBadge()}</TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant="outline" className="text-xs text-[#94a3b8] border-white/10">
          Free
        </Badge>
      </TableCell>

      {/* Connection Type */}
      <TableCell>{getConnectionTypeBadge()}</TableCell>

      {/* Daily Requests Usage */}
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white whitespace-nowrap">
            {account.today_connections || 0}/{account.daily_connection_limit || 5}
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.min(requestsProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-[#94a3b8] w-8">{requestsProgress}%</span>
        </div>
      </TableCell>

      {/* Daily Messages Usage */}
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white whitespace-nowrap">
            {account.today_messages || 0}/{account.daily_message_limit || 5}
          </span>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.min(messagesProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-[#94a3b8] w-8">{messagesProgress}%</span>
        </div>
      </TableCell>

      {/* Last Sync */}
      <TableCell>
        <span className="text-sm text-[#94a3b8]">{lastSyncText}</span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94a3b8] hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-[#2a2a2a] border-white/10">
            <DropdownMenuItem 
              onClick={() => toggleMutation.mutate({ id: account.id, status: account.status })}
              className="text-sm text-white focus:bg-white/10 cursor-pointer"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {account.status === 'active' ? 'Pause' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm text-white focus:bg-white/10 cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              onClick={() => {
                if (confirm('Are you sure you want to remove this account?')) {
                  deleteMutation.mutate(account.id)
                }
              }}
              className="text-sm text-red-400 focus:bg-white/10 cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
