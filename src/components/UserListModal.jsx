import React, { useState } from 'react';
import { Search, X, User } from 'lucide-react';

// Agora recebe 'users' diretamente do pai (Sidebar)
const UserListModal = ({ onClose, onSelectUser, currentUserId, users = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Não precisamos mais de useEffect para buscar dados no banco!
  // Usamos a lista 'users' que já é real-time

  const filteredUsers = users.filter(user => {
      // Remove o próprio usuário da lista
      if (user.id === currentUserId) return false;
      
      const searchLower = searchTerm.toLowerCase();
      
      // Busca pelo nome atualizado ou email
      const name = (user.name || user.displayName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return name.includes(searchLower) || email.includes(searchLower);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
        <div className="bg-gray-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-700" onClick={e => e.stopPropagation()}>
            
            {/* Cabeçalho */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                <h3 className="font-bold text-lg text-white">Nova Conversa</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>

            {/* Busca */}
            <div className="p-4 border-b border-gray-700 bg-gray-800">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent transition"
                        autoFocus
                    />
                </div>
            </div>

            {/* Lista */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>Nenhum usuário encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredUsers.map(user => (
                            <button 
                                key={user.id} 
                                onClick={() => onSelectUser(user)}
                                className="w-full flex items-center p-3 hover:bg-gray-700/50 rounded-lg transition text-left group"
                            >
                                {user.photoURL ? (
                                    <img src={user.photoURL} className="w-10 h-10 rounded-full mr-3 object-cover border border-gray-600" alt={user.name} />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center mr-3 border border-blue-500/30">
                                        <User className="w-5 h-5 text-blue-400" />
                                    </div>
                                )}
                                
                                <div className="flex flex-col overflow-hidden">
                                    {/* Prioriza o 'name' (banco) sobre o 'displayName' */}
                                    <span className="font-medium text-gray-200 truncate group-hover:text-white">
                                        {user.name || user.displayName || 'Usuário'}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate">{user.email}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default UserListModal;