import { GoogleGenAI, Type } from "@google/genai";
import { SolutionData, SearchResult } from "../types";

// Helper to get base64 from file
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Solves the math/physics problem using Gemini 3 Pro (best for STEM reasoning).
 * Returns both the solution and a prompt suitable for Veo video generation.
 */
export const solveProblem = async (imageFile: File): Promise<SolutionData> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });
  
  const imagePart = await fileToGenerativePart(imageFile);

  const prompt = `
    You are a professional Mathematics Solver AI.
    Analyze the provided image which contains a math or physics problem.
    
    Your goal is to provide a solution that is beautifully formatted, step-by-step, and easy to follow.

    Perform the following tasks:
    
    1. **Solve the problem step-by-step.**
       The content of your solution MUST strictly follow these formatting rules:
       - Use **bold headings** for each step: **Step 1: Given**, **Step 2: Formula**, **Step 3: Substitution**, **Step 4: Simplification**, **Step 5: Final Answer**.
       - Use **LaTeX-style math** for ALL equations, wrapped in single dollar signs (e.g., $E = mc^2$).
       - Use **bullet points** for lists of given data.
       - Use **line breaks** between steps for clarity.
       - **Step 5** must explicitly contain the final answer in a boxed LaTeX format: $\\boxed{\\text{Answer} = ...}$.
       - Do NOT show internal reasoning or scratchpad thoughts in the solution text.
       - Do NOT output raw JSON or code blocks inside the solution text itself.
       
       Example format for the solution text:
       
       **Step 1: Given**
       • Mass ($m$) = 10 kg
       • Acceleration ($a$) = 5 m/s²

       **Step 2: Formula**
       $F = m \\cdot a$

       **Step 3: Substitution**
       $F = 10 \\cdot 5$

       **Step 4: Simplification**
       $F = 50$

       **Step 5: Final Answer**
       $\\boxed{F = 50 \\text{ N}}$

    2. **Extract the core concept for visualization.**
       Create a descriptive prompt for a video generation AI (Veo) to visualize the concept.
       (e.g., "Cinematic 3D render of a red ball rolling down a wooden inclined plane, physics simulation style").

    3. **Determine confidence.** ('High', 'Medium', 'Low')

    **RESPONSE FORMAT:**
    You must return a valid JSON object containing the formatted solution text.
    schema:
    {
      "solutionMarkdown": "The beautifully formatted solution string following the rules above...",
      "visualPrompt": "The video generation prompt...",
      "confidence": "High"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Strongest model for reasoning
      contents: {
        parts: [imagePart, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            solutionMarkdown: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
          },
          required: ['solutionMarkdown', 'visualPrompt', 'confidence']
        },
        // Enable thinking for better math reasoning
        thinkingConfig: { thinkingBudget: 4096 } 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as SolutionData;
  } catch (error) {
    console.error("Error solving problem:", error);
    throw error;
  }
};

/**
 * Generates a video using Veo based on the visual prompt derived from the solution.
 */
export const generateExplanationVideo = async (visualPrompt: string): Promise<string> => {
  // Ensure we have a fresh client for the potentially updated key
  const apiKey = process.env.API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });

  console.log("Starting video generation with prompt:", visualPrompt);

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview', // Fast preview for better UX
      prompt: visualPrompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Video generation status:", operation.metadata);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed or returned no URI");

    // We must append the API key to the download link as per documentation
    return `${videoUri}&key=${apiKey}`;

  } catch (error) {
    console.error("Error generating video:", error);
    throw error;
  }
};

/**
 * Performs a search using Google Search grounding.
 * Then verifies the result using a stronger model (Gemini 3 Pro) effectively acting as the "Verifier".
 */
export const performSearch = async (query: string): Promise<SearchResult> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Step 1: Search using Gemini 2.5 Flash with Grounding
    const searchResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Good for grounding/search
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const searchText = searchResponse.text || "No results found.";
    
    // Extract grounding chunks for sources
    const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = chunks
      .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
      .map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      }));

    // Deduplicate sources based on URI
    const uniqueSources = Array.from(new Map(webSources.map((s: {uri: string, title: string}) => [s.uri, s])).values()) as { uri: string; title: string }[];

    // Step 2: Verify the solution using a stronger model (Gemini 3 Pro)
    // "verify the solution in the backend using ChatGPT [Gemini 3 Pro] and print it"
    let verificationText = "";
    try {
      console.log("Verifying search result with AI...");
      
      const verificationResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          I searched for: "${query}"
          
          The search engine provided this answer:
          "${searchText}"
          
          Please verify this information. Is it accurate, complete, and relevant? 
          Provide a concise verification summary (max 3 sentences).
        `
      });

      verificationText = verificationResponse.text || "";
      console.log("--- SOLUTION VERIFICATION ---");
      console.log(verificationText);
      console.log("-----------------------------");

    } catch (verifyError) {
      console.warn("Verification step failed:", verifyError);
      verificationText = "Could not verify result at this time.";
    }

    return {
      text: searchText,
      webSources: uniqueSources,
      verification: verificationText
    };
  } catch (error) {
    console.error("Error performing search:", error);
    throw error;
  }
};

/**
 * Translates the provided text into the target language using Gemini.
 * Preserves LaTeX formatting and Markdown structure.
 */
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Translate the following technical/mathematical text to ${targetLanguage}.
    
    IMPORTANT INSTRUCTIONS:
    1. Do NOT translate any content inside LaTeX delimiters ($...$ or $$...$$). Math equations must remain exactly as they are.
    2. Maintain the exact Markdown structure (headers, bolding, lists).
    3. Translate the prose explanations naturally and accurately.
    4. Do NOT add any preamble or explanation, just return the translated markdown.
    
    Text to translate:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || text;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};