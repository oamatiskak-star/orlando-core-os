import * as path from 'path'
import * as fs from 'fs'
import { z } from 'zod'
import {
  TierSpecSchema, CountrySpecSchema, DeviceSpecSchema,
  StripeTestCardSchema, NegativeScenarioSchema,
  type TierSpec, type CountrySpec, type DeviceSpec,
  type StripeTestCard, type NegativeScenario,
} from '../types'

function loadJson<T>(filename: string, schema: z.ZodTypeAny): T {
  const candidates = [
    path.join(__dirname, filename),
    path.join(__dirname, '..', '..', 'src', 'specs', filename),
  ]
  let parsedContent: unknown = null
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      parsedContent = JSON.parse(raw)
      break
    }
  }
  if (parsedContent === null) {
    throw new Error(`Spec file not found in candidates: ${candidates.join(', ')}`)
  }
  return schema.parse(parsedContent) as T
}

export function loadTiers(): TierSpec[] {
  return loadJson<TierSpec[]>('tiers.json', z.array(TierSpecSchema))
}

export function loadCountries(): CountrySpec[] {
  return loadJson<CountrySpec[]>('countries.json', z.array(CountrySpecSchema))
}

export function loadDevices(): DeviceSpec[] {
  return loadJson<DeviceSpec[]>('devices.json', z.array(DeviceSpecSchema))
}

export function loadStripeTestCards(): StripeTestCard[] {
  return loadJson<StripeTestCard[]>('stripe-test-cards.json', z.array(StripeTestCardSchema))
}

export function loadNegativeScenarios(): NegativeScenario[] {
  return loadJson<NegativeScenario[]>('negative-scenarios.json', z.array(NegativeScenarioSchema))
}

export function loadChecks(): Record<string, string[]> {
  const candidates = [
    path.join(__dirname, 'checks.json'),
    path.join(__dirname, '..', '..', 'src', 'specs', 'checks.json'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string[]>
    }
  }
  throw new Error('checks.json not found')
}
