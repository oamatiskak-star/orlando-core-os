import { redirect } from 'next/navigation'

// Opgevouwen in het canonieke Advocaat OS (sessie dashboard-rollout).
export default function Page() {
  redirect('/dashboard/advocaat/dossiers')
}
