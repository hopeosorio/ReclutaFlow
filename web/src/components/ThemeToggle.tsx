import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const styles = `
.theme-toggle {
    background: var(--bg-accent);
    border: 1px solid var(--border-light);
    color: var(--text-main);
    width: 42px;
    height: 42px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 9999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    transition: background 0.3s var(--ease-expo), border-color 0.3s var(--ease-expo), box-shadow 0.3s var(--ease-expo), transform 0.3s var(--ease-expo);
}

.theme-toggle:hover {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 8px 28px var(--accent-glow);
    transform: scale(1.12) rotate(20deg);
    color: #fff;
}

.theme-toggle:active {
    transform: scale(0.95) rotate(20deg);
}
`;

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        if (!document.getElementById('theme-toggle-styles')) {
            const el = document.createElement('style');
            el.id = 'theme-toggle-styles';
            el.textContent = styles;
            document.head.appendChild(el);
        }
    }, []);

    const applyTheme = (newTheme: 'dark' | 'light') => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';

        // View Transitions API: GPU crossfade between snapshots — zero per-element CSS transitions
        if ('startViewTransition' in document) {
            (document as any).startViewTransition(() => applyTheme(newTheme));
        } else {
            applyTheme(newTheme);
        }
    };

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Alternar Tema"
        >
            {theme === 'dark'
                ? <Sun size={18} strokeWidth={1.75} />
                : <Moon size={18} strokeWidth={1.75} />
            }
        </button>
    );
}
