export const APP_ID = 'lucrachat-v1'; 

// --- FUNÇÕES DE DIRETÓRIO ---
export const getChannelsCollectionPath = () => 'rooms';

export const getConversationPath = (conversationId) => {
  return `conversations/${conversationId}/messages`;
};

// --- FUNÇÕES DE NOME E ID ---
export const getDMId = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort();
  return sortedIds.join('_');
};

export const generateUsername = () => {
  const names = ["Andorinha", "Gavião", "Pardal", "Canário", "Sabiá", "Tucano", "Arara", "Coruja", "BeijaFlor", "Pinguim"];
  const adjective = ["Rápido", "Esperto", "Silencioso", "Ousado", "Calmo", "Focado", "Brilhante", "Ágil", "Criativo", "Gentil"];
  const randomName = names[Math.floor(Math.random() * names.length)];
  const randomAdjective = adjective[Math.floor(Math.random() * adjective.length)];
  return `${randomAdjective} ${randomName}`;
};

// --- FUNÇÕES VISUAIS ---

// Gera cor para o avatar (ajustada para ficar legível em modo claro e escuro)
export const stringToHslColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  // Saturação 60%, Luminosidade 45% (funciona bem com texto branco)
  return 'hsl(' + h + ', 60%, 45%)'; 
};

// Pega as iniciais do nome
export const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};