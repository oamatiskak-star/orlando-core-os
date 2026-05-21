interface DraftContext {
  from_email: string
  subject: string
  body: string
  company?: string | null
  category?: string | null
  priority?: string
}

interface Template {
  subject_template: string
  body_template: string
  placeholder_hints?: Record<string, string> | null
}

interface FilledTemplate {
  subject: string
  body: string
}

export function extractPlaceholdersFromContext(
  context: DraftContext,
  placeholderKeys: string[]
): Record<string, string> {
  const extracted: Record<string, string> = {}

  const contextMapping: Record<string, string> = {
    company: context.company || '',
    email: context.from_email,
    from_email: context.from_email,
    subject: context.subject,
    body: context.body,
    category: context.category || '',
    priority: context.priority || '',
  }

  for (const key of placeholderKeys) {
    extracted[key] = contextMapping[key] || ''
  }

  return extracted
}

export function fillTemplate(
  template: Template,
  placeholders: Record<string, string>
): FilledTemplate {
  let subject = template.subject_template
  let body = template.body_template

  for (const [key, value] of Object.entries(placeholders)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    subject = subject.replace(pattern, value || '')
    body = body.replace(pattern, value || '')
  }

  return { subject, body }
}

export function extractPlaceholdersFromTemplate(template: Template): string[] {
  const combined = `${template.subject_template} ${template.body_template}`
  const matches = combined.match(/\{\{([^}]+)\}\}/g) || []
  return matches.map(m => m.replace(/[{}]/g, ''))
}
