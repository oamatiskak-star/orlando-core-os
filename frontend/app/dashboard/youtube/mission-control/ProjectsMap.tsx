import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'

interface Project {
  id: string
  name: string
  description: string
  type: string
  status: string
  goal_description: string
  success_metrics: any[]
  channels: any[]
  clusters: any[]
  metadata: any
}

export default async function ProjectsMap() {
  const supabase = await createClient()

  const { data: projects, error } = await supabase
    .from('youtube_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-red-600">Error loading projects: {error.message}</p>
      </Card>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">Geen projecten gevonden</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {(projects as Project[]).map((project) => (
        <Card key={project.id} className="p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-bold">{project.name}</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  project.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : project.status === 'planning'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {project.status}
              </span>
            </div>
            <p className="text-gray-600">{project.description}</p>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">🎯 Doel</h3>
            <p className="text-gray-700">{project.goal_description}</p>
          </div>

          {/* Clusters */}
          {project.clusters && project.clusters.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">📊 Clusters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {project.clusters.map((cluster: any, idx: number) => (
                  <Card key={idx} className="p-4 bg-gray-50">
                    <h4 className="font-semibold mb-2">{cluster.name}</h4>
                    <ul className="text-sm space-y-1">
                      <li>📌 {cluster.channels} kanalen</li>
                      <li>🧪 {cluster.test_variable}</li>
                      <li>
                        {cluster.control
                          ? '✅ Controlegroep'
                          : '⚡ Test actief'}
                      </li>
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Success Metrics */}
          {project.success_metrics && project.success_metrics.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">📈 Succes Metreken</h3>
              <div className="space-y-3">
                {project.success_metrics.map((metric: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-blue-500 pl-3">
                    <p className="font-semibold text-sm">{metric.metric}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Doel: </span>
                        <span className="font-semibold">{metric.target}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Huidig: </span>
                        <span className="font-semibold">{metric.current}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {project.metadata && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">⚙️ Projectdetails</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Fases</p>
                  <p className="font-semibold">
                    {project.metadata.phases?.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Dagelijkse standup</p>
                  <p className="font-semibold">
                    {project.metadata.daily_standup_time || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Rapportage</p>
                  <p className="font-semibold">
                    {project.metadata.reporting_cadence || 'N/A'}
                  </p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <p className="text-gray-600">Agenten betrokken</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {project.metadata.key_agents?.map(
                      (agent: string, idx: number) => (
                        <span
                          key={idx}
                          className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold"
                        >
                          {agent}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
