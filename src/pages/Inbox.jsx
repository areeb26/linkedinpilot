import React, { useState, useEffect, useRef } from "react"
import { useChats, useMessages, useChatAttendees, useSendMessage, useSendAttachment } from "@/hooks/useUnipileMessaging"
import { useLinkedInAccounts } from "@/hooks/useLinkedInAccounts"
import { useRawUnipileAccounts } from "@/hooks/useUnipileAccounts"
import { useSuggestReply } from "@/hooks/useAi"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Send, Sparkles, ExternalLink, MoreVertical, CheckCircle2, XCircle, Plus, MessageSquare, AlertCircle, Paperclip } from "lucide-react"
import { formatDistanceToNow, isValid } from "date-fns"
import { toast } from "react-hot-toast"
import { supabase } from "@/lib/supabase"

const safeFormatDistance = (date) => {
  if (date === null || date === undefined) return ''
  try {
    // Handle Unix timestamps (seconds or milliseconds)
    let d
    if (typeof date === 'number') {
      // If it looks like seconds (< year 3000 in ms), convert to ms
      d = new Date(date < 1e12 ? date * 1000 : date)
    } else {
      d = new Date(date)
    }
    if (!isValid(d)) return ''
    // Sanity check: if date is before year 2000, it's bogus
    if (d.getFullYear() < 2000) return ''
    return formatDistanceToNow(d, { addSuffix: false })
  } catch {
    return ''
  }
}

export default function Inbox() {
  const [activeChatId, setActiveChatId] = useState(null)
  const [search, setSearch] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [pendingFile, setPendingFile] = useState(null)

  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)

  // Get the first active LinkedIn account with a Unipile account ID
  const { data: linkedInAccounts = [], isLoading: loadingAccounts } = useLinkedInAccounts()
  const { data: rawUnipileAccounts = [], isLoading: loadingUnipile } = useRawUnipileAccounts()

  // Prefer a Supabase row that already has unipile_account_id linked.
  // Fallback: if the webhook hasn't fired yet, use the first account from
  // Unipile's live list directly so the Unibox still works.
  const activeAccount = linkedInAccounts.find(a => a.unipile_account_id)
  const accountId = activeAccount?.unipile_account_id
    ?? rawUnipileAccounts[0]?.id
    ?? null

  // Unipile data hooks
  const { data: chats = [], isLoading: loadingChats, error: chatsError } = useChats(accountId)
  const { data: rawMessages = [], isLoading: loadingThread, error: threadError } = useMessages(activeChatId)
  const { data: attendees = [] } = useChatAttendees(activeChatId)
  
  // Sort messages by timestamp (oldest first) to ensure correct order
  const messages = React.useMemo(() => {
    return [...rawMessages].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date || a.created_at || 0)
      const dateB = new Date(b.timestamp || b.date || b.created_at || 0)
      return dateA - dateB
    })
  }, [rawMessages])

  const sendMessageMutation = useSendMessage()
  const sendAttachmentMutation = useSendAttachment()
  const suggestReplyMutation = useSuggestReply()

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId)
    setPendingFile(null)
  }

  const handleSend = async (body = messageBody) => {
    if (!activeChatId) return

    // If there's a pending file, send it as an attachment
    if (pendingFile) {
      await sendAttachmentMutation.mutateAsync({ chatId: activeChatId, file: pendingFile, text: body.trim() })
      setPendingFile(null)
      setMessageBody("")
      return
    }

    if (!body.trim()) return
    await sendMessageMutation.mutateAsync({ chatId: activeChatId, text: body, accountId })
    setMessageBody("")
  }

  const handleAiSuggest = async () => {
    if (!activeChatId) return
    const contextMessages = messages.slice(-5).map(m => ({
      role: m.direction === 'SENT' ? 'outbound' : 'inbound',
      content: m.text ?? m.body ?? ''
    }))
    toast.promise(
      suggestReplyMutation.mutateAsync({ messages: contextMessages, threadId: activeChatId }),
      {
        loading: 'Analysis for reply...',
        success: 'Suggestions ready',
        error: 'AI failed to respond'
      }
    )
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
    }
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const activeChat = chats.find(c => c.id === activeChatId)
  const firstAttendee = attendees[0] ?? null

  const filteredChats = chats.filter(c => {
    const attendee = c.attendees?.[0]
    const name = attendee?.name ?? attendee?.display_name ?? ''
    const preview = c.last_message?.text ?? c.last_message?.body ?? ''
    const q = search.toLowerCase()
    return name.toLowerCase().includes(q) || preview.toLowerCase().includes(q)
  })

  if (supabase.supabaseUrl.includes('placeholder')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-xs bg-[oklch(var(--warning)/0.1)] flex items-center justify-center border border-[oklch(var(--warning)/0.2)]">
          <AlertCircle className="w-8 h-8 text-[oklch(var(--warning))]" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] uppercase tracking-tight">Supabase Not Connected</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">To use the Unibox, you need to configure your Supabase credentials in the <code>.env</code> file.</p>
        </div>
        <div className="p-[var(--space-3)] bg-[var(--color-border)] rounded-xs border border-[var(--color-border)] w-full text-left font-mono text-xs text-[var(--color-text-secondary)]">
          VITE_SUPABASE_URL=your_project_url<br/>
          VITE_SUPABASE_ANON_KEY=your_anon_key
        </div>
      </div>
    )
  }

  // No LinkedIn account with a Unipile ID connected
  if (loadingAccounts || loadingUnipile) {
    return null
  }

  if (!accountId && linkedInAccounts.length > 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-xs bg-[oklch(var(--warning)/0.1)] flex items-center justify-center border border-[oklch(var(--warning)/0.2)]">
          <AlertCircle className="w-8 h-8 text-[oklch(var(--warning))]" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] uppercase tracking-tight">Connect a LinkedIn account first</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">Your LinkedIn account needs to be connected via Unipile to use the Unibox.</p>
        </div>
      </div>
    )
  }

  if (!accountId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-xs bg-[oklch(var(--warning)/0.1)] flex items-center justify-center border border-[oklch(var(--warning)/0.2)]">
          <AlertCircle className="w-8 h-8 text-[oklch(var(--warning))]" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[var(--color-text-primary)] uppercase tracking-tight">Connect a LinkedIn account first</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">Go to Accounts and connect a LinkedIn account to start using the Unibox.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4 overflow-hidden">
      {/* Left Column: Chats */}
      <Card className="w-80 flex flex-col overflow-hidden">
        <div className="p-[var(--space-3)] border-b border-[var(--color-border)] space-y-[var(--space-2)]">
          <h2 className="text-xs font-bold text-[var(--color-text-on-strong)] uppercase tracking-widest">Unibox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <Input
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-sm h-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-smooth">
          {loadingChats ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3 border-b border-[var(--color-border)]">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : chatsError ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-[oklch(var(--destructive))] mx-auto" />
              <div className="space-y-1">
                <p className="text-xs text-[oklch(var(--destructive))] font-bold uppercase">Failed to load</p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{chatsError.message || 'Check console'}</p>
              </div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto" />
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase">No conversations</p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">Start a campaign to generate messages</p>
              </div>
            </div>
          ) : filteredChats.map(chat => {
            const contactName = chat.attendees?.[0]?.name ?? chat.attendees?.[0]?.display_name ?? 'Prospect'
            const contactAvatar = chat.attendees?.[0]?.profile_picture_url ?? chat.attendees?.[0]?.avatar_url ?? null
            const preview = chat.last_message?.text ?? chat.last_message?.body ?? ''
            const lastDate = chat.last_message?.date ?? chat.last_message?.created_at ?? chat.last_message?.timestamp ?? chat.updated_at ?? chat.created_at ?? null
            const hasUnread = (chat.unread_count ?? 0) > 0
            const isActive = activeChatId === chat.id

            return (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`w-full p-[var(--space-3)] flex gap-[var(--space-2)] text-left transition-all duration-[150ms] border-b border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-inset ${
                  isActive
                    ? 'bg-[var(--color-surface-raised)]/10 border-l-2 border-l-[var(--color-surface-raised)]'
                    : 'hover:bg-black/4'
                }`}
              >
                <Avatar className="h-10 w-10 border border-[var(--color-border)] shrink-0">
                  <AvatarImage src={contactAvatar} />
                  <AvatarFallback className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] text-sm font-semibold">
                    {contactName[0] ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-[2px]">
                    <span className="text-sm font-semibold text-[var(--color-text-on-strong)] truncate">{contactName}</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-medium shrink-0 ml-2">
                      {safeFormatDistance(lastDate)}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${hasUnread ? 'text-[var(--color-text-on-strong)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                    {preview}
                  </p>
                  {hasUnread && (
                    <div className="flex items-center gap-2 mt-[var(--space-1)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-surface-raised)]" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Middle Column: Chat */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {activeChatId ? (
          <>
            {/* Thread Header */}
            <div className="p-[var(--space-3)] border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-[var(--space-2)]">
                <Avatar className="h-8 w-8 border border-[var(--color-border)]">
                  <AvatarImage src={firstAttendee?.profile_picture_url ?? firstAttendee?.avatar_url ?? activeChat?.attendees?.[0]?.profile_picture_url ?? activeChat?.attendees?.[0]?.avatar_url} />
                  <AvatarFallback className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] font-semibold">
                    {(firstAttendee?.name ?? activeChat?.attendees?.[0]?.name ?? 'U')[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-on-strong)] leading-none">
                    {firstAttendee?.name ?? activeChat?.attendees?.[0]?.name ?? 'Prospect'}
                  </h3>
                  <span className="text-[10px] text-[var(--color-surface-raised)] uppercase tracking-widest font-bold">Active Connection</span>
                </div>
              </div>
              <div className="flex items-center gap-[4px]">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]">
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Message Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scrollbar-smooth p-[var(--space-4)] space-y-[var(--space-3)] flex flex-col"
            >
              {loadingThread ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`flex gap-2 max-w-[70%] ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-2">
                          <Skeleton className="h-16 w-64 rounded-lg" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : threadError ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-xs bg-[oklch(var(--destructive)/0.1)] flex items-center justify-center border border-[oklch(var(--destructive)/0.2)]">
                    <AlertCircle className="w-8 h-8 text-[oklch(var(--destructive))]" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[var(--color-text-on-strong)]">Failed to load messages</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm max-w-xs">{threadError.message || 'An error occurred while fetching messages.'}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-xs bg-[var(--color-border)] flex items-center justify-center border border-[var(--color-border)]">
                    <MessageSquare className="w-8 h-8 text-[var(--color-text-secondary)]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-[var(--color-text-on-strong)]">No messages yet</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">Start the conversation by sending a message below.</p>
                  </div>
                </div>
              ) : messages
                .filter(msg => !msg.is_event || msg.is_event === 0) // Filter out reaction events
                .map((msg, index) => {
                // Unipile API uses 'is_sender' field as a number (1 or 0), not boolean
                // is_sender: 1 = your message (outbound, right side)
                // is_sender: 0 = their message (inbound, left side)
                const isOutbound = msg.is_sender === 1
                const body = msg.text ?? msg.body ?? ''
                const timestamp = msg.timestamp ?? msg.date

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[70%] group relative">
                      <div className={`p-[var(--space-2)] rounded-xs text-sm leading-relaxed ${
                        isOutbound
                          ? 'bg-[var(--color-surface-raised)] text-white rounded-br-none'
                          : 'bg-[var(--color-border)] text-[var(--color-text-on-strong)] border border-[var(--color-border)] rounded-bl-none'
                      }`}>
                        {body}
                      </div>
                      <div className={`mt-[4px] text-[9px] text-[var(--color-text-secondary)] font-medium uppercase tracking-tighter ${
                        isOutbound ? 'text-right' : 'text-left'
                      }`}>
                        {safeFormatDistance(timestamp)} ago
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* AI Suggestions */}
            {suggestReplyMutation.data && suggestReplyMutation.data.length > 0 && (
              <div className="px-[var(--space-4)] py-[var(--space-1)] flex gap-[var(--space-1)] overflow-x-auto scrollbar-smooth">
                {suggestReplyMutation.data.map((pill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(pill)}
                    className="shrink-0 px-[var(--space-2)] py-[6px] rounded-sm bg-[var(--color-surface-raised)]/10 border border-[var(--color-surface-raised)]/20 text-[var(--color-surface-raised)] text-xs font-medium hover:bg-[var(--color-surface-raised)]/20 transition-all duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            )}

            {/* File preview */}
            {pendingFile && (
              <div className="px-[var(--space-3)] py-[var(--space-1)] flex items-center gap-[var(--space-2)] bg-[var(--color-surface-raised)]/5 border-t border-[var(--color-border)]">
                <Paperclip className="w-3.5 h-3.5 text-[var(--color-surface-raised)] shrink-0" />
                <span className="text-xs text-[var(--color-surface-raised)] truncate flex-1">{pendingFile.name}</span>
                <button
                  onClick={() => setPendingFile(null)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  aria-label="Remove attachment"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-[var(--space-3)] border-t border-[var(--color-border)]">
              <div className="flex items-center gap-[var(--space-2)] relative">
                <Button
                  onClick={handleAiSuggest}
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)]/10"
                  aria-label="AI suggest reply"
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Attach file"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)]/10"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Drive the conversation forward..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="text-sm h-11"
                />
                <Button
                  onClick={() => handleSend()}
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-xs bg-[var(--color-border)] flex items-center justify-center border border-[var(--color-border)]">
              <MessageSquare className="w-8 h-8 text-[var(--color-text-secondary)]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[var(--color-text-on-strong)] uppercase tracking-tight">Select a Conversation</h3>
              <p className="text-[var(--color-text-secondary)] text-sm">Select a prospect from the left to start chatting.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Right Column: Context */}
      <Card className="w-80 flex flex-col overflow-hidden">
        {activeChatId ? (
          <div className="flex-1 overflow-y-auto scrollbar-smooth">
            {/* Lead Card */}
            <div className="p-[var(--space-4)] text-center space-y-[var(--space-3)] border-b border-[var(--color-border)]">
              <Avatar className="h-20 w-20 mx-auto border-2 border-[var(--color-border)]">
                <AvatarImage src={firstAttendee?.profile_picture_url ?? firstAttendee?.avatar_url} />
                <AvatarFallback className="text-2xl bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] font-bold">
                  {(firstAttendee?.name ?? 'U')[0]}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-[4px]">
                <h2 className="text-xl font-bold text-[var(--color-text-on-strong)]">{firstAttendee?.name ?? 'Prospect'}</h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{firstAttendee?.headline ?? ''}</p>
              </div>
              <div className="flex justify-center gap-[var(--space-1)]">
                {firstAttendee?.provider_id && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                    <a
                      href={`https://www.linkedin.com/in/${firstAttendee.provider_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn <ExternalLink className="w-3 h-3 ml-2" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-[var(--space-4)] space-y-[var(--space-4)]">
              {/* Sentiment */}
              <div className="space-y-[var(--space-2)]">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Sentiment Label</p>
                <div className="grid grid-cols-2 gap-[var(--space-1)]">
                  <SentimentButton
                    active={false}
                    onClick={() => {}}
                    icon={CheckCircle2}
                    label="Interested"
                    color="green"
                  />
                  <SentimentButton
                    active={false}
                    onClick={() => {}}
                    icon={XCircle}
                    label="Not Interested"
                    color="red"
                  />
                </div>
              </div>

              <Separator className="bg-[var(--color-border)]" />

              {/* CRM Actions */}
              <div className="space-y-[var(--space-2)]">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">CRM Actions</p>
                <Button className="w-full justify-start gap-[var(--space-2)] py-6">
                  <Plus className="w-5 h-5 bg-white/10 rounded p-1" aria-hidden="true" />
                  <div className="text-left">
                    <div className="text-[11px] font-bold uppercase tracking-widest">Create Opportunity</div>
                    <div className="text-[9px] opacity-70">Add to sales pipeline</div>
                  </div>
                </Button>
              </div>

              {/* Lead Info */}
              {firstAttendee && (
                <div className="space-y-[var(--space-2)] pt-[var(--space-2)]">
                  <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Lead Information</p>
                  <InfoRow label="Provider ID" value={firstAttendee.provider_id ?? 'Unknown'} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-8 text-center text-[var(--color-text-secondary)] text-[10px] uppercase font-bold tracking-widest">
            Select context
          </div>
        )}
      </Card>
    </div>
  )
}

function SentimentButton({ icon: Icon, label, active, onClick, color }) {
  const colors = {
    green: active
      ? 'bg-[var(--color-surface-raised)]/10 border-[var(--color-surface-raised)]/30 text-[var(--color-surface-raised)]'
      : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-surface-raised)]',
    red: active
      ? 'bg-[oklch(var(--destructive)/0.1)] border-[oklch(var(--destructive)/0.3)] text-[oklch(var(--destructive))]'
      : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[oklch(var(--destructive))]',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-[var(--space-1)] py-[10px] rounded-xs border text-[10px] font-bold uppercase tracking-widest transition-all duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${colors[color]}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-[var(--color-text-secondary)] font-medium uppercase tracking-tighter">{label}</span>
      <span className="text-[var(--color-text-on-strong)] font-semibold truncate ml-2 max-w-[150px]">{value}</span>
    </div>
  )
}
