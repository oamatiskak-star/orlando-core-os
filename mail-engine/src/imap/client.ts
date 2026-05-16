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

  async listFolders(account: MailAccount): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.getBoxes('', (err, boxes) => {
          imap.end()
          if (err) return reject(err)
          const names: string[] = []
          function collect(tree: Imap.MailBoxes, prefix = '') {
            for (const [key, box] of Object.entries(tree)) {
              const full = prefix ? `${prefix}${box.delimiter ?? '/'}${key}` : key
              names.push(full)
              if (box.children) collect(box.children, full)
            }
          }
          collect(boxes)
          resolve(names)
        })
      })

      imap.once('error', reject)
      imap.connect()
    })
  }

  async ensureFolder(account: MailAccount, folderPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.openBox(folderPath, true, (openErr) => {
          if (!openErr) {
            // Folder exists
            imap.closeBox(false, () => imap.end())
            return resolve()
          }
          // Folder doesn't exist — create it
          imap.addBox(folderPath, (addErr) => {
            imap.end()
            if (addErr) {
              logger.warn('Could not create IMAP folder', { folder: folderPath, err: addErr })
              return resolve() // non-fatal
            }
            logger.info('IMAP folder created', { folder: folderPath, email: account.email })
            resolve()
          })
        })
      })

      imap.once('error', (err: Error) => {
        logger.warn('IMAP ensureFolder error', { err, folder: folderPath })
        resolve() // non-fatal
      })
      imap.connect()
    })
  }

  async moveMessage(
    account: MailAccount,
    uid: number,
    fromFolder: string,
    toFolder: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.openBox(fromFolder, false, (err) => {
          if (err) { imap.end(); return reject(err) }

          imap.move(uid, toFolder, (moveErr) => {
            imap.end()
            if (moveErr) {
              logger.warn('IMAP move failed', { uid, fromFolder, toFolder, err: moveErr })
              return resolve() // non-fatal
            }
            logger.info('IMAP message moved', { uid, fromFolder, toFolder })
            resolve()
          })
        })
      })

      imap.once('error', (err: Error) => {
        logger.warn('IMAP moveMessage error', { err })
        resolve() // non-fatal
      })
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
