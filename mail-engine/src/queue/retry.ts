import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

type RetryTask = {
  id: string
  task_type: string
  payload: Record<string, unknown>
  status: string
  retry_count: number
  max_retries: number
  next_retry_at: string
  error_text: string | null
}

type TaskHandler = (payload: Record<string, unknown>) => Promise<void>

const handlers: Record<string, TaskHandler> = {}

export function registerTaskHandler(taskType: string, handler: TaskHandler): void {
  handlers[taskType] = handler
}

export class RetryQueue {
  async enqueue(taskType: string, payload: object, maxRetries = 5): Promise<void> {
    const { error } = await supabase.from('mail_retry_queue').insert({
      task_type: taskType,
      payload,
      max_retries: maxRetries,
      next_retry_at: new Date().toISOString(),
    })

    if (error) logger.error('Failed to enqueue task', { err: error, taskType })
  }

  async processQueue(): Promise<void> {
    const { data: tasks, error } = await supabase
      .from('mail_retry_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at')
      .limit(20)

    if (error) {
      logger.error('Failed to fetch retry queue', { err: error })
      return
    }

    for (const task of tasks as RetryTask[]) {
      await this.processTask(task)
    }
  }

  private async processTask(task: RetryTask): Promise<void> {
    await supabase
      .from('mail_retry_queue')
      .update({ status: 'processing' })
      .eq('id', task.id)

    const handler = handlers[task.task_type]
    if (!handler) {
      logger.warn('No handler registered for task type', { taskType: task.task_type })
      await supabase
        .from('mail_retry_queue')
        .update({ status: 'failed', error_text: `No handler for ${task.task_type}` })
        .eq('id', task.id)
      return
    }

    try {
      await handler(task.payload)
      await supabase
        .from('mail_retry_queue')
        .update({ status: 'done' })
        .eq('id', task.id)
      logger.info('Retry task completed', { taskType: task.task_type, id: task.id })
    } catch (err) {
      const newRetryCount = task.retry_count + 1
      const delay = Math.pow(2, newRetryCount) * 60 * 1000
      const nextRetry = new Date(Date.now() + delay).toISOString()

      if (newRetryCount >= task.max_retries) {
        await supabase
          .from('mail_retry_queue')
          .update({
            status: 'failed',
            retry_count: newRetryCount,
            error_text: String(err),
          })
          .eq('id', task.id)
        logger.error('Retry task permanently failed', {
          taskType: task.task_type,
          id: task.id,
          retries: newRetryCount,
        })
      } else {
        await supabase
          .from('mail_retry_queue')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            next_retry_at: nextRetry,
            error_text: String(err),
          })
          .eq('id', task.id)
        logger.warn('Retry task rescheduled', {
          taskType: task.task_type,
          id: task.id,
          nextRetry,
        })
      }
    }
  }
}
