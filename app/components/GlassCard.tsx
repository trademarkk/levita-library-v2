import { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { motion } from 'motion/react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({ children, className = '', delay = 0, onClick, ...props }: GlassCardProps) {
  return (
    <motion.div
      {...props}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative group ${className}`}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#c9a98d]/5 to-transparent rounded-xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
      <div className="glass-card-surface relative bg-[#1a1820]/60 backdrop-blur-xl border border-[#c9a98d]/20 rounded-xl p-6 hover:border-[#c9a98d]/40 transition-all duration-500">
        {children}
      </div>
    </motion.div>
  );
}
