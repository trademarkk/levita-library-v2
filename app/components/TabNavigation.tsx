import { motion } from 'motion/react';

interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[#c9a98d]/10 mb-8 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-4 lg:px-6 py-3 transition-all duration-300 whitespace-nowrap ${
            activeTab === tab.id
              ? 'text-[#c9a98d]'
              : 'text-[#a89b8f] hover:text-[#f5f3f0]'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#c9a98d] to-[#b88b7a]"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
