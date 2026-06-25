// Vercel serverless function — writes daily completion log to GitHub
// Called by the Mi Plan app whenever Kevin taps "Mark Done"
// Requires GITHUB_TOKEN env var in Vercel (repo contents: read+write)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  const { date, completed, episodes } = req.body;
  if (!date || !completed) return res.status(400).json({ error: 'Missing date or completed' });

  const TASK_NAMES = {
    audio:   'Language Transfer (audio)',
    content: 'Extra en Español (video)',
    reading: 'News in Slow Spanish (reading)',
    mily:    'Spanish with Mily',
  };

  const checklistLines = Object.entries(TASK_NAMES)
    .map(([id, name]) => `- [${completed.includes(id) ? 'x' : ' '}] ${name}`)
    .join('\n');

  const episodeLines = episodes
    ? `\n## Episode Progress\n- Language Transfer: episode ${episodes.lt || 1}\n- Extra en Español: episode ${episodes.ext || 1}\n`
    : '';

  const content = `# ${date}\n\n## Daily Checklist\n${checklistLines}\n${episodeLines}`;

  const owner = 'kevin-liner';
  const repo  = 'kevin-spanish';
  const path  = `logs/${date}.md`;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Get existing file SHA if it exists (needed for updates)
  let sha;
  try {
    const getRes = await fetch(apiBase, { headers });
    if (getRes.ok) { const d = await getRes.json(); sha = d.sha; }
  } catch {}

  const body = {
    message: `checkin: ${date}`,
    content: Buffer.from(content).toString('base64'),
    ...(sha ? { sha } : {}),
  };

  const writeRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!writeRes.ok) {
    const err = await writeRes.text();
    return res.status(500).json({ error: 'GitHub write failed', detail: err });
  }

  return res.status(200).json({ ok: true, path });
};
