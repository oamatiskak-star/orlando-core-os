import { redirect } from 'next/navigation'

// Ontvlecht: /financien was een parallel finance-dashboard naast /finance.
// Eén Finance & Incasso-ingang → doorverwijzing naar de Finance OS.
export default function FinancienRedirect() {
  redirect('/dashboard/finance')
}
