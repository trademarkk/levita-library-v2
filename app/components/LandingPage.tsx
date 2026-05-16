import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Shield, Users, ClipboardCheck, BookOpen, Activity } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0e12] via-[#1a1820] to-[#2a2630]">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#b88b7a] rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8e7a92] rounded-full blur-[120px]"></div>
        </div>
      </div>

      {/* Hero section */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="container mx-auto px-6 py-20"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-32">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#c9a98d]" />
              <span className="tracking-[0.3em] text-sm text-[#c9a98d] uppercase">LEVTIA</span>
            </div>
            <Link
              to="/login"
              className="px-6 py-2.5 bg-[#c9a98d] text-[#0f0e12] rounded-md hover:bg-[#b88b7a] transition-all duration-300"
            >
              Войти
            </Link>
          </div>

          {/* Hero content */}
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <h1 className="text-7xl md:text-8xl mb-8 leading-[1.1] text-[#f5f3f0]">
                Внутренняя
                <br />
                <span className="text-[#c9a98d] italic">библиотека студии</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-xl text-[#a89b8f] max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Role-based система знаний, регламентов, чек-листов и шаблонов для студии балета и растяжки.
              Там, где порядок встречается с эстетикой.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
            >
              <Link
                to="/login"
                className="inline-block px-10 py-4 bg-gradient-to-r from-[#c9a98d] to-[#b88b7a] text-[#0f0e12] rounded-md hover:shadow-2xl hover:shadow-[#c9a98d]/20 transition-all duration-500 text-lg"
              >
                Открыть LEVTIA Library
              </Link>
            </motion.div>
          </div>

          {/* Hero image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.9 }}
            className="mt-24 relative"
          >
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-[#c9a98d]/10">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e12]/80 to-transparent z-10"></div>
              <img
                src="https://images.unsplash.com/photo-1700264358310-fa1d3e42e499?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxsZXQlMjBkYW5jZXIlMjBlbGVnYW5jZSUyMGx1eHVyeXxlbnwxfHx8fDE3Nzc5MTk4MjF8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Ballet dancer in elegant pose"
                className="w-full h-[500px] object-cover"
              />
            </div>
          </motion.div>

          {/* Role cards */}
          <div className="mt-32 mb-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.2 }}
              className="text-5xl text-center mb-16 text-[#f5f3f0]"
            >
              Пространство для каждой роли
            </motion.h2>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <RoleCard
                icon={<Sparkles className="w-8 h-8" />}
                title="Ассистент"
                description="Задачи, шаблоны ответов кандидатам, полезные ссылки, обучение и дневной чек-лист."
                delay={1.3}
              />
              <RoleCard
                icon={<Shield className="w-8 h-8" />}
                title="Старший администратор"
                description="Обязанности, регламенты, клиентские шаблоны, возвраты и операционный контроль."
                delay={1.4}
              />
              <RoleCard
                icon={<Users className="w-8 h-8" />}
                title="Руководитель"
                description="Управление командой, важной информацией, шаблонами, чек-листами и возвратами."
                delay={1.5}
              />
              <RoleCard
                icon={<ClipboardCheck className="w-8 h-8" />}
                title="Администратор"
                description="Доступ к базе знаний, рабочим ссылкам, операционным заметкам и задачам смены."
                delay={1.6}
              />
              <RoleCard
                icon={<BookOpen className="w-8 h-8" />}
                title="Старший тренер"
                description="Методические стандарты, материалы обучения, регламенты и координация тренеров."
                delay={1.7}
              />
              <RoleCard
                icon={<Activity className="w-8 h-8" />}
                title="Тренер"
                description="Материалы занятий, заметки, стандарты студии и персональный чек-лист."
                delay={1.8}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className="group relative"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#c9a98d]/10 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
      <div className="relative bg-[#1a1820]/60 backdrop-blur-xl border border-[#c9a98d]/20 rounded-xl p-8 hover:border-[#c9a98d]/40 transition-all duration-500 h-full">
        <div className="text-[#c9a98d] mb-4">{icon}</div>
        <h3 className="text-2xl mb-3 text-[#f5f3f0]">{title}</h3>
        <p className="text-[#a89b8f] leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
