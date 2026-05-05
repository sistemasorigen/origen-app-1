import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownTab {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
}

interface AdminDropdownProps {
    tabs: DropdownTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    showLabel?: boolean;
}

/**
 * AdminDropdown - Neo-Brutalist dropdown menu for admin navigation
 * Maintains consistent styling with existing Admin tab buttons
 * Mobile-first approach with full accessibility support
 */
const AdminDropdown: React.FC<AdminDropdownProps> = ({
    tabs,
    activeTab,
    onTabChange,
    showLabel = true,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Find current tab for display
    const currentTab = tabs.find(tab => tab.id === activeTab);
    const CurrentIcon = currentTab?.icon || tabs[0]?.icon;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                setIsOpen(false);
                buttonRef.current?.focus();
                break;
            case 'ArrowDown':
            case 'ArrowUp': {
                e.preventDefault();
                const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
                const nextIndex =
                    e.key === 'ArrowDown'
                        ? (currentIndex + 1) % tabs.length
                        : (currentIndex - 1 + tabs.length) % tabs.length;
                handleSelectTab(tabs[nextIndex].id);
                break;
            }
            default:
                break;
        }
    };

    const handleSelectTab = (tabId: string) => {
        onTabChange(tabId);
        setIsOpen(false);
        buttonRef.current?.focus();
    };

    return (
        <div className="relative inline-block">
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`Menu de navegación ${currentTab?.label || 'Admin'}`}
                className="flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-slate-900 bg-white text-black font-bold uppercase text-xs md:text-sm transition-all hover:-translate-y-1 hover:shadow-md active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                {CurrentIcon && <CurrentIcon className="w-4 h-4" />}
                {showLabel && <span className="hidden sm:inline">{currentTab?.label || 'Menu'}</span>}
                <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    role="menu"
                    className="absolute top-full left-0 mt-2 w-48 bg-white border-2 border-slate-900 shadow-lg z-50 overflow-hidden"
                >
                    {tabs.map((tab, index) => {
                        const TabIcon = tab.icon;
                        const isSelected = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleSelectTab(tab.id)}
                                onKeyDown={handleKeyDown}
                                role="menuitem"
                                aria-current={isSelected ? 'page' : undefined}
                                className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-bold uppercase transition-all border-b border-slate-200 last:border-b-0 ${
                                    isSelected
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-black hover:bg-slate-100'
                                }`}
                            >
                                <TabIcon className="w-4 h-4 flex-shrink-0" />
                                <span>{tab.label}</span>
                                {isSelected && (
                                    <span className="ml-auto text-lg leading-none">✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminDropdown;
