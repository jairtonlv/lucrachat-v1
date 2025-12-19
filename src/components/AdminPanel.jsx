import React, { useState } from 'react';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Hash, Plus, Trash2, X, Lock, Check, Edit2, RotateCcw } from 'lucide-react';

const AdminPanel = ({ channels, users = [], currentUser, onClose }) => {
  const [channelInputValue, setChannelInputValue] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estado para controlar se estamos editando
  const [editingChannelId, setEditingChannelId] = useState(null);

  // Toggle de seleção de usuário
  const toggleUser = (userId) => {
      setSelectedUsers(prev => {
          if (prev.includes(userId)) {
              return prev.filter(id => id !== userId);
          } else {
              return [...prev, userId];
          }
      });
  };

  // Função para PREPARAR a edição
  const startEditing = (channel) => {
      setEditingChannelId(channel.id);
      setChannelInputValue(channel.name);
      
      // Carrega os usuários que já estão no canal (exceto eu mesmo, pois sou fixo)
      if (channel.allowedUsers && Array.isArray(channel.allowedUsers)) {
          const usersInChannel = channel.allowedUsers.filter(uid => uid !== currentUser.uid);
          setSelectedUsers(usersInChannel);
      } else {
          setSelectedUsers([]); // Se for público, zera a seleção
      }
  };

  // Função para CANCELAR a edição
  const cancelEditing = () => {
      setEditingChannelId(null);
      setChannelInputValue('');
      setSelectedUsers([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!channelInputValue || channelInputValue.trim() === '') return;

    setIsProcessing(true); 
    try {
      // Lógica dos Membros (Se tiver selecionado, é privado. Inclui o criador/editor)
      let finalAllowedUsers = null;
      if (selectedUsers.length > 0) {
          finalAllowedUsers = [...selectedUsers, currentUser.uid];
          // Remove duplicatas se houver
          finalAllowedUsers = [...new Set(finalAllowedUsers)];
      }

      if (editingChannelId) {
          // --- MODO EDIÇÃO ---
          const channelRef = doc(db, 'rooms', editingChannelId);
          
          await updateDoc(channelRef, {
              name: channelInputValue.trim(),
              allowedUsers: finalAllowedUsers // Se for null, o campo pode ser removido ou setado como null dependendo da lógica, aqui vamos substituir
          });
          
          // Se for null (público), precisamos garantir que o campo seja atualizado corretamente no Firestore
          if (finalAllowedUsers === null) {
              await updateDoc(channelRef, { allowedUsers: [] });
          }

          alert(`Canal atualizado com sucesso!`);
          setEditingChannelId(null);

      } else {
          // --- MODO CRIAÇÃO ---
          const channelId = channelInputValue.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
          const newChannelRef = doc(db, 'rooms', channelId);
          
          const dataToSave = { 
              name: channelInputValue.trim(), 
              order: channels.length + 1,
              createdAt: serverTimestamp()
          };

          if (finalAllowedUsers) {
              dataToSave.allowedUsers = finalAllowedUsers;
          }

          await setDoc(newChannelRef, dataToSave);
          alert(`Canal "${channelInputValue}" criado com sucesso!`);
      }

      // Limpa o form
      setChannelInputValue('');
      setSelectedUsers([]);

    } catch (error) {
      console.error("Erro:", error);
      alert("ERRO: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteChannel = async (channelId, channelName) => {
      if (channelId === 'geral') {
          alert("O canal Geral não pode ser excluído.");
          return;
      }
      if (window.confirm(`Tem certeza que deseja excluir o canal #${channelName}? Todas as mensagens serão perdidas.`)) {
          try {
              await deleteDoc(doc(db, 'rooms', channelId));
          } catch (error) {
              console.error("Erro ao excluir:", error);
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
            <h3 className="text-lg font-bold text-[#00a884]">Gerenciar Canais</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-full text-gray-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* FORMULÁRIO (CRIAÇÃO OU EDIÇÃO) */}
        <div className={`p-4 rounded-xl mb-6 shadow-md border transition-colors duration-300 ${editingChannelId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-700'}`}>
            <h4 className={`text-sm font-bold mb-3 flex items-center ${editingChannelId ? 'text-blue-400' : 'text-[#00a884]'}`}>
                {editingChannelId ? <Edit2 className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />} 
                {editingChannelId ? 'Editar Canal' : 'Novo Canal'}
            </h4>
            
            <form onSubmit={handleSave} className="space-y-4">
                <input 
                    type="text" 
                    value={channelInputValue}
                    onChange={(e) => setChannelInputValue(e.target.value)}
                    placeholder="Nome do canal (ex: marketing)" 
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] outline-none transition"
                />
                
                {/* SELEÇÃO DE USUÁRIOS */}
                <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">Quem pode acessar? (Deixe vazio para Público)</p>
                    <div className="max-h-40 overflow-y-auto bg-gray-900 border border-gray-600 rounded-lg p-2 custom-scrollbar">
                        {users.filter(u => u.id !== currentUser?.uid).map(user => (
                            <div 
                                key={user.id} 
                                onClick={() => toggleUser(user.id)}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer mb-1 transition ${selectedUsers.includes(user.id) ? 'bg-[#00a884]/20 border border-[#00a884]/50' : 'hover:bg-gray-800'}`}
                            >
                                <div className="flex items-center overflow-hidden">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} className="w-6 h-6 rounded-full mr-2" alt="avatar" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center mr-2 text-xs">
                                            {user.name?.[0] || '?'}
                                        </div>
                                    )}
                                    <span className="truncate text-sm">{user.name || user.displayName}</span>
                                </div>
                                {selectedUsers.includes(user.id) && <Check className="w-4 h-4 text-[#00a884]" />}
                            </div>
                        ))}
                        {users.length <= 1 && <p className="text-xs text-gray-500 text-center py-2">Nenhum outro usuário disponível.</p>}
                    </div>
                    {selectedUsers.length > 0 ? (
                        <p className="text-xs text-[#00a884] flex items-center"><Lock className="w-3 h-3 mr-1" /> Canal Privado com {selectedUsers.length} membro(s).</p>
                    ) : (
                        <p className="text-xs text-gray-500 flex items-center"><Hash className="w-3 h-3 mr-1" /> Canal Público (Todos veem).</p>
                    )}
                </div>

                <div className="flex gap-2">
                    {editingChannelId && (
                        <button 
                            type="button"
                            onClick={cancelEditing}
                            className="w-1/3 p-3 rounded-lg font-bold text-sm uppercase transition bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" /> Cancelar
                        </button>
                    )}
                    
                    <button 
                        type="submit" 
                        className={`flex-grow p-3 rounded-lg font-bold text-sm uppercase transition shadow-lg 
                            ${isProcessing 
                                ? 'bg-gray-600 cursor-not-allowed' 
                                : editingChannelId 
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                                    : 'bg-[#00a884] hover:bg-[#008f6f] text-white'
                            }`}
                        disabled={!channelInputValue.trim() || isProcessing}
                    >
                        {isProcessing ? 'Salvando...' : (editingChannelId ? 'Salvar Alterações' : 'Criar Canal')}
                    </button>
                </div>
            </form>
        </div>

        {/* LISTA DE CANAIS EXISTENTES */}
        <div className="space-y-2 pb-10">
            <h4 className="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wider">Canais Ativos</h4>
            {channels.map(channel => {
                const isPrivate = channel.allowedUsers && channel.allowedUsers.length > 0;
                const isEditing = editingChannelId === channel.id;

                return (
                    <div 
                        key={channel.id} 
                        className={`flex items-center justify-between p-3 rounded-lg text-sm border transition ${
                            isEditing 
                                ? 'bg-blue-900/10 border-blue-500 ring-1 ring-blue-500' 
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                    >
                        <span className="flex items-center font-medium text-gray-200">
                            {isPrivate ? <Lock className="w-4 h-4 mr-3 text-yellow-500" /> : <Hash className="w-4 h-4 mr-3 text-gray-500" />}
                            {channel.name}
                        </span>
                        
                        <div className="flex items-center gap-1">
                            {/* BOTÃO EDITAR */}
                            <button
                                onClick={() => startEditing(channel)}
                                className={`p-2 rounded transition ${isEditing ? 'text-blue-400 bg-blue-900/30' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-900/20'}`}
                                title="Editar Canal"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>

                            {/* BOTÃO EXCLUIR */}
                            <button
                                onClick={() => deleteChannel(channel.id, channel.name)}
                                className="p-2 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition"
                                disabled={channel.id === 'geral'} 
                                title={channel.id === 'geral' ? "Geral não pode ser excluído" : "Excluir canal"}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default AdminPanel;