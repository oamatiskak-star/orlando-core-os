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

  // Detecteer server delimiter, namespace-prefix en bestaande mappen
  async getServerInfo(account: MailAccount): Promise<{ delimiter: string; prefix: string; folders: string[] }> {
    return new Promise((resolve) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.getBoxes('', (err, boxes) => {
          imap.end()
          if (err) {
            resolve({ delimiter: '.', prefix: 'INBOX.', folders: [] })
            return
          }
          let delimiter = '.'
          const names: string[] = []
          function collect(tree: Imap.MailBoxes, serverPrefix = '') {
            for (const [key, box] of Object.entries(tree)) {
              const sep = box.delimiter ?? '.'
              delimiter = sep
              const full = serverPrefix ? `${serverPrefix}${sep}${key}` : key
              names.push(full)
              if (box.children) collect(box.children, full)
            }
          }
          collect(boxes)

          // Bepaal namespace prefix: als INBOX.Sent bestaat → prefix = 'INBOX.'
          const hasInboxChildren = names.some(n => n.startsWith('INBOX.') || n.startsWith('INBOX/'))
          const prefix = hasInboxChildren ? `INBOX${delimiter}` : ''
          resolve({ delimiter, prefix, folders: names })
        })
      })

      imap.once('error', () => resolve({ delimiter: '.', prefix: 'INBOX.', folders: [] }))
      imap.connect()
    })
  }

  async listFolders(account: MailAccount): Promise<string[]> {
    const { folders } = await this.getServerInfo(account)
    return folders
  }

  // Maakt één map aan. folderPath gebruikt altijd '/' als scheidingsteken — wordt intern omgezet.
  private async createSingleFolder(
    account: MailAccount,
    folderPath: string,
    delimiter: string,
    prefix = ''
  ): Promise<boolean> {
    const serverPath = prefix + (delimiter === '/' ? folderPath : folderPath.replace(/\//g, delimiter))
    return new Promise((resolve) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        // Check of map al bestaat
        imap.openBox(serverPath, true, (openErr) => {
          if (!openErr) {
            imap.closeBox(false, () => imap.end())
            return resolve(false) // al aanwezig
          }
          imap.addBox(serverPath, (addErr) => {
            imap.end()
            if (addErr) {
              logger.warn('Could not create IMAP folder', { folder: serverPath, err: addErr })
              return resolve(false)
            }
            logger.info('IMAP folder created', { folder: serverPath })
            resolve(true)
          })
        })
      })

      imap.once('error', () => resolve(false))
      imap.connect()
    })
  }

  // Maakt map + alle tussenliggende levels aan. folderPath = 'COMPANY/Category/Year'
  async ensureFolder(account: MailAccount, folderPath: string): Promise<void> {
    const { delimiter, prefix } = await this.getServerInfo(account)
    const parts = folderPath.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const partial = parts.slice(0, i).join('/')
      await this.createSingleFolder(account, partial, delimiter, prefix)
    }
  }

  // Zet logisch pad (COMPANY/Category/Year) om naar server pad
  async toServerPath(account: MailAccount, logicalPath: string): Promise<string> {
    const { delimiter, prefix } = await this.getServerInfo(account)
    return prefix + logicalPath.replace(/\//g, delimiter)
  }

  async moveMessage(
    account: MailAccount,
    uid: number,
    fromFolder: string,
    toFolder: string
  ): Promise<void> {
    const { delimiter, prefix } = await this.getServerInfo(account)
    // fromFolder is usually already a server path (INBOX, INBOX.Sent etc)
    const serverFrom = fromFolder
    // toFolder is a logical path COMPANY/Category/Year — prefix + convert
    const serverTo = prefix + toFolder.replace(/\//g, delimiter)

    return new Promise((resolve) => {
      const imap = new Imap(this.buildConfig(account))

      imap.once('ready', () => {
        imap.openBox(serverFrom, false, (err) => {
          if (err) { imap.end(); return resolve() }

          imap.move(uid, serverTo, (moveErr) => {
            imap.end()
            if (moveErr) {
              logger.warn('IMAP move failed', { uid, serverFrom, serverTo, err: moveErr })
              return resolve()
            }
            logger.info('IMAP message moved', { uid, serverFrom, serverTo })
            resolve()
          })
        })
      })

      imap.once('error', () => resolve())
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
