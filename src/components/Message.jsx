import React from 'react';
import { Check, CheckCheck, Trash2, CornerUpLeft, Pin } from 'lucide-react';

const Message = ({ 
    msg, 
    senderName, 
    senderAvatar, 
    isMine, 
    isSequence, 
    onReaction, 
    onDelete, 
    onReply, 
    onImageClick, 
    onPin,
    onEdit, 
    isMentioned,
    isRead
}) => {
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const reactionsCount = msg.reactions ? Object.values(msg.reactions).length : 0;
  const displayEmoji = reactionsCount > 0 ? Object.values(msg.reactions)[0] : null;

  const renderContent = () => {
      if (msg.type === 'image' && msg.fileUrl) {
          return (
              <div className="mt-1 mb-1 group relative">
                  <img 
                      src={msg.fileUrl} 
                      alt="Anexo" 
                      className="max-w-full sm:max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition border border-gray-200 dark:border-gray-700"
                      onClick={() => onImageClick(msg.fileUrl)}
                  />
              </div>
          );
      }
      
      if (msg.type === 'audio' && msg.fileUrl) {
          return (
             <div className="mt-1 mb-1 min-w-[200px]">
                 <audio controls src={msg.fileUrl} className="w-full h-8" />
             </div>
          );
      }

      if (msg.type === 'nudge') {
          return (
              <div className="flex items-center text-yellow-600 dark:text-yellow-500 font-bold italic py-2">
                  <span>🔔 Enviou um Zumbido!</span>
              </div>
          );
      }

      return (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {msg.text}
          </p>
      );
  };

  return (
    <div className={`flex flex-col mb-1 w-full ${isSequence ? 'mt-0.5' : 'mt-3'} ${isMine ? 'items-end' : 'items-start'} ${isMentioned ? 'bg-yellow-100/30 p-1 rounded-lg -mx-1' : ''}`}>
        
        {!isMine && !isSequence && (
            <div className="flex items-end mb-1 ml-10">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 mr-2">
                    {senderName || 'Usuário'}
                </span>
                <span className="text-[10px] text-gray-400">
                    {formatTime(msg.createdAt)}
                </span>
            </div>
        )}

        <div className={`flex max-w-[85%] md:max-w-[70%] group relative ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            
            {!isMine && (
                <div className="flex-shrink-0 mr-2 w-8">
                    {!isSequence ? (
                        senderAvatar ? (
                            <img src={senderAvatar} className="w-8 h-8 rounded-full object-cover shadow-sm" alt="Avatar" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                {senderName?.[0]}
                            </div>
                        )
                    ) : <div className="w-8" />} 
                </div>
            )}

            <div className={`relative px-3 py-2 shadow-sm text-gray-800 dark:text-gray-100 
                ${isMine 
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-l-lg rounded-br-lg' 
                    : 'bg-white dark:bg-[#202c33] rounded-r-lg rounded-bl-lg border border-gray-100 dark:border-gray-700'
                } 
                ${isSequence && isMine ? 'rounded-tr-md' : ''}
                ${isSequence && !isMine ? 'rounded-tl-md' : ''}
                ${msg.type === 'nudge' ? 'shake-animation border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''}
            `}>
                
                {msg.replyTo && (
                    <div className="mb-1 text-xs border-l-4 border-[#00a884] bg-black/5 dark:bg-white/5 p-1 rounded text-gray-600 dark:text-gray-300 truncate max-w-[200px] opacity-80">
                         Replying: {msg.replyTo.text || 'Mídia'}
                    </div>
                )}
                
                {msg.isPinned && (
                    <div className="flex items-center text-[10px] text-[#00a884] font-bold mb-1">
                        <Pin className="w-3 h-3 mr-1 fill-current" /> Fixada
                    </div>
                )}

                {renderContent()}

                <div className={`flex items-center justify-end gap-1 mt-1 space-x-1 ${isMine ? '' : 'ml-auto'}`}>
                    
                    {msg.isEdited && <span className="text-[9px] text-gray-500 italic">editado</span>}

                    {reactionsCount > 0 && (
                        <div className="bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 rounded-full px-1.5 py-0.5 flex items-center -mb-2 mr-2 z-10 cursor-pointer" onClick={() => onReaction('👍')} title="Ver reações">
                            <span className="text-xs mr-1">{displayEmoji}</span>
                            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300">{reactionsCount > 1 ? reactionsCount : ''}</span>
                        </div>
                    )}

                    <span className="text-[9px] text-gray-400 min-w-[30px] text-right">
                        {isMine ? formatTime(msg.createdAt) : ''}
                    </span>

                    {isMine && (
                        <span title={isRead ? "Lido" : "Entregue"}>
                            {isRead ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                            ) : (
                                <Check className="w-3 h-3 text-gray-400" />
                            )}
                        </span>
                    )}
                </div>

                {/* --- AQUI ESTÁ A BARRA DE AÇÕES FLUTUANTE (Igual ao seu print) --- */}
                <div className={`absolute -top-8 ${isMine ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-gray-800 dark:bg-gray-700 rounded-lg shadow-lg p-1 z-20 gap-1 border border-gray-600`}>
                    
                    {/* Botões de Reação Específicos */}
                    <button onClick={() => onReaction('👍')} className="p-1.5 hover:bg-gray-600 rounded-md transition text-lg leading-none" title="Joinha">👍</button>
                    <button onClick={() => onReaction('❤️')} className="p-1.5 hover:bg-gray-600 rounded-md transition text-lg leading-none" title="Amei">❤️</button>
                    <button onClick={() => onReaction('😂')} className="p-1.5 hover:bg-gray-600 rounded-md transition text-lg leading-none" title="Haha">😂</button>
                    
                    <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>

                    <button onClick={onReply} className="p-1.5 hover:bg-gray-600 rounded-md transition text-gray-300" title="Responder">
                        <CornerUpLeft className="w-4 h-4" />
                    </button>
                    
                    <button onClick={onPin} className={`p-1.5 hover:bg-gray-600 rounded-md transition ${msg.isPinned ? 'text-[#00a884]' : 'text-gray-300'}`} title={msg.isPinned ? "Desfixar" : "Fixar"}>
                        <Pin className="w-4 h-4" />
                    </button>

                    {isMine && (
                        <button onClick={onDelete} className="p-1.5 hover:bg-red-900/50 rounded-md transition text-gray-300 hover:text-red-400" title="Apagar">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default Message;