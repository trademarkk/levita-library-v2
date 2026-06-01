import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Lock, Mail } from 'lucide-react';
import { useLibrary } from '../domain/LibraryContext';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, resetPassword } = useLibrary();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (!result.ok) setError(result.error ?? 'Не удалось войти.');
      else navigate(result.route ?? '/assistant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const result = await resetPassword(email, newPassword);
      if (!result.ok) {
        setError(result.error ?? 'Не удалось изменить пароль.');
        return;
      }
      setPassword(newPassword);
      setNewPassword('');
      setMode('login');
      setSuccess('Пароль изменён. Теперь можно войти с новым паролем.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0e12] via-[#1a1820] to-[#2a2630]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-[#b88b7a] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-[#8e7a92] rounded-full blur-[150px]"></div>
        </div>
      </div>

      {/* Background image */}
      <div className="absolute inset-0 opacity-10">
        <img
          src="https://images.unsplash.com/photo-1622839343737-8e492aa8b488?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxiYWxsZXQlMjBkYW5jZXIlMjBlbGVnYW5jZSUyMGx1eHVyeXxlbnwxfHx8fDE3Nzc5MTk4MjF8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Фон студии"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Glass card */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#c9a98d]/10 to-transparent rounded-2xl blur-2xl"></div>
          <div className="relative bg-[#1a1820]/80 backdrop-blur-2xl border border-[#c9a98d]/30 rounded-2xl p-10">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <Sparkles className="w-6 h-6 text-[#c9a98d]" />
              <span className="tracking-[0.3em] text-sm text-[#c9a98d] uppercase">LEVTIA</span>
            </div>

            <h1 className="text-4xl text-center mb-3 text-[#f5f3f0]">{mode === 'login' ? 'Добро пожаловать' : 'Восстановление пароля'}</h1>
            <p className="text-center text-[#a89b8f] mb-10">{mode === 'login' ? 'Войдите, чтобы открыть внутреннюю библиотеку' : 'Введите почту сотрудника и новый пароль'}</p>

            <form onSubmit={mode === 'login' ? handleLogin : handleResetPassword} className="space-y-6">
              {/* Email field */}
              <div>
                <label htmlFor="login-email" className="block text-sm mb-2 text-[#f5f3f0]">Электронная почта</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a89b8f]" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#2a2630] border border-[#c9a98d]/20 rounded-lg px-12 py-3.5 text-[#f5f3f0] placeholder:text-[#a89b8f] focus:outline-none focus:border-[#c9a98d] transition-all duration-300"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {mode === 'login' ? (
                <div>
                  <label htmlFor="login-password" className="block text-sm mb-2 text-[#f5f3f0]">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a89b8f]" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#2a2630] border border-[#c9a98d]/20 rounded-lg px-12 py-3.5 text-[#f5f3f0] placeholder:text-[#a89b8f] focus:outline-none focus:border-[#c9a98d] transition-all duration-300"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="reset-password" className="block text-sm mb-2 text-[#f5f3f0]">Новый пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a89b8f]" />
                    <input
                      id="reset-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#2a2630] border border-[#c9a98d]/20 rounded-lg px-12 py-3.5 text-[#f5f3f0] placeholder:text-[#a89b8f] focus:outline-none focus:border-[#c9a98d] transition-all duration-300"
                      placeholder="Минимум 6 символов"
                    />
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#8b3a52]/35 border border-[#8b3a52]/70 rounded-lg px-4 py-3 text-sm text-[#f5f3f0] shadow-lg shadow-[#8b3a52]/10"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-[#5e6d58]/70 bg-[#5e6d58]/25 px-4 py-3 text-sm text-[#f5f3f0]"
                >
                  {success}
                </motion.div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-[#c9a98d] to-[#b88b7a] text-[#0f0e12] rounded-lg hover:shadow-2xl hover:shadow-[#c9a98d]/30 transition-all duration-500 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? 'Проверяем доступ...' : mode === 'login' ? 'Войти' : 'Изменить пароль'}
              </button>
            </form>
            <button
              onClick={() => {
                setMode((value) => value === 'login' ? 'reset' : 'login');
                setError('');
                setSuccess('');
              }}
              className="w-full mt-4 text-sm text-[#a89b8f] hover:text-[#c9a98d] transition-colors"
            >
              {mode === 'login' ? 'Восстановить пароль' : 'Вернуться ко входу'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
