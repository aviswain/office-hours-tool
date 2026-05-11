import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ClaudeOutputSchema = z.array(
  z.object({
    label: z.string().max(100),
    questionIds: z.array(z.string().uuid())
  })
);

export async function clusterQuestions(questions) {
  if (questions.length === 0) return [];

  const prompt = `You are helping a TA organize student questions for office hours.

Here are the student questions (each with an ID):
${questions.map(q => `ID: ${q.id}\nQuestion: ${q.question_text}`).join('\n\n')}

Group these questions into clusters of similar questions. Each cluster represents one distinct concept or confusion.

Respond ONLY with a valid JSON array. No explanation, no markdown, no code fences. Just the raw JSON array:
[
  {
    "label": "Short specific label describing the confusion (max 60 chars)",
    "questionIds": ["uuid1", "uuid2"]
  }
]

Rules:
- Every question ID from the input must appear in exactly one cluster
- If a question is unique, put it in its own cluster of one
- Labels must be specific, e.g. "Null pointer after function call" not "Pointer issue"
- Only use IDs that were provided to you — do not invent new ones`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const rawText = response.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${rawText.substring(0, 200)}`);
  }

  const validation = ClaudeOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(`Claude returned invalid cluster structure: ${JSON.stringify(validation.error.flatten())}`);
  }

  // Strip hallucinated IDs — only keep IDs that actually exist in our questions
  const validIds = new Set(questions.map(q => q.id));
  const safeClusters = validation.data
    .map(cluster => ({
      ...cluster,
      questionIds: cluster.questionIds.filter(id => validIds.has(id))
    }))
    .filter(cluster => cluster.questionIds.length > 0);

  return safeClusters;
}
