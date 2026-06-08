// Unit-tests voor de Hermes command-parser.
// Draaien (dependency-vrij, gebruikt de reeds geïnstalleerde typescript):
//   npm run test:hermes
// (compileert dit bestand + command-router.ts naar .test-tmp/ en draait `node --test`).

import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCommand, detectHosts } from './command-router'

test('detectHosts herkent losse + gecombineerde hosts', () => {
  assert.deepEqual(detectHosts('cli-l'), ['cli-l'])
  assert.deepEqual(detectHosts('CLI L'), ['cli-l'])
  assert.deepEqual(detectHosts('cli r'), ['cli-r'])
  assert.deepEqual(detectHosts('ga verder op CLI L en CLI R'), ['cli-l', 'cli-r'])
  assert.deepEqual(detectHosts('beide hosts'), ['cli-l', 'cli-r'])
  assert.deepEqual(detectHosts('niets relevants'), [])
})

test('"Ga verder op CLI L en CLI R" → resume, beide hosts', () => {
  const c = parseCommand('Ga verder op CLI L en CLI R')
  assert.equal(c.kind, 'resume')
  assert.deepEqual(c.hosts, ['cli-l', 'cli-r'])
})

test('"Hervat Claude Code sessies" → resume, default beide hosts', () => {
  const c = parseCommand('Hervat Claude Code sessies')
  assert.equal(c.kind, 'resume')
  assert.deepEqual(c.hosts, ['cli-l', 'cli-r'])
})

test('"Wat is de status van CLI L?" → host_status, cli-l', () => {
  const c = parseCommand('Wat is de status van CLI L?')
  assert.equal(c.kind, 'host_status')
  assert.deepEqual(c.hosts, ['cli-l'])
})

test('"status" zonder host → host_status, geen specifieke host', () => {
  const c = parseCommand('status')
  assert.equal(c.kind, 'host_status')
  assert.deepEqual(c.hosts, [])
})

test('"Wat blokkeert omzet vandaag?" → revenue_blockers', () => {
  assert.equal(parseCommand('Wat blokkeert omzet vandaag?').kind, 'revenue_blockers')
  assert.equal(parseCommand('wat blokkeert de lancering').kind, 'revenue_blockers')
})

test('"Start Fase A" → start_phase met titel "Fase A"', () => {
  const c = parseCommand('Start Fase A')
  assert.equal(c.kind, 'start_phase')
  assert.equal(c.title, 'Fase A')
})

test('"Start COPY_UX_FINAL_GATE" → start_phase met de gate als titel', () => {
  const c = parseCommand('Start COPY_UX_FINAL_GATE')
  assert.equal(c.kind, 'start_phase')
  assert.equal(c.title, 'COPY_UX_FINAL_GATE')
})

test('"Controleer Build Tracker" → build_tracker', () => {
  assert.equal(parseCommand('Controleer Build Tracker').kind, 'build_tracker')
})

test('"Welke taken staan open?" → open_tasks', () => {
  assert.equal(parseCommand('Welke taken staan open?').kind, 'open_tasks')
})

test('"Maak een taak aan voor CLI L: checkout testen" → create_task met titel + host', () => {
  const c = parseCommand('Maak een taak aan voor CLI L: checkout testen')
  assert.equal(c.kind, 'create_task')
  assert.deepEqual(c.hosts, ['cli-l'])
  assert.equal(c.title, 'checkout testen')
})

test('"Maak een taak aan voor CLI L" zonder titel → create_task, titel ontbreekt', () => {
  const c = parseCommand('Maak een taak aan voor CLI L')
  assert.equal(c.kind, 'create_task')
  assert.deepEqual(c.hosts, ['cli-l'])
  assert.equal(c.title, undefined)
})

test('"Zet CLI R in auditmodus" → audit_mode, cli-r', () => {
  const c = parseCommand('Zet CLI R in auditmodus')
  assert.equal(c.kind, 'audit_mode')
  assert.deepEqual(c.hosts, ['cli-r'])
})

test('"Onthoud dat de NL-launch op 3 juni is" → remember met memory-tekst', () => {
  const c = parseCommand('Onthoud dat de NL-launch op 3 juni is')
  assert.equal(c.kind, 'remember')
  assert.equal(c.memory, 'de NL-launch op 3 juni is')
})

test('"help" en "welke commando\'s" → help', () => {
  assert.equal(parseCommand('help').kind, 'help')
  assert.equal(parseCommand("welke commando's heb je?").kind, 'help')
})

test('onzin → unknown (en nooit een crash)', () => {
  const c = parseCommand('asdfqwerty blabla')
  assert.equal(c.kind, 'unknown')
  assert.equal(typeof c.understood, 'string')
})

test('lege input → unknown', () => {
  assert.equal(parseCommand('').kind, 'unknown')
  assert.equal(parseCommand('   ').kind, 'unknown')
})

test('"Hoe staan de uploads?" → uploads', () => {
  assert.equal(parseCommand('Hoe staan de uploads?').kind, 'uploads')
  assert.equal(parseCommand('uploadstatus').kind, 'uploads')
})

test('"Wat is er mis met de uploads?" → upload_problems', () => {
  assert.equal(parseCommand('Wat is er mis met de uploads?').kind, 'upload_problems')
  assert.equal(parseCommand('welke uploads zijn gefaald').kind, 'upload_problems')
  assert.equal(parseCommand('vastgelopen uploads').kind, 'upload_problems')
})

test('"Retry upload <id>" → retry_upload met id', () => {
  const id = '11111111-2222-3333-4444-555555555555'
  const c = parseCommand(`Retry upload ${id}`)
  assert.equal(c.kind, 'retry_upload')
  assert.equal(c.uploadId, id)
})

test('"probeer de upload opnieuw" zonder id → retry_upload, geen id', () => {
  const c = parseCommand('probeer de upload opnieuw')
  assert.equal(c.kind, 'retry_upload')
  assert.equal(c.uploadId, undefined)
})

test('"Research: ..." → web_research met query', () => {
  const c = parseCommand('Research: laatste NL-hypotheekrente juni 2026')
  assert.equal(c.kind, 'web_research')
  assert.equal(c.query, 'laatste NL-hypotheekrente juni 2026')
})

test('"zoek online naar X" → web_research', () => {
  const c = parseCommand('zoek online naar nieuwe Wet betaalbare huur')
  assert.equal(c.kind, 'web_research')
  assert.equal(c.query, 'nieuwe Wet betaalbare huur')
})

test('"perplexity ..." → web_research', () => {
  assert.equal(parseCommand('perplexity wat is de actuele AEX-stand').kind, 'web_research')
})
