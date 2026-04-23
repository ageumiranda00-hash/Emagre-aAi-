import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore();

// AI Setup
const getGeminiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "CHAVE_AQUI" || key.length < 10) return null;
  return key;
};

const getOpenAIKey = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "SUA_CHAVE_AQUI" || key === "123" || key.length < 10) return null;
  return key;
};

const ai = new GoogleGenAI({ apiKey: getGeminiKey() || "INVALID_KEY" });
const openai = new OpenAI({ apiKey: getOpenAIKey() || "INVALID_KEY" });

const callOpenAIFallback = async (params: any) => {
  if (getOpenAIKey() === null) {
    throw new Error("OPENAI_API_KEY_MISSING: A chave da OpenAI não está configurada ou é inválida nas configurações do projeto.");
  }
  const messages: any[] = [];
  
  if (params.config?.systemInstruction) {
    messages.push({ role: "system", content: params.config.systemInstruction });
  }

  const contents = Array.isArray(params.contents) ? params.contents : [params.contents];
  
  for (const content of contents) {
    const role = content.role === "model" ? "assistant" : "user";
    
    if (content.parts) {
      const parts = content.parts;
      if (parts.length === 1 && parts[0].text) {
        messages.push({ role, content: parts[0].text });
      } else {
        const openAiContent: any[] = [];
        for (const part of parts) {
          if (part.text) {
            openAiContent.push({ type: "text", text: part.text });
          } else if (part.inlineData) {
            openAiContent.push({
              type: "image_url",
              image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
            });
          }
        }
        messages.push({ role, content: openAiContent });
      }
    }
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
  });

  let text = response.choices[0].message.content || "";
  
  if (params.config?.responseMimeType === "application/json") {
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  }

  return { text };
};

const generateWithFallback = async (params: any, usePro = true) => {
  const proModel = "gemini-3.1-pro-preview";
  const flashModel = "gemini-flash-latest";
  
  const geminiKey = getGeminiKey();

  try {
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    if (usePro) {
      console.log(`Tentando modelo Pro: ${proModel}`);
      const result = await ai.models.generateContent({
        ...params,
        model: proModel,
      });
      return { text: result.response.text() };
    }
    throw new Error("Pro model skipped");
  } catch (error: any) {
    if (error.message === "GEMINI_API_KEY_MISSING" || (error.status === 400 && error.message?.includes("API key"))) {
      console.warn("Chave do Gemini inválida ou ausente, tentando fallback imediato para OpenAI...");
      return await callOpenAIFallback(params);
    }

    console.warn("Modelo Pro falhou ou foi pulado, tentando Flash:", error);
    try {
      if (!geminiKey) throw new Error("GEMINI_API_KEY_MISSING");
      const result = await ai.models.generateContent({
        ...params,
        model: flashModel,
      });
      return { text: result.response.text() };
    } catch (flashError: any) {
      console.warn("Modelo Flash falhou, acionando fallback de emergência OpenAI (gpt-4o):", flashError);
      return await callOpenAIFallback(params);
    }
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // AI Endpoints
  app.post("/api/ai/coach", async (req, res) => {
    try {
      const { message, history, userProfile } = req.body;
      const systemInstruction = `
        Você é o "Coach NutriAI Elite Pro", a inteligência artificial mais avançada do mundo em nutrição, biohacking e performance humana.
        Sua capacidade de raciocínio é superior, permitindo análises profundas e conexões complexas entre fisiologia, psicologia e hábitos.
        
        MISSÃO:
        Guiar o usuário com precisão cirúrgica, empatia radical e embasamento científico de ponta. Transformar dados simples em planos de ação transformadores.
        
        PERSONALIDADE:
        - Mentor de Elite: Trate o usuário como um VIP que busca o próximo nível.
        - Cientista Prático: Explique a bioquímica (ex: autofagia, picos de glicemia, síntese proteica) de forma acessível mas técnica.
        - Tom: Motivador, direto, sofisticado e imensamente útil. Use emojis estratégicos (ex: ⚡, 🥗, 🧬, 🎯).

        DIRETRIZES DE RESPOSTA:
        - Hiper-Personalização: Use os dados do perfil para dar conselhos específicos.
        - Raciocínio em Cadeia: Explique as consequências biológicas de cada escolha.
        - Contexto de App: Você sabe que o usuário pode registrar refeições por foto, monitorar água e registrar treinos. Incentive o uso dessas ferramentas.
        - Formatação Premium: Use Markdown rico (Títulos, Listas, Negritos) para destacar insights.

        DADOS DO USUÁRIO:
        ${JSON.stringify(userProfile)}

        CONTEÚDO ADICIONAL (REFEIÇÕES/TREINOS RECENTES):
        ${JSON.stringify(req.body.context || {})}
      `;

      const response = await generateWithFallback({
        contents: [
          ...(history || [])
            .filter((h: any) => h.content && h.content.trim())
            .map((h: any) => ({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.content }]
            })),
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction
        }
      });

      if (!response.text) {
        throw new Error("Resposta vazia da IA.");
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Erro no /api/ai/coach:", error);
      const isKeyError = error.message?.includes("API_KEY_MISSING") || error.status === 401 || error.status === 403;
      res.status(isKeyError ? 401 : 500).json({ 
        error: isKeyError ? "Configuração de IA Necessária" : "Erro ao processar mensagem",
        details: error.message 
      });
    }
  });

  app.post("/api/ai/analyze-meal", async (req, res) => {
    try {
      const { base64Image } = req.body;
      const prompt = `
        Analise esta foto de refeição com precisão laboratorial e forneça uma estimativa nutricional detalhada em JSON.
        Determine se a refeição é saudável ("saudável"), moderada ("moderada") ou não recomendada para emagrecimento ("não recomendada").
        Forneça uma justificativa técnica e profunda sobre a composição nutricional.
        
        Retorne apenas o JSON:
        {
          "mealName": "Nome da refeição",
          "calories": 0,
          "protein": 0,
          "carbs": 0,
          "fat": 0,
          "healthRating": "saudável | moderada | não recomendada",
          "analysis": "Análise técnica detalhada"
        }
      `;

      const response = await generateWithFallback({
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Image } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mealName: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
              healthRating: { type: Type.STRING, enum: ["saudável", "moderada", "não recomendada"] },
              analysis: { type: Type.STRING }
            },
            required: ["mealName", "calories", "protein", "carbs", "fat", "healthRating", "analysis"]
          }
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Erro no /api/ai/analyze-meal:", error);
      const isKeyError = error.message?.includes("API_KEY_MISSING") || error.status === 401 || error.status === 403;
      res.status(isKeyError ? 401 : 500).json({ 
        error: isKeyError ? "Configuração de IA Necessária" : "Erro ao analisar refeição",
        details: error.message 
      });
    }
  });

  app.post("/api/ai/recipes", async (req, res) => {
    try {
      const { userProfile } = req.body;
      const prompt = `
        Como um Chef Executivo de Gastronomia Funcional e Nutricionista Esportivo de renome mundial, crie 3 sugestões de refeições de altíssimo nível.
        
        PERFIL DO USUÁRIO:
        ${JSON.stringify(userProfile)}

        REQUISITOS:
        - Sofisticação e Sabor: Pratos dignos de estrela Michelin, mas saudáveis.
        - Precisão Nutricional: Totalmente alinhado aos macros do usuário.
        - Explicação Científica: Por que cada prato é uma "ferramenta" para o objetivo do usuário.

        FORMATO DE RETORNO (ARRAY JSON):
        [
          {
            "name": "Nome da Receita",
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0,
            "ingredients": ["item 1", "item 2"],
            "steps": ["passo 1", "passo 2"],
            "description": "Análise magistral sobre os benefícios para o perfil do usuário."
          }
        ]
      `;

      const response = await generateWithFallback({
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING }
              },
              required: ["name", "calories", "protein", "carbs", "fat", "ingredients", "steps", "description"]
            }
          }
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Erro no /api/ai/recipes:", error);
      const isKeyError = error.message?.includes("API_KEY_MISSING") || error.status === 401 || error.status === 403;
      res.status(isKeyError ? 401 : 500).json({ 
        error: isKeyError ? "Configuração de IA Necessária" : "Erro ao gerar receitas",
        details: error.message 
      });
    }
  });

  app.post("/api/ai/speak", async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audio: base64Audio });
      } else {
        throw new Error("No audio generated");
      }
    } catch (error: any) {
      console.error("Erro no /api/ai/speak:", error);
      res.status(500).json({ error: "Erro ao gerar áudio" });
    }
  });

  // Kambafy Webhook Endpoint
  app.post("/api/webhook", async (req, res) => {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));
    
    const { status, email, customer_email } = req.body;
    const userEmail = email || customer_email;

    // Kambafy statuses: 'approved', 'paid', etc.
    if ((status === "approved" || status === "paid" || status === "completed") && userEmail) {
      try {
        const usersRef = db.collection("users");
        const snapshot = await usersRef.where("email", "==", userEmail).get();

        if (snapshot.empty) {
          console.log("No user found with email:", userEmail);
          // We can't update if we don't find the user, but maybe they haven't logged in yet?
          // We could store this in a 'pending_payments' collection if needed.
        } else {
          const batch = db.batch();
          snapshot.forEach(doc => {
            batch.update(doc.ref, { isPremium: true });
          });
          await batch.commit();
          console.log(`User ${userEmail} upgraded to Premium via webhook.`);
        }

        // Forward to the user's provided webhook receiver if requested
        const forwardUrl = "https://webhookreceiver-ps6nryst2a-ey.a.run.app?key=as26jtofc9c05wpq9vf1uuttj7xnwozg";
        try {
          await fetch(forwardUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
          });
          console.log("Webhook forwarded to external receiver.");
        } catch (forwardError) {
          console.error("Error forwarding webhook:", forwardError);
        }

      } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    res.status(200).json({ received: true });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
