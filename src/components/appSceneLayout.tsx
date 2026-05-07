import type { PropsWithChildren } from 'react';
import LogoConmed from '../assets/conmedImages/conmedLogo.png';
import '../css/appSceneLayout.css';
import ProgrammingDashboardParticleBackground from './programmingDashboardParticleBackground';

type AppSceneLayoutProps = PropsWithChildren<{
  showLogo?: boolean;
  className?: string;
}>;

function AppSceneLayout({
  children,
  showLogo = true,
  className = '',
}: AppSceneLayoutProps) {
  const sceneClassName = className ? `appScene ${className}` : 'appScene';

  return (
    <main className={sceneClassName}>
      <ProgrammingDashboardParticleBackground />
      <div className='appSceneGlow appSceneGlowPrimary' aria-hidden='true' />
      <div className='appSceneGlow appSceneGlowSecondary' aria-hidden='true' />
      {showLogo && <img className='appSceneBrandLogo' src={LogoConmed} alt='conmedLogo' />}
      {children}
    </main>
  );
}

export default AppSceneLayout;
