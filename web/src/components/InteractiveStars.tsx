import { useEffect, useRef } from 'react';

export default function InteractiveStars() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particles: Particle[] = [];
        let mouse = { x: -1000, y: -1000, radius: 150 };
        let rafId = 0;
        let mousePending = false;
        let scrolling = false;
        let scrollTimer: ReturnType<typeof setTimeout>;
        const isTouchDevice = 'ontouchstart' in window;

        // Determinar el color inicial según el tema
        const getParticleColor = () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            return isLight ? 'rgba(0, 0, 0,' : 'rgba(255, 255, 255,';
        };

        let colorBase = getParticleColor();

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init();
        };

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;
            opacity: number;

            constructor() {
                this.x = Math.random() * canvas!.width;
                this.y = Math.random() * canvas!.height;
                this.vx = (Math.random() - 0.5) * 0.4;
                this.vy = (Math.random() - 0.5) * 0.4;
                this.size = Math.random() * 1.8 + 0.2;
                this.opacity = Math.random() * 0.3 + 0.1;
            }

            draw() {
                if (!ctx) return;
                ctx.fillStyle = `${colorBase} ${this.opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    const shiftX = (dx / distance) * force * 2;
                    const shiftY = (dy / distance) * force * 2;
                    this.x -= shiftX;
                    this.y -= shiftY;
                }

                if (this.x < 0) this.x = canvas!.width;
                if (this.x > canvas!.width) this.x = 0;
                if (this.y < 0) this.y = canvas!.height;
                if (this.y > canvas!.height) this.y = 0;
            }
        }

        const init = () => {
            particles = [];
            // Reduced density: /4000 instead of /2000 — fewer particles, smoother scroll
            const numberOfParticles = Math.min((window.innerWidth * window.innerHeight) / 4000, 400);
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            // En touch, no pausar durante scroll — las partículas responden al toque
            if (!scrolling || isTouchDevice) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < particles.length; i++) {
                    particles[i].update();
                    particles[i].draw();
                }
            }
            rafId = requestAnimationFrame(animate);
        };

        // Throttle mousemove via rAF flag — fires at most once per frame instead of every pixel
        const handleMouseMove = (e: MouseEvent) => {
            if (mousePending) return;
            mousePending = true;
            requestAnimationFrame(() => {
                mouse.x = e.x;
                mouse.y = e.y;
                mousePending = false;
            });
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        };

        const handleThemeChange = () => {
            colorBase = getParticleColor();
        };

        const handleScroll = () => {
            scrolling = true;
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => { scrolling = false; }, 200);
        };

        // Touch: actualizar posición del mouse desde el primer punto de contacto
        const handleTouchMove = (e: TouchEvent) => {
            if (mousePending) return;
            mousePending = true;
            const touch = e.touches[0];
            requestAnimationFrame(() => {
                mouse.x = touch.clientX;
                mouse.y = touch.clientY;
                mousePending = false;
            });
        };

        const handleTouchEnd = () => {
            // Desvanecer el efecto gradualmente moviendo el cursor lejos
            mouse.x = -1000;
            mouse.y = -1000;
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('themechange', handleThemeChange as any);
        // 'app-scroll' fired by PublicLayout; 'scroll' covers CRM and document-level scroll
        window.addEventListener('app-scroll', handleScroll);
        document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });

        resize();
        animate();

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(scrollTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('themechange', handleThemeChange as any);
            window.removeEventListener('app-scroll', handleScroll);
            document.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 0,
                background: 'transparent',
                willChange: 'transform',   // promotes to own GPU layer
                contain: 'strict',         // limits layout/paint scope
            }}
        />
    );
}
