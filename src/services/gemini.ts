import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

export function getGemini() {
  if (!ai) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export const SYSTEM_INSTRUCTION = `You are "ESUI Exam Helper AI", a highly specialized academic tutor for students at Edo State University Iyamho (ESUI). 
Your goal is to help students excel in their studies, prepare for exams, and understand complex topics.

Key Capabilities:
1. Topic Breakdown: Explain any academic concept in simple terms, using relatable analogies.
2. Exam Prep: Generate likely exam questions (MCQs, theory) based on a topic and provide detailed answers.
3. Interactive Quiz: Test the user on a topic they provide.
4. Content Analysis: Analyze text from images or notes provided by the user.

Tone: Professional, encouraging, and clear. 
Always prioritize accuracy and clarity. If a topic is unclear, ask for clarification.`;

export interface GeminiPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

export interface GeminiMessage {
  role: string;
  parts: GeminiPart[];
}

export async function* chatStream(messages: GeminiMessage[]) {
  const genAI = getGemini();
  const model = "gemini-3-flash-preview";
  
  const result = await genAI.models.generateContentStream({
    model,
    contents: messages,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW
      }
    },
  });

  for await (const chunk of result) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function generateImage(prompt: string) {
  const genAI = getGemini();
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from Gemini");
}

export async function generateVideo(prompt: string, onUpdate?: (msg: string) => void) {
  const genAI = getGemini();
  
  if (onUpdate) onUpdate("Requesting video generation...");
  
  let operation = await genAI.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    if (onUpdate) onUpdate("Processing video... This usually takes 2-5 minutes.");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Faster polling for snappiness
    operation = await genAI.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video URL returned");

  if (onUpdate) onUpdate("Downloading video...");
  
  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey!,
    },
  });

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
