import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { X, User, Search, Loader2 } from 'lucide-react';

const UserListModal = ({ onClose, onSelectUser, currentUserId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef);
        const querySnapshot = await getDocs(q);
        
        const fetchedUsers = [];
        querySnapshot.forEach((doc) => {
          // Não mostra o próprio usuário na lista
          if (doc.id !== currentUserId) {
            fetchedUsers.push({ id: doc.id, ...doc.data() });
          }
        });
        
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Nova Conversa</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Busca */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="flex-grow overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              Nenhum usuário encontrado.
            </div>
          ) : (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="w-full flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition text-left group"
              >
                {user.photoURL ? (
                   <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full object-cover mr-3 border border-gray-200 dark:border-gray-600" />
                ) : (
                   <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3 text-blue-600 dark:text-blue-400">
                      <User className="w-5 h-5" />
                   </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {user.displayName || 'Sem Nome'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserListModal;