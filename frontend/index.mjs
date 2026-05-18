import { streamText } from 'ai'

const result = streamText({
  model: 'anthropic/claude-sonnet-4-6',
  prompt: 'Leg kwantumcomputing uit in eenvoudige termen.',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}

console.log()
