import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ClusterOutputSchema = z.array(
  z.object({
    label: z.string().min(1).max(100),
    questionIds: z.array(z.string().uuid()).min(1),
  })
);

export async function clusterQuestions(questions) {
  if (questions.length === 0) return [];

  const prompt = `You are helping a TA organize student questions for office hours.

Here are the student questions, each with a UUID:
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

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
  });

  const rawText = response.text.trim();

  let parsed;
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON: ${rawText.substring(0, 200)}`);
  }

  const validation = ClusterOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(`Gemini returned invalid cluster structure: ${JSON.stringify(validation.error.flatten())}`);
  }

  const validIds = new Set(questions.map(q => q.id));
  const safeClusters = validation.data
    .map(cluster => ({
      ...cluster,
      questionIds: cluster.questionIds.filter(id => validIds.has(id)),
    }))
    .filter(cluster => cluster.questionIds.length > 0);

  return safeClusters;
}

export async function generateSummary(clusters) {
  if (clusters.length === 0) {
    return '# Office Hours Summary\n\nNo questions were answered this session.';
  }

  const prompt = `You are summarizing a CS office hours session for students to keep as a reference.

Here are the questions and answers from the session:

${clusters.map((c, i) => `### Topic ${i + 1}: ${c.label}
Student questions (${c.questions.length}):
${c.questions.map(q => `- ${q.student_name}: "${q.question_text}"`).join('\n')}
TA answer: ${c.answer}`).join('\n\n')}

Write a clean markdown study guide from this session. For each topic use exactly this structure:

## [Topic title]

**TA's answer:** [quote the TA's answer verbatim here]

**Explanation:** [expand on the TA's answer with a clearer, fuller explanation of the underlying concept]

Then end the document with a brief "## Key Takeaways" bullet list.
Start the document with "# Office Hours Summary" and one sentence describing what was covered overall.

Output only the markdown. No preamble or meta-commentary.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
  });

  return response.text.trim();
}
