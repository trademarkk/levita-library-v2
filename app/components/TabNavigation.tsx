import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';

interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  storageKey?: string;
}

function orderTabs(tabs: Tab[], order: string[]) {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Tab[];
  const missing = tabs.filter((tab) => !order.includes(tab.id));
  return [...ordered, ...missing];
}

export function TabNavigation({ tabs, activeTab, onTabChange, storageKey }: TabNavigationProps) {
  const key = storageKey ?? `levtia-tab-order:${tabs.map((tab) => tab.id).join('|')}`;
  const [order, setOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setOrder(tabs.map((tab) => tab.id));
      return;
    }
    try {
      const saved = JSON.parse(raw) as string[];
      setOrder(Array.isArray(saved) ? saved : tabs.map((tab) => tab.id));
    } catch {
      setOrder(tabs.map((tab) => tab.id));
    }
  }, [key, tabs]);

  const visibleTabs = useMemo(() => orderTabs(tabs, order), [tabs, order]);

  const moveTab = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = visibleTabs.map((tab) => tab.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    window.localStorage.setItem(key, JSON.stringify(next));
  };

  return (
    <div className="tab-navigation flex flex-nowrap lg:flex-wrap gap-2 border-b border-[#c9a98d]/10 mb-8 overflow-x-auto lg:overflow-visible pb-2 lg:pb-3">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          draggable
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onDragStart={() => setDraggedId(tab.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => moveTab(tab.id)}
          onDragEnd={() => setDraggedId(null)}
          onClick={() => onTabChange(tab.id)}
          className={`relative shrink-0 rounded-lg border px-4 lg:px-5 py-2.5 transition-all duration-300 whitespace-nowrap ${
            activeTab === tab.id
              ? 'border-[#c9a98d]/55 bg-[#c9a98d]/18 text-[#f5f3f0] shadow-[0_10px_30px_rgba(201,169,141,0.14)]'
              : 'border-transparent text-[#a89b8f] hover:border-[#c9a98d]/20 hover:bg-[#2a2630]/55 hover:text-[#f5f3f0]'
          } ${draggedId === tab.id ? 'opacity-50' : ''}`}
          title="Можно перетащить вкладку"
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-gradient-to-r from-[#c9a98d] to-[#b88b7a]"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
