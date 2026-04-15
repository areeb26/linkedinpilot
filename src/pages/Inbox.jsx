import React, { useState, useEffect, useRef } from "react"
import { useConversations, useThread, useMarkRead, useSendMessage, useRealtime, useSetLabel } from "@/hooks/useMessages"
import { useSuggestReply } from "@/hooks/useAi"
import { useCreateCampaign } from "@/hooks/useCampaigns" // Reusing for context if needed
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Search, Send, Sparkles, User, ExternalLink, MoreVertical, CheckCircle2, XCircle, Plus, MessageSquare, AlertCircle } from "lucide-react"
import { formatDistanceToNow, isValid } from "date-fns"
import { toast } from "react-hot-toast"
import { supabase } from "@/lib/supabase"

const safeFormatDistance = (date) => {
  try {
    const d = new Date(date)
    if (!isValid(d)) return 'Just now'
    return formatDistanceToNow(d, { addSuffix: false })
  } catch (e) {
    return 'Recently'
  }
}

export default function Inbox() {
  const { data: conversations = [], isLoading: loadingConvs, error: convsError } = useConversations()
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [search, setSearch] = useState("")
  const [messageBody, setMessageBody] = useState("")

  const { data: messages = [], isLoading: loadingThread, error: threadError } = useThread(activeThreadId)
  const markReadMutation = useMarkRead()
  const sendMessageMutation = useSendMessage()
  const suggestReplyMutation = useSuggestReply()
  const setLabelMutation = useSetLabel()

  const scrollRef = useRef(null)

  // Start Realtime
  useRealtime()

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle Thread Change
  const handleSelectThread = (threadId) => {
    setActiveThreadId(threadId)
    markReadMutation.mutate(threadId)
  }

  const handleSend = async (body = messageBody) => {
    if (!body.trim() || !activeThreadId) return
    
    const activeConv = conversations.find(c => c.thread_id === activeThreadId)
    await sendMessageMutation.mutateAsync({
      thread_id: activeThreadId,
      body,
      lead_id: activeConv?.lead?.id,
      linkedin_account_id: activeConv?.lastMessage?.linkedin_account_id
    })
    setMessageBody("")
  }

  const handleAiSuggest = async () => {
    if (!activeThreadId) return
    const contextMessages = messages.slice(-5).map(m => ({ role: m.direction, content: m.body }))
    toast.promise(suggestReplyMutation.mutateAsync({ messages: contextMessages, threadId: activeThreadId }), {
      loading: 'Analysis for reply...',
      success: 'Suggestions ready',
      error: 'AI failed to respond'
    })
  }

  const activeConv = conversations.find(c => c.thread_id === activeThreadId)
  const filteredConvs = conversations.filter(c => 
    c.lead?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.body?.toLowerCase().includes(search.toLowerCase())
  )

  if (supabase.supabaseUrl.includes('placeholder')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <AlertCircle className="w-8 h-8 text-yellow-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">Supabase Not Connected</h3>
          <p className="text-[#94a3b8] text-sm">To use the Unibox, you need to configure your Supabase credentials in the <code>.env</code> file.</p>
        </div>
        <div className="p-4 bg-white/5 rounded-xl border border-white/5 w-full text-left font-mono text-xs text-[#666]">
          VITE_SUPABASE_URL=your_project_url<br/>
          VITE_SUPABASE_ANON_KEY=your_anon_key
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4 overflow-hidden">
      {/* Left Column: Conversations */}
      <Card className="w-80 flex flex-col bg-[#1e1e1e] border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Unibox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
            <Input 
              placeholder="Search chats..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/5 text-sm h-9" 
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingConvs ? (
            <div className="p-8 text-center text-[#444] text-xs font-bold uppercase tracking-widest animate-pulse">Scanning threads...</div>
          ) : convsError ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs text-red-400 font-bold uppercase">Failed to load</p>
                <p className="text-[10px] text-[#666]">{convsError.message || 'Check console'}</p>
              </div>
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-[#444] mx-auto" />
              <div className="space-y-1">
                <p className="text-xs text-[#666] font-bold uppercase">No conversations</p>
                <p className="text-[10px] text-[#555]">Start a campaign to generate messages</p>
              </div>
            </div>
          ) : filteredConvs.map(conv => (
            <button
              key={conv.thread_id}
              onClick={() => handleSelectThread(conv.thread_id)}
              className={`w-full p-4 flex gap-3 text-left transition-all hover:bg-white/5 border-b border-white/5 ${
                activeThreadId === conv.thread_id ? 'bg-white/5 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <Avatar className="h-10 w-10 border border-white/10 shrink-0">
                <AvatarImage src={conv.lead?.avatar_url} />
                <AvatarFallback className="bg-blue-500/10 text-blue-400">
                  {conv.lead?.full_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="text-sm font-bold text-white truncate">{conv.lead?.full_name || 'Prospect'}</span>
                  <span className="text-[10px] text-[#444] font-medium">
                    {safeFormatDistance(conv.lastMessage?.sent_at)}
                  </span>
                </div>
                <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-white font-bold' : 'text-[#94a3b8]'}`}>
                  {conv.lastMessage?.body}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {conv.lastMessage?.sentiment && (
                    <Badge variant="outline" className="text-[8px] uppercase tracking-tighter px-1.5 py-0 border-white/10 text-[#666]">
                      {conv.lastMessage?.sentiment}
                    </Badge>
                  )}
                  {conv.unreadCount > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Middle Column: Chat */}
      <Card className="flex-1 flex flex-col bg-[#1e1e1e] border-white/5 overflow-hidden">
        {activeThreadId ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-white/10">
                  <AvatarImage src={activeConv?.lead?.avatar_url} />
                  <AvatarFallback>{activeConv?.lead?.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">{activeConv?.lead?.full_name}</h3>
                  <span className="text-[10px] text-green-400 uppercase tracking-widest font-bold">Active Connection</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#444] hover:text-white">
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#444] hover:text-white">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Message Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-black/20 to-transparent flex flex-col"
            >
              {loadingThread ? (
                <div className="h-full flex items-center justify-center text-[#444] text-[10px] uppercase font-bold tracking-widest">Hydrating conversation...</div>
              ) : threadError ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">Failed to load messages</h3>
                    <p className="text-[#94a3b8] text-sm max-w-xs">{threadError.message || 'An error occurred while fetching messages.'}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <MessageSquare className="w-8 h-8 text-[#444]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">No messages yet</h3>
                    <p className="text-[#94a3b8] text-sm">Start the conversation by sending a message below.</p>
                  </div>
                </div>
              ) : messages.map((msg, i) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] group relative`}>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.direction === 'outbound' 
                        ? 'bg-purple-600 text-white rounded-br-none' 
                        : 'bg-white/5 text-white border border-white/5 rounded-bl-none'
                    }`}>
                      {msg.body}
                    </div>
                    <div className={`mt-1 text-[9px] text-[#444] font-bold uppercase tracking-tighter ${
                      msg.direction === 'outbound' ? 'text-right' : 'text-left'
                    }`}>
                      {safeFormatDistance(msg.sent_at)} ago
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Suggestions */}
            {suggestReplyMutation.data && suggestReplyMutation.data.length > 0 && (
              <div className="px-6 py-2 flex gap-2 overflow-x-auto no-scrollbar">
                {suggestReplyMutation.data.map((pill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(pill)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-4 bg-black/20 border-t border-white/5">
              <div className="flex items-center gap-3 relative">
                <Button 
                  onClick={handleAiSuggest}
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 text-blue-400 hover:bg-blue-400/10"
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <Input 
                  placeholder="Drive the conversation forward..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="bg-white/5 border-white/10 text-sm h-11 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button 
                  onClick={() => handleSend()}
                  size="sm" 
                  className="h-9 w-9 p-0 bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <MessageSquare className="w-8 h-8 text-[#444]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Select a Conversation</h3>
              <p className="text-[#94a3b8] text-sm">Select a prospect from the left to start chatting.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Right Column: Context */}
      <Card className="w-80 bg-[#1e1e1e] border-white/5 flex flex-col overflow-hidden">
        {activeConv ? (
          <div className="flex-1 overflow-y-auto">
            {/* Lead Card */}
            <div className="p-6 text-center space-y-4 border-b border-white/5">
              <Avatar className="h-20 w-20 mx-auto border-2 border-white/10">
                <AvatarImage src={activeConv.lead?.avatar_url} />
                <AvatarFallback className="text-2xl">{activeConv.lead?.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{activeConv.lead?.full_name}</h2>
                <p className="text-xs text-[#94a3b8] leading-relaxed">{activeConv.lead?.headline}</p>
              </div>
              <div className="flex justify-center gap-2">
                 <Button variant="outline" size="sm" className="h-8 border-white/5 bg-white/5 text-xs text-white" asChild>
                    <a href={activeConv.lead?.profile_url} target="_blank" rel="noreferrer">
                      LinkedIn <ExternalLink className="w-3 h-3 ml-2" />
                    </a>
                 </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Sentiment Label</p>
                <div className="grid grid-cols-2 gap-2">
                  <SentimentButton 
                    active={activeConv.lastMessage?.sentiment === 'interested'} 
                    onClick={() => setLabelMutation.mutate({ messageId: activeConv.lastMessage.id, sentiment: 'interested' })}
                    icon={CheckCircle2} 
                    label="Interested" 
                    color="green" 
                  />
                  <SentimentButton 
                    active={activeConv.lastMessage?.sentiment === 'not_interested'} 
                    onClick={() => setLabelMutation.mutate({ messageId: activeConv.lastMessage.id, sentiment: 'not_interested' })}
                    icon={XCircle} 
                    label="Not Interested" 
                    color="red" 
                  />
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">CRM Actions</p>
                <Button className="w-full justify-start gap-3 bg-blue-600 hover:bg-blue-500 text-white border-none py-6">
                  <Plus className="w-5 h-5 bg-white/10 rounded p-1" />
                  <div className="text-left">
                    <div className="text-[11px] font-bold uppercase tracking-widest">Create Opportunity</div>
                    <div className="text-[9px] text-blue-200">Add to sales pipeline</div>
                  </div>
                </Button>
              </div>

              <div className="space-y-3 pt-4">
                 <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Lead Information</p>
                 <InfoRow label="Company" value={activeConv.lead?.company || 'Unknown'} />
                 <InfoRow label="Location" value={activeConv.lead?.location || 'Unknown'} />
                 <InfoRow label="Email" value={activeConv.lead?.email || 'N/A'} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-8 text-center text-[#444] text-[10px] uppercase font-bold tracking-widest">
            Select context
          </div>
        )}
      </Card>
    </div>
  )
}

function SentimentButton({ icon: Icon, label, active, onClick, color }) {
  const colors = {
    green: active ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/5 text-[#444] hover:text-green-400',
    red: active ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/5 text-[#444] hover:text-red-400'
  }
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${colors[color]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-[#444] font-medium uppercase tracking-tighter">{label}</span>
      <span className="text-white font-bold truncate ml-2 max-w-[150px]">{value}</span>
    </div>
  )
}
