import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Direction, Skin, GameMode, LevelConfig, FoodType } from './types';
import { SNAKE_SKINS, LEVEL_CONFIGS, ACHIEVEMENTS, BOARD_THEMES, BoardTheme, ALL_FOOD_TEMPLATES } from './data';
import GameBoard from './components/GameBoard';
import SkinSelector from './components/SkinSelector';
import SnakeHeadPreview from './components/SnakeHeadPreview';
import PowerUpGuide from './components/PowerUpGuide';
import AchievementsBox from './components/AchievementsBox';
import { playClickSound, playAchievementSound, setSoundEnabled, getSoundEnabled, setSoundVolume, getSoundVolume } from './utils/audio';

export default function App() {
  const [selectedSkin, setSelectedSkin] = useState<Skin>(() => {
    try {
      const stored = localStorage.getItem('snake_selected_skin_id');
      if (stored) {
        const found = SNAKE_SKINS.find(s => s.id === stored);
        if (found) return found;
      }
    } catch (e) {}
    return SNAKE_SKINS[0];
  });

  // Save selected skin dynamically to preserve across games/reloads and unlock skin achievements
  useEffect(() => {
    try {
      localStorage.setItem('snake_selected_skin_id', selectedSkin.id);
      
      const storedSkins = JSON.parse(localStorage.getItem('snake_played_skins') || '[]');
      if (!storedSkins.includes(selectedSkin.id)) {
        const nextList = [...storedSkins, selectedSkin.id];
        localStorage.setItem('snake_played_skins', JSON.stringify(nextList));
        
        if (nextList.length >= 3) {
          unlockAchievement('all_skins');
        }
        if (nextList.length >= 6) {
          unlockAchievement('skin_collector');
        }
      }
    } catch (e) {}
  }, [selectedSkin]);

  const [gameMode, setGameMode] = useState<GameMode>('CLASSIC');
  const [currentLevelIdx, setCurrentLevelIdx] = useState<number>(0);
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    return Number(localStorage.getItem('snake_unlocked_level') || '1');
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  // Scoring
  const [score, setScore] = useState<number>(0);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [highScore, setHighScore] = useState<number>(0);
  const [foodEatenCount, setFoodEatenCount] = useState<number>(0);


  // Achievements State
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [volumeLevel, setVolumeLevel] = useState<number>(getSoundVolume());
  const [isVolumeShutterOpen, setIsVolumeShutterOpen] = useState<boolean>(false);

  // Overlay Screens
  const [showGameOver, setShowGameOver] = useState<boolean>(false);
  const [showLevelClear, setShowLevelClear] = useState<boolean>(false);
  const [showVictory, setShowVictory] = useState<boolean>(false);

  // Navigation Page state (Full screen screens for footer links)
  const [activePage, setActivePage] = useState<'HOME' | 'PRIVACY' | 'TERMS' | 'CONTACT'>('HOME');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Contact form state
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactSubject, setContactSubject] = useState<string>('');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactSubmitted, setContactSubmitted] = useState<boolean>(false);

  // Custom game configurations (Functional Settings)
  const [customSpeedMultiplier, setCustomSpeedMultiplier] = useState<number>(() => {
    return parseFloat(localStorage.getItem('snake_speed_multiplier') || '1.0');
  });
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    return localStorage.getItem('snake_board_theme') || 'mint';
  });
  const [allowedFruits, setAllowedFruits] = useState<Record<FoodType, boolean>>(() => {
    const defaultAllowed = {} as Record<FoodType, boolean>;
    ALL_FOOD_TEMPLATES.forEach((t, idx) => {
      if (t.type.startsWith('POWER_')) {
        defaultAllowed[t.type] = true;
      } else if (idx < 25) {
        defaultAllowed[t.type] = true;
      } else {
        defaultAllowed[t.type] = false;
      }
    });
    try {
      const stored = localStorage.getItem('snake_allowed_fruits');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultAllowed, ...parsed };
      }
    } catch (e) {}
    return defaultAllowed;
  });

  // Current Level Config
  const activeLevelConfig = LEVEL_CONFIGS[currentLevelIdx];

  // Initialize scores and achievements from localStorage
  useEffect(() => {
    const hs = Number(localStorage.getItem(`snake_hs_${gameMode}`) || '0');
    setHighScore(hs);

    // Clear overlay screens and scores when switching modes
    setShowGameOver(false);
    setShowLevelClear(false);
    setShowVictory(false);
    setScore(0);
    setComboMultiplier(1);
    setFoodEatenCount(0);

    const storedAch = JSON.parse(localStorage.getItem('snake_unlocked_achievements') || '[]');
    setUnlockedAchievements(storedAch);

    // Sync played skins check
    const playedSkins = JSON.parse(localStorage.getItem('snake_played_skins') || '[]');
    if (playedSkins.length >= 3) {
      unlockAchievementDirectly('all_skins', storedAch);
    }
  }, [gameMode]);

  // Direct unlocking helper (handles state sync)
  const unlockAchievementDirectly = (id: string, currentUnlocked: string[]) => {
    if (!currentUnlocked.includes(id)) {
      const nextList = [...currentUnlocked, id];
      localStorage.setItem('snake_unlocked_achievements', JSON.stringify(nextList));
      setUnlockedAchievements(nextList);
      playAchievementSound();
    }
  };

  // Safe callback version for board
  const unlockAchievement = (id: string) => {
    setUnlockedAchievements((prev) => {
      if (!prev.includes(id)) {
        const nextList = [...prev, id];
        localStorage.setItem('snake_unlocked_achievements', JSON.stringify(nextList));
        playAchievementSound();
        return nextList;
      }
      return prev;
    });
  };

  // Handle Score Shifts
  const handleScoreChange = (newScore: number, multiplier: number) => {
    setScore(newScore);
    setComboMultiplier(multiplier);
    if (newScore > highScore) {
      setHighScore(newScore);
    }
  };

  // Toggle Sound State
  const handleToggleSound = () => {
    const nextSound = !soundOn;
    setSoundOn(nextSound);
    setSoundEnabled(nextSound);
    playClickSound();
  };

  // Handle Volume Change
  const handleVolumeChange = (newVolume: number) => {
    setVolumeLevel(newVolume);
    setSoundVolume(newVolume);
    if (!soundOn && newVolume > 0) {
      setSoundOn(true);
      setSoundEnabled(true);
    }
  };

  // Start the actual gameplay
  const startGame = () => {
    playClickSound();
    setScore(0);
    setComboMultiplier(1);
    setFoodEatenCount(0);
    setIsPaused(false);
    setShowGameOver(false);
    setShowLevelClear(false);
    setShowVictory(false);
    setIsPlaying(true);
  };

  // Handle Game Over
  const handleGameOver = (finalScore: number, currentHighScore: number, foodEaten: number) => {
    setHighScore(currentHighScore);
    setFoodEatenCount(foodEaten);
    setIsPlaying(false);
    setShowGameOver(true);
  };

  // Handle Level Completed
  const handleLevelUp = () => {
    setIsPlaying(false);
    
    // Increment and unlock next level
    const completedLevel = activeLevelConfig.level;
    const nextLevelNum = completedLevel + 1;
    if (nextLevelNum > unlockedLevel) {
      setUnlockedLevel(nextLevelNum);
      localStorage.setItem('snake_unlocked_level', nextLevelNum.toString());
    }

    // Check if it was the final level
    if (currentLevelIdx === LEVEL_CONFIGS.length - 1) {
      setShowVictory(true);
    } else {
      setShowLevelClear(true);
    }
  };

  // Advance to next level
  const nextLevel = () => {
    playClickSound();
    const nextIdx = Math.min(LEVEL_CONFIGS.length - 1, currentLevelIdx + 1);
    setCurrentLevelIdx(nextIdx);
    
    // Reset states and start game directly
    setScore(0);
    setComboMultiplier(1);
    setFoodEatenCount(0);
    setShowLevelClear(false);
    setIsPlaying(true);
  };

  // Quick reset all scores & achievements
  const resetAllProgress = () => {
    if (window.confirm("Are you sure you want to reset all your scores and achievements?")) {
      playClickSound();
      localStorage.removeItem('snake_hs_CLASSIC');
      localStorage.removeItem('snake_hs_LEVELS');
      localStorage.removeItem('snake_unlocked_achievements');
      localStorage.removeItem('snake_played_skins');
      localStorage.removeItem('snake_unlocked_level');
      setHighScore(0);
      setUnlockedAchievements([]);
      setUnlockedLevel(1);
      setCurrentLevelIdx(0);
    }
  };

  const handleSpeedMultiplierChange = (val: number) => {
    setCustomSpeedMultiplier(val);
    localStorage.setItem('snake_speed_multiplier', val.toString());
  };

  const handleBoardThemeChange = (themeId: string) => {
    setBoardTheme(themeId);
    localStorage.setItem('snake_board_theme', themeId);
  };

  const handleFruitToggle = (fruit: FoodType) => {
    setAllowedFruits(prev => {
      const next = { ...prev, [fruit]: !prev[fruit] };
      // Keep at least one fruit active so it never crashes!
      const activeCount = Object.values(next).filter(Boolean).length;
      if (activeCount === 0) {
        next.APPLE = true;
      }
      localStorage.setItem('snake_allowed_fruits', JSON.stringify(next));
      return next;
    });
  };

  // Immersive gameplay layout when playing is active (scroll-free viewport focused arcade setup)
  // Reduced outer padding by 75% (changed p-2.5 to p-0.5) as requested!
  if (isPlaying) {
    return (
      <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-0 lg:p-4 z-50">
        
        <GameBoard
          selectedSkin={selectedSkin}
          onSelectSkin={setSelectedSkin}
          gameMode={gameMode}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          isPlaying={isPlaying}
          onGameOver={handleGameOver}
          currentLevel={activeLevelConfig.level}
          onLevelUp={handleLevelUp}
          onScoreChange={handleScoreChange}
          score={score}
          onGameStart={startGame}
          unlockAchievement={unlockAchievement}
          levelConfig={activeLevelConfig}
          resetGameAndBack={resetGameAndBack}
          soundOn={soundOn}
          handleToggleSound={handleToggleSound}
          volumeLevel={volumeLevel}
          handleVolumeChange={handleVolumeChange}
          customSpeedMultiplier={customSpeedMultiplier}
          setCustomSpeedMultiplier={handleSpeedMultiplierChange}
          boardTheme={boardTheme}
          setBoardTheme={handleBoardThemeChange}
          allowedFruits={allowedFruits}
          setAllowedFruits={handleFruitToggle}
          highScore={highScore}
        />
      </div>
    );
  }

  // Helper start menu card builder
  const renderStartMenuCard = () => {
    if (showGameOver) {
      return (
        <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border-4 border-red-500 shadow-xl text-center flex flex-col items-center justify-center min-h-[380px] animate-fade-in">
          <span className="text-5xl animate-pulse block mb-2">🌋</span>
          <h2 className="text-2xl font-black text-red-500 mb-1">Ouch! Game Over!</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-semibold">
            Crash! You hit a wall or yourself! Navigate carefully.
          </p>

          <div className="bg-red-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border-2 border-red-200 dark:border-red-900/50 mb-4 grid grid-cols-3 gap-1.5 w-full">
            <div className="text-center">
              <span className="text-lg">🍎</span>
              <p className="text-[9px] text-slate-500 uppercase font-black">Eaten</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200">{foodEatenCount}</p>
            </div>
            <div className="text-center border-x border-red-200 dark:border-red-900/50 px-1.5">
              <span className="text-lg">⭐</span>
              <p className="text-[9px] text-slate-500 uppercase font-black">Score</p>
              <p className="text-sm font-black text-rose-500">{score}</p>
            </div>
            <div className="text-center">
              <span className="text-lg">👑</span>
              <p className="text-[9px] text-slate-500 uppercase font-black">High</p>
              <p className="text-sm font-black text-amber-500">{highScore}</p>
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full py-3 bg-emerald-400 hover:bg-emerald-500 text-slate-900 font-black rounded-2xl border-4 border-emerald-600 shadow-[0_4px_0_#059669] active:translate-y-0.5 transition-all text-sm cursor-pointer"
            id="game-restart-btn"
          >
            🚀 PLAY AGAIN 🚀
          </button>
        </div>
      );
    }

    if (showLevelClear) {
      return (
        <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border-4 border-violet-500 shadow-xl text-center flex flex-col items-center justify-center min-h-[380px] animate-fade-in">
          <span className="text-5xl block mb-2">🏆</span>
          <h2 className="text-2xl font-black text-violet-500 mb-1">Level {activeLevelConfig.level} Cleared!</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mb-4">
            Amazing! You successfully cleared the level goal! 🎉
          </p>

          <div className="bg-violet-100 dark:bg-slate-900/60 p-3 rounded-2xl border-2 border-violet-200 dark:border-violet-900/50 mb-4 w-full">
            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
              Final Score: <span className="text-sm font-black text-violet-500">{score}</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              Next Stop: <span className="font-bold text-emerald-500">{LEVEL_CONFIGS[Math.min(LEVEL_CONFIGS.length-1, currentLevelIdx+1)].theme.name}</span>
            </p>
          </div>

          <button
            onClick={nextLevel}
            className="w-full py-3 bg-violet-400 hover:bg-violet-500 text-slate-900 font-black rounded-2xl border-4 border-violet-600 shadow-[0_4px_0_#7C3AED] active:translate-y-0.5 transition-all text-sm cursor-pointer"
            id="next-level-btn"
          >
            🗺️ ENTER NEXT WORLD 🚀
          </button>
        </div>
      );
    }

    if (showVictory) {
      return (
        <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border-4 border-amber-500 shadow-xl text-center flex flex-col items-center justify-center min-h-[380px] animate-fade-in">
          <span className="text-6xl block mb-3 animate-bounce">🐉👑🌟</span>
          <h2 className="text-2xl font-black bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 bg-clip-text text-transparent mb-1">
            Snake God Victory!
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mb-4 leading-relaxed">
            Incredible! You have conquered all {LEVEL_CONFIGS.length} dangerous worlds and become the legendary Snake King! 👑
          </p>

          <div className="bg-amber-100 dark:bg-slate-900/60 p-3 rounded-2xl border-2 border-amber-300 dark:border-amber-900/50 mb-4 w-full">
            <p className="text-xs font-black text-amber-700 dark:text-amber-400">
              Ultimate Score: <span className="text-lg font-black text-rose-500">{score}</span>
            </p>
          </div>

          <button
            onClick={() => { playClickSound(); setCurrentLevelIdx(0); resetGameAndBack(); }}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-2xl border-4 border-amber-600 shadow-[0_4px_0_#D97706] active:translate-y-0.5 transition-all text-sm cursor-pointer"
            id="victory-btn"
          >
            🎭 START NEW ADVENTURE 🎭
          </button>
        </div>
      );
    }

    // Default Play Screen
    return (
      <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border-4 border-emerald-500 shadow-xl text-center flex flex-col items-center justify-center min-h-[380px] animate-fade-in">
        <div className="mb-3 animate-bounce">
          <SnakeHeadPreview skin={selectedSkin} size={68} />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">
          Ready to Slither?
        </p>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5 mb-3">
          Slinky {selectedSkin.name.split(' ')[0]}
        </h2>

        <div className="bg-amber-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border-2 border-amber-200 dark:border-amber-950/60 text-center mb-4 w-full">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Your Skin: <span className="font-bold text-amber-600">{selectedSkin.name}</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {gameMode === 'CLASSIC' 
              ? 'Classic Mode: No limits! Just eat delicious food and beat your highscore!'
              : `Level Mode: Entering Level ${activeLevelConfig.level} - ${activeLevelConfig.theme.name}! Target score: ${activeLevelConfig.targetScore} points.`}
          </p>
        </div>

        <button
          onClick={startGame}
          className="w-full py-3 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black rounded-2xl border-4 border-emerald-600 shadow-[0_4px_0_#059669] active:translate-y-0.5 transition-all text-base cursor-pointer"
          id="game-start-btn"
        >
          🚀 START SLITHER 🚀
        </button>
      </div>
    );
  };

  // 1. Privacy Policy Page Render (Full Screen View)
  const renderPrivacyPage = () => {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 via-amber-50 to-emerald-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 font-sans p-4 md:p-8 transition-colors duration-300 flex items-center justify-center">
        <div className="max-w-3xl w-full bg-white dark:bg-slate-800 border-4 border-violet-500 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in relative my-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-violet-500 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🔒</span>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">
                  Privacy Policy
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">Last Updated: June 30, 2026</p>
              </div>
            </div>
            <button
              onClick={() => { playClickSound(); setActivePage('HOME'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-extrabold rounded-2xl border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer active:scale-95 text-xs shadow-sm"
            >
              ⬅ Back to Game
            </button>
          </div>
          
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-6 leading-relaxed font-sans max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              Welcome to Slinky Snake Adventures 2D. We hold your data privacy and security in the highest regard. Please read our simple and transparent Privacy Policy carefully:
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">1. Zero Data Collection</h4>
              <p>
                This website runs entirely client-side. This means we do not collect any personal information about you, such as your name, email address, IP address, geographical location, or browser cookies, and we do not transmit any data to external cloud servers.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">2. LocalStorage Usage</h4>
              <p>
                To maintain game progress, we only use your browser's <strong className="text-violet-500">Local Storage</strong>. The following details are saved:
              </p>
              <ul className="list-disc list-inside ml-2 mt-2 space-y-1">
                <li>Your highscore.</li>
                <li>Your unlocked achievements.</li>
                <li>Your preferred snake skin.</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                This data remains on your computer or mobile device. If you clear your browser cache or cookies, this data will be reset.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">3. Third-Party Services</h4>
              <p>
                This website does not use any advertising networks, social media trackers, or external analytics tools like Google Analytics. This game is completely ad-free, safe, and a clean arcade experience.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">4. Children's Privacy</h4>
              <p>
                This game is completely safe for children of all age groups. We do not collect any information from children. You can let children play the game without any worries.
              </p>
            </div>
            <p className="pt-4 border-t dark:border-slate-700 text-xs text-slate-400 text-center">
              If you have any questions regarding this Privacy Policy, you can reach out to us using the "Contact Us" page.
            </p>
          </div>
          
          <button
            onClick={() => { playClickSound(); setActivePage('HOME'); }}
            className="mt-8 w-full bg-violet-500 hover:bg-violet-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-all cursor-pointer hover:scale-[1.01] active:scale-95 text-center text-sm uppercase tracking-wider"
          >
            Understood & Return to Lobby
          </button>
        </div>
      </div>
    );
  };

  // 2. Terms of Use Page Render (Full Screen View)
  const renderTermsPage = () => {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 via-amber-50 to-emerald-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 font-sans p-4 md:p-8 transition-colors duration-300 flex items-center justify-center">
        <div className="max-w-3xl w-full bg-white dark:bg-slate-800 border-4 border-violet-500 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in relative my-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-violet-500 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📜</span>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">
                  Terms of Use
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">Last Updated: June 30, 2026</p>
              </div>
            </div>
            <button
              onClick={() => { playClickSound(); setActivePage('HOME'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-extrabold rounded-2xl border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer active:scale-95 text-xs shadow-sm"
            >
              ⬅ Back to Game
            </button>
          </div>
          
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-6 leading-relaxed font-sans max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              By using the Slinky Snake Adventures 2D website, you agree to comply with the following terms and conditions. Please read them carefully:
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">1. Acceptable Use</h4>
              <p>
                This website is provided solely for your personal entertainment and enjoyment. You may not use this game for any commercial purposes. You are not required to pay any fee to play the game; it is 100% free.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">2. Fair Play Policy</h4>
              <p>
                We encourage players to enjoy the game exactly as it is designed. Manipulating LocalStorage via the browser developer console, artificially inflating scores, or unlocking achievements via scripts reduces the true thrill of the game. Play fair and set honest records!
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">3. Intellectual Property</h4>
              <p>
                All source code, canvas drawing logic, gradient skins design, customized fruit explosion animations, and audio synthesizer code of this game are protected by intellectual property laws. You cannot copy, re-brand, or commercially redistribute this code without written permission.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/50">
              <h4 className="font-extrabold text-base text-violet-600 dark:text-violet-400 mb-2">4. Limitation of Liability</h4>
              <p>
                This game is provided on an "AS IS" basis. We assume no responsibility for any technical issues, browser crashes, or deletion of LocalStorage data. The sound effects generated during gameplay are generated via your computer's sound card and browser, which are completely safe.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => { playClickSound(); setActivePage('HOME'); }}
            className="mt-8 w-full bg-violet-500 hover:bg-violet-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-all cursor-pointer hover:scale-[1.01] active:scale-95 text-center text-sm uppercase tracking-wider"
          >
            I Agree & Return to Lobby
          </button>
        </div>
      </div>
    );
  };

  // 3. Contact Us Page Render (Full Screen View)
  const renderContactPage = () => {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 via-amber-50 to-emerald-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 font-sans p-4 md:p-8 transition-colors duration-300 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white dark:bg-slate-800 border-4 border-violet-500 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in relative my-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-violet-500 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">✉️</span>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white leading-tight">
                  Contact Us
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                  Your feedback and suggestions help us improve Slinky Snake!
                </p>
              </div>
            </div>
            <button
              onClick={() => { playClickSound(); setActivePage('HOME'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-extrabold rounded-2xl border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer active:scale-95 text-xs shadow-sm"
            >
              ⬅ Back to Game
            </button>
          </div>
          
          {contactSubmitted ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border-4 border-emerald-400 p-8 rounded-3xl text-center flex flex-col items-center justify-center py-12 animate-scale-up">
              <span className="text-6xl mb-4">🎉</span>
              <h3 className="text-emerald-700 dark:text-emerald-400 font-extrabold text-2xl mb-2">
                Message Sent Successfully!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
                Hi <span className="font-black text-violet-500">{contactName}</span>, your message has been received. We are incredibly grateful for your valuable feedback!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-8">
                <button
                  onClick={() => {
                    playClickSound();
                    setContactSubmitted(false);
                    setContactName('');
                    setContactEmail('');
                    setContactSubject('');
                    setContactMessage('');
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-2xl text-xs cursor-pointer transition-all active:scale-95 shadow-md uppercase tracking-wider"
                >
                  Write New Message
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setActivePage('HOME');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold py-3.5 px-6 rounded-2xl text-xs cursor-pointer transition-all active:scale-95 shadow-md uppercase tracking-wider"
                >
                  Return to Lobby
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
                  alert('Please fill in all required fields.');
                  return;
                }
                playClickSound();
                setContactSubmitted(true);
              }}
              className="space-y-4 font-sans text-sm text-slate-700 dark:text-slate-300"
            >
              <div>
                <label className="block font-black mb-1.5">Your Name (Full Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Sameer Choudhary"
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-violet-400 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="sameer@example.com"
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-violet-400 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black mb-1.5">Subject</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="Gameplay feedback / new suggestion"
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-violet-400 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black mb-1.5">Your Message <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={5}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Write your message here..."
                  className="w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-violet-400 focus:outline-none dark:text-white resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { playClickSound(); setActivePage('HOME'); }}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-extrabold rounded-xl transition-all cursor-pointer active:scale-95 text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-violet-500 hover:bg-violet-600 text-white font-extrabold rounded-xl shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-95 text-xs uppercase tracking-wider"
                >
                  Send Message
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // Full-screen page routing logic
  if (activePage === 'PRIVACY') {
    return renderPrivacyPage();
  }
  if (activePage === 'TERMS') {
    return renderTermsPage();
  }
  if (activePage === 'CONTACT') {
    return renderContactPage();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-amber-50 to-emerald-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 font-sans p-3 md:p-4 pt-1 transition-colors duration-300">
      
      {/* 1. Header controls (Hamburger menu left, Sound button right - scaled down 30% and pushed high up) */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-1.5 pt-0.5 px-1 relative z-30">
        {/* Left Side: 3-line Hamburger Menu Button with Dropdown Options */}
        <div className="relative">
          <button
            onClick={() => {
              playClickSound();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="p-1.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-[0_2.5px_0_#CBD5E1] dark:shadow-[0_2.5px_0_#1E293B] hover:scale-105 active:translate-y-0.5 transition-all cursor-pointer text-slate-700 dark:text-slate-100 flex items-center justify-center"
            aria-label="Menu"
            id="hamburger-menu-btn"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Dropdown Options menu */}
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-slate-800 border-4 border-violet-500 rounded-2xl p-3 shadow-2xl w-72 sm:w-80 text-left animate-fade-in font-sans max-h-[80vh] overflow-y-auto">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block px-2.5 py-1 mb-2 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50">
                ⚙️ ARCADE CABINET SETTINGS
              </span>
              
              <div className="space-y-4">
                {/* 1. SPEED CONTROLLER */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">⚡ SNAKE SPEED:</span>
                    <span className="text-xs font-mono font-black text-violet-600 dark:text-violet-400">
                      x{customSpeedMultiplier.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="2.2"
                    step="0.1"
                    value={customSpeedMultiplier}
                    onChange={(e) => {
                      playClickSound();
                      handleSpeedMultiplierChange(parseFloat(e.target.value));
                    }}
                    className="w-full accent-violet-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    id="snake-speed-slider"
                  />
                  <div className="flex justify-between text-[8px] font-black text-slate-400 mt-0.5">
                    <span>SLOW 🐌</span>
                    <span>NORMAL 🐍</span>
                    <span>HYPER! 🚀</span>
                  </div>
                </div>

                {/* 2. BACKGROUND COLOR COMBOS */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-1.5">
                    🎨 BOARD BACKGROUND COMBOS:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BOARD_THEMES.map((theme) => {
                      const isSel = boardTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => {
                            playClickSound();
                            handleBoardThemeChange(theme.id);
                          }}
                          className={`p-1.5 rounded-lg border-2 text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                            isSel
                              ? 'bg-violet-100/60 dark:bg-violet-950/20 border-violet-500 text-violet-700 dark:text-violet-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[10px] font-bold truncate">{theme.name.split(' ')[0]}</span>
                          <div className="flex -space-x-1.5 items-center flex-shrink-0">
                            <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.color1 }} />
                            <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.color2 }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. FRUITS LIST WITH CHECKBOXES */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-1.5">
                    🍎 ALLOWED FOOD SPAWNS:
                  </span>
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {ALL_FOOD_TEMPLATES.map((fruit) => {
                      const isTicked = allowedFruits[fruit.type] === true;
                      return (
                        <button
                          key={fruit.type}
                          onClick={() => {
                            playClickSound();
                            handleFruitToggle(fruit.type);
                          }}
                          className="w-full flex justify-between items-center px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{fruit.emoji}</span>
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{fruit.name}</span>
                          </div>
                          
                          {/* Checked Box */}
                          <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${
                            isTicked
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                          }`}>
                            {isTicked && (
                              <svg className="w-2.5 h-2.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700/50 my-1.5"></div>
                
                {/* 4. ACTIONS */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => {
                      playClickSound();
                      setIsMenuOpen(false);
                      resetAllProgress();
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs font-extrabold rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all flex items-center gap-2 cursor-pointer border border-transparent hover:border-rose-200"
                  >
                    ⚠️ Reset All Progress
                  </button>
                  <button
                    onClick={() => {
                      playClickSound();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-center py-2 text-xs font-black bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-white transition-all cursor-pointer"
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Sound control (scaled down 30% and positioned high up) */}
        <div className="relative">
          <button
            onClick={() => {
              playClickSound();
              setIsVolumeShutterOpen(!isVolumeShutterOpen);
            }}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-[0_2.5px_0_#CBD5E1] dark:shadow-[0_2.5px_0_#1E293B] hover:scale-105 active:translate-y-0.5 transition-all text-xs font-black flex items-center gap-1.5 cursor-pointer dark:text-slate-100"
            id="sound-shutter-toggle"
          >
            {soundOn ? `🔊 ${Math.round(volumeLevel * 100)}% ▾` : '🔇 MUTED ▾'}
          </button>

          {/* Slide Down Volume Shutter */}
          {isVolumeShutterOpen && (
            <div className="absolute top-full right-0 mt-2 z-40 bg-white dark:bg-slate-800 border-4 border-violet-500 rounded-2xl p-3 shadow-xl w-48 text-left animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400">SOUND</span>
                <button
                  onClick={() => {
                    playClickSound();
                    handleToggleSound();
                  }}
                  className={`px-2 py-0.5 text-[9px] font-black rounded-lg transition-all border-2 cursor-pointer ${
                    soundOn 
                      ? 'bg-emerald-500 text-white border-emerald-600' 
                      : 'bg-rose-500 text-white border-rose-600'
                  }`}
                >
                  {soundOn ? 'ACTIVE' : 'MUTED'}
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Volume:</span>
                  <span className="font-mono font-bold text-violet-500 dark:text-violet-400">{soundOn ? Math.round(volumeLevel * 100) : 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundOn ? volumeLevel : 0}
                  disabled={!soundOn}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  id="volume-slider-header"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Brand Hero Logo (Fixed place, no bouncing) */}
      <header className="max-w-xl mx-auto text-center mb-3">
        <div className="inline-flex items-center justify-center bg-emerald-400 dark:bg-emerald-600 p-2 rounded-full border-2 border-emerald-600 shadow-md mb-1">
          <span className="text-2xl">🐍</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight drop-shadow-sm">
          Slinky Snake Adventures
        </h1>
        <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
          A magical journey filled with shining stars, spicy chilies, and golden crowns! ✨⭐
        </p>
      </header>

      {/* 3. Main Setup/Configuration Container */}
      <main className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* ROW 1: START OPTIONS & SKIN SELECTOR (Play box at the top) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* Column A: Active Play/Start Menu Box (On top / first) */}
          <div className="flex flex-col gap-4">
            {/* Mode switch bar */}
            <div className="bg-slate-200/80 dark:bg-slate-800 p-1.5 rounded-2xl border-4 border-slate-300 dark:border-slate-700 gap-1 flex shadow-inner w-full">
              <button
                onClick={() => { playClickSound(); setGameMode('CLASSIC'); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  gameMode === 'CLASSIC'
                    ? 'bg-emerald-400 border-2 border-emerald-600 text-slate-900 shadow-[0_2px_0_#059669]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
                id="mode-classic"
              >
                ♾️ Classic Mode
              </button>
              <button
                onClick={() => { playClickSound(); setGameMode('LEVELS'); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  gameMode === 'LEVELS'
                    ? 'bg-violet-400 border-2 border-violet-600 text-slate-900 shadow-[0_2px_0_#7C3AED]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
                id="mode-levels"
              >
                🗺️ Levels Mode
              </button>
            </div>

            {/* Level selection for level-mode inside left column */}
            {gameMode === 'LEVELS' && (
              <div className="bg-violet-50 dark:bg-slate-800/60 p-4 rounded-3xl border-4 border-violet-400 shadow-md w-full overflow-hidden">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs text-violet-700 dark:text-violet-400 font-black uppercase tracking-wide">
                    🗺️ Select World (Swipe/Scroll ➔)
                  </span>
                  <span className="text-[10px] bg-violet-200 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200 px-2 py-0.5 rounded-full font-black">
                    {LEVEL_CONFIGS.filter((l, i) => i === 0 || l.level <= unlockedLevel).length}/{LEVEL_CONFIGS.length} Unlocked
                  </span>
                </div>
                
                {/* Horizontal scrollable row */}
                <div className="flex flex-row gap-2.5 overflow-x-auto pb-3 pt-1 px-1 snap-x scrollbar-thin scrollbar-thumb-violet-400 dark:scrollbar-thumb-violet-600 scrollbar-track-transparent">
                  {LEVEL_CONFIGS.map((lvl, index) => {
                    const isSelected = index === currentLevelIdx;
                    const isUnlocked = index === 0 || lvl.level <= unlockedLevel;
                    return (
                      <button
                        key={lvl.level}
                        disabled={!isUnlocked}
                        onClick={() => {
                          if (isUnlocked) {
                            playClickSound();
                            setCurrentLevelIdx(index);
                          }
                        }}
                        className={`flex-shrink-0 w-14 h-14 rounded-2xl font-bold flex flex-col items-center justify-center border-4 snap-center transition-all relative ${
                          !isUnlocked
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-300 dark:border-slate-700 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-gradient-to-br from-violet-400 to-indigo-400 border-violet-600 text-slate-900 scale-105 shadow-md'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-violet-400 hover:scale-102 active:scale-95 cursor-pointer'
                        }`}
                        title={isUnlocked ? lvl.theme.name : 'Completed previous level to unlock!'}
                      >
                        <span className="text-[9px] uppercase tracking-wider font-black leading-none opacity-80">World</span>
                        <span className="text-lg font-black mt-0.5 leading-none">{lvl.level}</span>
                        {!isUnlocked && (
                          <div className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 border border-rose-600 shadow-sm flex items-center justify-center text-[8px] w-4.5 h-4.5 font-bold">
                            🔒
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <p className="text-center text-[11px] text-violet-700 dark:text-violet-300 mt-2 font-bold bg-white/50 dark:bg-slate-900/30 py-1.5 rounded-xl border border-violet-200/40">
                  📍 Target destination: <span className="font-black text-rose-500">{activeLevelConfig.theme.name}</span>
                </p>
              </div>
            )}

            {renderStartMenuCard()}
          </div>

          {/* Column B: Skins Selection & Mode Settings */}
          <div className="flex flex-col gap-4">
            <SkinSelector
              selectedSkin={selectedSkin}
              onSelectSkin={setSelectedSkin}
            />
          </div>

        </div>

        {/* ROW 2: SCORES, POWERUP GUIDES & ACHIEVEMENTS (At the bottom) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-4 border-t border-slate-300/40 dark:border-slate-800/40 pt-6">
          
          {/* 1. Score Center */}
          <div className="bg-amber-100/80 dark:bg-slate-800/80 p-5 rounded-3xl border-4 border-amber-400 shadow-md flex flex-col gap-3 h-full justify-between">
            <div>
              <h3 className="text-xs font-black text-amber-800 dark:text-amber-400 text-center uppercase tracking-widest mb-2.5">
                🏆 Score Center 🏆
              </h3>
              
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50">
                  <span className="text-[9px] text-slate-400 uppercase font-black block">Last Score</span>
                  <span className="text-xl font-black text-rose-500">{score}</span>
                </div>
                <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50">
                  <span className="text-[9px] text-slate-400 uppercase font-black block">Best Record</span>
                  <span className="text-xl font-black text-amber-500">{highScore}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-200/40 dark:bg-slate-900/40 p-2.5 rounded-xl text-center flex justify-between items-center px-4 mt-4">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">🔥 Multiplier:</span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-rose-300">
                x{comboMultiplier}
              </span>
            </div>
          </div>

          {/* 2. Power-Up Items Guide */}
          <PowerUpGuide />

          {/* 3. Achievements list */}
          <AchievementsBox unlockedList={unlockedAchievements} />

        </div>

      </main>

      {/* Deep Rich 1000-Word Website Explanation & Description Section */}
      <section className="mt-16 bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 md:p-10 border-4 border-slate-200 dark:border-slate-800 shadow-lg max-w-7xl mx-auto font-sans text-slate-700 dark:text-slate-300">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-6 border-b-4 border-violet-500 pb-3 flex items-center gap-3">
          🐍 Slinky Snake Adventures 2D — Ultimate Arcade Gaming Guide
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm leading-relaxed">
          {/* Left Column */}
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🎮 1. Slinky Snake Adventures 2D - A Brand New Modern Arcade Era
              </h3>
              <p>
                Slinky Snake Adventures 2D is not just another standard snake game; it is a highly modernized, elegant, and thrilling evolution of the classic Nokia snake game. Born in the 1970s, this legendary arcade gameplay has been fully reimagined using cutting-edge web technologies including React, Vite, Tailwind CSS, and the HTML5 Canvas API. We have designed this game to be deeply engaging, challenging, and relaxing for players of all ages. You will experience pixel-perfect smooth visuals paired with a real-time Web Audio synthesizer that generates authentic analog synthesizer sound effects dynamically at every slither and turn.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🌍 2. A Journey Through Two Exciting Game Modes
              </h3>
              <p>
                Our website provides players with two distinctly engineered gameplay experiences to suit their style:
              </p>
              <ul className="list-disc list-inside ml-2 mt-1 flex flex-col gap-1.5">
                <li>
                  <strong className="text-slate-800 dark:text-slate-100">Classic Mode:</strong> An endless, pure highscore challenge with no boundaries. As you consume succulent fruits, your length and score grow indefinitely. Can you survive long enough to shatter your own legendary highscore? This mode is a true test of focus, hand-eye coordination, and swift reaction times.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-100">Level Mode:</strong> Embark on an adventurous campaign across {LEVEL_CONFIGS.length} magical worlds. Each world introduces unique obstacle configurations, increasing complexity, and a required target score to successfully enter the next gate. Every single level features its own gorgeous color theme and atmospheric background.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🍓 3. A Feast of 10+ Delicious Fruits & Super-Foods
              </h3>
              <p>
                Instead of traditional simple dots, Slinky Snake features a rich, colorful menu of over 10 varieties of juicy fruits and magical powerups. Each edible item possesses a specific point value, a customized particle explosion effect, and a physical/score impact on the game:
              </p>
              <ul className="list-disc list-inside ml-2 mt-1 flex flex-col gap-1">
                <li><strong>Juicy Apple:</strong> +10 points - Classic and reliable food.</li>
                <li><strong>Slippery Banana:</strong> +12 points - Easy to consume and highly satisfying.</li>
                <li><strong>Purple Grape:</strong> +15 points - Temporarily slows down the snake for 6 seconds to let you navigate complex narrow turns safely.</li>
                <li><strong>Spicy Chili:</strong> +15 points - Increases the snake speed and doubles your combo multiplier score for 8 seconds!</li>
                <li><strong>Golden Pineapple:</strong> +18 points - Explodes with a tropical particle burst.</li>
                <li><strong>Hard Coconut:</strong> +20 points - Crunchy shockwave that gently shakes the game board.</li>
                <li><strong>Golden Star:</strong> +25 points - Sparkling visual trail and triggers a double multiplier.</li>
                <li><strong>Watermelon:</strong> +30 points - Explosive juice splatter with intense screen vibration!</li>
                <li><strong>Rainbow Cake:</strong> +40 points - Immediately appends 2 extra segments to your length.</li>
                <li><strong>Dragon Fruit:</strong> +50 points - Extremely rare mystical food that releases magical purple glow sparks.</li>
                <li><strong>Magical Blue Booster:</strong> +50 points - Laboratory elixir that grants high velocity decaying slowly over 10 seconds.</li>
              </ul>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                ⚡ 4. Dynamic Combo Multipliers & Musical Tones
              </h3>
              <p>
                To become a true arcade champion, master our dynamic Combo System. When you consume multiple fruits in quick succession, the combo timer stays active and your score multiplier increases. In addition, as your combo grows, our custom audio engine dynamically pitches up the synthesizer tones, creating an incredibly satisfying musical crescendo as you play!
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🎨 5. 10+ Premium Hand-Crafted Skins & Customization
              </h3>
              <p>
                Express your personality with our state-of-the-art skin selector! We feature over 10 premium, hand-crafted skins, including Neon Glow, Cosmic Space, Mystic Dragon, Rainbow Spectrum, Candy Swirl, Tiger Stripes, Golden Luster, and Phantom Specter. Each skin features uniquely rendered gradients, textures, and custom snake heads that render beautifully on the HTML5 canvas.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🔊 6. Real-Time Web Audio Synthesizer & Physics Vibration
              </h3>
              <p>
                Without downloading heavy static audio files, this game leverages your browser's native Web Audio API to synthesize custom wave sound effects in real-time. When the snake slithers, eats, clears a level, or collides with an obstacle, the audio node constructs precise wave synthesis (Sine, Square, Triangle, and Sawtooth) on-the-fly. Coupled with fluid camera shakes and blast debris, players get a tactile console-like experience.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-2">
                🔒 7. 100% Client-Side Privacy & Secure Storage
              </h3>
              <p>
                We respect your privacy completely. Slinky Snake Adventures 2D runs entirely on the client side; no emails, personal records, IP addresses, or gameplay statistics are ever transmitted to any external server. Your unlocked achievements, highscores, and selected skins are securely saved in your browser's local storage (LocalStorage), allowing you to pick up exactly where you left off!
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Tips Alert Box */}
        <div className="mt-8 bg-violet-50 dark:bg-slate-900/40 border-l-4 border-violet-500 p-4 rounded-r-2xl">
          <p className="text-xs font-bold text-violet-800 dark:text-violet-300">
            💡 Pro-Tip: Consuming a Golden Star immediately after eating a Spicy Chili yields massive double combo scores! Use Purple Grapes strategically when the snake grows long to squeeze through narrow obstacles.
          </p>
        </div>
      </section>

      {/* Modern Interactive Footer Links Section */}
      <footer className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500 pb-12 border-t border-slate-300/20 dark:border-slate-800/20 pt-8 max-w-7xl mx-auto px-4">
        <p className="mt-1 text-[11px] text-slate-400/80 dark:text-slate-600/80">Use Arrow Keys / WASD or On-screen Controls to Slither</p>
        <p className="mt-2 text-[10px] text-slate-500/60 dark:text-slate-700/60">© 2026 Slinky Snake Adventures. All rights reserved. 100% Client-Side Safe.</p>
        
        {/* Side-by-side links located at the very bottom, beneath the 2026 copyright text */}
        <div className="flex flex-row justify-center items-center gap-4 mt-4 font-bold text-[12px] text-slate-600 dark:text-slate-400">
          <button
            onClick={() => { playClickSound(); setActivePage('PRIVACY'); }}
            className="hover:text-violet-500 transition-colors cursor-pointer flex items-center gap-1"
          >
            🔒 Privacy Policy
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            onClick={() => { playClickSound(); setActivePage('TERMS'); }}
            className="hover:text-violet-500 transition-colors cursor-pointer flex items-center gap-1"
          >
            📜 Terms of Use
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            onClick={() => { playClickSound(); setActivePage('CONTACT'); setContactSubmitted(false); }}
            className="hover:text-violet-500 transition-colors cursor-pointer flex items-center gap-1"
          >
            ✉️ Contact Us
          </button>
        </div>
      </footer>

    </div>
  );

  // Helper reset function
  function resetGameAndBack() {
    setScore(0);
    setComboMultiplier(1);
    setFoodEatenCount(0);
    setShowVictory(false);
    setShowGameOver(false);
    setShowLevelClear(false);
    setIsPlaying(false);
  }
}
