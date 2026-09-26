'use client'

import Avatar from './Avatar'
import { timeAgo } from '@/lib/ui'
import type { Post } from '@/lib/types'

export default function PostCard({ post, liked, canLike, onLike }: { post: Post; liked: boolean; canLike: boolean; onLike: () => void }) {
  return (
    <article className="flex gap-3 px-1 py-4">
      <Avatar handle={post.handle} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[15px]">
          <span className="font-semibold">@{post.handle}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(post.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-[16px] leading-snug">{post.body}</p>
        <button
          aria-label={`${liked ? 'Liked' : 'Like'} post by @${post.handle}; ${post.likes} likes`}
          onClick={onLike}
          disabled={!canLike}
          aria-pressed={liked}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm tabular-nums transition-colors disabled:cursor-default"
          style={{ color: liked ? 'var(--like)' : 'var(--muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z" />
          </svg>
          {post.likes}
        </button>
      </div>
    </article>
  )
}
