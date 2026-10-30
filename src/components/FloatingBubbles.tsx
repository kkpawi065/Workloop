import { useEffect, useRef } from 'react';

interface FloatingBubblesProps {
  theme: 'light' | 'dark';
}

export default function FloatingBubbles({ theme }: FloatingBubblesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Bubble structure
    interface Bubble {
      x: number;
      y: number;
      radius: number;
      speedX: number;
      speedY: number;
      alpha: number;
      targetAlpha: number;
      colorType: 'purple' | 'pink' | 'teal';
    }

    const bubbleCount = Math.min(22, Math.floor((width * height) / 45000) + 5);
    const bubbles: Bubble[] = [];

    const colors = {
      dark: {
        purple: 'rgba(168, 85, 247, ', // purple-500
        pink: 'rgba(236, 72, 153, ',   // pink-500
        teal: 'rgba(20, 184, 166, ',   // teal-500
      },
      light: {
        purple: 'rgba(147, 51, 234, ', // purple-600
        pink: 'rgba(219, 39, 119, ',   // pink-600
        teal: 'rgba(13, 148, 136, ',   // teal-600
      },
    };

    function createBubble(isInitial = false): Bubble {
      const radius = Math.random() * 50 + 20; // 20px to 70px
      const colorsPool: Array<'purple' | 'pink' | 'teal'> = ['purple', 'pink', 'teal'];
      const colorType = colorsPool[Math.floor(Math.random() * colorsPool.length)];

      return {
        x: Math.random() * width,
        y: isInitial ? Math.random() * height : height + radius * 2,
        radius,
        speedX: (Math.random() - 0.5) * 0.15, // extremely slow drift
        speedY: -(Math.random() * 0.18 + 0.08), // smooth, unhurried rise
        alpha: isInitial ? Math.random() * 0.05 : 0, // fade in gently if created new
        targetAlpha: Math.random() * 0.1 + 0.03, // 3% to 13% opacity range for elegance
        colorType,
      };
    }

    // Initialize bubble elements
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push(createBubble(true));
    }

    function handleResize() {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', handleResize);

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      const colorSet = theme === 'dark' ? colors.dark : colors.light;

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];

        // Slow movement updates
        b.x += b.speedX;
        b.y += b.speedY;

        // Soft fade state transitions
        if (b.alpha < b.targetAlpha) {
          b.alpha += 0.0015;
        }

        // Draw gradient fills for realistic translucent spheres
        const gradient = ctx.createRadialGradient(
          b.x - b.radius * 0.25,
          b.y - b.radius * 0.25,
          b.radius * 0.05,
          b.x,
          b.y,
          b.radius
        );

        const baseColor = colorSet[b.colorType];
        gradient.addColorStop(0, `${baseColor}${b.alpha * 1.6})`);
        gradient.addColorStop(0.5, `${baseColor}${b.alpha * 0.8})`);
        gradient.addColorStop(1, `${baseColor}0)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Screen margins wrap around
        if (b.x - b.radius > width) {
          b.x = -b.radius;
        } else if (b.x + b.radius < 0) {
          b.x = width + b.radius;
        }

        // Recycle bubble once it floats out of view
        if (b.y + b.radius * 2 < 0) {
          bubbles[i] = createBubble(false);
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none w-full h-full transition-opacity duration-1000"
      id="login-floating-bubbles"
    />
  );
}
