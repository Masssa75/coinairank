interface ProgressRingProps {
  tier: 'ALPHA' | 'SOLID' | 'BASIC' | 'TRASH' | null;
  size?: number;
}

export default function ProgressRing({ tier, size = 36 }: ProgressRingProps) {
  const tierConfig = {
    ALPHA: { letter: 'α', percentage: 90, color: '#00c896' },
    SOLID: { letter: 'S', percentage: 70, color: '#ff9500' },
    BASIC: { letter: 'B', percentage: 45, color: '#ff6b35' },
    TRASH: { letter: 'T', percentage: 15, color: '#ff3b30' },
  };

  // Return null if tier is not valid
  if (!tier || !tierConfig[tier]) {
    return null;
  }

  const config = tierConfig[tier];
  const degrees = (config.percentage / 100) * 360;

  return (
    <div
      className="progress-circle relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        className="circle-fill absolute w-full h-full rounded-full"
        style={{
          background: `conic-gradient(${config.color} 0deg, ${config.color} ${degrees}deg, #f0f0f0 ${degrees}deg)`,
        }}
      />
      <div
        className="circle-inner relative bg-white rounded-full flex items-center justify-center font-extrabold text-gray-600 z-10"
        style={{
          width: size - 8,
          height: size - 8,
          fontSize: size / 3.5,
        }}
      >
        {config.letter}
      </div>
    </div>
  );
}
