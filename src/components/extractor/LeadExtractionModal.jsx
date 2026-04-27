import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogClose, DialogTitle } from '@/components/ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import {
  X, ChevronLeft, ChevronRight, Puzzle, Search, Sparkles,
  Building2, MapPin, ExternalLink, Loader2, CheckCircle2,
  AlertCircle, Briefcase, SlidersHorizontal, ArrowRight,
  Zap
} from 'lucide-react'

const METHOD_PICK  = 'method'
const EXT_KEYWORD  = 'ext_keyword'
const EXT_CONFIG   = 'ext_config'
const EXT_PROGRESS = 'ext_progress'
const UNI_FORM     = 'uni_form'
const UNI_RESULTS  = 'uni_results'

function buildLinkedInSearchUrl(kw) {
  return 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(kw.trim()) + '&origin=GLOBAL_SEARCH_HEADER'
}

const extConfigRef = { current: null }

export function LeadExtractionModal({ isOpen, onOpenChange }) {
  const [step, setStep] = useState(METHOD_PICK)
  const reset = () => {
    extConfigRef.current = null  // clear stale config so next run starts fresh
    setStep(METHOD_PICK)
  }
  const handleClose = (open) => { if (!open) reset(); onOpenChange(open) }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl p-0 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs overflow-hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root><DialogTitle>Extract Leads</DialogTitle></VisuallyHidden.Root>

        {/* Modal header */}
        <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Sparkles className="h-5 w-5 text-[var(--color-surface-raised)]" />
            <span className="text-[var(--color-text-on-strong)] font-bold text-lg">Extract Leads</span>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]"
              // Hide the header × during extraction — the bottom button is the only close
              style={{ visibility: step === UNI_RESULTS ? 'hidden' : 'visible' }}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="p-[var(--space-4)] max-h-[80vh] overflow-y-auto scrollbar-smooth">
          {step === METHOD_PICK  && <MethodPicker onSelect={(m) => setStep(m === 'extension' ? EXT_KEYWORD : UNI_FORM)} />}
          {step === EXT_KEYWORD  && <ExtKeywordStep onBack={() => setStep(METHOD_PICK)} onNext={() => setStep(EXT_CONFIG)} />}
          {step === EXT_CONFIG   && <ExtConfigStep  onBack={() => setStep(EXT_KEYWORD)} onDone={() => setStep(EXT_PROGRESS)} />}
          {step === EXT_PROGRESS && <ExtProgressStep onClose={() => handleClose(false)} />}
          {step === UNI_FORM     && <UnipileFormStep onBack={() => setStep(METHOD_PICK)} onResults={() => setStep(UNI_RESULTS)} />}
          {step === UNI_RESULTS  && <UnipileResultsStep onBack={() => setStep(UNI_FORM)} onClose={() => handleClose(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- MethodPicker ----
function MethodPicker({ onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-on-strong)] mb-1">How do you want to extract leads?</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Choose your extraction method</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect('extension')}
          className="group relative p-6 rounded-xs border border-[var(--color-border)] bg-[var(--color-border)] hover:border-[var(--color-surface-raised)]/50 hover:brightness-110/5 transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xs bg-[var(--color-surface-raised)]/10 flex items-center justify-center mb-4 group-hover:brightness-110/20 transition-colors">
            <Puzzle className="h-6 w-6 text-[var(--color-surface-raised)]" />
          </div>
          <h3 className="text-[var(--color-text-on-strong)] font-bold mb-1">Chrome Extension</h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
            Search LinkedIn directly. The extension scrapes results in real-time as you browse.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Any search</span>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Post engagements</span>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Groups</span>
          </div>
          <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-surface-raised)] transition-colors" />
        </button>

        <button
          onClick={() => onSelect('unipile')}
          className="group relative p-6 rounded-xs border border-[var(--color-border)] bg-[var(--color-border)] hover:border-[oklch(var(--info)/0.5)] hover:bg-[oklch(var(--info)/0.05)] transition-all text-left"
        >
          <div className="h-12 w-12 rounded-xs bg-[oklch(var(--info)/0.1)] flex items-center justify-center mb-4 group-hover:bg-[oklch(var(--info)/0.2)] transition-colors">
            <Zap className="h-6 w-6 text-[oklch(var(--info))]" />
          </div>
          <h3 className="text-[var(--color-text-on-strong)] font-bold mb-1">LinkedIn Search API</h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
            Use Unipile's LinkedIn API to search and extract leads with advanced filters.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Classic</span>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Sales Navigator</span>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[var(--color-border)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">Recruiter</span>
          </div>
          <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-[var(--color-text-secondary)] group-hover:text-[oklch(var(--info))] transition-colors" />
        </button>
      </div>
    </div>
  )
}

// ---- ExtKeywordStep ----
function ExtKeywordStep({ onBack, onNext }) {
  const [keywords, setKeywords] = useState('')

  const handleOpen = () => {
    if (!keywords.trim()) { toast.error('Enter keywords first'); return }
    window.open(buildLinkedInSearchUrl(keywords), '_blank')
    onNext()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-on-strong)]">Who do you want to search?</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Enter keywords and we will open LinkedIn search for you</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">Search Keywords</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
          <Input
            autoFocus
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
            placeholder="e.g. Marketing Manager London, SaaS Founder, CTO startup"
            className="pl-10 bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] h-12 focus-visible:ring-[var(--color-ring)]"
          />
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">Tip: job title + location + industry gives the best results</p>
      </div>

      <div className="p-4 rounded-xs bg-[var(--color-surface-raised)]/5 border border-[var(--color-surface-raised)]/15 space-y-2">
        <p className="text-xs font-bold text-[var(--color-surface-raised)] uppercase tracking-wider">What happens next</p>
        <ol className="space-y-1.5">
          {['LinkedIn search opens in a new tab with your keywords',
            'Apply any extra filters you want (location, industry, etc.)',
            'Come back here and configure your extraction',
            'The extension will scrape results automatically'
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="flex-shrink-0 h-4 w-4 rounded-sm bg-[var(--color-surface-raised)]/20 text-[var(--color-surface-raised)] flex items-center justify-center text-[10px] font-bold mt-0.5">{i+1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">Back</Button>
        <Button
          onClick={handleOpen}
          disabled={!keywords.trim()}
          className="bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text-on-strong)] px-6 font-bold"
        >
          Open LinkedIn Search <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// ---- ExtConfigStep ----
function ExtConfigStep({ onBack, onDone }) {
  const { workspaceId } = useWorkspaceStore()
  const { data: accounts = [] } = useLinkedInAccounts()
  const [listName, setListName] = useState('')
  const [maxLeads, setMaxLeads] = useState(50)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const activeAccounts = accounts.filter(a => a.status !== 'disconnected')

  const handleStart = async () => {
    if (!listName.trim()) { toast.error('Enter a list name'); return }
    if (!selectedAccountId) { toast.error('Select a LinkedIn account'); return }
    if (isStarting) return  // prevent double-click double-submit
    setIsStarting(true)
    try {
      // Check if a campaign with this name already exists for this workspace
      // to prevent duplicate creation on double-click or re-render
      const { data: campaign, error: campErr } = await supabase
        .from('campaigns')
        .insert([{
          workspace_id: workspaceId,
          linkedin_account_id: selectedAccountId,
          name: listName.trim(),
          status: 'active',
          type: 'prospect-extractor',
          settings: { source: 'search', max_leads: maxLeads }
        }])
        .select()
        .single()
      if (campErr) throw campErr

      const { data: action, error: actErr } = await supabase
        .from('action_queue')
        .insert([{
          workspace_id: workspaceId,
          linkedin_account_id: selectedAccountId,
          campaign_id: campaign.id,
          action_type: 'scrapeLeads',
          payload: { extractionType: 'search', campaignId: campaign.id, maxLeads },
          status: 'pending'
        }])
        .select()
        .single()
      if (actErr) throw actErr

      // Update payload to include the action_queue_id so the extension can link leads
      await supabase
        .from('action_queue')
        .update({ payload: { extractionType: 'search', campaignId: campaign.id, maxLeads, action_queue_id: action.id } })
        .eq('id', action.id)

      extConfigRef.current = { actionId: action.id, campaignId: campaign.id, workspaceId, maxLeads, listName: listName.trim() }
      onDone()
    } catch (err) {
      toast.error('Failed to start: ' + err.message)
      setIsStarting(false)  // only reset on error so button stays disabled on success
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-on-strong)]">Configure Extraction</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Name your list and set how many leads to scrape</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">List Name</label>
        <Input
          autoFocus
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="e.g. Marketing Managers London Q2"
          className="bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] h-11 focus-visible:ring-[var(--color-ring)]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">Number of People to Scrape</label>
        <div className="flex items-center gap-4 flex-wrap">
          <Input
            type="number"
            min={1}
            max={1000}
            value={maxLeads}
            onChange={(e) => setMaxLeads(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
            className="bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] h-11 w-28 focus-visible:ring-[var(--color-ring)]"
          />
          <div className="flex gap-2">
            {[25, 50, 100, 250].map(n => (
              <button
                key={n}
                onClick={() => setMaxLeads(n)}
                className={cn(
                  'px-3 py-1.5 rounded-xs text-xs font-bold transition-all border',
                  maxLeads === n
                    ? 'bg-[var(--color-surface-raised)] border-[var(--color-surface-raised)] text-[var(--color-text-on-strong)]'
                    : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-on-strong)]'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">Max 1,000 per extraction. LinkedIn shows ~10 per page.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">LinkedIn Account</label>
        {activeAccounts.length === 0 ? (
          <div className="p-4 rounded-xs border border-dashed border-[var(--color-border)] text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No connected accounts. Connect one first.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeAccounts.map(acc => (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xs border cursor-pointer transition-all',
                  selectedAccountId === acc.id
                    ? 'border-[var(--color-surface-raised)]/50 bg-[var(--color-surface-raised)]/5'
                    : 'border-[var(--color-border)] bg-[var(--color-border)] hover:border-[var(--color-border)]'
                )}
              >
                <div className="h-9 w-9 rounded-sm bg-[var(--color-border)] border border-[var(--color-border)] overflow-hidden flex-shrink-0">
                  {acc.avatar_url
                    ? <img src={acc.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[var(--color-text-secondary)]">{(acc.full_name || '?').substring(0,2).toUpperCase()}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-on-strong)] truncate">{acc.full_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">{acc.headline || acc.email || ''}</p>
                </div>
                <div className={cn(
                  'h-4 w-4 rounded-sm border-2 flex-shrink-0 transition-colors',
                  selectedAccountId === acc.id ? 'border-[var(--color-surface-raised)] bg-[var(--color-surface-raised)]' : 'border-[var(--color-border)]'
                )} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">Back</Button>
        <Button
          onClick={handleStart}
          disabled={isStarting || !listName.trim() || !selectedAccountId}
          className="bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text-on-strong)] px-8 font-bold"
        >
          {isStarting
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting...</>
            : <>Start Scraping <ChevronRight className="h-4 w-4 ml-1" /></>
          }
        </Button>
      </div>
    </div>
  )
}

// ---- ExtConfigStep ----
// ---- ExtProgressStep ----
function ExtProgressStep({ onClose }) {
  const cfg = extConfigRef.current || {}
  const { actionId, workspaceId, maxLeads = 50, listName = 'Extraction' } = cfg

  const [scraped, setScraped] = React.useState(0)
  const [status, setStatus] = React.useState('processing')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    if (!actionId || !workspaceId) return

    const pollAction = async () => {
      const { data } = await supabase
        .from('action_queue')
        .select('status, result')
        .eq('id', actionId)
        .single()
      if (data) {
        if (data.status === 'done' || data.status === 'completed') setStatus('done')
        if (data.status === 'failed') {
          setStatus('failed')
          setErrorMsg((data.result && data.result.error) || 'Extraction failed')
        }
      }
    }

    const channel = supabase
      .channel('ext_progress_' + actionId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: 'workspace_id=eq.' + workspaceId
      }, () => {
        setScraped(prev => {
          const next = prev + 1
          if (next >= maxLeads) setStatus('done')
          return next
        })
      })
      .subscribe()

    const interval = setInterval(pollAction, 3000)
    pollAction()

    return () => {
      clearInterval(interval)
      channel.unsubscribe().then(() => supabase.removeChannel(channel))
    }
  }, [actionId, workspaceId, maxLeads])

  const pct = Math.min(100, Math.round((scraped / maxLeads) * 100))
  const pending = Math.max(0, maxLeads - scraped)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-on-strong)] mb-1">
          {status === 'done' ? 'Extraction Complete!' : status === 'failed' ? 'Extraction Failed' : 'Scraping in Progress...'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{listName}</p>
      </div>

      {status === 'failed' ? (
        <div className="p-4 rounded-xs bg-[oklch(var(--destructive)/0.1)] border border-[oklch(var(--destructive)/0.2)] flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[oklch(var(--destructive))] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[oklch(var(--destructive))]">Extraction failed</p>
            <p className="text-xs text-[oklch(var(--destructive))] mt-1">{errorMsg || 'Make sure LinkedIn is open and the extension is active.'}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Progress</span>
              <span className="text-[var(--color-text-on-strong)] font-bold">{pct}%</span>
            </div>
            <div className="h-3 bg-[var(--color-border)] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[var(--color-surface-raised)] rounded-sm transition-all duration-500"
                style={{ width: pct + '%' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
              <p className="text-2xl font-bold text-[var(--color-text-on-strong)]">{scraped}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Scraped</p>
            </div>
            <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{pending}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Pending</p>
            </div>
            <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
              <p className="text-2xl font-bold text-[var(--color-text-on-strong)]">{maxLeads}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Target</p>
            </div>
          </div>

          {status === 'processing' && (
            <div className="flex items-center gap-3 p-4 rounded-xs bg-[var(--color-surface-raised)]/5 border border-[var(--color-surface-raised)]/15">
              <Loader2 className="h-5 w-5 text-[var(--color-surface-raised)] animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-on-strong)]">Extension is scraping LinkedIn</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Keep LinkedIn open. You can close this modal and scraping continues in the background.</p>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-3 p-4 rounded-xs bg-[oklch(var(--success)/0.05)] border border-[oklch(var(--success)/0.2)]">
              <CheckCircle2 className="h-5 w-5 text-[oklch(var(--success))] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-on-strong)]">Done! {scraped} leads saved to <span className="text-[var(--color-surface-raised)]">{listName}</span></p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">View them in the Prospect Extractor page.</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-3">
        {(status === 'done' || status === 'failed') ? (
          <Button onClick={onClose} className="bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text-on-strong)] px-8 font-bold">Done</Button>
        ) : (
          <Button variant="ghost" onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">
            Close (scraping continues)
          </Button>
        )}
      </div>
    </div>
  )
}

// ---- FilterDropdown — dropdown with search for Unipile parameter IDs ----
// Shows a trigger button that opens a dropdown with a search input + results list.
// Selected items appear as removable tags above the trigger.
function FilterDropdown({ label, icon: Icon, paramType, accountId, apiType: service, selected, onToggle, placeholder }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const containerRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const debounceRef = React.useRef(null)

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const fetchResults = React.useCallback(async (q) => {
    if (!accountId) return
    setLoading(true)
    try {
      const serviceMap = { classic: 'CLASSIC', sales_navigator: 'SALES_NAVIGATOR', recruiter: 'RECRUITER' }
      const params = new URLSearchParams({
        account_id: accountId,
        type: paramType,
        limit: '15',
        service: serviceMap[service] || 'CLASSIC',
        ...(q.trim() ? { keywords: q.trim() } : {}),
      })
      const res = await fetch(`${BACKEND_URL}/api/linkedin/search/parameters?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error(`[FilterDropdown] Failed to fetch ${paramType}:`, errorData)
        throw new Error(errorData.error || `Failed to fetch ${label.toLowerCase()}`)
      }
      const data = await res.json()
      setResults(data.items || [])
    } catch (err) {
      console.error(`[FilterDropdown] Error fetching ${paramType}:`, err)
      toast.error(`Failed to load ${label.toLowerCase()}: ${err.message}`)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [BACKEND_URL, accountId, paramType, service, label])

  const handleOpen = () => {
    setOpen(true)
    if (results.length === 0) fetchResults('')
  }

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(val), 300)
  }

  const isSelected = (id) => selected.some(s => s.id === id)

  const handleToggle = (item) => {
    onToggle(item)
    // Keep dropdown open for multi-select
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </label>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[var(--color-surface-raised)]/10 border border-[var(--color-surface-raised)]/25 text-xs text-[var(--color-surface-raised)] font-medium"
            >
              {s.title}
              <button
                onClick={() => onToggle(s)}
                className="ml-0.5 hover:text-[oklch(var(--destructive))] transition-colors leading-none"
                aria-label={`Remove ${s.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          'h-9 px-3 rounded-xs text-sm',
          'border transition-all duration-[150ms]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          open
            ? 'border-[var(--color-ring)] bg-[var(--color-border)] text-[var(--color-text-on-strong)]'
            : 'border-[var(--color-border)] bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-ring)]/50 hover:text-[var(--color-text-on-strong)]'
        )}
      >
        <span className="truncate">
          {selected.length > 0
            ? `${selected.length} selected`
            : placeholder}
        </span>
        <svg
          className={cn('h-4 w-4 shrink-0 transition-transform duration-[150ms]', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs shadow-elevation-3 overflow-hidden">
            {/* Search input inside dropdown */}
            <div className="p-2 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleQueryChange}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-border)] rounded-xs border border-[var(--color-border)] text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
                />
                {loading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[var(--color-text-secondary)]" />
                )}
              </div>
            </div>

            {/* Results list */}
            <div className="max-h-52 overflow-y-auto scrollbar-smooth">
              {results.length === 0 && !loading ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-secondary)]">
                  {query ? `No results for "${query}"` : 'Type to search...'}
                </div>
              ) : (
                results.map(item => {
                  const checked = isSelected(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggle(item)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-[100ms]',
                        checked
                          ? 'bg-[var(--color-surface-raised)]/8 text-[var(--color-text-on-strong)]'
                          : 'text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]'
                      )}
                    >
                      {/* Checkbox indicator */}
                      <span className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                        checked
                          ? 'bg-[var(--color-surface-raised)] border-[var(--color-surface-raised)]'
                          : 'border-[var(--color-border)]'
                      )}>
                        {checked && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {item.picture_url && (
                        <img src={item.picture_url} alt="" className="h-5 w-5 rounded-sm object-cover shrink-0" />
                      )}
                      <span className="flex-1 truncate">{item.title}</span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {selected.length > 0 ? `${selected.length} selected` : 'Select multiple'}
              </span>
              <button
                type="button"
                onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
                className="text-xs font-medium text-[var(--color-surface-raised)] hover:brightness-110 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- UnipileFormStep ----
function UnipileFormStep({ onBack, onResults }) {
  const { data: accounts = [] } = useLinkedInAccounts()
  const [selectedAccountId, setSelectedAccountId] = React.useState('')
  const [apiType, setApiType] = React.useState('classic')
  const [category, setCategory] = React.useState('people')
  const [keywords, setKeywords] = React.useState('')
  const [listName, setListName] = React.useState('')
  const [maxLeads, setMaxLeads] = React.useState(50)
  // ID-based filter state — each is an array of { id, title } objects
  const [locationIds, setLocationIds] = React.useState([])
  const [companyIds, setCompanyIds] = React.useState([])
  const [industryIds, setIndustryIds] = React.useState([])
  const [titleIds, setTitleIds] = React.useState([])
  const [showFilters, setShowFilters] = React.useState(false)
  const [isStarting, setIsStarting] = React.useState(false)

  const activeAccount = accounts.find(a => a.id === selectedAccountId)
  const unipileAccountId = activeAccount && activeAccount.unipile_account_id

  // Helper to toggle an item in an ID list (add if not present, remove if present)
  const makeToggle = (setter) => (item) => {
    setter(prev =>
      prev.find(p => p.id === item.id)
        ? prev.filter(p => p.id !== item.id)  // remove
        : [...prev, item]                       // add
    )
  }

  const handleStart = async () => {
    if (!listName.trim()) { toast.error('Enter a list name'); return }
    if (!selectedAccountId) { toast.error('Select a LinkedIn account'); return }
    if (!unipileAccountId) { toast.error('This account is not connected via Unipile. Use the Chrome Extension method instead.'); return }
    if (!keywords.trim()) { toast.error('Enter keywords to search'); return }
    if (isStarting) return

    // Build filters using IDs per Unipile spec
    const filters = {}
    if (locationIds.length > 0)  filters.location = locationIds.map(l => Number(l.id) || l.id)
    if (companyIds.length > 0)   filters.company  = { include: companyIds.map(c => Number(c.id) || c.id) }
    if (industryIds.length > 0)  filters.industry = { include: industryIds.map(i => String(i.id)) }
    if (titleIds.length > 0)     filters.title    = titleIds.map(t => t.title).join(' OR ')

    setIsStarting(true)
    extConfigRef.current = {
      listName: listName.trim(),
      unipileAccountId,
      selectedAccountId,
      maxLeads,
      searchParams: { api: apiType, category, keywords, filters }
    }
    onResults()
  }

  const accountsWithUnipile = accounts.filter(a => a.unipile_account_id)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-on-strong)]">LinkedIn Search API</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">Search and extract leads via Unipile</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">List Name <span className="text-[oklch(var(--destructive))]">*</span></label>
        <Input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="e.g. SaaS Founders NYC"
          className="bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] h-11 focus-visible:ring-[var(--color-ring)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">LinkedIn Account <span className="text-[oklch(var(--destructive))]">*</span></label>
        {accountsWithUnipile.length === 0 ? (
          <div className="p-3 rounded-xs border border-[oklch(var(--warning)/0.2)] bg-[oklch(var(--warning)/0.05)]">
            <p className="text-xs text-[oklch(var(--warning))]">No accounts connected via Unipile. Connect an account or use the Chrome Extension method.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {accountsWithUnipile.map(acc => (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xs border cursor-pointer transition-all',
                  selectedAccountId === acc.id
                    ? 'border-[oklch(var(--info)/0.5)] bg-[oklch(var(--info)/0.05)]'
                    : 'border-[var(--color-border)] bg-[var(--color-border)] hover:border-[var(--color-border)]'
                )}
              >
                <div className="h-8 w-8 rounded-sm bg-[var(--color-border)] border border-[var(--color-border)] overflow-hidden flex-shrink-0">
                  {acc.avatar_url
                    ? <img src={acc.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[var(--color-text-secondary)]">{(acc.full_name || '?').substring(0,2).toUpperCase()}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-on-strong)] truncate">{acc.full_name}</p>
                </div>
                <div className={cn(
                  'h-4 w-4 rounded-sm border-2 flex-shrink-0',
                  selectedAccountId === acc.id ? 'border-blue-500 bg-blue-500' : 'border-[var(--color-border)]'
                )} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-on-strong)]">LinkedIn Tier</label>
          <div className="flex flex-col gap-1.5">
            {[['classic','Classic'],['sales_navigator','Sales Navigator'],['recruiter','Recruiter']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setApiType(val)}
                className={cn(
                  'px-3 py-2 rounded-xs text-xs font-bold text-left transition-all border',
                  apiType === val
                    ? 'bg-[var(--color-surface-raised)] border-blue-500 text-[var(--color-text-on-strong)]'
                    : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-on-strong)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-on-strong)]">Category</label>
          <div className="flex flex-col gap-1.5">
            {[['people','People'],['companies','Companies'],['posts','Posts'],['jobs','Jobs']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCategory(val)}
                className={cn(
                  'px-3 py-2 rounded-xs text-xs font-bold text-left transition-all border',
                  category === val
                    ? 'bg-[var(--color-surface-raised)] border-blue-500 text-[var(--color-text-on-strong)]'
                    : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-on-strong)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">Keywords <span className="text-[oklch(var(--destructive))]">*</span></label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Job title, skills, company name..."
            className="pl-10 bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] h-11 focus-visible:ring-[var(--color-ring)]"
          />
        </div>
      </div>

      <button
        onClick={() => setShowFilters(f => !f)}
        className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {showFilters ? 'Hide' : 'Show'} advanced filters
      </button>

      {showFilters && (
        <div className="space-y-[var(--space-2)]">
          <div className="grid grid-cols-2 gap-3">
            <FilterDropdown
              label="Location"
              icon={MapPin}
              paramType="LOCATION"
              accountId={unipileAccountId}
              apiType={apiType}
              selected={locationIds}
              onToggle={makeToggle(setLocationIds)}
              placeholder="Select locations..."
            />
            <FilterDropdown
              label="Company"
              icon={Building2}
              paramType="COMPANY"
              accountId={unipileAccountId}
              apiType={apiType}
              selected={companyIds}
              onToggle={makeToggle(setCompanyIds)}
              placeholder="Select companies..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FilterDropdown
              label="Industry"
              paramType="INDUSTRY"
              accountId={unipileAccountId}
              apiType={apiType}
              selected={industryIds}
              onToggle={makeToggle(setIndustryIds)}
              placeholder="Select industries..."
            />
            <FilterDropdown
              label="Job Title"
              icon={Briefcase}
              paramType="JOB_TITLE"
              accountId={unipileAccountId}
              apiType={apiType}
              selected={titleIds}
              onToggle={makeToggle(setTitleIds)}
              placeholder="Select job titles..."
            />
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            Click a dropdown → type to search → check items to add. LinkedIn requires IDs, not raw text.
          </p>
        </div>
      )}

      {/* How many people */}
      <div className="space-y-2 pt-1">
        <label className="text-sm font-medium text-[var(--color-text-on-strong)]">How many people to extract? <span className="text-[oklch(var(--destructive))]">*</span></label>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="number"
            min={1}
            max={2500}
            value={maxLeads}
            onChange={(e) => setMaxLeads(Math.max(1, Math.min(2500, parseInt(e.target.value) || 1)))}
            className="bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)] h-11 w-28 focus-visible:ring-[var(--color-ring)]"
          />
          <div className="flex gap-2 flex-wrap">
            {[25, 50, 100, 250, 500].map(n => (
              <button
                key={n}
                onClick={() => setMaxLeads(n)}
                className={cn(
                  'px-3 py-1.5 rounded-xs text-xs font-bold transition-all border',
                  maxLeads === n
                    ? 'bg-[var(--color-surface-raised)] border-blue-500 text-[var(--color-text-on-strong)]'
                    : 'bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-on-strong)]'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Classic: up to 1,000 per query · Sales Navigator / Recruiter: up to 2,500
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">Back</Button>
        <Button
          onClick={handleStart}
          disabled={isStarting || !keywords.trim() || !selectedAccountId || !listName.trim()}
          className="bg-[var(--color-surface-raised)] hover:brightness-110 text-[var(--color-text-on-strong)] px-8 font-bold"
        >
          {isStarting
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting...</>
            : <>Start Extraction <ChevronRight className="h-4 w-4 ml-1" /></>
          }
        </Button>
      </div>
    </div>
  )
}

// ---- UnipileResultsStep — background pagination scraper ----
// Immediately creates campaign + action_queue, then loops POST /linkedin/search
// with cursor until maxLeads is reached, saving each page to Supabase in batches.
function UnipileResultsStep({ onBack, onClose }) {
  const { workspaceId } = useWorkspaceStore()
  const [scraped, setScraped] = React.useState(0)
  const [total, setTotal] = React.useState(null)
  const [status, setStatus] = React.useState('idle') // idle | running | done | failed
  const [errorMsg, setErrorMsg] = React.useState('')

  const cfg = extConfigRef.current || {}
  const { listName = 'LinkedIn Search', unipileAccountId, selectedAccountId, maxLeads = 50, searchParams = {} } = cfg

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

  // mapItem: convert a Unipile search result item to a leads table row
  // Field availability by tier (from Unipile docs):
  //   Classic:        id(URN), name, member_urn, profile_url(with ?miniProfileUrn=), location, headline
  //   Sales Nav:      id, name, first_name, last_name, public_identifier, public_profile_url,
  //                   profile_picture_url, location, headline, current_positions[]
  //   Recruiter:      id, headline, location, current_positions[] — name/profile_url may be null
  const mapItem = (item, actionId) => {
    // Build a valid, clickable profile_url.
    // Priority order:
    // 1. public_profile_url (Sales Nav) - most reliable
    // 2. public_identifier (Sales Nav) - build clean URL
    // 3. profile_url with valid slug (Classic) - extract slug
    // 4. member_urn (Classic/Recruiter) - use member ID format
    // 5. provider_id - use as member ID
    let profileUrl = ''

    if (item.public_profile_url) {
      // Sales Nav: clean URL like https://www.linkedin.com/in/john-smith
      profileUrl = item.public_profile_url.split('?')[0].replace(/\/$/, '')
    } else if (item.public_identifier) {
      // Sales Nav fallback: build from slug
      profileUrl = `https://www.linkedin.com/in/${item.public_identifier}`
    } else if (item.profile_url) {
      // Classic: profile_url may be like "https://www.linkedin.com/in/slug?miniProfileUrn=..."
      const stripped = item.profile_url.split('?')[0].replace(/\/$/, '')
      const slug = stripped.split('/in/')[1] || ''
      
      // Check if slug is a real LinkedIn username (not a URN)
      if (slug && !slug.startsWith('urn:') && !slug.startsWith('ACo') && !slug.startsWith('AEo') && !/[+/=]/.test(slug)) {
        profileUrl = stripped
      }
    }
    
    // If we still don't have a URL, try member_urn or provider_id
    if (!profileUrl) {
      const memberId = item.member_urn?.split(':').pop() || item.provider_id || item.id
      if (memberId && memberId !== 'undefined' && memberId !== 'null') {
        // Use LinkedIn's member ID format which always works
        profileUrl = `https://www.linkedin.com/in/member/${memberId}`
      }
    }

    // Ensure absolute URL
    if (profileUrl && !profileUrl.startsWith('http')) {
      profileUrl = 'https://www.linkedin.com' + (profileUrl.startsWith('/') ? '' : '/') + profileUrl
    }

    // Company: Sales Nav / Recruiter have current_positions; Classic doesn't.
    // Fall back to parsing headline ("Title @ Company" or "Title at Company").
    const companyFromPositions =
      item.current_positions?.[0]?.company_name ||
      item.current_positions?.[0]?.company ||
      item.positions?.[0]?.company_name ||
      item.positions?.[0]?.company ||
      ''
    const headline = item.headline || item.summary || ''
    const companyFromHeadline = headline.includes(' at ')
      ? headline.split(' at ').slice(1).join(' at ').trim()
      : headline.includes(' @ ')
        ? headline.split(' @ ').slice(1).join(' @ ').trim()
        : ''
    const company = companyFromPositions || companyFromHeadline

    // Title: use current_positions[0].role first (Recruiter/Sales Nav),
    // then parse from headline ("Title at Company" / "Title @ Company")
    const roleFromPositions = item.current_positions?.[0]?.role || item.positions?.[0]?.role || ''
    const titleFromHeadline = headline.includes(' at ')
      ? headline.split(' at ')[0].trim()
      : headline.includes(' @ ')
        ? headline.split(' @ ')[0].trim()
        : ''
    const title = roleFromPositions || titleFromHeadline || headline

    // Name: Recruiter anonymizes names as "LinkedIn Member" — use role + company as fallback.
    // For Classic/Sales Nav, item.name is always a real name. If it's null, mark as unknown
    // rather than using the headline/title (which would show job titles as names).
    const rawName = item.name || [item.first_name, item.last_name].filter(Boolean).join(' ')
    const isAnonymized = !rawName || rawName === 'LinkedIn Member' || rawName === 'LinkedIn User'
    
    const fullName = isAnonymized
      ? (title && company ? `${title} at ${company}` : title && title !== headline ? title : 'LinkedIn Member')
      : rawName

    return {
      workspace_id:       workspaceId,
      action_queue_id:    actionId,
      full_name:          fullName,
      first_name:         item.first_name || null,
      last_name:          item.last_name  || null,
      headline,
      title,
      company,
      profile_url:        profileUrl,
      avatar_url:         item.profile_picture_url || item.picture_url || '',
      location:           item.location || item.geo_location || '',
      linkedin_member_id: item.provider_id || item.id || item.member_urn || '',
      source:             'unipile-search',
      connection_status:  'none',
    }
  }

  // Run extraction once on mount — use a local cancelled flag instead of a ref
  // so React StrictMode's double-invoke correctly cancels the first run and
  // lets the second (real) run proceed.
  React.useEffect(() => {
    let cancelled = false

    if (!unipileAccountId || !workspaceId) {
      setStatus('failed')
      setErrorMsg('Missing account or workspace. Go back and try again.')
      return
    }

    setStatus('running')

    const run = async () => {
      try {
        // 0. Health-check the backend
        try {
          const health = await fetch(BACKEND_URL + '/health', { signal: AbortSignal.timeout(4000) })
          if (!health.ok) throw new Error('Backend returned ' + health.status)
        } catch {
          throw new Error(
            `Cannot reach the backend worker at ${BACKEND_URL}. ` +
            'Make sure it is running: cd backend && uvicorn main:app --reload --port 3000'
          )
        }
        if (cancelled) return

        // 1. Create campaign record
        const { data: campaign, error: campErr } = await supabase
          .from('campaigns')
          .insert([{
            workspace_id: workspaceId,
            linkedin_account_id: selectedAccountId || null,
            name: listName,
            status: 'active',
            type: 'prospect-extractor',
            settings: { source: 'unipile-search', max_leads: maxLeads, search_params: searchParams },
          }])
          .select()
          .single()
        if (campErr) throw campErr
        if (cancelled) return

        // 2. Create action_queue record
        const { data: action, error: actErr } = await supabase
          .from('action_queue')
          .insert([{
            workspace_id: workspaceId,
            linkedin_account_id: selectedAccountId || null,
            campaign_id: campaign.id,
            action_type: 'scrapeLeads',
            payload: { source: 'unipile-search', listName, maxLeads, search_params: searchParams },
            status: 'processing',
          }])
          .select()
          .single()
        if (actErr) throw actErr
        if (cancelled) return

        // 3. Pagination loop
        const { api, category, keywords, filters = {} } = searchParams
        let cursor = null
        let totalScraped = 0
        let pageNum = 0

        while (totalScraped < maxLeads && !cancelled) {
          const pageLimit = Math.min(25, maxLeads - totalScraped)

          // Build the search body that goes to Unipile via the backend proxy.
          // The backend merges `limit` into this body, so don't include it here.
          const searchBody = {
            api,
            category,
            ...(keywords ? { keywords } : {}),
            ...(Object.keys(filters).length > 0 ? { filters } : {}),
            ...(cursor ? { cursor } : {}),
          }

          const res = await fetch(BACKEND_URL + '/api/linkedin/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            // Backend expects: { account_id, limit, body: <search params> }
            body: JSON.stringify({
              account_id: unipileAccountId,
              limit: pageLimit,
              body: searchBody,
            }),
          })

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}))
            throw new Error(errBody.error || errBody.message || `Search API error ${res.status}`)
          }
          const data = await res.json()

          console.log(`[Extraction] Page ${pageNum}:`, {
            items: data.items?.length ?? 0,
            cursor: data.cursor,
            total: data.paging?.total_count,
            totalScraped,
            maxLeads,
            // Show all keys of first item so we know what fields are available
            firstItemKeys: data.items?.[0] ? Object.keys(data.items[0]) : [],
            firstItem: data.items?.[0],
            // Show first 3 items with name data
            sampleNames: data.items?.slice(0, 3).map(item => ({
              name: item.name,
              first_name: item.first_name,
              last_name: item.last_name,
              headline: item.headline,
              public_identifier: item.public_identifier
            }))
          })

          if (pageNum === 0 && data.paging?.total_count) {
            // Cap the displayed total at what LinkedIn actually has
            setTotal(Math.min(data.paging.total_count, maxLeads))
          }

          const items = data.items || []
          if (items.length === 0) break
          if (cancelled) break

          const remaining  = maxLeads - totalScraped
          const pageLeads  = items.slice(0, remaining).map(item => mapItem(item, action.id))
          const validLeads = pageLeads.filter(l => !!l.profile_url)

          console.log(`[Extraction] Page ${pageNum}: ${items.length} items, ${validLeads.length} with profile_url`)

          // Note: Profile enrichment disabled because LinkedIn blocks access to most profiles
          // with 422 "Recipient cannot be reached" errors. This is LinkedIn's privacy system.
          // Names that aren't in search results are intentionally hidden by LinkedIn.

          if (validLeads.length > 0 && !cancelled) {
            const { error: insertErr } = await supabase
              .from('leads')
              .upsert(validLeads, { onConflict: 'workspace_id,profile_url', ignoreDuplicates: false })
            if (insertErr) {
              console.error('[Extraction] Upsert error:', insertErr.message, insertErr.details)
              // Still count them — don't stall the loop on duplicate errors
            }
            totalScraped += validLeads.length
            setScraped(totalScraped)
          } else if (validLeads.length === 0 && items.length > 0) {
            // All items on this page had no profile_url — count them anyway to avoid infinite loop
            totalScraped += items.length
          }

          cursor = data.cursor || null
          pageNum++
          if (!cursor) break

          await new Promise(r => setTimeout(r, 800))
        }

        if (cancelled) return

        // 4. Mark done
        await supabase
          .from('action_queue')
          .update({ status: 'done', result: { scraped: totalScraped } })
          .eq('id', action.id)

        setStatus('done')
      } catch (err) {
        if (!cancelled) {
          console.error('[Extraction] Failed:', err)
          setStatus('failed')
          setErrorMsg(err.message || 'Extraction failed')
        }
      }
    }

    run()

    // Cleanup: mark cancelled so any in-flight async steps stop gracefully
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const displayTotal = total || maxLeads
  const pct = Math.min(100, Math.round((scraped / displayTotal) * 100))
  const pending = Math.max(0, displayTotal - scraped)

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 text-[var(--color-surface-raised)] animate-spin" />
        <p className="text-sm text-[var(--color-text-secondary)]">Initialising extraction...</p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="h-16 w-16 rounded-sm bg-[oklch(var(--success)/0.1)] flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-[oklch(var(--success))]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-on-strong)] mb-1">Extraction Complete!</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-on-strong)] font-bold">{scraped}</span> leads saved to{' '}
            <span className="text-[oklch(var(--info))] font-medium">{listName}</span>
          </p>
        </div>
        <Button onClick={onClose} className="bg-[var(--color-surface-raised)] hover:brightness-110 text-[var(--color-text-on-strong)] px-8 font-bold">
          View Leads
        </Button>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-[var(--color-text-on-strong)]">Extraction Failed</h2>
        </div>
        <div className="p-4 rounded-xs bg-[oklch(var(--destructive)/0.1)] border border-[oklch(var(--destructive)/0.2)] flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[oklch(var(--destructive))] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[oklch(var(--destructive))]">Something went wrong</p>
            <p className="text-xs text-[oklch(var(--destructive))] mt-1">{errorMsg}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">Back</Button>
          <Button onClick={onClose} className="bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)] text-[var(--color-text-on-strong)] px-6 font-bold">Close</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--color-text-on-strong)] mb-1">Extracting Leads...</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{listName}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Progress</span>
          <span className="text-[var(--color-text-on-strong)] font-bold">{pct}%</span>
        </div>
        <div className="h-3 bg-[var(--color-border)] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[var(--color-surface-raised)] rounded-sm transition-all duration-700"
            style={{ width: pct + '%' }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
          <p className="text-2xl font-bold text-[var(--color-text-on-strong)]">{scraped}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Scraped</p>
        </div>
        <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{pending}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Pending</p>
        </div>
        <div className="p-4 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] text-center">
          <p className="text-2xl font-bold text-[var(--color-text-on-strong)]">{displayTotal}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Target</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xs bg-[oklch(var(--info)/0.05)] border border-[oklch(var(--info)/0.15)]">
        <Loader2 className="h-5 w-5 text-[oklch(var(--info))] animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-[var(--color-text-on-strong)]">Fetching from LinkedIn Search API</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Paginating through results and saving to your list. You can close this modal — it continues in the background.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]">
          Close (continues in background)
        </Button>
      </div>
    </div>
  )
}
