import Imap from 'node-imap'
import { simpleParser, ParsedMail } from 'mailparser'
import { MailAccount } from '../lib/supabase'
import { logger } from '../lib/logger'

export type ImapMessage = {
  uid: number
  parsedMail: ParsedMail
}

export class ImapClient {
  private buildConfig(account: MailAccount): Imap.Config {
    const host = account.imap_host!
    const port = account.imap_port ?? 993
    const user = account.imap_user ?? account.email
    const password = account.imap_pass_encrypted!

    return {
      host,
      port,
      tls: port === 993,
      tlsOptions: { rejectUnauthorized: false },
      user,
      password,
      connTimeout: 15000,
      authTimeout: 10000,
    }
  }

  async fetchUnread(account: MailAccount, limit = 50): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))
      const results: ImapMessage[] = []

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, _box) => {
          if (err) {
            imap.end()
            return reject(err)
          }

          imap.search(['UNSEEN'], (searchErr, uids) => {
            if (searchErr) {
              imap.end()
              return reject(searchErr)
            }

            if (!uids || uids.length === 0) {
              imap.end()
              return resolve([])
            }

            const limited = uids.slice(-limit)
            const fetch = imap.fetch(limited, { bodies: '', struct: true, markSeen: false })

            fetch.on('message', (msg, seqno) => {
              let uid = seqno
              const buffers: Buffer[] = []

              msg.on('attributes', (attrs) => {
                uid = attrs.uid ?? seqno
              })

              msg.on('body', (stream) => {
                stream.on('data', (chunk: Buffer) => buffers.push(chunk))
                stream.once('end', async () => {
                  try {
                    const raw = Buffer.concat(buffers)
                    const parsed = await simpleParser(raw)
                    results.push({ uid, parsedMail: parsed })
                  } catch (parseErr) {
                    logger.error('Failed to parse IMAP message', { parseErr, uid })
                  }
                })
              })
            })

            fetch.once('error', (fetchErr) => {
              logger.error('IMAP fetch error', { fetchErr })
            })

            fetch.once('end', () => {
              imap.end()
            })
          })
        })
      })

      imap.once('end', () => resolve(results))
      imap.once('error', (err: Error) => {
        logger.error('IMAP connection error', { err, email: account.email })
        reject(err)
      })

      imap.connect()
    })
  }

  async markRead(account: MailAccount, uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) { imap.end(); return reject(err) }

          imap.addFlags(uid, ['\\Seen'], (flagErr) => {
            imap.end()
            if (flagErr) return reject(flagErr)
            resolve()
          })
        })
      })

      imap.once('error', reject)
      imap.connect()
    })
  }

  async countUnread(account: MailAccount): Promise<number> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err) => {
          if (err) { imap.end(); return reject(err) }

          imap.search(['UNSEEN'], (searchErr, uids) => {
            imap.end()
            if (searchErr) return reject(searchErr)
            resolve(uids?.length ?? 0)
          })
        })
      })

      imap.once('error', reject)
      imap.connect()
    })
  }
}
