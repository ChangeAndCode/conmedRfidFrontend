import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
};

type Rgb = readonly [number, number, number];

const PALETTE: readonly Rgb[] = [
  [88, 214, 255],
  [106, 139, 255],
  [122, 255, 201],
];

const PARTICLE_DENSITY_MULTIPLIER = 1.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mixColor = (from: Rgb, to: Rgb, ratio: number): Rgb => {
  const safeRatio = clamp(ratio, 0, 1);

  return [
    Math.round(from[0] + (to[0] - from[0]) * safeRatio),
    Math.round(from[1] + (to[1] - from[1]) * safeRatio),
    Math.round(from[2] + (to[2] - from[2]) * safeRatio),
  ];
};

function ProgrammingDashboardParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let particles: Particle[] = [];

    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      lastInteraction: 0,
    };

    const createParticles = () => {
      const area = width * height;
      const estimatedCount = reducedMotion ? area / 32000 : area / 21000;
      const baseParticleCount =
        width < 768
          ? clamp(Math.round(estimatedCount), reducedMotion ? 18 : 24, reducedMotion ? 34 : 52)
          : clamp(Math.round(estimatedCount), reducedMotion ? 30 : 42, reducedMotion ? 56 : 82);
      const particleCount = Math.round(baseParticleCount * PARTICLE_DENSITY_MULTIPLIER);

      particles = Array.from({ length: particleCount }, () => {
        const originX = Math.random() * width;
        const originY = Math.random() * height;

        return {
          x: originX,
          y: originY,
          originX,
          originY,
          vx: 0,
          vy: 0,
          radius: Math.random() * 1.8 + 1,
          phase: Math.random() * Math.PI * 2,
        };
      });

      if (pointer.x === 0 && pointer.y === 0) {
        pointer.x = width * 0.68;
        pointer.y = height * 0.34;
        pointer.targetX = pointer.x;
        pointer.targetY = pointer.y;
      }
    };

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      // Cap DPR to keep the canvas cheap on dense displays.
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      createParticles();
    };

    const updatePointer = (clientX: number, clientY: number) => {
      pointer.targetX = clientX;
      pointer.targetY = clientY;
      pointer.lastInteraction = performance.now();
    };

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
    };

    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      resizeCanvas();
    };

    const renderFrame = (time: number) => {
      context.clearRect(0, 0, width, height);

      const pointerIsActive = time - pointer.lastInteraction < 1800;

      if (!pointerIsActive) {
        pointer.targetX = width * 0.58 + Math.cos(time * 0.00022) * width * 0.18;
        pointer.targetY = height * 0.42 + Math.sin(time * 0.00016) * height * 0.14;
      }

      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;

      const halo = context.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        Math.max(width, height) * 0.38,
      );
      halo.addColorStop(0, 'rgba(73, 164, 255, 0.12)');
      halo.addColorStop(0.45, 'rgba(32, 82, 155, 0.07)');
      halo.addColorStop(1, 'rgba(6, 15, 29, 0)');
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      const connectionDistance = width < 768 ? 92 : 112;
      const connectionDistanceSquared = connectionDistance * connectionDistance;
      const influenceRadius = width < 768 ? 135 : 170;
      const influenceRadiusSquared = influenceRadius * influenceRadius;

      particles.forEach((particle) => {
        const dx = pointer.x - particle.x;
        const dy = pointer.y - particle.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared) || 1;

        let ax =
          (particle.originX - particle.x) * (reducedMotion ? 0.0024 : 0.0032) +
          Math.cos(time * 0.001 + particle.phase) * (reducedMotion ? 0.0007 : 0.0012);
        let ay =
          (particle.originY - particle.y) * (reducedMotion ? 0.0024 : 0.0032) +
          Math.sin(time * 0.0012 + particle.phase) * (reducedMotion ? 0.0007 : 0.0012);

        if (distanceSquared < influenceRadiusSquared) {
          const force = (1 - distance / influenceRadius) * (reducedMotion ? 0.065 : 0.095);
          ax += ((dx / distance) + (dy / distance) * 0.35) * force;
          ay += ((dy / distance) - (dx / distance) * 0.35) * force;
        }

        particle.vx = particle.vx * 0.93 + ax;
        particle.vy = particle.vy * 0.93 + ay;
        particle.x += particle.vx;
        particle.y += particle.vy;
      });

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        for (let nextIndex = index + 1; nextIndex < particles.length; nextIndex += 1) {
          const otherParticle = particles[nextIndex];
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared > connectionDistanceSquared) {
            continue;
          }

          const alpha = (1 - distanceSquared / connectionDistanceSquared) * (reducedMotion ? 0.09 : 0.15);

          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(otherParticle.x, otherParticle.y);
          context.strokeStyle = `rgba(108, 198, 255, ${alpha})`;
          context.lineWidth = 0.8;
          context.stroke();
        }
      }

      particles.forEach((particle) => {
        const xMix = clamp(particle.x / Math.max(width, 1), 0, 1);
        const phaseMix = (Math.sin(time * 0.00055 + particle.phase) + 1) * 0.5;
        const baseColor = mixColor(PALETTE[0], PALETTE[1], xMix);
        const accentColor = mixColor(PALETTE[1], PALETTE[2], phaseMix);
        const speedRatio = clamp(Math.hypot(particle.vx, particle.vy) * 1.8, 0, 1);
        const finalColor = mixColor(baseColor, accentColor, 0.35 + speedRatio * 0.4);
        const radius =
          particle.radius +
          speedRatio * 0.9 +
          ((Math.sin(time * 0.0016 + particle.phase) + 1) * 0.5) * 0.45;

        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${finalColor[0]}, ${finalColor[1]}, ${finalColor[2]}, ${
          0.58 + speedRatio * 0.28
        })`;
        context.fill();
      });

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    resizeCanvas();
    animationFrameId = window.requestAnimationFrame(renderFrame);

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerMove, { passive: true });
    motionMediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerMove);
      motionMediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className='appSceneParticlesCanvas' aria-hidden='true' />;
}

export default ProgrammingDashboardParticleBackground;
