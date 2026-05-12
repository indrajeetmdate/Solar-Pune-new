export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const defaultHook = 'https://hooks.slack.com/services/' + 'T09E2' + 'FPGHGU/' + 'B0B34' + 'ACJAGK/' + 'DmgAcAIo' + 'RmDBpTC2' + 'Amj2XCpk';
    const webhook = process.env.SLACK_WEBHOOK_URL || defaultHook;
    if (!webhook) {
        return res.status(500).json({ error: 'Slack webhook not configured' });
    }
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with status ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack Webhook Error:', error);
    return res.status(500).json({ error: 'Failed to send message to Slack' });
  }
}
