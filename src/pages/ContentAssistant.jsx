import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ThumbsUp, MessageCircle, Share2, Plus, Loader2, ChevronDown, ChevronUp,
  Building2, User, Sparkles,
} from 'lucide-react'
import { formatDistanceToNow, isValid } from 'date-fns'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import {
  useMyPosts,
  useCompanyPosts,
  usePostComments,
  useCreatePost,
  useCommentOnPost,
  useReactToPost,
} from '@/hooks/useUnipilePosts'

const safeDate = (d) => {
  try {
    const date = new Date(d)
    if (!isValid(date)) return ''
    return formatDistanceToNow(date, { addSuffix: true })
  } catch { return '' }
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------
function PostCard({ post, accountId }) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  const { data: comments = [], isLoading: loadingComments } = usePostComments(
    accountId,
    // Unipile requires social_id for comment operations, not the regular id
    showComments ? (post.social_id ?? post.id) : null
  )
  const commentMutation = useCommentOnPost()
  const reactMutation = useReactToPost()

  const handleComment = async () => {
    if (!commentText.trim()) return
    // Use social_id for comment operations per Unipile docs
    await commentMutation.mutateAsync({ accountId, postId: post.social_id ?? post.id, text: commentText })
    setCommentText('')
  }

  const handleReact = () => {
    // Use social_id for reaction operations per Unipile docs
    reactMutation.mutate({ accountId, postId: post.social_id ?? post.id, reactionType: 'LIKE' })
  }

  const text = post.text ?? post.content ?? ''
  const author = post.author ?? {}
  const date = post.parsed_datetime ?? post.date ?? null

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
      {/* Author */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-white/10 shrink-0">
          <AvatarImage src={author.profile_picture_url} />
          <AvatarFallback className="bg-purple-500/20 text-purple-400 text-sm">
            {(author.name ?? 'U')[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{author.name ?? 'You'}</p>
          <p className="text-[10px] text-[#94a3b8]">{safeDate(date)}</p>
        </div>
        {post.share_url && (
          <a
            href={post.share_url}
            target="_blank"
            rel="noreferrer"
            className="text-[#444] hover:text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Post text */}
      <p className="text-sm text-[#94a3b8] leading-relaxed whitespace-pre-line line-clamp-6">{text}</p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[10px] text-[#444] font-bold uppercase tracking-widest border-t border-white/5 pt-3">
        <span>{post.reaction_counter ?? 0} reactions</span>
        <span>{post.comment_counter ?? 0} comments</span>
        <span>{post.repost_counter ?? 0} reposts</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReact}
          disabled={reactMutation.isPending}
          className="h-8 text-[10px] font-bold uppercase tracking-widest text-[#444] hover:text-blue-400 hover:bg-blue-400/10 gap-1.5"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Like
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowComments(v => !v)}
          className="h-8 text-[10px] font-bold uppercase tracking-widest text-[#444] hover:text-purple-400 hover:bg-purple-400/10 gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Comment
          {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="space-y-3 border-t border-white/5 pt-3">
          {loadingComments ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#444]" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-[10px] text-[#444] text-center py-2">No comments yet</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[8px] bg-white/5">{(c.author?.name ?? 'U')[0]}</AvatarFallback>
                </Avatar>
                <div className="bg-white/5 rounded-xl px-3 py-2 flex-1">
                  <p className="text-[10px] font-bold text-white">{c.author?.name ?? 'User'}</p>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">{c.text ?? c.content ?? ''}</p>
                </div>
              </div>
            ))
          )}

          {/* Comment input */}
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="bg-white/5 border-white/10 text-sm h-9 text-white placeholder:text-[#444]"
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            />
            <Button
              size="sm"
              onClick={handleComment}
              disabled={!commentText.trim() || commentMutation.isPending}
              className="h-9 bg-purple-600 hover:bg-purple-500 text-white px-3"
            >
              {commentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ContentAssistant() {
  const [postText, setPostText] = useState('')
  const [viewMode, setViewMode] = useState('my') // 'my' | 'company'
  const [companyId, setCompanyId] = useState('')
  const [companyInput, setCompanyInput] = useState('')

  const { data: linkedInAccounts = [] } = useLinkedInAccounts()
  const activeAccount = linkedInAccounts.find(a => a.unipile_account_id)
  const accountId = activeAccount?.unipile_account_id ?? null

  const { data: myPosts = [], isLoading: loadingMyPosts } = useMyPosts(accountId)
  const { data: companyPosts = [], isLoading: loadingCompanyPosts } = useCompanyPosts(
    accountId,
    viewMode === 'company' ? companyId : null
  )
  const createPost = useCreatePost()

  const posts = viewMode === 'my' ? myPosts : companyPosts
  const isLoading = viewMode === 'my' ? loadingMyPosts : loadingCompanyPosts

  const handleCreatePost = async () => {
    if (!postText.trim() || !accountId) return
    await createPost.mutateAsync({ accountId, text: postText })
    setPostText('')
  }

  if (!accountId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Content Assistant</h2>
          <p className="text-[#94a3b8] text-sm mt-1">Manage your LinkedIn posts and engagement.</p>
        </div>
        <div className="flex items-center justify-center h-48 rounded-xl border border-white/5 bg-[#1e1e1e]">
          <p className="text-[#94a3b8] text-sm">Connect a LinkedIn account to use Content Assistant.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Content Assistant</h2>
          <p className="text-[#94a3b8] text-sm mt-1">Manage your LinkedIn posts and engagement.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'my' ? 'default' : 'outline'}
            onClick={() => setViewMode('my')}
            className="h-8 text-xs gap-1.5 border-white/10"
          >
            <User className="w-3.5 h-3.5" /> My Posts
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'company' ? 'default' : 'outline'}
            onClick={() => setViewMode('company')}
            className="h-8 text-xs gap-1.5 border-white/10"
          >
            <Building2 className="w-3.5 h-3.5" /> Company
          </Button>
        </div>
      </div>

      {/* Company ID input (only in company mode) */}
      {viewMode === 'company' && (
        <div className="flex gap-2">
          <Input
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            placeholder="Company LinkedIn identifier (e.g. 'microsoft')"
            className="bg-white/5 border-white/10 text-white placeholder:text-[#444] h-10"
          />
          <Button
            size="sm"
            onClick={() => setCompanyId(companyInput.trim())}
            disabled={!companyInput.trim()}
            className="h-10 bg-purple-600 hover:bg-purple-500 text-white"
          >
            Load
          </Button>
        </div>
      )}

      {/* Create post */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Create Post</p>
        </div>
        <Textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="What do you want to share with your network?"
          rows={4}
          className="bg-white/5 border-white/10 text-sm text-white placeholder:text-[#444] resize-none"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleCreatePost}
            disabled={!postText.trim() || createPost.isPending}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-10 px-6"
          >
            {createPost.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Publishing…</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> Publish Post</>
            )}
          </Button>
        </div>
      </div>

      {/* Posts list */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] whitespace-nowrap">
            {viewMode === 'my' ? 'Your Posts' : 'Company Posts'}
          </h3>
          <div className="h-px w-full bg-white/5" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-[#94a3b8]">
            No posts found.
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id ?? post.social_id} post={post} accountId={accountId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
