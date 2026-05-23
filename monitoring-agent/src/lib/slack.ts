import axios from "axios";

export interface SlackMessage {
  channel?: string;
  blocks?: Array<any>;
  text?: string;
  attachments?: Array<any>;
}

export async function sendSlackNotification(
  webhook: string,
  message: string | SlackMessage,
  channel?: string
): Promise<void> {
  if (!webhook) {
    console.warn("[slack] No webhook configured, skipping notification");
    return;
  }

  try {
    const payload: SlackMessage =
      typeof message === "string"
        ? { text: message, channel }
        : { ...message, channel };

    await axios.post(webhook, payload);
    console.log("[slack] Notification sent successfully");
  } catch (error) {
    console.error("[slack] Error sending notification:", error);
  }
}

export async function sendSlackBlockMessage(
  webhook: string,
  blocks: Array<any>,
  channel?: string
): Promise<void> {
  if (!webhook) {
    console.warn("[slack] No webhook configured, skipping notification");
    return;
  }

  try {
    await axios.post(webhook, { blocks, channel });
    console.log("[slack] Block message sent successfully");
  } catch (error) {
    console.error("[slack] Error sending block message:", error);
  }
}
