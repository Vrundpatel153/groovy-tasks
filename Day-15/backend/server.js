import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import { saveMeeting, getMeetings } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from the parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!GROQ_API_KEY) {
  console.error('WARNING: GROQ_API_KEY is not defined in the environment variables.');
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Tool 1: extract_action_items
async function extract_action_items(transcript) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a precise data extractor. Extract action items from the provided meeting transcript.
Your response must be a valid JSON object with the following schema:
{
  "action_items": [
    {
      "task": "clear description of what needs to be done",
      "owner": "name/role of the assignee, or 'unspecified'",
      "deadline": "deadline or 'unspecified'"
    }
  ]
}
Strictly output JSON. Do not include any explanation or markdown formatting outside of the raw JSON.`
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.action_items || [];
  } catch (error) {
    console.error('Error in extract_action_items tool:', error);
    return [];
  }
}

// Tool 2: send_to_slack
async function send_to_slack(summary, actionItems) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('Slack Webhook URL is missing. Skipping Slack post.');
    return false;
  }

  try {
    // Format slack message text
    let text = `*📝 Meeting Summary & Action Items*\n\n`;
    text += `*Summary:*\n${summary}\n\n`;
    text += `*Action Items:*\n`;
    
    if (actionItems.length === 0) {
      text += `_None identified._\n`;
    } else {
      actionItems.forEach((item, index) => {
        text += `${index + 1}. *${item.task}* — *Owner:* _${item.owner}_ | *Deadline:* _${item.deadline}_\n`;
      });
    }

    const payload = {
      text,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📝 Meeting Summary & Action Items',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Summary:*\n${summary}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Action Items:*\n` + (actionItems.length === 0 
              ? `_None identified._` 
              : actionItems.map((item, idx) => `• *${item.task}* (Owner: _${item.owner}_, Deadline: _${item.deadline}_)`).join('\n'))
          }
        }
      ]
    };

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Slack API responded with status ${res.status}: ${errText}`);
    }

    return true;
  } catch (error) {
    console.error('Error in send_to_slack tool:', error);
    return false;
  }
}

// Agent Flow Endpoint
app.post('/summarize', async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
    return res.status(400).json({ error: 'Transcript is required.' });
  }

  try {
    // 1. Generate Concise Summary (3-5 sentences)
    const summaryResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional meeting summarizer. Generate a concise meeting summary of exactly 3 to 5 sentences. Focus on the core discussion topics, key decisions, and general outcomes.'
        },
        {
          role: 'user',
          content: transcript
        }
      ]
    });
    
    const summary = summaryResponse.choices[0].message.content.trim();

    // 2. Run extract_action_items tool
    const actionItems = await extract_action_items(transcript);

    // 3. Run send_to_slack tool
    const slackSent = await send_to_slack(summary, actionItems);

    // 4. Save record to local JSON DB
    const savedRecord = await saveMeeting({
      transcript,
      summary,
      actionItems,
      slackSent
    });

    // 5. Return JSON payload
    return res.json({
      summary,
      actionItems,
      slackSent,
      savedId: savedRecord.id
    });
  } catch (error) {
    console.error('Error during summarization flow:', error);
    return res.status(500).json({ error: 'Failed to process transcript.' });
  }
});

// History endpoint
app.get('/history', async (req, res) => {
  try {
    const meetings = await getMeetings();
    // Return sorted in descending order of timestamp (most recent first)
    const sorted = [...meetings].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.json(sorted);
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
