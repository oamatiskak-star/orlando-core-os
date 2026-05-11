import { Users, Upload, UserPlus } from 'lucide-react'

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Users size={16} className="text-pink-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">CRM</h1>
            <p className="text-xs text-white/30">Klanten, leads en contacten per bedrijf.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            <Upload size={13} />
            Contacten importeren
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            <UserPlus size={13} />
            Nieuw contact
          </button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Naam</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Bedrijf</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Laatste contact</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Users size={18} className="text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">Geen contacten gevonden</p>
                    <p className="text-[11px] text-white/20">Importeer bestaande contacten of voeg handmatig toe.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                        <Upload size={12} />
                        Contacten importeren
                      </button>
                      <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                        <UserPlus size={12} />
                        Nieuw contact
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
