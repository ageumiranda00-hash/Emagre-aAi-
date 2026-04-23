export const getAICoachResponse = async (message: string, history: any[] = [], userProfile: any = {}, context: any = {}) => {
  try {
    const response = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, userProfile, context })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401 || (data.error && data.error.includes("Configuração"))) {
        return `⚠️ ERRO DE CONFIGURAÇÃO: A chave da API de Inteligência Artificial (Gemini ou OpenAI) não foi configurada corretamente nas configurações do projeto. Por favor, adicione uma chave válida para continuar.`;
      }
      throw new Error(data.error || 'Erro na API');
    }
    
    return data.text;
  } catch (error: any) {
    console.error("Erro detalhado no Coach IA:", error);
    return "Desculpe, tive um problema técnico para processar sua mensagem agora. Por favor, tente novamente em alguns instantes.";
  }
};

export const analyzeMealImage = async (base64Image: string) => {
  const response = await fetch('/api/ai/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image })
  });
  
  const data = await response.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
  
  if (!response.ok) {
    if (response.status === 401 || (data.error && data.error.includes("Configuração"))) {
      throw new Error("⚠️ CONFIGURAÇÃO NECESSÁRIA: Adicione uma chave de API válida nas configurações do projeto para usar a análise de IA.");
    }
    throw new Error(data.error || 'Erro na API');
  }
  
  return data;
};

export const getRecipeSuggestions = async (userProfile: any) => {
  const response = await fetch('/api/ai/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userProfile })
  });
  
  const data = await response.json().catch(() => ({ error: 'Resposta inválida do servidor' }));
  
  if (!response.ok) {
    if (response.status === 401 || (data.error && data.error.includes("Configuração"))) {
      throw new Error("⚠️ CONFIGURAÇÃO NECESSÁRIA: Adicione uma chave de API válida nas configurações do projeto para usar as sugestões de IA.");
    }
    throw new Error(data.error || 'Erro na API');
  }
  
  return data;
};

export const speakText = async (text: string) => {
  try {
    const response = await fetch('/api/ai/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) throw new Error('Erro na API');
    
    const data = await response.json();
    const base64Audio = data.audio;
    
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to Int16Array (assuming 16-bit PCM)
      const pcmData = new Int16Array(bytes.buffer);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = audioContext.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      // Normalize Int16 to Float32 [-1, 1]
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      return new Promise((resolve) => {
        source.onended = () => {
          audioContext.close();
          resolve(true);
        };
        source.start();
      });
    }
  } catch (error) {
    console.error("Erro ao gerar áudio:", error);
  }
};
