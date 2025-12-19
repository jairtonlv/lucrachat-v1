import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { Send, Hash, MessageSquare, Settings, Paperclip, X, FileText, Smile, Zap, Check, CheckCheck, Loader2, Users, Search, Download, Mic, Square, Edit2, ArrowUpCircle } from 'lucide-react';
import Message from './Message';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig'; 

const REAL_NUDGE_SOUND_URL = "/msn_nudge.mp3";
const CHAT_BACKGROUND_URL = "/fundo.png"; 

const ChatArea = ({ 
    messages, 
    userId, 
    currentConversationName, 
    currentConversationId, 
    isDM, 
    showAdminPanel, 
    setShowAdminPanel, 
    newMessage, 
    setNewMessage, 
    onSendMessage, 
    onReaction, 
    onDelete, 
    isDarkMode, 
    onTyping, 
    typingUsers, 
    pinnedMessage, 
    onPin, 
    onUnpin, 
    currentChannel, 
    allUsers = [], 
    onLoadMore 
}) => {
  const messagesEndRef = useRef(null);
  const topSentinelRef = useRef(null); 
  const scrollContainerRef = useRef(null); 
  
  const prevScrollHeightRef = useRef(0);
  const prevMessageCountRef = useRef(0);
  const lastMessageIdRef = useRef(null);

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastNudgeId, setLastNudgeId] = useState(null);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingMessage, setEditingMessage] = useState(null); 

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // SCROLL INFINITO
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && messages.length >= 20 && !searchQuery) {
            if (scrollContainerRef.current) {
                prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
                prevMessageCountRef.current = messages.length;
            }
            onLoadMore();
        }
    }, { threshold: 0.5 }); 

    if (topSentinelRef.current) {
        observer.observe(topSentinelRef.current);
    }

    return () => observer.disconnect();
  }, [messages.length, searchQuery, onLoadMore]);

  useLayoutEffect(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const currentScrollHeight = container.scrollHeight;
      const countDifference = messages.length - prevMessageCountRef.current;
      if (countDifference > 0 && prevScrollHeightRef.current > 0) {
          const heightDifference = currentScrollHeight - prevScrollHeightRef.current;
          container.scrollTop = container.scrollTop + heightDifference;
      }
      prevScrollHeightRef.current = 0; 
  }, [messages]); 

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const lastMsgId = lastMsg?.id;
    if (lastMsgId !== lastMessageIdRef.current || messages.length <= 20) {
        if (!searchQuery && messagesEndRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
        lastMessageIdRef.current = lastMsgId;
    }
  }, [messages, searchQuery]);

  // FUNÇÕES
  const handleStartEdit = (msg) => {
      setEditingMessage(msg);
      setNewMessage(msg.text); 
      if(textInputRef.current) textInputRef.current.focus();
  };

  const handleCancelEdit = () => {
      setEditingMessage(null);
      setNewMessage('');
  };

  const handleUpdateMessage = async () => {
      if (!editingMessage || !newMessage.trim()) return;
      try {
          const msgRef = doc(db, `conversations/${currentConversationId}/messages`, editingMessage.id);
          await updateDoc(msgRef, { text: newMessage, isEdited: true });
          handleCancelEdit();
      } catch (error) {
          console.error("Erro ao editar:", error);
          alert("Não foi possível editar.");
          handleCancelEdit();
      }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorderRef.current = new MediaRecorder(stream);
          audioChunksRef.current = [];
          mediaRecorderRef.current.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              await handleSendAudio(audioBlob); 
              stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorderRef.current.start();
          setIsRecording(true);
      } catch (err) {
          console.error("Erro ao acessar microfone:", err);
          alert("Não foi possível acessar o microfone.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleSendAudio = async (audioBlob) => {
      if (!currentConversationId) return;
      setIsUploading(true);
      try {
          const fileName = `audio_${Date.now()}.webm`;
          const audioRef = ref(storage, `audio_messages/${currentConversationId}/${fileName}`);
          await uploadBytes(audioRef, audioBlob);
          const downloadURL = await getDownloadURL(audioRef);
          const audioAttachment = { name: 'Mensagem de Voz', type: 'audio/webm', url: downloadURL };
          await onSendMessage(null, audioAttachment, replyTo, 'audio');
      } catch (error) {
          console.error("Erro ao enviar áudio:", error);
          alert("Erro ao enviar áudio.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleForceDownload = (url) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = function() {
          if (xhr.status === 200) {
              const blob = xhr.response;
              const link = document.createElement('a');
              link.href = window.URL.createObjectURL(blob);
              link.download = 'download-lucrachat.jpg';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else { window.open(url, '_blank'); }
      };
      xhr.onerror = () => window.open(url, '_blank');
      xhr.send();
  };

  useEffect(() => {
    setOtherUserLastSeen(null);
    if (!currentConversationId || !userId) return; 
    const conversationRef = doc(db, 'conversations', currentConversationId);
    const unsubscribe = onSnapshot(conversationRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(isDM) {
                const otherUserKey = Object.keys(data).find(key => key.startsWith('lastSeen_') && key !== `lastSeen_${userId}`);
                if (otherUserKey && data[otherUserKey]) setOtherUserLastSeen(data[otherUserKey]);
            }
            const currentTotal = data.messageCount || 0;
            const myReadCount = data[`lastReadCount_${userId}`] || 0;
            if (currentTotal > myReadCount) {
                 setDoc(conversationRef, { [`lastSeen_${userId}`]: serverTimestamp(), [`lastReadCount_${userId}`]: currentTotal }, { merge: true });
            }
        }
    });
    return () => unsubscribe();
  }, [currentConversationId, userId, isDM]);

  useEffect(() => {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.type === 'nudge' && lastMsg.id !== lastNudgeId) {
          const isRecent = (Date.now() - lastMsg.timestamp) < 10000;
          if (lastMsg.userId !== userId && isRecent) {
             triggerShake();
          }
          setLastNudgeId(lastMsg.id);
      }
  }, [messages, userId, lastNudgeId]);

  const triggerShake = () => {
      try {
        const audio = new Audio(REAL_NUDGE_SOUND_URL);
        audio.volume = 0.8;
        audio.play().catch(e => console.log("Audio play prevented"));
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } catch (e) { console.error("Erro no efeito de zumbido", e); }
  };

  const handleSendClick = async (e) => {
    e.preventDefault();
    if (editingMessage) {
        await handleUpdateMessage();
        return;
    }
    if ((newMessage.trim() || attachmentFile) && !isSending && !isUploading) {
        setIsSending(true);
        try {
            let finalAttachment = null;
            if (attachmentFile) {
                setIsUploading(true);
                const fileRef = ref(storage, `chat_files/${currentConversationId}/${Date.now()}_${attachmentFile.name}`);
                await uploadBytes(fileRef, attachmentFile);
                const downloadURL = await getDownloadURL(fileRef);
                finalAttachment = { name: attachmentFile.name, type: attachmentFile.type, url: downloadURL };
            }
            await onSendMessage(newMessage, finalAttachment, replyTo);
            setNewMessage('');
            setAttachmentFile(null);
            setReplyTo(null);
            setShowEmojiPicker(false);
            if (textInputRef.current) textInputRef.current.focus();
        } catch (error) {
            console.error("Erro ao enviar:", error);
            alert("Erro ao enviar mensagem.");
        } finally {
            setIsSending(false);
            setIsUploading(false);
        }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendClick(e);
    }
    if (onTyping && !editingMessage) {
        onTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    }
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) setAttachmentFile(file);
      e.target.value = null; 
  };

  const onEmojiClick = (emojiData) => {
      setNewMessage(prev => prev + emojiData.emoji);
  };

  useEffect(() => {
      const handleClickOutside = (event) => {
          if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) && emojiButtonRef.current && !emojiButtonRef.current.contains(event.target)) {
              setShowEmojiPicker(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDateLabel = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hoje";
    if (date.toDateString() === yesterday.toDateString()) return "Ontem";
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getChannelMembers = () => {
      if (!currentChannel || !currentChannel.allowedUsers || currentChannel.allowedUsers.length === 0) return null; 
      return allUsers.filter(u => currentChannel.allowedUsers.includes(u.id));
  };

  const filteredMessages = searchQuery.trim() === '' 
    ? messages 
    : messages.filter(msg => 
        msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        msg.userName?.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative transition-colors duration-300">
        
        <div 
            className="absolute inset-0 z-0 opacity-80 dark:opacity-20 pointer-events-none"
            style={{ 
                backgroundImage: `url(${CHAT_BACKGROUND_URL})`,
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}
        />

        <header className="h-16 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10 relative">
            <div className="flex items-center text-gray-800 dark:text-gray-100">
                {isDM ? <MessageSquare className="w-5 h-5 mr-3 text-gray-500" /> : <Hash className="w-5 h-5 mr-3 text-gray-500" />}
                <div>
                    <h2 className="font-bold text-base truncate max-w-[200px] md:max-w-md">{currentConversationName}</h2>
                    {isDM && messages.length > 0 && <p className="text-xs text-[#00a884] font-medium">Online</p>}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={() => onSendMessage('', null, null, 'nudge')} className="p-2 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-full transition" title="Enviar Zumbido"><Zap className="w-5 h-5 fill-current" /></button>
                <button onClick={() => { setShowSearch(!showSearch); if(showSearch) setSearchQuery(''); }} className={`p-2 rounded-full transition ${showSearch ? 'bg-gray-200 dark:bg-gray-700 text-[#00a884]' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="Buscar"><Search className="w-5 h-5" /></button>
                {!isDM && <button onClick={() => setShowMembersModal(true)} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition" title="Ver Membros"><Users className="w-5 h-5" /></button>}
                {!isDM && <button onClick={() => setShowAdminPanel(!showAdminPanel)} className={`p-2 rounded-full transition ${showAdminPanel ? 'bg-blue-100 text-[#00a884]' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}><Settings className="w-5 h-5" /></button>}
            </div>
        </header>

        {showSearch && (
            <div className="bg-white dark:bg-gray-800 p-2 px-4 shadow-md z-10 flex items-center border-b border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input type="text" placeholder="Buscar mensagem..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400" autoFocus />
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
            </div>
        )}

        {pinnedMessage && (
            <div className="z-10 relative bg-gray-100 dark:bg-[#1f2c34] p-2 px-4 flex justify-between items-center text-xs border-b border-l-4 border-l-[#00a884] dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-[#2a3942] transition">
                <div className="flex flex-col"><span className="font-bold text-[#00a884]">Mensagem Fixada</span><span className="text-gray-600 dark:text-gray-300 truncate max-w-[250px]">{pinnedMessage.text}</span></div>
                {showAdminPanel && <button onClick={onUnpin} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-gray-500 hover:text-red-500"><X className="w-4 h-4" /></button>}
            </div>
        )}

        {showMembersModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowMembersModal(false)}>
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="font-bold text-lg dark:text-white">Membros do Canal</h3>
                        <button onClick={() => setShowMembersModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                    <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {!getChannelMembers() ? (
                            <div className="text-center py-6"><Users className="w-12 h-12 mx-auto text-[#00a884] mb-2 opacity-50" /><p className="text-gray-800 dark:text-gray-200 font-medium">Canal Público</p><p className="text-sm text-gray-500">Todos do escritório têm acesso.</p></div>
                        ) : (
                            <ul className="space-y-2">
                                {getChannelMembers().map(user => (
                                    <li key={user.id} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                                        {user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full mr-3 object-cover" /> : <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mr-3"><span className="text-xs font-bold text-gray-600 dark:text-gray-300">{user.name?.[0]}</span></div>}
                                        <span className="text-sm font-medium dark:text-gray-200">{user.name || user.displayName}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ÁREA DE MENSAGENS */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar z-10 relative">
            {!searchQuery && messages.length >= 20 && (
                 <div ref={topSentinelRef} className="w-full h-4 flex justify-center items-center opacity-0 pointer-events-none">
                     <span className="text-[10px]">Carregando...</span>
                 </div>
            )}
            {searchQuery === '' && messages.length >= 20 && messages.length % 20 === 0 && (
                <div className="flex justify-center my-2 opacity-50">
                     <Loader2 className="w-5 h-5 animate-spin text-[#00a884]" />
                </div>
            )}
            {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-50 select-none">
                    {searchQuery ? <p className="text-gray-500 dark:text-gray-400">Sem resultados</p> : (
                        <div className="text-center"><MessageSquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400">Nenhuma mensagem aqui ainda.</p></div>
                    )}
                </div>
            ) : (
                filteredMessages.map((msg, index) => {
                    const isMine = msg.userId === userId;
                    const prevMsg = filteredMessages[index - 1]; 
                    const isSequence = prevMsg && prevMsg.userId === msg.userId && msg.type !== 'nudge' && prevMsg.type !== 'nudge' && (msg.timestamp - prevMsg.timestamp < 5 * 60 * 1000); 
                    let isRead = false;
                    if (isDM && otherUserLastSeen && msg.createdAt) {
                        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                        const lastSeenDate = otherUserLastSeen.toDate ? otherUserLastSeen.toDate() : new Date(otherUserLastSeen);
                        if (!isNaN(msgDate.getTime())) isRead = msgDate <= lastSeenDate;
                    }
                    let showDateSeparator = false;
                    let dateLabel = "";
                    const currentDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.timestamp || Date.now());
                    if (!prevMsg) { showDateSeparator = true; dateLabel = getDateLabel(currentDate); } else {
                        const prevDate = prevMsg.createdAt?.toDate ? prevMsg.createdAt.toDate() : new Date(prevMsg.timestamp || Date.now());
                        if (currentDate.toDateString() !== prevDate.toDateString()) { showDateSeparator = true; dateLabel = getDateLabel(currentDate); }
                    }

                    // --- MUDANÇA PRINCIPAL AQUI ---
                    // Procuramos o usuário atual na lista global (allUsers)
                    const sender = allUsers.find(u => u.id === msg.userId);
                    // Se achou, usa o nome/avatar ATUAL. Se não, usa o antigo gravado na msg.
                    const currentName = sender ? (sender.name || sender.displayName) : msg.userName;
                    const currentAvatar = sender ? sender.photoURL : msg.userAvatar;

                    return (
                        <React.Fragment key={msg.id}>
                            {showDateSeparator && (<div className="flex justify-center my-4 sticky top-2 z-0"><span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold py-1 px-3 rounded-full shadow-sm uppercase tracking-wide opacity-90 border border-gray-300 dark:border-gray-700">{dateLabel}</span></div>)}
                            <Message 
                                msg={msg} 
                                // PASSANDO OS DADOS REAIS E ATUALIZADOS
                                senderName={currentName} 
                                senderAvatar={currentAvatar}
                                isMine={isMine} 
                                isSequence={isSequence} 
                                onReaction={() => onReaction(msg.id, '👍')} 
                                onDelete={() => onDelete(msg.id)} 
                                onReply={() => setReplyTo(msg)} 
                                onImageClick={setSelectedImage} 
                                onPin={() => onPin(msg)} 
                                isMentioned={msg.mentions?.includes(userId)} 
                                isRead={isRead}
                                onEdit={() => handleStartEdit(msg)} 
                            />
                        </React.Fragment>
                    );
                })
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <footer className="bg-[#f0f2f5] dark:bg-[#202c33] p-2 md:p-3 flex flex-col gap-2 relative z-20 shadow-inner">
            
            {typingUsers && typingUsers.length > 0 && (
               <div className="text-xs text-[#00a884] font-bold animate-pulse mb-1 ml-2 transition-all">
                 {typingUsers.map(u => u.name).join(', ')} está digitando...
               </div>
            )}

            {editingMessage && (
                <div className="flex justify-between items-center bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg border-l-4 border-blue-500 mb-1 animate-slide-up">
                    <div className="flex flex-col text-sm">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center"><Edit2 className="w-3 h-3 mr-1"/> Editando Mensagem</span>
                        <span className="text-gray-600 dark:text-gray-300 truncate max-w-[200px] opacity-70">{editingMessage.text}</span>
                    </div>
                    <button onClick={handleCancelEdit} className="text-gray-500 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                </div>
            )}

            {replyTo && !editingMessage && (
                <div className="flex justify-between items-center bg-gray-200 dark:bg-[#1f2c34] p-2 rounded-lg border-l-4 border-[#00a884] mb-1 animate-slide-up">
                    <div className="flex flex-col text-sm"><span className="text-[#00a884] font-bold text-xs">Respondendo a {replyTo.userName}</span><span className="text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{replyTo.text || '[Anexo]'}</span></div><button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                </div>
            )}

            {attachmentFile && (
                <div className="flex items-center bg-[#00a884]/10 p-2 rounded-lg border border-[#00a884]/30 animate-slide-up">
                    {attachmentFile.type.startsWith('image/') ? (
                        <img 
                            src={URL.createObjectURL(attachmentFile)} 
                            alt="Preview" 
                            className="w-10 h-10 object-cover rounded mr-2 border border-gray-300"
                        />
                    ) : (
                        <FileText className="w-5 h-5 text-[#00a884] mr-2" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-grow">{attachmentFile.name}</span>
                    <button onClick={() => setAttachmentFile(null)} className="text-red-500 hover:bg-red-100 p-1 rounded"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="flex items-end gap-2">
                <div className="relative">
                    <button type="button" ref={emojiButtonRef} onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"><Smile className="w-6 h-6" /></button>
                    {showEmojiPicker && <div ref={emojiPickerRef} className="absolute bottom-14 left-0 shadow-2xl rounded-xl z-50 animate-fade-in"><EmojiPicker theme={isDarkMode ? Theme.DARK : Theme.LIGHT} onEmojiClick={onEmojiClick} width={300} height={400} searchDisabled skinTonesDisabled /></div>}
                </div>

                <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition" disabled={!!editingMessage}><Paperclip className="w-6 h-6" /></button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

                {isRecording ? (
                    <div className="flex-grow p-3 bg-white dark:bg-[#2a3942] rounded-2xl shadow-sm flex items-center justify-between animate-pulse">
                        <span className="text-red-500 font-bold flex items-center"><div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-bounce"></div>Gravando áudio...</span>
                        <button onClick={stopRecording} className="text-red-500 hover:bg-red-100 p-1 rounded"><Square className="w-5 h-5 fill-current" /></button>
                    </div>
                ) : (
                    <input ref={textInputRef} type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder={editingMessage ? "Edite sua mensagem..." : "Mensagem..."} className="flex-grow p-3 bg-white dark:bg-[#2a3942] dark:text-white border-0 rounded-2xl focus:ring-0 focus:outline-none shadow-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-700 transition-colors duration-300" disabled={!currentConversationId} />
                )}
                
                {!newMessage.trim() && !attachmentFile && !isRecording && !editingMessage ? (
                    <button type="button" onClick={startRecording} className="bg-[#00a884] text-white w-12 h-12 rounded-full hover:bg-[#008f6f] shadow-md flex items-center justify-center flex-shrink-0 transition-all transform active:scale-90" disabled={!currentConversationId || isUploading}>
                        <Mic className="w-5 h-5" />
                    </button>
                ) : (
                    <button onClick={handleSendClick} className={`bg-[#00a884] text-white w-12 h-12 rounded-full hover:bg-[#008f6f] shadow-md flex items-center justify-center flex-shrink-0 transition-all transform active:scale-90 ${isUploading || isSending ? 'opacity-75 cursor-not-allowed' : ''} disabled:opacity-50 disabled:scale-100`} disabled={(!newMessage.trim() && !attachmentFile && !editingMessage) || !currentConversationId || isUploading || isSending}>
                        {isUploading || isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5 ml-1" />)}
                    </button>
                )}
            </div>
        </footer>
    </div>
  );
};

export default ChatArea;