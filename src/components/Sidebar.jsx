import React, { useState, useEffect } from 'react';
import { Hash, User, Settings, Sun, Moon, Edit3, LogOut, Plus, Zap, Lock, X } from 'lucide-react'; 
import { auth } from '../firebaseConfig'; 
import { signOut } from 'firebase/auth'; 
import AdminPanel from './AdminPanel';
import ProfileModal from './ProfileModal'; 
import UserListModal from './UserListModal'; 
import { getDMId } from '../utils';

const Sidebar = ({ 
    user, 
    userName, 
    users, 
    channels, 
    currentConversationId, 
    isDM, 
    showAdminPanel, 
    setShowAdminPanel, 
    selectChannel, 
    selectDM, 
    onChangeName, 
    isDarkMode, 
    toggleTheme,
    notificationUserId, 
    unreadMap = {} 
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  
  const [activeDMs, setActiveDMs] = useState([]); 

  // 1. CARREGAR E ATUALIZAR CONVERSAS
  useEffect(() => {
      if (!user || users.length === 0) return;

      const savedOpenDMs = JSON.parse(localStorage.getItem(`openDMs_${user.uid}`)) || [];
      const restoredDMs = users.filter(u => savedOpenDMs.includes(u.id));
      
      const unreadUserIds = [];
      Object.keys(unreadMap).forEach(chatId => {
          if (chatId.includes('_')) {
              const parts = chatId.split('_');
              if (parts.includes(user.uid)) {
                  const otherUserId = parts.find(id => id !== user.uid);
                  if (otherUserId) unreadUserIds.push(otherUserId);
              }
          }
      });

      const allIdsToShow = [...new Set([...savedOpenDMs, ...unreadUserIds])];
      const finalDMs = users.filter(u => allIdsToShow.includes(u.id));

      setActiveDMs(finalDMs);
  }, [user, users]); 

  // 2. MONITORAR NOVAS MENSAGENS
  useEffect(() => {
      if (!user || !users.length) return;
      
      let hasNew = false;
      const currentIds = activeDMs.map(u => u.id);
      const newDMs = [...activeDMs];

      Object.keys(unreadMap).forEach(chatId => {
          if (chatId.includes('_')) {
              const parts = chatId.split('_');
              if (parts.includes(user.uid)) {
                  const otherUserId = parts.find(id => id !== user.uid);
                  
                  if (otherUserId && !currentIds.includes(otherUserId)) {
                      const userObj = users.find(u => u.id === otherUserId);
                      if (userObj) {
                          newDMs.push(userObj);
                          hasNew = true;
                          saveOpenDM(otherUserId); 
                      }
                  }
              }
          }
      });

      if (hasNew) {
          setActiveDMs(newDMs);
      }
  }, [unreadMap, users, user]);

  const saveOpenDM = (friendId) => {
      if (!user) return;
      const currentSaved = JSON.parse(localStorage.getItem(`openDMs_${user.uid}`)) || [];
      if (!currentSaved.includes(friendId)) {
          const newSaved = [...currentSaved, friendId];
          localStorage.setItem(`openDMs_${user.uid}`, JSON.stringify(newSaved));
      }
  };

  const closeDM = (e, friendId) => {
      e.stopPropagation(); 
      const newActive = activeDMs.filter(u => u.id !== friendId);
      setActiveDMs(newActive);

      if (user) {
          const currentSaved = JSON.parse(localStorage.getItem(`openDMs_${user.uid}`)) || [];
          const newSaved = currentSaved.filter(id => id !== friendId);
          localStorage.setItem(`openDMs_${user.uid}`, JSON.stringify(newSaved));
      }
  };

  const handleSaveProfile = (newName, newAvatar) => {
      if (onChangeName && user) {
          localStorage.setItem(`chatUserName_${user.uid}`, newName);
          if (newAvatar) localStorage.setItem(`chatUserAvatar_${user.uid}`, newAvatar);
          window.location.reload(); 
      }
  };

  const handleLogout = async () => {
      try {
          await signOut(auth);
          window.location.reload(); 
      } catch (error) {
          console.error("Erro ao sair:", error);
      }
  };

  const handleUserSelect = (selectedUser) => {
      if (!activeDMs.some(u => u.id === selectedUser.id)) {
          setActiveDMs(prev => [...prev, selectedUser]);
      }
      saveOpenDM(selectedUser.id);
      
      const freshUser = users.find(u => u.id === selectedUser.id) || selectedUser;

      selectDM({
          ...freshUser,
          name: freshUser.name || freshUser.displayName || 'Usuário'
      });
      setShowUserListModal(false);
  };

  return (
    <div className="flex-shrink-0 w-1/4 md:w-64 bg-gray-900 text-white flex flex-col hidden sm:flex h-full border-r border-gray-800">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#00a884]">LucraChat</h2>
          
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full hover:bg-gray-800 transition text-gray-400 hover:text-yellow-400"
            title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Usuário Logado */}
        <div className="p-4 bg-gray-800 flex items-center justify-between border-b border-gray-700">
            <button 
                onClick={() => setShowProfileModal(true)} 
                className="flex items-center text-sm font-medium hover:text-[#00a884] transition truncate w-full group"
                title="Editar Perfil"
            >
              <div className="relative">
                  {localStorage.getItem(`chatUserAvatar_${user?.uid}`) ? (
                      <img src={localStorage.getItem(`chatUserAvatar_${user?.uid}`)} className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-600" alt="Avatar" />
                  ) : (
                      <User className="w-8 h-8 p-1 bg-gray-700 rounded-full mr-2 text-[#00a884] flex-shrink-0" />
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-[#00a884] rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                      <Edit3 className="w-2 h-2 text-white" />
                  </div>
              </div>
              <div className="flex flex-col items-start truncate">
                  <span className="truncate font-bold">{userName}</span>
                  <span className="text-xs text-gray-400 font-normal">Editar Perfil</span>
              </div>
            </button>
        </div>

        {showProfileModal && (
            <ProfileModal 
                currentUser={userName}
                currentAvatar={localStorage.getItem(`chatUserAvatar_${user?.uid}`)}
                onClose={() => setShowProfileModal(false)}
                onSave={handleSaveProfile}
            />
        )}

        {showUserListModal && (
            <UserListModal 
                onClose={() => setShowUserListModal(false)}
                onSelectUser={handleUserSelect}
                currentUserId={user?.uid}
                users={users} // AQUI ESTÁ A CORREÇÃO: Passando a lista viva
            />
        )}

        <div className="p-4 border-b border-gray-800">
             <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={`flex items-center justify-center w-full p-2 rounded-lg transition duration-150 font-semibold text-sm ${
                    showAdminPanel ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                }`}
            >
                <Settings className="w-4 h-4 mr-2" />
                {showAdminPanel ? 'Fechar Admin' : 'Gerenciar Canais'}
            </button>
        </div>

        {showAdminPanel ? (
            <AdminPanel 
                channels={channels} 
                users={users} 
                currentUser={user} 
                onClose={() => setShowAdminPanel(false)} 
            />
        ) : (
            <div className="p-4 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-gray-700 flex flex-col">
                <div className="flex-grow">
                    <h3 className="text-xs font-semibold mb-3 text-gray-500 uppercase tracking-wider">Canais</h3>
                    {channels.length === 0 && (
                        <div className="text-xs text-gray-500 italic mb-4 px-2">Nenhum canal encontrado.</div>
                    )}
                    <div className="space-y-1 mb-6">
                        {channels.map(channel => {
                            const isActive = currentConversationId === channel.id && !isDM;
                            const unreadCount = unreadMap[channel.id];
                            const isPrivate = channel.allowedUsers && channel.allowedUsers.length > 0;

                            return (
                                <div
                                    key={channel.id}
                                    onClick={() => selectChannel(channel.id, channel.name)}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition duration-150 ${
                                        isActive
                                            ? 'bg-[#00a884] text-white font-medium shadow-sm'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center truncate">
                                        {isPrivate ? <Lock className={`w-3 h-3 mr-3 flex-shrink-0 ${isActive ? 'text-green-100' : 'text-gray-600'}`} /> : <Hash className={`w-4 h-4 mr-3 flex-shrink-0 ${isActive ? 'text-green-100' : 'text-gray-600'}`} />}
                                        <span className={`truncate ${unreadCount > 0 && !isActive ? 'font-bold text-white' : ''}`}>
                                            {channel.name}
                                        </span>
                                    </div>
                                    
                                    {unreadCount > 0 && !isActive && (
                                        <div className="min-w-[20px] h-5 px-1 bg-[#00a884] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm animate-pulse">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mensagens Diretas</h3>
                        <button onClick={() => setShowUserListModal(true)} className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition" title="Nova Conversa">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-1">
                        {activeDMs.length === 0 && (
                            <p className="text-xs text-gray-600 italic px-2">Nenhuma conversa aberta.</p>
                        )}
                        {activeDMs.filter(u => u.id !== user?.uid).map(u => {
                            const liveUser = users.find(user => user.id === u.id) || u;
                            
                            const displayName = liveUser.name || liveUser.displayName || 'Usuário';
                            const displayAvatar = liveUser.photoURL;
                            const isOnline = liveUser.isOnline;

                            const isNudging = notificationUserId === u.id;
                            const isActive = isDM && getDMId(user?.uid, u.id) === currentConversationId;
                            const dmId = getDMId(user?.uid, u.id);
                            const unreadCount = unreadMap[dmId];
                            
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => handleUserSelect(liveUser)} 
                                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition duration-150 relative ${
                                        isActive
                                            ? 'bg-[#00a884] text-white font-medium shadow-sm'
                                            : isNudging 
                                                ? 'bg-yellow-500/20 text-yellow-400 animate-pulse border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center truncate flex-grow">
                                        <div className="relative">
                                            {displayAvatar ? (
                                                <img src={displayAvatar} className={`w-5 h-5 rounded-full mr-3 object-cover ${isNudging ? 'ring-2 ring-yellow-500 animate-bounce' : ''}`} alt="avatar" />
                                            ) : (
                                                <User className={`w-4 h-4 mr-3 ${isNudging ? 'text-yellow-500 animate-bounce' : (isActive ? 'text-green-100' : 'text-gray-600')}`} />
                                            )}
                                            {isOnline && (
                                                <div className="absolute -bottom-0.5 right-2 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full" title="Online"></div>
                                            )}
                                        </div>
                                        
                                        <span className={`truncate flex-grow ${isNudging ? 'font-bold' : ''} ${unreadCount > 0 && !isActive ? 'font-bold text-white' : ''}`}>
                                            {displayName}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center ml-2">
                                        {isNudging && <Zap className="w-4 h-4 text-yellow-500 fill-current animate-bounce" />}
                                        
                                        {unreadCount > 0 && !isActive && !isNudging && (
                                            <div className="min-w-[20px] h-5 px-1 bg-[#00a884] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </div>
                                        )}

                                        <button 
                                            onClick={(e) => closeDM(e, u.id)}
                                            className={`ml-2 p-1 rounded-full hover:bg-gray-700/50 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-white/70 hover:text-white' : ''}`}
                                            title="Fechar Conversa"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800">
                    <button onClick={handleLogout} className="flex items-center w-full p-2 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition text-sm font-medium"><LogOut className="w-4 h-4 mr-3" />Sair da Conta</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Sidebar;