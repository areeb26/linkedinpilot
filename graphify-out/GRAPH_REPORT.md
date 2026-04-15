# Graphify Report: linkedin-pilot

**Generated:** 1776253429.8776696

## Summary

| Metric | Value |
|--------|-------|
| Total Nodes | 320 |
| Total Edges | 721 |
| Communities | 32 |

## Node Types

- **index.ts**: 3
- **postcss.config.js**: 2
- **tailwind.config.js**: 2
- **getStartDate()**: 2
- **supabase.ts**: 2
- **Badge()**: 2
- **eslint.config.js**: 1
- **vite.config.js**: 1
- **build.js**: 1
- **loadEnv()**: 1
- **main()**: 1
- **useActionQueue.js**: 1
- **useActionQueue()**: 1
- **useAi.js**: 1
- **useSuggestReply()**: 1
- **useAutomations.js**: 1
- **useAutomations()**: 1
- **useCreateAutomation()**: 1
- **useUpdateAutomation()**: 1
- **useToggleAutomation()**: 1
- **useDeleteAutomation()**: 1
- **useCampaigns.js**: 1
- **useCampaigns()**: 1
- **useCampaign()**: 1
- **useCreateCampaign()**: 1
- **useUpdateCampaign()**: 1
- **useLaunchCampaign()**: 1
- **usePauseCampaign()**: 1
- **useDuplicateCampaign()**: 1
- **useDeleteCampaign()**: 1
- **useChartData.js**: 1
- **buildEmptyBuckets()**: 1
- **fetchChartData()**: 1
- **useChartData()**: 1
- **useDashboardStats.js**: 1
- **fetchStats()**: 1
- **useDashboardStats()**: 1
- **useLeads.js**: 1
- **useLeads()**: 1
- **useCreateLead()**: 1
- **useUpdateLead()**: 1
- **useDeleteLeads()**: 1
- **useImportLeads()**: 1
- **useWorkspaceConfig()**: 1
- **useScoreLeads()**: 1
- **useLinkedInAccounts.js**: 1
- **useLinkedInAccounts()**: 1
- **useAddAccount()**: 1
- **useUpdateAccount()**: 1
- **useToggleAccount()**: 1
- **useDeleteAccount()**: 1
- **useMessages.js**: 1
- **useConversations()**: 1
- **useThread()**: 1
- **useMarkRead()**: 1
- **useSendMessage()**: 1
- **useSetLabel()**: 1
- **useRealtime()**: 1
- **useTeam.js**: 1
- **useTeam()**: 1
- **useInvitations()**: 1
- **useInviteMember()**: 1
- **useRemoveMember()**: 1
- **useUsageStats.js**: 1
- **useUsageStats()**: 1
- **useWorkspace.js**: 1
- **useWorkspace()**: 1
- **useUpdateWorkspace()**: 1
- **useUpdateSettings()**: 1
- **gemini.js**: 1
- **invokeAI()**: 1
- **queryClient.js**: 1
- **supabase.js**: 1
- **utils.js**: 1
- **cn()**: 1
- **authStore.js**: 1
- **uiStore.js**: 1
- **workspaceStore.js**: 1
- **_graphify_check.py**: 1
- **_graphify_run.py**: 1
- **Graphify extraction runner for linkedin-pilot project**: 1
- **main.py**: 1
- **startup()**: 1
- **shutdown()**: 1
- **health()**: 1
- **ProcessRequest**: 1
- **BaseModel**: 1
- **process_endpoint()**: 1
- **run_action()**: 1
- **_setup_session()**: 1
- **_execute_action()**: 1
- **_log_failed_action()**: 1
- **Called by Supabase Edge Functions to trigger a single action.     Returns immedi**: 1
- **Authenticate the Playwright browser context for the given account.**: 1
- **Dispatch to the correct Playwright method based on action_type.**: 1
- **Log a failed action to both action_queue and actions_log (audit trail).**: 1
- **engine.py**: 1
- **LinkedInScraper**: 1
- **.__init__()**: 1
- **.init_browser()**: 1
- **._check_page_errors()**: 1
- **.set_cookies()**: 1
- **.login_with_credentials()**: 1
- **.scrape_profile()**: 1
- **.send_connection_request()**: 1
- **.send_message()**: 1
- **.scrape_leads_batch()**: 1
- **.close()**: 1
- **Internal helper to check for common LinkedIn blocking/errors.**: 1
- **Scrape leads from a LinkedIn search URL (Sales Navigator or regular search).**: 1
- **ai_parser.py**: 1
- **parse_scraped_text()**: 1
- **Uses Gemini Flash to extract structured JSON from raw scraped text.**: 1
- **crypto.py**: 1
- **decrypt_credentials()**: 1
- **encrypt_credentials()**: 1
- **Decrypts AES-GCM encrypted text used in LinkedPilot.     Format: iv_base64:conte**: 1
- **Encrypts text using AES-GCM to match LinkedPilot format.**: 1
- **db.py**: 1
- **get_supabase()**: 1
- **discovery.py**: 1
- **get_financial_info()**: 1
- **find_procurement_portals()**: 1
- **Retrieves financial info for a stock symbol using yfinance.**: 1
- **Finds recruitment/procurement portal URLs using DuckDuckGo.**: 1
- **exceptions.py**: 1
- **LinkedInError**: 1
- **Exception**: 1
- **ProfileNotFoundError**: 1
- **AccountRestrictedError**: 1
- **SessionExpiredError**: 1
- **ActionTimeoutError**: 1
- **ProxyError**: 1
- **Base exception for LinkedIn scraper errors.**: 1
- **Raised when a profile URL returns 404 or page not found text.**: 1
- **Raised when LinkedIn flags the account as restricted.**: 1
- **Raised when the session is no longer valid (redirected to login).**: 1
- **Raised when a specific automation action times out.**: 1
- **Raised when ScraperAPI or proxy fails.**: 1
- **logger.py**: 1
- **setup_logger()**: 1
- **background.ts**: 1
- **getStableId()**: 1
- **getCookieValue()**: 1
- **resolveProfile()**: 1
- **sendScrapeMessage()**: 1
- **saveLeadsViaEdgeFunction()**: 1
- **updateActionStatus()**: 1
- **checkPendingActions()**: 1
- **subscribeToQueue()**: 1
- **processAction()**: 1
- **fetchProfileData()**: 1
- **extractProfileFromVoyager()**: 1
- **syncInboxAcrossAllTabs()**: 1
- **saveMessagesToSupabase()**: 1
- **waitForNavigationAndRetry()**: 1
- **dashboard.ts**: 1
- **syncWorkspace()**: 1
- **interceptor.ts**: 1
- **initializeInterceptor()**: 1
- **linkedin.ts**: 1
- **randomDelay()**: 1
- **handleConnectionsData()**: 1
- **handleSearchData()**: 1
- **handleProfileData()**: 1
- **handleCommentsData()**: 1
- **handleReactionsData()**: 1
- **handleGroupEventData()**: 1
- **cleanProfileUrl()**: 1
- **pollBuffer()**: 1
- **normalizeCommenter()**: 1
- **normalizeProfile()**: 1
- **extractAvatar()**: 1
- **handleGraphQLData()**: 1
- **normalizeGraphQLSearchHit()**: 1
- **normalizeSearchHit()**: 1
- **waitForElement()**: 1
- **safeSendResponse()**: 1
- **handleAction()**: 1
- **fetchProfileViaAPI()**: 1
- **getProfileInfo()**: 1
- **autoScroll()**: 1
- **enrichLead()**: 1
- **scrapeLeads()**: 1
- **scrapeSearchResults()**: 1
- **scrapeComments()**: 1
- **scrapeReactions()**: 1
- **scrapeGroupMembers()**: 1
- **scrapeEventAttendees()**: 1
- **scrapeNetwork()**: 1
- **viewProfile()**: 1
- **sendConnectionRequest()**: 1
- **sendMessage()**: 1
- **getCsrfToken()**: 1
- **getVoyagerHeaders()**: 1
- **sendMessageViaAPI()**: 1
- **sendConnectionRequestViaAPI()**: 1
- **fetchConversationsViaAPI()**: 1
- **cors.ts**: 1
- **handleCors()**: 1
- **popup.tsx**: 1
- **handleConnect()**: 1
- **handleExtract()**: 1
- **handleFixConnection()**: 1
- **App.jsx**: 1
- **ProtectedRoute()**: 1
- **App()**: 1
- **main.jsx**: 1
- **ActivityChart.jsx**: 1
- **ActivityChart()**: 1
- **ImportModal.jsx**: 1
- **ImportModal()**: 1
- **StatCard.jsx**: 1
- **StatCard()**: 1
- **AccountCard.jsx**: 1
- **AccountCard()**: 1
- **ConnectAccountModal.jsx**: 1
- **ConnectAccountModal()**: 1
- **AutomationCard.jsx**: 1
- **AutomationCard()**: 1
- **AutomationConfigDrawer.jsx**: 1
- **AutomationConfigDrawer()**: 1
- **CampaignCard.jsx**: 1
- **CampaignCard()**: 1
- **StatBox()**: 1
- **ActionNode.jsx**: 1
- **ConditionNode.jsx**: 1
- **EndNode.jsx**: 1
- **TriggerNode.jsx**: 1
- **LeadExtractorWizard.jsx**: 1
- **LeadExtractorWizard()**: 1
- **SourceCard.jsx**: 1
- **SourceCard()**: 1
- **StepIndicator.jsx**: 1
- **StepIndicator()**: 1
- **AppShell.jsx**: 1
- **AppShell()**: 1
- **Header.jsx**: 1
- **WorkspaceDropdown()**: 1
- **UserAvatar()**: 1
- **Header()**: 1
- **Sidebar.jsx**: 1
- **UserInitials()**: 1
- **Sidebar()**: 1
- **BulkActionBar.jsx**: 1
- **BulkActionBar()**: 1
- **IcpConfigModal.jsx**: 1
- **IcpConfigModal()**: 1
- **LeadFilters.jsx**: 1
- **LeadFilters()**: 1
- **LeadTable.jsx**: 1
- **LeadTable()**: 1
- **avatar.jsx**: 1
- **badge.jsx**: 1
- **button.jsx**: 1
- **card.jsx**: 1
- **checkbox.jsx**: 1
- **dialog.jsx**: 1
- **DialogHeader()**: 1
- **DialogFooter()**: 1
- **dropdown-menu.jsx**: 1
- **DropdownMenuShortcut()**: 1
- **input.jsx**: 1
- **label.jsx**: 1
- **progress.jsx**: 1
- **select.jsx**: 1
- **separator.jsx**: 1
- **sheet.jsx**: 1
- **SheetHeader()**: 1
- **SheetFooter()**: 1
- **slider.jsx**: 1
- **switch.jsx**: 1
- **table.jsx**: 1
- **tabs.jsx**: 1
- **textarea.jsx**: 1
- **Auth.jsx**: 1
- **Auth()**: 1
- **CampaignBuilder.jsx**: 1
- **CampaignBuilder()**: 1
- **StepButton()**: 1
- **Campaigns.jsx**: 1
- **Campaigns()**: 1
- **ContentAssistant.jsx**: 1
- **ContentAssistant()**: 1
- **Dashboard.jsx**: 1
- **Dashboard()**: 1
- **InboundAutomations.jsx**: 1
- **InboundAutomations()**: 1
- **QuickStat()**: 1
- **Inbox.jsx**: 1
- **safeFormatDistance()**: 1
- **Inbox()**: 1
- **SentimentButton()**: 1
- **InfoRow()**: 1
- **LeadDatabase.jsx**: 1
- **LeadDatabase()**: 1
- **LeadExtractor.jsx**: 1
- **LeadExtractor()**: 1
- **LinkedInAccounts.jsx**: 1
- **LinkedInAccounts()**: 1
- **GlobalStat()**: 1
- **SafetyCard()**: 1
- **SkeletonAccount()**: 1
- **Settings.jsx**: 1
- **Settings()**: 1
- **SettingsTabTrigger()**: 1
- **WorkspaceSection()**: 1
- **TeamSection()**: 1
- **BillingSection()**: 1
- **UsageCard()**: 1
- **IntegrationsSection()**: 1
- **IntegrationCard()**: 1
- **WebhookAction()**: 1

## Communities

### Community 0 (6 nodes)
- `eslint_config_js`
- `globals`
- `config`
- `eslint_plugin_react`
- `eslint_plugin_react_hooks`
- ... and 1 more

### Community 1 (1 nodes)
- `postcss_config_js`

### Community 2 (1 nodes)
- `tailwind_config_js`

### Community 3 (4 nodes)
- `path`
- `vite_config_js`
- `plugin_react`
- `vite`

### Community 4 (3 nodes)
- `extension_build_js`
- `build_main`
- `build_loadenv`

### Community 5 (1 nodes)
- `extension_postcss_config_js`

### Community 6 (1 nodes)
- `extension_tailwind_config_js`

### Community 7 (57 nodes)
- `usecampaigns_usecampaigns`
- `usecampaigns_usedeletecampaign`
- `useteam_useremovemember`
- `src_hooks_useactionqueue_js`
- `react_query`
- ... and 5 more

### Community 8 (12 nodes)
- `usechartdata_buildemptybuckets`
- `src_hooks_store_uistore`
- `usechartdata_fetchchartdata`
- `usechartdata_getstartdate`
- `usedashboardstats_getstartdate`
- ... and 5 more

### Community 9 (3 nodes)
- `extension_lib_supabase_ts`
- `src_lib_supabase_js`
- `supabase_js`

... and 22 more communities

## Files

Graph files:
- `graphify-out/graph.json` - Full graph with communities
- `graphify-out/index.html` - Interactive D3.js visualization
- `graphify-out/communities.json` - Community assignments
