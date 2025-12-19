import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, addDoc, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, limit, orderBy, increment, limitToLast } from 'firebase/firestore'; 
import { ref, onValue, onDisconnect, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database'; 
import { auth, db, database } from './firebaseConfig'; 
import { getDMId } from './utils'; 

import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { LogIn, Mail, Lock, AlertCircle, Loader2, UserPlus, ArrowRight, Trash2 } from 'lucide-react'; 

const REAL_NUDGE_SOUND_URL = "/msn_nudge.mp3";

const App = () => {
  // --- ESTADOS GERAIS ---
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  
  const [users, setUsers] = useState([]); 
  const [onlineStatusMap, setOnlineStatusMap] = useState({}); 
  const [channels, setChannels] = useState([]);
  
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversationName, setCurrentConversationName] = useState('');
  const [isDM, setIsDM] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const [newMessage, setNewMessage] = useState('');
  const [notificationUserId, setNotificationUserId] = useState(null);
  
  // RESTAURADO: Estado de usuários digitando
  const [typingUsers, setTypingUsers] = useState([]);
  
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});

  // --- PAGINAÇÃO ---
  const [messagesLimit, setMessagesLimit] = useState(20); 

  // --- ESTADOS DE LOGIN ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // --- MODAL DE EXCLUSÃO ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDeleteId, setMessageToDeleteId] = useState(null);

  // 0. PERMISSÃO DE NOTIFICAÇÃO
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // 1. AUTENTICAÇÃO E PRESENÇA
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        const storedName = localStorage.getItem(`chatUserName_${currentUser.uid}`);
        const storedAvatar = localStorage.getItem(`chatUserAvatar_${currentUser.uid}`);
        const emailName = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';
        const finalName = storedName || currentUser.displayName || emailName;

        setUserName(finalName);
        setUserAvatar(storedAvatar || currentUser.photoURL);
        
        setDoc(doc(db, 'users', currentUser.uid), {
           name: finalName,
           email: currentUser.email,
           photoURL: storedAvatar || currentUser.photoURL,
           lastSeen: serverTimestamp(),
        }, { merge: true });

        const userStatusDatabaseRef = ref(database, '/status/' + currentUser.uid);
        const isOfflineForDatabase = { state: 'offline', last_changed: rtdbServerTimestamp() };
        const isOnlineForDatabase = { state: 'online', last_changed: rtdbServerTimestamp() };

        const connectedRef = ref(database, '.info/connected');

        onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === false) {
                return;
            }
            onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
                set(userStatusDatabaseRef, isOnlineForDatabase);
            });
        });

      } else {
        setUser(null);
        setUserName('');
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. LISTENER DE DADOS
  useEffect(() => {
     if (!user) return;
     
     const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
         const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setUsers(usersList);
     });

     const statusRef = ref(database, 'status');
     const unsubStatus = onValue(statusRef, (snapshot) => {
         const data = snapshot.val();
         setOnlineStatusMap(data || {});
     });

     const unsubChannels = onSnapshot(collection(db, 'rooms'), (snapshot) => {
        const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const myRooms = allRooms.filter(room => {
            try {
                if (!room.allowedUsers || !Array.isArray(room.allowedUsers) || room.allowedUsers.length === 0) return true;
                if (!user || !user.uid) return false;
                return room.allowedUsers.includes(user.uid);
            } catch (err) { return false; }
        });

        myRooms.sort((a, b) => (a.order || 99) - (b.order || 99));
        setChannels(myRooms);
     });

     return () => { unsubUsers(); unsubChannels(); unsubStatus(); };
  }, [user]);

  const mergedUsers = users.map(u => {
      const statusData = onlineStatusMap[u.id];
      return {
          ...u,
          isOnline: statusData ? statusData.state === 'online' : false
      };
  });

  // 3. LISTENER DE MENSAGENS NÃO LIDAS
  useEffect(() => {
    if (!user) return;

    const unsubUnread = onSnapshot(collection(db, 'conversations'), (snapshot) => {
        const newUnreadMap = {};
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const conversationId = docSnap.id;
            
            const lastMsgAt = data.lastMessageAt;
            const lastMsgDate = lastMsgAt?.toDate ? lastMsgAt.toDate() : (lastMsgAt ? new Date(lastMsgAt) : new Date(0));
            const now = new Date();
            const timeDiff = now - lastMsgDate;
            
            if (timeDiff < 3000 && data.lastSenderId !== user.uid && document.hidden) {
                if (Notification.permission === 'granted') {
                    const sender = users.find(u => u.id === data.lastSenderId);
                    const senderName = sender?.name || sender?.displayName || 'Nova Mensagem';
                    const senderPhoto = sender?.photoURL || '/vite.svg'; 
                    const channel = channels.find(c => c.id === conversationId);

                    let notifyTitle = senderName;
                    let notifyBody = data.lastMessageText || 'Nova mensagem';

                    if (channel) {
                        notifyTitle = `# ${channel.name}`;
                        notifyBody = `${senderName}: ${notifyBody}`;
                    }
                    
                    new Notification(notifyTitle, { body: notifyBody, icon: senderPhoto, tag: conversationId, renotify: true });
                }
            }

            const totalMessages = data.messageCount || 0;
            const myReadCount = data[`lastReadCount_${user.uid}`] || 0;
            let unreadCount = 0;

            if (totalMessages > myReadCount) {
                unreadCount = totalMessages - myReadCount;
            } else {
                const myLastSeen = data[`lastSeen_${user.uid}`];
                if (lastMsgAt) {
                    const mySeenDate = myLastSeen?.toDate ? myLastSeen.toDate() : (myLastSeen ? new Date(myLastSeen) : new Date(0));
                    if (lastMsgDate > mySeenDate) unreadCount = 1; 
                }
            }

            if (data.lastSenderId === user.uid) unreadCount = 0;
            if (conversationId === currentConversationId) unreadCount = 0;
            if (unreadCount > 0) newUnreadMap[conversationId] = unreadCount;
        });
        setUnreadMap(newUnreadMap);
    });
    return () => unsubUnread();
  }, [user, currentConversationId, users, channels]);

  // 4. MENSAGENS ATUAIS
  useEffect(() => {
      if (!currentConversationId) {
          setMessages([]);
          setPinnedMessage(null);
          return;
      }
      
      const q = query(
          collection(db, `conversations/${currentConversationId}/messages`), 
          orderBy('timestamp', 'asc'),
          limitToLast(messagesLimit) 
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMessages(msgs);
          const pinned = msgs.find(m => m.isPinned);
          setPinnedMessage(pinned || null);
      });
      return () => unsubscribe();
  }, [currentConversationId, messagesLimit]); 

  // --- RESTAURADO: LISTENER DE QUEM ESTÁ DIGITANDO ---
  useEffect(() => {
      if (!currentConversationId || !user) {
          setTypingUsers([]);
          return;
      }

      // Escuta a subcoleção 'typing' dentro da conversa atual
      const q = query(collection(db, `conversations/${currentConversationId}/typing`));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const typers = [];
          snapshot.forEach(doc => {
              // Só adiciona se não for eu mesmo
              if (doc.id !== user.uid) {
                  typers.push(doc.data());
              }
          });
          setTypingUsers(typers);
      });

      return () => unsubscribe();
  }, [currentConversationId, user]);

  // --- RESTAURADO: FUNÇÃO PARA ATUALIZAR MEU STATUS DE DIGITANDO ---
  const updateTypingStatus = async (isTyping) => {
      if (!user || !currentConversationId) return;

      const myTypingRef = doc(db, `conversations/${currentConversationId}/typing`, user.uid);
      
      if (isTyping) {
          // Salva que estou digitando (com timestamp para expirar se travar)
          await setDoc(myTypingRef, {
              userId: user.uid,
              name: userName,
              timestamp: serverTimestamp()
          });
      } else {
          // Remove meu documento de digitando
          await deleteDoc(myTypingRef);
      }
  };

  const handleLoadMoreMessages = () => {
      setMessagesLimit(prev => prev + 20); 
  };

  // 5. ZUMBIDO GLOBAL
  useEffect(() => {
    if(!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if(docSnap.exists()){
            const data = docSnap.data();
            if(data.lastNudge && data.lastNudgeTime){
                const now = new Date();
                const nudgeTime = data.lastNudgeTime.toDate();
                if(now - nudgeTime < 5000) {
                    triggerGlobalShake(data.lastNudge);
                    if (document.hidden && Notification.permission === 'granted') {
                        const sender = users.find(u => u.id === data.lastNudge);
                        const senderName = sender?.name || 'Alguém';
                        new Notification(`${senderName} enviou um ZUMBIDO!`, { body: "⚠️ ATENÇÃO!", icon: '/vite.svg', tag: 'nudge', renotify: true });
                    }
                }
            }
        }
    });
    return () => unsub();
  }, [user, users]);

  const triggerGlobalShake = (senderId) => {
      setNotificationUserId(senderId);
      const audio = new Audio(REAL_NUDGE_SOUND_URL);
      audio.volume = 0.8;
      audio.play().catch(e => console.log("Audio error", e));
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      document.body.classList.add('animate-shake');
      setTimeout(() => document.body.classList.remove('animate-shake'), 1000);
  };

  const handleSendMessage = async (text, attachment = null, replyTo = null, type = 'text') => {
      if (!user || !currentConversationId) return;

      // Garante que para de digitar ao enviar
      updateTypingStatus(false);

      const newMessageData = {
          text: text, userId: user.uid, userName: userName, userAvatar: userAvatar,
          timestamp: Date.now(), createdAt: serverTimestamp(), 
          type: type, replyTo: replyTo, attachment: attachment, reactions: [], mentions: [] 
      };

      try {
          await addDoc(collection(db, `conversations/${currentConversationId}/messages`), newMessageData);
          
          let messagePreview = text;
          if (type === 'nudge') messagePreview = '🔔 ZUMBIDO!';
          else if (type === 'audio') messagePreview = '🎵 Mensagem de Voz';
          else if (attachment) messagePreview = '📎 Anexo';

          await setDoc(doc(db, 'conversations', currentConversationId), {
              lastMessageAt: serverTimestamp(),
              lastMessageText: messagePreview,
              lastSenderId: user.uid,
              messageCount: increment(1) 
          }, { merge: true });

          if (type === 'nudge' && isDM) {
              const parts = currentConversationId.split('_');
              const otherUserId = parts.find(id => id !== user.uid);
              if(otherUserId) {
                  updateDoc(doc(db, 'users', otherUserId), { lastNudge: user.uid, lastNudgeTime: serverTimestamp() });
              }
          }
      } catch (error) { console.error("Erro envio:", error); }
  };

  const handleReaction = async (msgId, emoji) => {}; 
  
  const handleDeleteMessage = (msgId) => { 
      setMessageToDeleteId(msgId);
      setShowDeleteModal(true);
  };

  const confirmDeleteMessage = async () => {
      if (!messageToDeleteId) return;
      try {
          await deleteDoc(doc(db, `conversations/${currentConversationId}/messages`, messageToDeleteId)); 
          setShowDeleteModal(false);
          setMessageToDeleteId(null);
      } catch(error) {
          console.error("Erro ao apagar:", error);
          alert("Erro ao apagar mensagem: " + error.message);
          setShowDeleteModal(false);
      }
  };
  
  const handlePinMessage = async (msg) => {
      if(pinnedMessage) await updateDoc(doc(db, `conversations/${currentConversationId}/messages`, pinnedMessage.id), { isPinned: false });
      await updateDoc(doc(db, `conversations/${currentConversationId}/messages`, msg.id), { isPinned: true });
  };

  const handleUnpinMessage = async () => {
      if(pinnedMessage) {
          await updateDoc(doc(db, `conversations/${currentConversationId}/messages`, pinnedMessage.id), { isPinned: false });
          setPinnedMessage(null);
      }
  };

  const selectChannel = (channelId) => {
      setMessagesLimit(20); 
      setCurrentConversationId(channelId);
      const ch = channels.find(c => c.id === channelId);
      setCurrentConversationName(ch ? `# ${ch.name}` : channelId);
      setIsDM(false);
      updateTypingStatus(false); // Limpa status se mudar de tela
      if(notificationUserId) setNotificationUserId(null);
  };

  const selectDM = (otherUser) => {
      setMessagesLimit(20); 
      const dmId = getDMId(user.uid, otherUser.id);
      setCurrentConversationId(dmId);
      setCurrentConversationName(otherUser.displayName || otherUser.name);
      setIsDM(true);
      updateTypingStatus(false); // Limpa status se mudar de tela
      if(notificationUserId === otherUser.id) setNotificationUserId(null);
  };
  
  const handleChangeName = (newName, newAvatar) => {
      setUserName(newName);
      if(newAvatar) setUserAvatar(newAvatar);
  };
  
  const toggleTheme = () => {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      if (newMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const handleGoogleLogin = async () => {
      setAuthLoading(true); setAuthError('');
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(auth, provider); } catch (error) { setAuthError(error.message); }
      setAuthLoading(false);
  };

  const handleEmailLogin = async (e) => {
      e.preventDefault();
      setAuthLoading(true); setAuthError('');
      try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { 
        if(error.code === 'auth/invalid-credential') setAuthError("Email ou senha incorretos.");
        else setAuthError("Erro ao entrar: " + error.code);
      }
      setAuthLoading(false);
  };

  const handleRegister = async (e) => {
      e.preventDefault();
      setAuthLoading(true); setAuthError('');
      try {
          const res = await createUserWithEmailAndPassword(auth, email, password);
          const nameFromEmail = email.split('@')[0];
          await setDoc(doc(db, 'users', res.user.uid), {
             name: nameFromEmail,
             email: email,
             photoURL: null,
             lastSeen: serverTimestamp(),
             isOnline: true
          });
      } catch (error) {
          if(error.code === 'auth/email-already-in-use') setAuthError("Este email já está em uso.");
          else if(error.code === 'auth/weak-password') setAuthError("A senha deve ter pelo menos 6 caracteres.");
          else setAuthError("Erro ao criar conta: " + error.code);
      }
      setAuthLoading(false);
  };

  const handleResetPassword = async (e) => {
      e.preventDefault();
      if(!resetEmail) return alert("Digite seu e-mail.");
      try {
          await sendPasswordResetEmail(auth, resetEmail);
          alert("Email de redefinição enviado! Verifique sua caixa de entrada.");
          setShowResetModal(false);
      } catch(error) {
          alert("Erro: " + error.message);
      }
  };

  const handleLogout = () => signOut(auth);

  if (!user) {
    // (Login permanece igual)
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors p-4">
        {showResetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-bounce-in">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">Recuperar Senha</h3>
                    <p className="text-sm text-gray-500 mb-4">Digite seu e-mail para receber um link de redefinição.</p>
                    <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="seu@email.com" className="w-full p-3 mb-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"/>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowResetModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button onClick={handleResetPassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Enviar</button>
                    </div>
                </div>
            </div>
        )}
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
            <div className="w-full p-8 flex flex-col justify-center relative">
                <div className="mb-6 text-center">
                    <h1 className="text-4xl font-extrabold text-[#00a884] mb-2 tracking-tight">LucraChat</h1>
                    <p className="text-gray-500 dark:text-gray-400">Conecte-se e colabore com sua equipe.</p>
                </div>
                {authError && (<div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm rounded flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{authError}</div>)}
                <form onSubmit={isRegistering ? handleRegister : handleEmailLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition" placeholder="nome@exemplo.com"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition" placeholder="••••••••"/>
                        </div>
                    </div>
                    {!isRegistering && (<div className="flex justify-end"><button type="button" onClick={() => setShowResetModal(true)} className="text-sm text-[#00a884] hover:underline">Esqueceu a senha?</button></div>)}
                    <button type="submit" disabled={authLoading} className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center">{authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Criar Conta' : 'Entrar')}</button>
                </form>
                <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Ou continue com</span></div></div>
                <button onClick={handleGoogleLogin} className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-3"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" /><span>Google</span></button>
                <div className="mt-6 text-center"><p className="text-gray-600 dark:text-gray-400 text-sm">{isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}<button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="ml-2 font-bold text-[#00a884] hover:underline focus:outline-none">{isRegistering ? 'Fazer Login' : 'Cadastre-se'}</button></p></div>
            </div>
        </div>
      </div>
    );
  }

  const currentChannelData = channels.find(c => c.id === currentConversationId);

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark' : ''} ${notificationUserId ? 'animate-shake' : ''}`}>
        <Sidebar 
            user={user}
            userName={userName}
            users={mergedUsers} 
            channels={channels}
            currentConversationId={currentConversationId}
            isDM={isDM}
            showAdminPanel={showAdminPanel}
            setShowAdminPanel={setShowAdminPanel}
            selectChannel={selectChannel}
            selectDM={selectDM}
            onChangeName={handleChangeName}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            notificationUserId={notificationUserId}
            unreadMap={unreadMap}
        />
        
        <ChatArea 
            messages={messages}
            userId={user?.uid}
            currentConversationName={currentConversationName}
            currentConversationId={currentConversationId}
            isDM={isDM}
            showAdminPanel={showAdminPanel}
            setShowAdminPanel={setShowAdminPanel}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSendMessage={handleSendMessage}
            onReaction={handleReaction}
            onDelete={handleDeleteMessage}
            isDarkMode={isDarkMode}
            
            // RESTAURADO: Passando a função correta
            onTyping={updateTypingStatus}
            typingUsers={typingUsers}
            
            pinnedMessage={pinnedMessage}
            onPin={handlePinMessage}
            onUnpin={handleUnpinMessage}
            currentChannel={currentChannelData}
            allUsers={mergedUsers} 
            onLoadMore={handleLoadMoreMessages} 
        />

        {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowDeleteModal(false)}>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm transform scale-100 transition-all border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center mb-4 text-red-600 dark:text-red-500">
                        <Trash2 className="w-6 h-6 mr-3" />
                        <h3 className="text-lg font-bold">Excluir mensagem?</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                        Esta ação não poderá ser desfeita. A mensagem será apagada permanentemente para todos na conversa.
                    </p>
                    
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition">Cancelar</button>
                        <button onClick={confirmDeleteMessage} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition transform active:scale-95">Sim, Excluir</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;