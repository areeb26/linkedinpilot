import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateAutomation, useUpdateAutomation } from "@/hooks/useAutomations"
import { useLinkedInAccounts } from "@/hooks/useLinkedInAccounts"
import { useCampaigns } from "@/hooks/useCampaigns"
import { Loader2, Zap, Save } from "lucide-react"

const automationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  linkedin_account_id: z.string().uuid("Please select a LinkedIn account"),
  trigger_type: z.enum(["post_comment", "post_reaction", "profile_view"]),
  action_type: z.enum(["send_message", "add_to_campaign"]),
  action_config: z.object({
    message_body: z.string().optional(),
    campaign_id: z.string().uuid().optional()
  })
})

export function AutomationConfigDrawer({ automation, onClose }) {
  const { data: accounts = [] } = useLinkedInAccounts()
  const { data: campaigns = [] } = useCampaigns()
  const createMutation = useCreateAutomation()
  const updateMutation = useUpdateAutomation()

  const isEditing = !!automation?.id

  const form = useForm({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "post_comment",
      action_type: "send_message",
      action_config: { message_body: "" }
    }
  })

  useEffect(() => {
    if (automation) {
      form.reset({
        name: automation.name || "",
        description: automation.description || "",
        linkedin_account_id: automation.linkedin_account_id || "",
        trigger_type: automation.trigger_type || "post_comment",
        action_type: automation.action_type || "send_message",
        action_config: automation.action_config || { message_body: "" }
      })
    }
  }, [automation, form])

  const onSubmit = async (data) => {
    if (isEditing) {
      await updateMutation.mutateAsync({ id: automation.id, ...data })
    } else {
      await createMutation.mutateAsync(data)
    }
    onClose()
  }

  return (
    <SheetContent className="sm:max-w-xl flex flex-col h-full bg-[#1e1e1e] border-l border-white/5">
      <SheetHeader className="pb-6 border-b border-white/5">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-4 mx-auto sm:mx-0">
          <Zap className="w-6 h-6 text-blue-400" />
        </div>
        <SheetTitle className="text-2xl font-bold tracking-tight">
          {isEditing ? "Edit Automation" : "Configure Automation"}
        </SheetTitle>
        <SheetDescription className="text-sm">
          Set up triggers and automated responses for your LinkedIn engagement.
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto py-8 space-y-8 custom-scrollbar">
        {/* Basic Info */}
        <section className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Automation Name</Label>
            <Input 
              {...form.register("name")} 
              placeholder="e.g. Respond to Latest Posts" 
              className="bg-white/5 border-white/10 h-11 text-white"
            />
            {form.formState.errors.name && <p className="text-[10px] text-red-400 font-bold uppercase">{form.formState.errors.name.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold">LinkedIn Account</Label>
            <Select 
              value={form.watch("linkedin_account_id")}
              onValueChange={(val) => form.setValue("linkedin_account_id", val)}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-11 text-white">
                <SelectValue placeholder="Select seat..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Trigger Config */}
        <section className="space-y-4 pt-4">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Trigger Mechanism</p>
          <div className="grid grid-cols-3 gap-3">
             {["post_comment", "post_reaction", "profile_view"].map(type => (
               <button
                 key={type}
                 type="button"
                 onClick={() => form.setValue("trigger_type", type)}
                 className={`p-4 rounded-xl border text-center transition-all ${
                   form.watch("trigger_type") === type 
                     ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 ring-1 ring-blue-500/20' 
                     : 'bg-white/5 border-white/5 text-[#444] hover:bg-white/10'
                 }`}
               >
                 <span className="text-[10px] font-bold uppercase tracking-tighter truncate">{type.replace('_', ' ')}</span>
               </button>
             ))}
          </div>
        </section>

        {/* Action Config */}
        <section className="space-y-6 pt-4">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Automation Action</p>
          
          <div className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Action Type</Label>
            <Select 
              value={form.watch("action_type")}
              onValueChange={(val) => form.setValue("action_type", val)}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                <SelectItem value="send_message">Send Auto-Reply</SelectItem>
                <SelectItem value="add_to_campaign">Enroll in Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.watch("action_type") === 'send_message' ? (
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Message Template</Label>
              <Textarea 
                {...form.register("action_config.message_body")}
                placeholder="Thanks for commenting! Just sent you a DM..." 
                className="bg-white/5 border-white/10 min-h-[120px] text-white leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Target Campaign</Label>
              <Select 
                value={form.watch("action_config.campaign_id")}
                onValueChange={(val) => form.setValue("action_config.campaign_id", val)}
              >
                <SelectTrigger className="bg-white/5 border-white/10 h-11 text-white">
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>
      </form>

      <SheetFooter className="pt-6 border-t border-white/5 bg-[#1e1e1e]">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onClose}
          className="text-[#444] hover:text-white"
        >
          Cancel
        </Button>
        <Button 
          onClick={form.handleSubmit(onSubmit)}
          disabled={createMutation.isPending || updateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
        >
          {(createMutation.isPending || updateMutation.isPending) ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEditing ? "Save Changes" : "Create Automation"}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
