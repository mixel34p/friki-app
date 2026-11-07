import { Link } from 'react-router-dom'
import { findMentions } from '../lib/mentions'
import './Mentions.css'

export default function MentionText({ text, mentions = [], fallbackToPost }) {
  const profiles = new Map(mentions.map(mention => [mention.username.toLowerCase(), mention]))
  const parts = []
  let cursor = 0
  for (const match of findMentions(text)) {
    const mention = profiles.get(match.username.toLowerCase())
    if (!mention?.profile?.username) continue
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start) })
    parts.push({ text: text.slice(match.start, match.end), username: mention.profile.username })
    cursor = match.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts.map((part, index) => part.username
    ? <Link key={index} className="post-mention-link" to={`/profile/${encodeURIComponent(part.username)}`} onClick={event => event.stopPropagation()}>{part.text}</Link>
    : fallbackToPost ? <Link key={index} className="post-plain-text-link" to={fallbackToPost}>{part.text}</Link> : part.text)
}
