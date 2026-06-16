# Day 6 - Groq CLI Chatbot

A minimal multi-turn Node.js CLI chatbot using Groq's OpenAI-compatible chat completions API.
![alt text](<Screenshot 2026-06-16 094537.png>)
## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```bash
GROQ_API_KEY=your_key_here
```

Start the chatbot:

```bash
npm start
```

Type your message after `You:`.

Type `exit` or `quit` to stop the chatbot.

The CLI colors message types: user prompts are cyan, Groq replies are green, errors are red, and status text is gray.
