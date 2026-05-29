import { Terminal, Wrench, PlayCircle, Activity, FolderGit2, Cpu, MessageCircle, ArrowRightCircle } from 'lucide-react'

type Cmd = {
  cmd: string
  desc: string
  example?: string
}

type Group = {
  title: string
  icon: typeof Terminal
  intro?: string
  items: Cmd[]
}

const GROUPS: Group[] = [
  {
    title: 'In Claude (skills)',
    icon: Cpu,
    intro: 'Typ deze in Claude Code zelf — geen shell nodig.',
    items: [
      { cmd: '/ga-verder',  desc: 'Hervat exact waar vorige sessie eindigde (na crash of context-limit). Leest osm_sessions + lokale context md.' },
      { cmd: '/handoff',    desc: 'Expliciete checkpoint: schrijft rijke summary naar Supabase + ~/OSM_STATE/contexts/<ENTITY>.md. Status → paused.' },
    ],
  },
  {
    title: 'Dagelijks gebruik',
    icon: PlayCircle,
    items: [
      { cmd: 'ga-verder',           desc: 'Shell-equivalent van /ga-verder. Toont waar je gebleven was.', example: 'ga-verder' },
      { cmd: 'ga-verder --json',    desc: 'Alleen JSON van laatste sessie (gebruikt door de /ga-verder skill).' },
      { cmd: 'ga-verder --reactivate', desc: 'Flip latest crashed/context_full row terug naar active.' },
      { cmd: 'osm-status',          desc: 'Huidige sessie + Supabase connectivity + queue depth.', example: 'osm-status' },
      { cmd: 'osm-attach',          desc: 'Attach (of create) persistent tmux session met OSM windows. iTerm-CC of plain attach afhankelijk van context.' },
      { cmd: 'osm-bootstrap-layout', desc: 'Voeg OSM windows (claude/aquier/media/buildtracker) toe aan huidige tmux. Idempotent.' },
    ],
  },
  {
    title: 'Worktrees',
    icon: FolderGit2,
    intro: 'Eén worktree per actieve taak. Geen branch-chaos.',
    items: [
      { cmd: 'osm-worktree new <ENTITY> <slug>', desc: 'Maakt ~/WORKTREES/<ENTITY>/<slug> op nieuwe branch task/<slug>, vanaf huidige git-repo HEAD. Upsert osm_sessions rij.', example: 'osm-worktree new AQUIER ai-lead-fix' },
      { cmd: 'osm-worktree done <ENTITY> <slug>', desc: 'Verwijdert worktree + branch (na dirty/merged check). Status → done.' },
      { cmd: 'osm-worktree list',                 desc: 'Toon alle worktrees met branch + dirty count.' },
      { cmd: 'osm-worktree open <ENTITY> <slug>', desc: 'Print het pad (handig in shell: cd $(osm-worktree open ENT slug)).' },
    ],
  },
  {
    title: 'Monitoring & recovery',
    icon: Activity,
    items: [
      { cmd: 'osm-watchdog-status', desc: 'Toon launchd status + recente watchdog events + open incidents.' },
      { cmd: 'osm-flush-queue',     desc: 'Handmatige retry van gequeude Supabase writes (queue/ map).' },
      { cmd: 'launchctl start com.osm.watchdog', desc: 'Forceer één extra watchdog run (handig om alerts te testen).' },
      { cmd: 'launchctl start com.osm.flush-queue', desc: 'Forceer één extra queue-flush run.' },
    ],
  },
  {
    title: 'Eenmalige setup (per machine)',
    icon: Wrench,
    items: [
      { cmd: 'osm-init',               desc: 'Eerste setup: zet machine_id + Supabase creds in keychain.' },
      { cmd: 'osm-install-hooks',      desc: 'Registreer Claude hooks (UserPromptSubmit/PostToolUse/Stop) in ~/.claude/settings.json.' },
      { cmd: 'osm-install-tmux',       desc: 'Installeer TPM + tmux-resurrect + tmux-continuum, source OSM config in ~/.tmux.conf.' },
      { cmd: 'osm-install-watchdog',   desc: 'Installeer launchd agent voor watchdog (60s tick).' },
      { cmd: 'osm-install-flush-agent', desc: 'Installeer launchd agent voor queue flush (5min tick).' },
      { cmd: 'osm-install-fase2',      desc: 'Orchestreert tmux + zshrc fix + mosh + bootstrap layout (interactief, per stap).' },
      { cmd: 'osm-fix-zshrc-mobile',   desc: 'Surgical fix voor de mobile-nieuwe-window-per-connect bug in ~/.zshrc.' },
      { cmd: 'osm-install-mosh',       desc: 'brew install mosh + firewall-instructies.' },
      { cmd: 'osm-configure-notify',   desc: 'Stelt eigen OSM_NTFY_TOPIC in ~/OSM_STATE/notify.env (los van tmux bell topic).' },
      { cmd: 'osm-replicate-to <user@host>', desc: 'rsync OSM_CORE naar CLI_R (of andere machine), chmod + symlink. Daarna remote osm-init.', example: 'osm-replicate-to bouwproffsnederlandbv@cli-r.local' },
    ],
  },
  {
    title: 'Skills (in Claude Code)',
    icon: MessageCircle,
    items: [
      { cmd: '/ga-verder',  desc: 'Resume vorige sessie — werkt vanuit verse claude na crash/limit.' },
      { cmd: '/handoff',    desc: 'Expliciete checkpoint vóór sessie-einde.' },
    ],
  },
  {
    title: 'Dashboard routes',
    icon: ArrowRightCircle,
    items: [
      { cmd: '/dashboard/osm/sessions',     desc: 'Alle live OSM sessies per machine, met klik door naar detail.' },
      { cmd: '/dashboard/osm/sessions/[id]', desc: 'Sessie-detail: summary, todos, files, events log.' },
      { cmd: '/dashboard/osm/worktrees',    desc: 'Alle actieve worktrees uit osm_sessions.' },
      { cmd: '/dashboard/osm/commands',     desc: 'Deze referentie.' },
      { cmd: '/dashboard/build-tracker',    desc: 'Build tracker — bovenaan de live "Ga verder" card met realtime updates.' },
    ],
  },
]

export default function OsmCommandsPage() {
  return (
    <div className="space-y-5">
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <p className="text-[11px] text-white/55 leading-relaxed">
          Volledig commando-overzicht voor OSM. Shell-commando&apos;s leven in{' '}
          <code className="text-emerald-400/90">~/.local/bin/</code> (symlinks naar{' '}
          <code className="text-emerald-400/90">~/OSM_CORE/scripts/</code>). Skills leven in{' '}
          <code className="text-emerald-400/90">~/.claude/skills/</code>.
        </p>
      </div>

      {GROUPS.map((g) => {
        const Icon = g.icon
        return (
          <div key={g.title} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={12} className="text-emerald-400" />
              <h3 className="text-[12px] font-semibold text-white/85">{g.title}</h3>
            </div>
            {g.intro && <p className="text-[11px] text-white/45 mb-3">{g.intro}</p>}
            <div className="space-y-1.5">
              {g.items.map((item) => (
                <div key={item.cmd} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                  <code className="md:col-span-4 text-[11px] text-emerald-400/95 font-mono break-all">
                    {item.cmd}
                  </code>
                  <p className="md:col-span-8 text-[11px] text-white/70 leading-relaxed">
                    {item.desc}
                    {item.example && (
                      <span className="block mt-1 text-[10px] text-white/40 font-mono">
                        e.g. {item.example}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl p-4 text-[10.5px] text-white/45 leading-relaxed">
        Docs op disk: <code className="text-emerald-400/90">~/OSM_CORE/docs/CLI_R_BOOTSTRAP.md</code> (paste-prompt voor tweede Mac Mini),{' '}
        <code className="text-emerald-400/90">~/OSM_CORE/docs/MANUAL_SETUP.md</code> (iTerm, mosh, Tailscale, ntfy, Hermes prep).
      </div>
    </div>
  )
}
