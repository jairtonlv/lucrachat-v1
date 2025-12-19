import React, { useState, useRef } from 'react';
import { X, Camera, User, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { updatePassword, updateProfile } from 'firebase/auth'; // Importamos updateProfile
import { doc, updateDoc } from 'firebase/firestore'; // Importamos updateDoc do Firestore
import { auth, db } from '../firebaseConfig'; 

const ProfileModal = ({ currentUser, currentAvatar, onClose }) => {
  // Pega o usuário real do Auth para garantir
  const user = auth.currentUser;
  
  const [name, setName] = useState(user?.displayName || currentUser || '');
  const [avatar, setAvatar] = useState(user?.photoURL || currentAvatar || null);
  const [preview, setPreview] = useState(user?.photoURL || currentAvatar || null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // Senha
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatar(reader.result); // Aqui seria ideal subir pro Storage, mas Base64 funciona pra teste
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
        if (!user) throw new Error("Usuário não identificado.");

        // 1. Atualizar Nome e Foto no Auth e no Banco
        if (name !== user.displayName || avatar !== user.photoURL) {
            // Atualiza Auth (Login)
            await updateProfile(user, {
                displayName: name,
                photoURL: avatar
            });

            // Atualiza Firestore (Banco de Usuários) para aparecer na lista de contatos
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                name: name,
                photoURL: avatar
            });
        }

        // 2. Atualizar Senha (se preenchido)
        if (showPasswordSection && newPassword) {
            if (newPassword.length < 6) throw new Error("Senha muito curta.");
            if (newPassword !== confirmPassword) throw new Error("Senhas não conferem.");
            
            await updatePassword(user, newPassword);
        }

        setStatusMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        
        // Recarrega a página após 1.5s para refletir tudo
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        console.error(error);
        if (error.code === 'auth/requires-recent-login') {
            setStatusMsg({ type: 'error', text: 'Para mudar a senha, saia e entre novamente.' });
        } else {
            setStatusMsg({ type: 'error', text: error.message });
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            
            <div className="bg-[#00a884] p-6 text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
                <div className="relative inline-block group">
                    <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-gray-200 dark:bg-gray-700 mx-auto">
                        {preview ? <img src={preview} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 text-gray-400" />}
                    </div>
                    <button onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow text-[#00a884]"><Camera className="w-4 h-4" /></button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
                <h2 className="text-white text-xl font-bold mt-4">Editar Perfil</h2>
            </div>

            <div className="p-6 space-y-4">
                {statusMsg.text && (
                    <div className={`p-2 rounded text-sm font-bold flex items-center ${statusMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2"/> : <AlertCircle className="w-4 h-4 mr-2"/>}
                        {statusMsg.text}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seu Nome</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white" />
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <button onClick={() => setShowPasswordSection(!showPasswordSection)} className="flex items-center text-sm font-bold text-[#00a884] hover:underline">
                        <Lock className="w-4 h-4 mr-2" /> {showPasswordSection ? 'Cancelar alteração de senha' : 'Quero alterar minha senha'}
                    </button>

                    {showPasswordSection && (
                        <div className="mt-4 space-y-3">
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 rounded-lg text-sm dark:text-white" placeholder="Nova Senha" />
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 rounded-lg text-sm dark:text-white" placeholder="Confirmar Senha" />
                        </div>
                    )}
                </div>

                <button onClick={handleSave} disabled={loading} className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3 px-4 rounded-lg shadow-md flex items-center justify-center mt-4 disabled:opacity-50">
                    {loading ? 'Salvando...' : <><Save className="w-5 h-5 mr-2" /> Salvar Alterações</>}
                </button>
            </div>
        </div>
    </div>
  );
};

export default ProfileModal;