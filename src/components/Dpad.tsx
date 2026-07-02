import { Direction } from '../types';
import { playClickSound } from '../utils/audio';

interface DpadProps {
  currentDirection: Direction;
  onChangeDirection: (dir: Direction) => void;
  onPauseToggle?: () => void;
}

export default function Dpad({ currentDirection, onChangeDirection, onPauseToggle }: DpadProps) {
  const handlePress = (dir: Direction) => {
    // Prevent reverse moves
    if (dir === 'UP' && currentDirection === 'DOWN') return;
    if (dir === 'DOWN' && currentDirection === 'UP') return;
    if (dir === 'LEFT' && currentDirection === 'RIGHT') return;
    if (dir === 'RIGHT' && currentDirection === 'LEFT') return;

    // Remove turning click sound to prevent annoying continuous noise
    onChangeDirection(dir);
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-slate-100/40 dark:bg-slate-900/40 rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-slate-700 max-w-sm mx-auto shadow-inner select-none">
      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest mb-2.5">
        🕹️ Arcade Controller 🕹️
      </span>
      
      {/* Expanded Direction Pad layout with spacious, perfectly symmetrical centering gaps */}
      <div className="relative w-56 h-56 lg:w-44 lg:h-44">
        {/* UP Button */}
        <button
          onClick={() => handlePress('UP')}
          disabled={currentDirection === 'DOWN'}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 lg:w-11 lg:h-11 bg-rose-400 hover:bg-rose-500 disabled:opacity-40 border-4 lg:border-2 border-rose-600 rounded-2xl flex items-center justify-center transition-all duration-100 active:scale-90 active:brightness-90 hover:brightness-105 text-white font-extrabold text-2xl lg:text-lg select-none cursor-pointer z-10 shadow-md"
          id="dpad-up"
        >
          ▲
        </button>

        {/* LEFT Button */}
        <button
          onClick={() => handlePress('LEFT')}
          disabled={currentDirection === 'RIGHT'}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 lg:w-11 lg:h-11 bg-emerald-400 hover:bg-emerald-500 disabled:opacity-40 border-4 lg:border-2 border-emerald-600 rounded-2xl flex items-center justify-center transition-all duration-100 active:scale-90 active:brightness-90 hover:brightness-105 text-white font-extrabold text-2xl lg:text-lg select-none cursor-pointer z-10 shadow-md"
          id="dpad-left"
        >
          ◀
        </button>

        {/* CENTER JOYSTICK DECORATIVE BUBBLE - WORKING PAUSE/UNPAUSE TOGGLE BUTTON */}
        <button
          onClick={() => {
            playClickSound();
            if (onPauseToggle) {
              onPauseToggle();
            }
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2.4rem] h-[2.4rem] lg:w-[2.2rem] lg:h-[2.2rem] bg-amber-400 dark:bg-amber-500 border-2 border-amber-600 rounded-full flex flex-col items-center justify-center shadow-md transition-all duration-100 active:scale-90 active:brightness-90 hover:brightness-105 select-none cursor-pointer z-20"
          id="dpad-center-pause"
          title="Pause / Resume Game"
        >
          <span className="text-[7px] font-black text-slate-950 tracking-tight leading-none">PAUSE</span>
          <span className="text-[10px] mt-0.5 leading-none">🐍</span>
        </button>

        {/* RIGHT Button */}
        <button
          onClick={() => handlePress('RIGHT')}
          disabled={currentDirection === 'LEFT'}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 lg:w-11 lg:h-11 bg-sky-400 hover:bg-sky-500 disabled:opacity-40 border-4 lg:border-2 border-sky-600 rounded-2xl flex items-center justify-center transition-all duration-100 active:scale-90 active:brightness-90 hover:brightness-105 text-white font-extrabold text-2xl lg:text-lg select-none cursor-pointer z-10 shadow-md"
          id="dpad-right"
        >
          ▶
        </button>

        {/* DOWN Button */}
        <button
          onClick={() => handlePress('DOWN')}
          disabled={currentDirection === 'UP'}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 lg:w-11 lg:h-11 bg-violet-400 hover:bg-violet-500 disabled:opacity-40 border-4 lg:border-2 border-violet-600 rounded-2xl flex items-center justify-center transition-all duration-100 active:scale-90 active:brightness-90 hover:brightness-105 text-white font-extrabold text-2xl lg:text-lg select-none cursor-pointer z-10 shadow-md"
          id="dpad-down"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
