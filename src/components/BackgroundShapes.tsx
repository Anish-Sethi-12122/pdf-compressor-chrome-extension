export function BackgroundShapes() {
  return (
    <div 
      className="breathing-gradient-bg" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden', 
        zIndex: -1 
      }}
      aria-hidden="true" 
    />
  );
}
