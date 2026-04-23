import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MealAnalysis {
  mealName: string;
  calories: number;
  macronutrients: {
    protein: number;
    carbs: number;
    fats: number;
  };
  healthScore: number; // 1-10
  suggestions: string[];
  coachComment: string;
}

export const analyzeMeal = async (
  description: string,
  imageBase64?: string,
  mimeType?: string
): Promise<MealAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `Você é um coach de emagrecimento e nutricionista experiente. 
Sua tarefa é analisar a refeição descrita ou mostrada na imagem.
Seja encorajador, mas honesto.
Forneça estimativas de calorias e macronutrientes (proteínas, carboidratos, gorduras em gramas).
Dê uma nota de saúde de 1 a 10.
Sugira melhorias para tornar a refeição mais equilibrada para perda de peso.
Responda SEMPRE em formato JSON seguindo esta estrutura:
{
  "mealName": "Nome da refeição",
  "calories": 0,
  "macronutrients": { "protein": 0, "carbs": 0, "fats": 0 },
  "healthScore": 0,
  "suggestions": ["sugestão 1", "sugestão 2"],
  "coachComment": "Comentário motivador e técnico"
}`;

  const prompt = description || "Analise esta refeição.";
  
  const parts: any[] = [{ text: prompt }];
  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}") as MealAnalysis;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Erro ao processar a análise da refeição.");
  }
};
