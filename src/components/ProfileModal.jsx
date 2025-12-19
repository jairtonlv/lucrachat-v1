import React, { useState, useRef } from 'react';
import { X, Camera, User, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { updatePassword } from 'firebase/auth'; // Importando a função de senha
import { auth } from '../firebaseConfig'; // Importando o auth

const ProfileModal = ({ currentUser, currentAvatar, onClose, onSave }) => {
  const [name, setName] = useState(currentUser || '');
  const [avatar, setAvatar] = useState(currentAvatar || null);
  const [preview, setPreview] = useState(currentAvatar || null);
  
  // Estados para mudança de senha
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ type: '', msg: '' });

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        // Converte para Base64 para preview imediato e salvamento simples no localStorage
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatar(reader.result);
            setPreview(reader.result);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setPasswordStatus({ type: '', msg: '' });

    // 1. Lógica de Senha (se o usuário abriu a seção e digitou algo)
    if (showPasswordSection && newPassword) {
        if (newPassword.length < 6) {
            setPasswordStatus({ type: 'error', msg: 'A senha deve ter pelo menos 6 caracteres.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordStatus({ type: 'error', msg: 'As senhas não coincidem.' });
            return;
        }

        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                setPasswordStatus({ type: 'success', msg: 'Senha alterada com sucesso!' });
                setNewPassword('');
                setConfirmPassword('');
                // Não fecha o modal imediatamente para o usuário ver a mensagem de sucesso
            }
        } catch (error) {
            console.error("Erro senha:", error);
            if (error.code === 'auth/requires-recent-login') {
                setPasswordStatus({ type: 'error', msg: 'Por segurança, saia e entre novamente para mudar a senha.' });
                return; // Impede de fechar o modal
            } else {
                setPasswordStatus({ type: 'error', msg: 'Erro ao mudar senha: ' + error.message });
                return;
            }
        }
    }

    // 2. Salvar Nome e Foto (Lógica original)
    // Só executa o onSave se não teve erro crítico na senha
    onSave(name, avatar);
    
    // Se só alterou nome/foto, fecha. Se alterou senha com sucesso, fecha após um delay ou deixa o usuário fechar.
    if (!showPasswordSection || passwordStatus.type === 'success') {
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            
            {/* Cabeçalho */}
            <div className="bg-[#00a884] p-6 text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white transition"><X className="w-6 h-6" /></button>
                <div className="relative inline-block group">
                    <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-gray-200 dark:bg-gray-700 mx-auto shadow-lg">
                        {preview ? (
                            <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-full h-full p-4 text-gray-400" />
                        )}
                    </div>
                    <button 
                        onClick={() => fileInputRef.current.click()}
                        className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 text-[#00a884] p-2 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                        title="Alterar foto"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
                <h2 className="text-white text-xl font-bold mt-4">Editar Perfil</h2>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-4">
                
                {/* Nome */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seu Nome</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none transition dark:text-white"
                            placeholder="Digite seu nome..."
                        />
                    </div>
                </div>

                {/* Seção de Senha (Acordeão) */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <button 
                        onClick={() => setShowPasswordSection(!showPasswordSection)}
                        className="flex items-center text-sm font-bold text-[#00a884] hover:underline focus:outline-none"
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        {showPasswordSection ? 'Cancelar alteração de senha' : 'Quero alterar minha senha'}
                    </button>

                    {showPasswordSection && (
                        <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nova Senha</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-[#00a884] outline-none dark:text-white"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirmar Senha</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-[#00a884] outline-none dark:text-white"
                                    placeholder="Repita a senha"
                                />
                            </div>
                            
                            {/* Mensagens de Erro/Sucesso da Senha */}
                            {passwordStatus.msg && (
                                <div className={`flex items-center text-xs font-bold p-2 rounded ${passwordStatus.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                    {passwordStatus.type === 'error' ? <AlertCircle className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                    {passwordStatus.msg}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Botão Salvar */}
                <button 
                    onClick={handleSave} 
                    className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center justify-center mt-4"
                >
                    <Save className="w-5 h-5 mr-2" />
                    Salvar Alterações
                </button>
            </div>
        </div>
    </div>
  );
};

export default ProfileModal;