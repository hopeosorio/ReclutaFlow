import { useEffect, useState } from 'react';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // Disparar evento personalizado para que otros componentes (como InteractiveStars) se enteren
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));
    };

    return (
        <button
            onClick={toggleTheme}
            style={{
                background: 'var(--bg-accent)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                transition: 'all 0.3s var(--ease-expo)',
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                zIndex: 9999,
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}
            aria-label="Alternar Tema"
        >
            {theme === 'dark' ? '☼' : '☾'}
        </button>
    );
}
