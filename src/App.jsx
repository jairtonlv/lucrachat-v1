import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { auth, db, storage } from './firebaseConfig';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { Loader2, Lock, Mail } from 'lucide-react';
import { getDMId } from './utils';

const App = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversationName, setCurrentConversationName] = useState('');
  const [currentChannel, setCurrentChannel] = useState(null); 
  const [isDM, setIsDM] = useState(false);
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [newMessage, setNewMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [notificationUserId, setNotificationUserId] = useState(null);

  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showLogin, setShowLogin] = useState(true);

  // Zumbido e Pinned
  const [typingUsers, setTypingUsers] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [shake, setShake] = useState(false);

  // Scroll Infinito
  const [messagesLimit, setMessagesLimit] = useState(20);

  // Tema Escuro/Claro
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await setDoc(doc(db, 'users', currentUser.uid), {
          name: currentUser.displayName || currentUser.email.split('@')[0],
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          id: currentUser.uid,
          isOnline: true,
          lastSeen: serverTimestamp()
        }, { merge: true });
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Carregar Usuários e Canais
  useEffect(() => {
    if (!user) return;

    // Usuários
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    });

    // Canais (Rooms)
    const qRooms = query(collection(db, 'rooms'), orderBy('createdAt', 'asc'));
    const unsubRooms = onSnapshot(qRooms, (snapshot) => {
        const roomsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtra canais privados
        const visibleRooms = roomsList.filter(room => {
            if (!room.allowedUsers || room.allowedUsers.length === 0) return true; // Público
            return room.allowedUsers.includes(user.uid); // Privado onde sou membro
        });

        setChannels(visibleRooms);
        
        // Seleciona o primeiro canal se nada estiver selecionado
        if (!currentConversationId && visibleRooms.length > 0) {
            selectChannel(visibleRooms[0].id, visibleRooms[0].name);
        }
    });

    // Monitoramento de Não Lidas e Zumbidos globais
    const qConversations = query(collection(db, 'conversations')); 
    const unsubConversations = onSnapshot(qConversations, (snapshot) => {
       const unreads = {};
       snapshot.docs.forEach(docSnap => {
           const data = docSnap.data();
           const conversationId = docSnap.id;
           
           // Zumbido Global
           if (data.lastNudge && data.lastNudge !== user.uid) {
             const nudgeTime = data.lastNudgeTime?.toMillis ? data.lastNudgeTime.toMillis() : 0;
             if (Date.now() - nudgeTime < 5000) {
                // Descobre quem mandou (se for DM, é o outro ID)
                let senderId = data.lastNudge; 
                setNotificationUserId(senderId);
                setTimeout(() => setNotificationUserId(null), 5000);
             }
           }

           // Contagem de Não Lidas
           if (conversationId !== currentConversationId) {
               const total = data.messageCount || 0;
               const myRead = data[`lastReadCount_${user.uid}`] || 0;
               if (total > myRead) {
                   unreads[conversationId] = total - myRead;
               }
           }
       });
       setUnreadMap(unreads);
    });

    return () => {
        unsubUsers();
        unsubRooms();
        unsubConversations();
    };
  }, [user, currentConversationId]);


  // Carregar Mensagens da Conversa Atual
  useEffect(() => {
    if (!currentConversationId) return;

    setLoading(true);
    setPinnedMessage(null); // Reseta ao trocar de chat
    
    // Zera contagem de não lidas ao entrar
    const conversationRef = doc(db, 'conversations', currentConversationId);
    getDoc(conversationRef).then(snap => {
        if(snap.exists()) {
             const data = snap.data();
             setDoc(conversationRef, { 
                 [`lastReadCount_${user.uid}`]: data.messageCount || 0 
             }, { merge: true });
        }
    });

    // Listener de Mensagens
    const q = query(
        collection(db, `conversations/${currentConversationId}/messages`),
        orderBy('createdAt', 'desc') // Pega do mais novo para o mais velho (para scroll infinito funcionar bem invertido, ou normal array reverse)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      
      // Filtro local para limitar a quantidade exibida inicialmente (simulando paginação)
      const visibleMsgs = msgs.slice(Math.max(msgs.length - messagesLimit, 0));
      
      setMessages(visibleMsgs);
      
      // Verifica Pinned
      const pinned = visibleMsgs.find(m => m.isPinned);
      if (pinned) setPinnedMessage(pinned);
      
      setLoading(false);
    });

    // Listener de "Digitando..."
    const typingRef = collection(db, `conversations/${currentConversationId}/typing`);
    const unsubTyping = onSnapshot(typingRef, (snap) => {
        const typers = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.id !== user?.uid && d.isTyping && (Date.now() - d.timestamp?.toMillis() < 5000));
        setTypingUsers(typers);
    });

    return () => {
        unsubscribe();
        unsubTyping();
    };
  }, [currentConversationId, messagesLimit, user]);

  const loadMoreMessages = () => {
      setMessagesLimit(prev => prev + 20);
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
          await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
          setAuthError('Erro ao entrar: Verifique e-mail e senha.');
      }
  };

  const handleRegister = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
          const res = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(res.user, { displayName: email.split('@')[0] });
          await setDoc(doc(db, 'users', res.user.uid), {
              name: email.split('@')[0],
              email: email,
              photoURL: null,
              id: res.user.uid,
              createdAt: serverTimestamp()
          });
      } catch (error) {
          setAuthError('Erro ao cadastrar: ' + error.message);
      }
  };

  const handleGoogleLogin = async () => {
      const provider = new GoogleAuthProvider();
      try {
          await signInWithPopup(auth, provider);
      } catch (error) {
          console.error("Erro Google:", error);
      }
  };

  const selectChannel = (id, name) => {
      setCurrentConversationId(id);
      setCurrentConversationName(name);
      setIsDM(false);
      
      // Encontra o objeto do canal completo
      const ch = channels.find(c => c.id === id);
      setCurrentChannel(ch || null);
      
      setMessagesLimit(20);
      setShowAdminPanel(false);
  };

  const selectDM = (friend) => {
      const dmId = getDMId(user.uid, friend.id);
      setCurrentConversationId(dmId);
      setCurrentConversationName(friend.name || friend.displayName);
      setIsDM(true);
      setCurrentChannel(null);
      setMessagesLimit(20);
      setShowAdminPanel(false);
  };

  const handleSendMessage = async (text, attachment = null, replyTo = null, type = 'text') => {
      if ((!text.trim() && !attachment && type !== 'nudge') || !currentConversationId) return;

      const conversationRef = doc(db, 'conversations', currentConversationId);
      
      // Se for zumbido
      if (type === 'nudge') {
          triggerGlobalShake();
          
          // Adiciona mensagem de sistema no chat
          await addDoc(collection(db, `conversations/${currentConversationId}/messages`), {
              type: 'nudge',
              text: '🔔 Enviou um zumbido!',
              userId: user.uid,
              userName: user.displayName || user.email,
              userAvatar: user.photoURL,
              createdAt: serverTimestamp(),
              timestamp: Date.now()
          });

          // Atualiza metadados para notificar o outro usuário (mesmo com regras estritas)
          await setDoc(conversationRef, {
              lastNudge: user.uid,
              lastNudgeTime: serverTimestamp(),
              lastMessageAt: serverTimestamp(),
              lastMessageText: '🔔 ZUMBIDO!'
          }, { merge: true });
          
          return;
      }

      // Mensagem Normal (Texto/Imagem/Audio)
      const newMessageData = {
          text: text || '',
          userId: user.uid,
          userName: user.displayName || user.email,
          userAvatar: user.photoURL,
          createdAt: serverTimestamp(),
          timestamp: Date.now(),
          type: attachment ? (attachment.type.startsWith('image') ? 'image' : 'audio') : 'text',
          fileUrl: attachment ? attachment.url : null,
          fileName: attachment ? attachment.name : null,
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, userName: replyTo.userName } : null,
          mentions: [],
          reactions: {},
          isPinned: false
      };

      await addDoc(collection(db, `conversations/${currentConversationId}/messages`), newMessageData);

      // Atualiza contador de mensagens e última mensagem
      const snap = await getDoc(conversationRef);
      const currentCount = snap.exists() ? (snap.data().messageCount || 0) : 0;
      
      await setDoc(conversationRef, {
          lastMessageAt: serverTimestamp(),
          lastMessageText: type === 'image' ? '📷 Imagem' : (type === 'audio' ? '🎤 Áudio' : text),
          messageCount: currentCount + 1,
          [`lastReadCount_${user.uid}`]: currentCount + 1 
      }, { merge: true });
  };

  const handleTyping = async (isTyping) => {
      if (!currentConversationId || !user) return;
      const typingDoc = doc(db, `conversations/${currentConversationId}/typing`, user.uid);
      await setDoc(typingDoc, {
          name: user.displayName || user.email,
          isTyping: isTyping,
          timestamp: serverTimestamp()
      });
  };

  const handleDeleteMessage = async (msgId) => {
      if (!confirm("Apagar mensagem?")) return;
      await deleteDoc(doc(db, `conversations/${currentConversationId}/messages`, msgId));
  };

  const handlePinMessage = async (msg) => {
      if (!msg) return;
      const isPinnedNow = !msg.isPinned;
      
      // Se for fixar, desfixa as outras primeiro (opcional, ou permite múltiplas)
      // Aqui vamos permitir apenas 1 por vez para simplificar a UI
      if (isPinnedNow) {
          const q = query(collection(db, `conversations/${currentConversationId}/messages`), where("isPinned", "==", true));
          const snapshot = await getDocs(q);
          snapshot.forEach(async (d) => {
              await updateDoc(doc(db, `conversations/${currentConversationId}/messages`, d.id), { isPinned: false });
          });
      }

      await updateDoc(doc(db, `conversations/${currentConversationId}/messages`, msg.id), {
          isPinned: isPinnedNow
      });
  };

  // --- CORREÇÃO DO REACTION AQUI ---
  const handleReaction = async (messageId, emoji) => {
    if (!currentConversationId || !user) return;
    try {
      const msgRef = doc(db, `conversations/${currentConversationId}/messages`, messageId);
      const msgSnap = await getDoc(msgRef);

      if (msgSnap.exists()) {
        const data = msgSnap.data();
        const currentReactions = data.reactions || {};

        // Lógica Toggle
        if (currentReactions[user.uid] === emoji) {
           delete currentReactions[user.uid];
        } else {
           currentReactions[user.uid] = emoji;
        }

        // ATUALIZAÇÃO CIRÚRGICA: SÓ MANDA REACTION
        // Isso evita bloqueio das regras de segurança que protegem texto/data
        await updateDoc(msgRef, {
          reactions: currentReactions
        });
      }
    } catch (error) {
      console.error("Erro ao reagir:", error);
    }
  };

  const triggerGlobalShake = () => {
      setShake(true);
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      try {
          const audio = new Audio("/msn_nudge.mp3");
          audio.volume = 0.8;
          audio.play().catch(e => console.log("Audio autoplay block", e));
      } catch(e) {}
      setTimeout(() => setShake(false), 800);
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-gray-900 text-[#00a884]"><Loader2 className="w-10 h-10 animate-spin" /></div>;

  if (!user) {
      return (
          <div className="h-screen flex items-center justify-center bg-gray-950 px-4">
              <div className="w-full max-w-md bg-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-800">
                  <div className="text-center mb-8">
                      <h1 className="text-3xl font-bold text-[#00a884] mb-2">LucraChat</h1>
                      <p className="text-gray-400">Conecte-se e colabore com sua equipe.</p>
                  </div>

                  {authError && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-400 rounded text-sm text-center">{authError}</div>}

                  <form onSubmit={showLogin ? handleLogin : handleRegister} className="space-y-4">
                      <div>
                          <label className="block text-gray-400 text-xs font-bold mb-1 ml-1 uppercase">Email</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition" placeholder="nome@exemplo.com" required />
                          </div>
                      </div>
                      <div>
                          <label className="block text-gray-400 text-xs font-bold mb-1 ml-1 uppercase">Senha</label>
                          <div className="relative">
                              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition" placeholder="••••••••" required minLength={6} />
                          </div>
                          {showLogin && <div className="text-right mt-1"><a href="#" className="text-xs text-[#00a884] hover:underline">Esqueceu a senha?</a></div>}
                      </div>

                      <button type="submit" className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3 rounded-lg transition transform active:scale-95 shadow-lg shadow-[#00a884]/20">
                          {showLogin ? 'Entrar' : 'Criar Conta'}
                      </button>
                  </form>

                  <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
                      <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-900 text-gray-500">Ou continue com</span></div>
                  </div>

                  <button onClick={handleGoogleLogin} className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium py-3 rounded-lg flex items-center justify-center transition">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                      Google
                  </button>

                  <div className="mt-6 text-center text-sm">
                      <span className="text-gray-500">{showLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}</span>
                      <button onClick={() => setShowLogin(!showLogin)} className="ml-1 text-[#00a884] font-bold hover:underline">
                          {showLogin ? 'Cadastre-se' : 'Faça Login'}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${shake ? 'animate-shake' : ''} ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar 
          user={user} 
          userName={user.displayName}
          users={users} 
          channels={channels} 
          currentConversationId={currentConversationId} 
          isDM={isDM}
          showAdminPanel={showAdminPanel}
          setShowAdminPanel={setShowAdminPanel}
          selectChannel={selectChannel}
          selectDM={selectDM}
          onChangeName={(name) => updateProfile(user, { displayName: name })}
          isDarkMode={isDarkMode}
          toggleTheme={() => setIsDarkMode(!isDarkMode)}
          notificationUserId={notificationUserId}
          unreadMap={unreadMap}
      />
      
      {currentConversationId ? (
          <ChatArea 
              messages={messages} 
              userId={user.uid}
              currentConversationName={currentConversationName}
              currentConversationId={currentConversationId}
              isDM={isDM}
              showAdminPanel={showAdminPanel}
              setShowAdminPanel={setShowAdminPanel}
              newMessage={newMessage} 
              setNewMessage={setNewMessage} 
              onSendMessage={handleSendMessage}
              onReaction={handleReaction} // A NOVA FUNÇÃO VAI AQUI
              onDelete={handleDeleteMessage}
              isDarkMode={isDarkMode}
              onTyping={handleTyping}
              typingUsers={typingUsers}
              pinnedMessage={pinnedMessage}
              onPin={handlePinMessage}
              onUnpin={() => handlePinMessage(pinnedMessage)} // Botão de fechar usa a mesma lógica
              currentChannel={currentChannel}
              allUsers={users}
              onLoadMore={loadMoreMessages}
          />
      ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35] text-center p-8 transition-colors duration-300">
               <div className="w-64 h-64 bg-[url('/fundo.png')] opacity-20 bg-contain bg-no-repeat bg-center mb-8"></div>
               <h2 className="text-3xl font-light text-gray-700 dark:text-gray-200 mb-4">LucraChat Web</h2>
               <p className="text-gray-500 dark:text-gray-400 max-w-md">Envie e receba mensagens, faça chamadas de atenção e colabore com sua equipe de forma rápida e segura.</p>
               <div className="mt-8 flex items-center text-gray-400 text-sm"><Lock className="w-3 h-3 mr-1" /> Protegido com criptografia de ponta a ponta</div>
          </div>
      )}
    </div>
  );
};

export default App;