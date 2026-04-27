import React from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToggleAccount, useDeleteAccount } from "@/hooks/useLinkedInAccounts"
import { Settings, Flame, Trash2, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

export function AccountCard({ account }) {
  const [loading, setLoading] = React.useState(false)
  const toggleMutation = useToggleAccount()
  const deleteMutation = useDeleteAccount()

  const healthColors = {
    healthy: "text-green-400 bg-green-400/10 border-green-500/20",
    restricted: "text-yellow-400 bg-yellow-400/10 border-yellow-500/20",
    blocked: "text-red-400 bg-red-400/10 border-red-500/20"
  }

  const sendProgress = (account.today_connections / 5) * 100
  const messageProgress = (account.today_messages / 5) * 100

  return (
    <Card className="bg-[#1e1e1e] border-white/5 overflow-hidden group">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div className="relative">
              <img 
                src={account.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.full_name)}&background=random`} 
                alt={account.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-white/10"
              />
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-surface-base)] ${account.status === 'active' ? 'bg-green-500' : 'bg-[var(--color-text-secondary)]'}`} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white tracking-tight flex items-center gap-2">
                {account.full_name}
                {account.warmup_enabled && <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 uppercase tracking-tighter font-bold ${healthColors[account.health_status] || healthColors.healthy}`}>
                  {account.health_status || 'Healthy'}
                </Badge>
                <span className="text-[10px] text-[#444] font-medium uppercase tracking-widest">{account.login_method}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Switch 
              checked={account.status === 'active'} 
              onCheckedChange={() => toggleMutation.mutate({ id: account.id, status: account.status })}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>

        {/* Daily Progress */}
        <div className="grid grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.1em]">Connections</p>
              <p className="text-[10px] font-bold text-white tracking-tighter">
                {account.today_connections}<span className="text-[#444]">/5</span>
              </p>
            </div>
            <Progress value={sendProgress} className="h-1 bg-[var(--color-input)]" indicatorClassName="bg-blue-500" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-[9px] font-bold text-[#444] uppercase tracking-[0.1em]">Messages</p>
              <p className="text-[10px] font-bold text-white tracking-tighter">
                {account.today_messages}<span className="text-[#444]">/5</span>
              </p>
            </div>
            <Progress value={messageProgress} className="h-1 bg-[var(--color-input)]" indicatorClassName="bg-purple-500" />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2 opacity-60 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            onClick={async () => {
              setLoading(true)
              try {
                const { data: _data, error: functionError } = await supabase.functions.invoke('connect-cookie', {
                  body: { 
                    cookie: account.cookie_encrypted, 
                    workspace_id: account.workspace_id 
                  }
                })
                
                if (functionError) throw functionError
                
                alert("Profile synced successfully!")
                // Refreshing usually happens via React Query, but we can also trigger it here
              } catch (err) {
                console.error("Manual sync error:", err)
                alert(`Sync failed: ${err.message}`)
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            className="flex-1 h-9 text-[10px] font-bold uppercase tracking-widest text-blue-400/50 hover:text-blue-400 hover:bg-[var(--color-input)]"
          >
            <RefreshCw className={loading ? "w-3.5 h-3.5 mr-2 animate-spin" : "w-3.5 h-3.5 mr-2"} />
            Sync
          </Button>
          <div className="w-px h-4 bg-[var(--color-border)] self-center" />
          <Button 
            variant="ghost" 
            onClick={() => {
              if (confirm('Are you sure you want to remove this account?')) {
                deleteMutation.mutate(account.id)
              }
            }}
            className="flex-1 h-9 text-[10px] font-bold uppercase tracking-widest text-red-400/50 hover:text-red-400 hover:bg-[var(--color-input)]"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Remove
          </Button>
        </div>
      </div>
    </Card>
  )
}
