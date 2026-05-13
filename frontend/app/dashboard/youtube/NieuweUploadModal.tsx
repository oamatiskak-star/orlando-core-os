'use client'

import { useState } from 'react'
import { Plus, X, Upload } from 'lucide-react'
import { queueVideoUpload } from './actions'

interface Props {
  channels: { id: string; naam: string }[]
}

export default function NieuweUploadModal({ channels }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    await queueVideoUpload(formData)
    setLoading(false)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Plus size={13} />
        Upload toevoegen
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
          <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={15} className="text-red-400" />
                <h2 className="text-sm font-semibold text-white">Nieuwe Upload</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Kanaal</label>
                  <select name="channel_id" required
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50">
                    {channels.map(ch => (
                      <option key={ch.id} value={ch.id} className="bg-[#0d0d1a]">{ch.naam}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Titel</label>
                  <input name="title" required placeholder="Video titel"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50" />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Beschrijving</label>
                  <textarea name="description" rows={3} placeholder="Video beschrijving"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 resize-none" />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Bestandspad (server)</label>
                  <input name="file_path" required placeholder="/uploads/video.mp4"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 font-mono" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/65">Thumbnail pad</label>
                  <input name="thumbnail_path" placeholder="/uploads/thumb.jpg"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50 font-mono" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/65">Privacy</label>
                  <select name="privacy_status"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50">
                    <option value="private" className="bg-[#0d0d1a]">Privé</option>
                    <option value="unlisted" className="bg-[#0d0d1a]">Niet vermeld</option>
                    <option value="public" className="bg-[#0d0d1a]">Publiek</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Geplande publicatie (optioneel)</label>
                  <input name="scheduled_publish_at" type="datetime-local"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/50" />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-white/65">Tags (komma-gescheiden)</label>
                  <input name="tags" placeholder="vastgoed, investeren, rijkdom"
                    className="w-full bg-white/[0.09] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-red-500/50" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                  <Upload size={12} />
                  {loading ? 'Toevoegen…' : 'Toevoegen aan queue'}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 border border-white/10 text-white/50 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                  Annuleer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
