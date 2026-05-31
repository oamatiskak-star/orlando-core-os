import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildContinuePrompt, type ContinuePromptContext } from '@/lib/continue-prompt'

export const dynamic = 'force-dynamic'

// Worktree → host. Aquier-werk draait op CLI-R (worker, capability aquier-product);
// de rest (orlando-core-os) op CLI-L (orchestrator).
function resolveTarget(ctx: ContinuePromptContext): { machine_id: string; worktree_path: string; repo: string } {
  const hay = `${ctx.company ?? ''} ${ctx.tracker ?? ''} ${ctx.name ?? ''} ${ctx.route ?? ''}`.toLowerCase()
  const isAquier = /aquier|aquire|vastgoedscapler|modiwe software/.test(hay)
  return isAquier
    ? { machine_id: 'cli-r', worktree_path: '~/Code/vastgoedscapler-saas', repo: 'oamatiskak-star/aquire' }
    : { machine_id: 'cli-l', worktree_path: '~/Code/orlando-core-os', repo: 'oamatiskak-star/orlando-core-os' }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const ctx = body.context as ContinuePromptContext | undefined
  if (!ctx || !ctx.name) {
    return NextResponse.json({ error: 'context vereist' }, { status: 400 })
  }

  const admin = createAdminClient()
  let target = resolveTarget(ctx)

  // Voorrang: een bestaande sessie op exact deze worktree (juiste host + pad + tmux).
  const { data: sess } = await admin
    .from('osm_sessions')
    .select('machine_id, worktree_path')
    .ilike('entity', `%${ctx.name}%`)
    .in('status', ['active', 'paused', 'context_full', 'crashed'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sess?.machine_id && sess.worktree_path) {
    target = { ...target, machine_id: sess.machine_id, worktree_path: sess.worktree_path }
  }

  const machine = (body.machine_override === 'cli-l' || body.machine_override === 'cli-r')
    ? body.machine_override : target.machine_id

  // Mobiel herkennen: expliciete client-vlag heeft voorrang, anders User-Agent.
  const ua = req.headers.get('user-agent') ?? ''
  const fromMobile = typeof body.from_mobile === 'boolean'
    ? body.from_mobile
    : /iphone|ipad|android|mobile/i.test(ua)

  const prompt = buildContinuePrompt(ctx)

  // Bij mobiel: named tmux-sessie zodat iTerm2 (host) én Terminus (iPhone) hetzelfde
  // venster delen. Terminus-link om vanaf de telefoon direct te koppelen.
  const tmuxSession = fromMobile ? `resume-${Math.abs(hashStr(ctx.name + machine)).toString(36).slice(0, 6)}` : null
  const terminusLink = fromMobile ? `ssh://${machine}` : null

  const { data, error } = await admin
    .from('osm_terminal_commands')
    .insert({
      machine_id: machine,
      worktree_path: target.worktree_path,
      repo: target.repo,
      action: 'open_claude_resume',
      prompt,
      build_id: typeof body.build_id === 'string' ? body.build_id : null,
      title: ctx.name,
      from_mobile: fromMobile,
      tmux_session: tmuxSession,
      terminus_link: terminusLink,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true, id: data.id, machine_id: machine, worktree_path: target.worktree_path,
    from_mobile: fromMobile, tmux_session: tmuxSession, terminus_link: terminusLink,
    attach_cmd: tmuxSession ? `ssh ${machine} -t 'tmux attach -t ${tmuxSession}'` : null,
  })
}

// Stabiele hash voor een korte, deterministische tmux-sessienaam.
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return h
}
