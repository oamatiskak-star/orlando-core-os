import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'
import { logger } from '../lib/logger'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type AttachmentAnalysis = {
  documentType: 'offerte' | 'factuur' | 'contract' | 'bouwtekening' | 'overig'
  extractedText: string
  extractedData: {
    supplier?: string
    amount?: number
    date?: string
    vatNumber?: string
    invoiceNumber?: string
    dueDate?: string
    description?: string
    [key: string]: unknown
  }
  confidence: number
}

export class AttachmentAnalyzer {
  async analyzeAttachment(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<AttachmentAnalysis> {
    const filenameLower = filename.toLowerCase()

    const documentTypeFromName = this.detectTypeFromFilename(filenameLower)

    if (mimeType === 'application/pdf') {
      return this.analyzePdf(buffer, filename, documentTypeFromName)
    }

    if (mimeType.startsWith('image/')) {
      return this.analyzeImageByContext(filename, mimeType, documentTypeFromName)
    }

    return {
      documentType: documentTypeFromName,
      extractedText: '',
      extractedData: {},
      confidence: 0.3,
    }
  }

  private detectTypeFromFilename(filename: string): AttachmentAnalysis['documentType'] {
    if (filename.includes('factuur') || filename.includes('invoice') || filename.includes('rekening')) {
      return 'factuur'
    }
    if (filename.includes('offerte') || filename.includes('quote') || filename.includes('aanbieding')) {
      return 'offerte'
    }
    if (filename.includes('contract') || filename.includes('overeenkomst') || filename.includes('agreement')) {
      return 'contract'
    }
    if (filename.includes('tekening') || filename.includes('plattegrond') || filename.includes('dwg') || filename.includes('plan')) {
      return 'bouwtekening'
    }
    return 'overig'
  }

  private async analyzePdf(
    buffer: Buffer,
    filename: string,
    hintType: AttachmentAnalysis['documentType']
  ): Promise<AttachmentAnalysis> {
    let extractedText = ''

    try {
      const parsed = await pdfParse(buffer)
      extractedText = parsed.text.substring(0, 4000)
    } catch (err) {
      logger.error('PDF parse failed', { err, filename })
    }

    if (!extractedText.trim()) {
      return {
        documentType: hintType,
        extractedText: '',
        extractedData: {},
        confidence: 0.2,
      }
    }

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Analyseer dit document en geef JSON terug:

Bestandsnaam: ${filename}
Verwacht type: ${hintType}
Tekst:
${extractedText}

Geef exact dit JSON:
{
  "documentType": "factuur|offerte|contract|bouwtekening|overig",
  "supplier": "<leverancier naam of null>",
  "amount": <bedrag in euros of null>,
  "date": "<datum YYYY-MM-DD of null>",
  "vatNumber": "<BTW nummer of null>",
  "invoiceNumber": "<factuurnummer of null>",
  "dueDate": "<vervaldatum YYYY-MM-DD of null>",
  "description": "<omschrijving van 50 tekens>",
  "confidence": <0.0-1.0>
}`,
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')

      const parsed = JSON.parse(jsonMatch[0])
      return {
        documentType: parsed.documentType ?? hintType,
        extractedText,
        extractedData: {
          supplier: parsed.supplier,
          amount: parsed.amount,
          date: parsed.date,
          vatNumber: parsed.vatNumber,
          invoiceNumber: parsed.invoiceNumber,
          dueDate: parsed.dueDate,
          description: parsed.description,
        },
        confidence: parsed.confidence ?? 0.7,
      }
    } catch (err) {
      logger.error('AI attachment analysis failed', { err, filename })
      return {
        documentType: hintType,
        extractedText,
        extractedData: {},
        confidence: 0.4,
      }
    }
  }

  private analyzeImageByContext(
    filename: string,
    mimeType: string,
    hintType: AttachmentAnalysis['documentType']
  ): AttachmentAnalysis {
    return {
      documentType: hintType,
      extractedText: '',
      extractedData: { filename, mimeType },
      confidence: 0.4,
    }
  }
}
