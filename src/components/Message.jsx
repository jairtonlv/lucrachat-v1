import React from 'react';
import { stringToHslColor, getInitials } from '../utils';
import { FileText, Download, Trash2, Reply, Pin, Zap, Check, CheckCheck, Edit2 } from 'lucide-react';

// RECEBENDO OS NOVOS PROPS: senderName e senderAvatar
const Message = ({ msg, senderName, senderAvatar, isMine, isSequence, onReaction, onDelete, onReply, onImageClick, onPin, isMentioned, isRead, onEdit }) => {
  
  // USANDO OS NOMES ATUALIZADOS AO INVÉS DO ANTIGO (msg.userName)
  // Se senderName vier vazio por algum erro, usa msg.userName como backup
  const displayName = senderName || msg.userName || 'Anon';
  const displayAvatar = senderAvatar || msg.userAvatar;

  const avatarColor = stringToHslColor(displayName);
  const initials = getInitials(displayName);
  
  const hasAttachment = !!msg.attachment;
  const isNudge = msg.type === 'nudge';
  const isAudio = msg.type === 'audio';

  const messageTime = msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : msg.createdAt) : Date.now();
  const isRecent = (Date.now() - messageTime) < 900000;

  const canEdit = isMine && !isNudge && !isAudio && !hasAttachment && msg.text && isRecent;
  const canDelete = isMine && isRecent;

  const handleForceDownload = (url, fileName) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = function() {
          if (xhr.status === 200) {
              const blob = xhr.response;
              const link = document.createElement('a');
              link.href = window.URL.createObjectURL(blob);
              link.download = fileName || 'download';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else { window.open(url, '_blank'); }
      };
      xhr.onerror = () => window.open(url, '_blank');
      xhr.send();
  };

  const getUniqueReactions = () => {
      if (!msg.reactions || msg.reactions.length === 0) return [];
      const emojis = msg.reactions.map(r => r.split(':')[0]);
      return [...new Set(emojis)]; 
  };

  const renderAttachment = () => {
    if (!hasAttachment) return null;
    const url = msg.attachment.url || msg.attachment.data;
    const name = msg.attachment.name || 'Anexo';
    const type = msg.attachment.type || '';

    if (type && type.startsWith('image/')) {
        return (
            <div className="mb-2 mt-1 rounded-lg overflow-hidden max-w-full border border-gray-200 dark:border-gray-700 relative group">
                <img src={url} alt={name} className="max-h-64 w-full object-cover cursor-pointer hover:opacity-90 transition" onClick={() => onImageClick(url)} />
                <button onClick={(e) => { e.stopPropagation(); handleForceDownload(url, name); }} className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md backdrop-blur-sm cursor-pointer z-10" title="Baixar Imagem"><Download className="w-4 h-4" /></button>
            </div>
        );
    }

    if (type && type.startsWith('audio/')) {
        return (
             <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2 min-w-[280px]">
                <audio controls preload="metadata" src={url} className="w-full h-10" />
             </div>
        );
    }

    return (
        <div onClick={() => handleForceDownload(url, name)} className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg mb-2 mt-1 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition group cursor-pointer" title="Clique para baixar">
            <div className="p-2 bg-white dark:bg-gray-700 rounded-full"><FileText className="w-5 h-5 text-[#00a884]" /></div>
            <div className="flex flex-col overflow-hidden max-w-[150px]"><span className="text-sm font-bold truncate text-gray-800 dark:text-gray-200">{name}</span><span className="text-[10px] uppercase text-gray-500 font-medium">{type.split('/')[1] || 'ARQUIVO'}</span></div>
            <div className="ml-auto text-gray-400 group-hover:text-[#00a884]"><Download className="w-5 h-5" /></div>
        </div>
    );
  };

  const marginTop = isSequence ? 'mt-1' : 'mt-4';
  const bubbleRadius = isMine ? (isSequence ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-none') : (isSequence ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-none');
  const bubbleColor = isMine ? 'bg-[#005c4b] text-white shadow-sm' : (isMentioned ? 'bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 border border-yellow-500/50 shadow-sm' : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 shadow-sm');
  const CheckIcon = isRead ? CheckCheck : Check; 
  const checkColor = isRead ? 'text-blue-300' : 'text-gray-400';

  return (
    <div className={`flex w-full ${marginTop} ${isMine ? 'justify-end' : 'justify-start'} group relative animate-in fade-in duration-200`}>
        {!isMine && (
            <div className="w-8 mr-2 flex-shrink-0 flex flex-col justify-end">
                {!isSequence ? (
                    displayAvatar ? <img src={displayAvatar} alt={initials} className="w-8 h-8 rounded-full object-cover shadow-sm" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: avatarColor }}>{initials}</div>
                ) : (<div className="w-8" />)}
            </div>
        )}

        <div className={`relative max-w-[85%] md:max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
            {!isMine && !isSequence && !isNudge && (
                <span className="text-[11px] font-bold mb-1 ml-1 cursor-pointer hover:underline" style={{ color: avatarColor }}>{displayName}</span>
            )}

            <div className={`relative px-3 py-2 ${bubbleRadius} ${bubbleColor} ${isNudge ? 'w-full' : ''}`}>
                {msg.replyTo && (
                    <div className="mb-2 p-2 rounded bg-black/5 dark:bg-black/20 border-l-4 border-[#00a884] text-xs opacity-80">
                        <span className="font-bold block text-[#00a884]">{msg.replyTo.userName}</span>
                        <span className="truncate block">{msg.replyTo.text}</span>
                    </div>
                )}

                {isAudio ? (
                    <div className="flex items-center min-w-[280px] mt-1 mb-1">
                        <audio controls preload="metadata" src={msg.attachment?.url} className="w-full h-10" />
                    </div>
                ) : (
                    renderAttachment()
                )}

                {isNudge ? (
                    <div className={`flex items-center font-bold italic select-none ${isMine ? 'text-green-100' : 'text-yellow-600 dark:text-yellow-400'}`}><Zap className="w-4 h-4 mr-2 animate-pulse fill-current" /><span>Enviou um zumbido!</span></div>
                ) : (
                    !isAudio && msg.text && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {msg.text}
                            {msg.isEdited && <span className="text-[10px] text-gray-500/80 italic ml-1 select-none">(editado)</span>}
                        </p>
                    )
                )}
                
                <div className="flex items-center justify-end gap-1 mt-1 space-x-1 select-none opacity-60">
                     <span className="text-[10px]">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}</span>
                    {isMine && (<CheckIcon className={`w-3.5 h-3.5 ${checkColor}`} />)}
                </div>

                {msg.reactions && msg.reactions.length > 0 && (
                    <div className={`absolute -bottom-2 ${isMine ? 'left-0' : 'right-0'} flex gap-0.5 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded-full shadow border border-gray-100 dark:border-gray-700 z-10 scale-90`}>
                        {getUniqueReactions().map(emoji => (<span key={emoji} className="text-xs">{emoji}</span>))}
                        <span className="text-[9px] text-gray-500 font-bold ml-0.5 pt-0.5">{msg.reactions.length}</span>
                    </div>
                )}
            </div>

            <div className={`absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 shadow-md rounded-lg flex items-center p-1 border border-gray-200 dark:border-gray-600 z-20`}>
                <button onClick={() => onReaction(msg.id, '👍')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Curtir">👍</button>
                <button onClick={() => onReaction(msg.id, '❤️')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Amei">❤️</button>
                <button onClick={() => onReaction(msg.id, '😂')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Haha">😂</button>
                <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                <button onClick={onReply} className="p-1.5 text-gray-500 hover:text-[#00a884] hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Responder"><Reply className="w-4 h-4"/></button>
                
                {canEdit && (
                    <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Editar"><Edit2 className="w-4 h-4"/></button>
                )}
                
                <button onClick={onPin} className="p-1.5 text-gray-500 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Fixar"><Pin className="w-4 h-4"/></button>
                
                {canDelete && (
                    <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded" title="Apagar"><Trash2 className="w-4 h-4"/></button>
                )}
            </div>
        </div>
    </div>
  );
};

export default Message;