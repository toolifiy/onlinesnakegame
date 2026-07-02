import { useEffect, useRef, useState } from 'react';
import { Direction, Position, Particle, FloatingText, Food, FoodType, Skin, LevelConfig, GameMode } from '../types';
import { playEatSound, playCrashSound, playLevelUpSound, playClickSound, initAudio } from '../utils/audio';
import { SNAKE_SKINS, BOARD_THEMES, BoardTheme, ALL_FOOD_TEMPLATES } from '../data';
import Dpad from './Dpad';
import SnakeHeadPreview from './SnakeHeadPreview';

interface EatAnimation {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface GameBoardProps {
  selectedSkin: Skin;
  onSelectSkin: (skin: Skin) => void;
  gameMode: GameMode;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
  isPlaying: boolean;
  onGameOver: (score: number, highscore: number, foodEaten: number) => void;
  currentLevel: number;
  onLevelUp: () => void;
  onScoreChange: (score: number, comboMultiplier: number) => void;
  score: number;
  onGameStart: () => void;
  unlockAchievement: (id: string) => void;
  levelConfig: LevelConfig;
  resetGameAndBack: () => void;
  soundOn: boolean;
  handleToggleSound: () => void;
  volumeLevel: number;
  handleVolumeChange: (newVolume: number) => void;
  customSpeedMultiplier: number;
  setCustomSpeedMultiplier: (speed: number) => void;
  boardTheme: string;
  setBoardTheme: (theme: string) => void;
  allowedFruits: Record<FoodType, boolean>;
  setAllowedFruits: (fruit: FoodType) => void;
  highScore: number;
}

const GRID_SIZE = 20; // 20x20 grid

export default function GameBoard({
  selectedSkin,
  onSelectSkin,
  gameMode,
  isPaused,
  setIsPaused,
  isPlaying,
  onGameOver,
  currentLevel,
  onLevelUp,
  onScoreChange,
  score,
  onGameStart,
  unlockAchievement,
  levelConfig,
  resetGameAndBack,
  soundOn,
  handleToggleSound,
  volumeLevel,
  handleVolumeChange,
  customSpeedMultiplier,
  setCustomSpeedMultiplier,
  boardTheme,
  setBoardTheme,
  allowedFruits,
  setAllowedFruits,
  highScore,
}: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Core game states
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const [food, setFood] = useState<Food | null>(null);
  
  // Local direction state
  const [direction, setDirection] = useState<Direction>('UP');

  // Power-up durations in milliseconds
  const [activeEffects, setActiveEffects] = useState<{
    chili: number; // speed up + double points
    grape: number; // slow down
    booster: number; // Blue magic booster
    immortal: number; // Ghost Immortal
    doublePoints: number; // Double points
    magnet: number; // Magnet pull
    chiliCrying: number; // 10 seconds funny crying tears
  }>({ chili: 0, grape: 0, booster: 0, immortal: 0, doublePoints: 0, magnet: 0, chiliCrying: 0 });

  // Floating text, particles, and visual effect states
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const eatAnimationsRef = useRef<EatAnimation[]>([]);
  const [screenShake, setScreenShake] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  const [foodEatenCount, setFoodEatenCount] = useState(0);
  const foodEatenCountRef = useRef<number>(foodEatenCount);
  const [boosterEatenCount, setBoosterEatenCount] = useState(0);
  const boosterEatenCountRef = useRef<number>(0);

  // High score explosion / blast animation states
  const [hasBrokenRecord, setHasBrokenRecord] = useState(false);
  const [blastActive, setBlastActive] = useState(false);
  const [blastSparks, setBlastSparks] = useState<{ id: number; angle: number; char: string }[]>([]);
  const initialHighScoreRef = useRef<number>(highScore);

  useEffect(() => {
    if (isPlaying) {
      initialHighScoreRef.current = highScore;
      setHasBrokenRecord(false);
      setBlastActive(false);
      setBlastSparks([]);
    }
  }, [isPlaying]);

  useEffect(() => {
    const recordToBreak = initialHighScoreRef.current || 5;
    if (isPlaying && score > recordToBreak && !hasBrokenRecord) {
      setHasBrokenRecord(true);
      setBlastActive(true);
      
      const chars = ['⭐', '✨', '💥', '🎉', '👑'];
      const sparks = [];
      for (let i = 0; i < 16; i++) {
        sparks.push({
          id: i,
          angle: (i / 16) * Math.PI * 2 + Math.random() * 0.3,
          char: chars[Math.floor(Math.random() * chars.length)]
        });
      }
      setBlastSparks(sparks);
      playLevelUpSound(); // play glorious celebration sound!
      
      // Clear blast effects after animation duration
      setTimeout(() => {
        setBlastActive(false);
        setBlastSparks([]);
      }, 2000);
    }
  }, [score, isPlaying]);

  const directionRef = useRef<Direction>(direction);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isPausedRef = useRef<boolean>(isPaused);

  // Sync refs to avoid stale closures in requestAnimationFrame loop
  useEffect(() => { foodEatenCountRef.current = foodEatenCount; }, [foodEatenCount]);
  useEffect(() => { boosterEatenCountRef.current = boosterEatenCount; }, [boosterEatenCount]);
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  const [isLizardPaused, setIsLizardPaused] = useState<boolean>(false);
  const isLizardPausedRef = useRef<boolean>(false);
  useEffect(() => { isLizardPausedRef.current = isLizardPaused; }, [isLizardPaused]);

  const [isLizardDelay, setIsLizardDelay] = useState<boolean>(false);
  const isLizardDelayRef = useRef<boolean>(false);
  useEffect(() => { isLizardDelayRef.current = isLizardDelay; }, [isLizardDelay]);

  // Decoupled refs for continuous loop safety
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Food | null>(food);
  const activeEffectsRef = useRef(activeEffects);
  const comboCountRef = useRef<number>(comboCount);
  const scoreRef = useRef<number>(score);
  const screenShakeRef = useRef<number>(screenShake);
  const gameModeRef = useRef<GameMode>(gameMode);
  const selectedSkinRef = useRef<Skin>(selectedSkin);

  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { activeEffectsRef.current = activeEffects; }, [activeEffects]);
  useEffect(() => { comboCountRef.current = comboCount; }, [comboCount]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { screenShakeRef.current = screenShake; }, [screenShake]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { selectedSkinRef.current = selectedSkin; }, [selectedSkin]);

  const customSpeedMultiplierRef = useRef<number>(customSpeedMultiplier);
  useEffect(() => {
    customSpeedMultiplierRef.current = customSpeedMultiplier;
  }, [customSpeedMultiplier]);

  const boardThemeRef = useRef<string>(boardTheme);
  useEffect(() => {
    boardThemeRef.current = boardTheme;
  }, [boardTheme]);

  const allowedFruitsRef = useRef<Record<FoodType, boolean>>(allowedFruits);
  useEffect(() => {
    allowedFruitsRef.current = allowedFruits;
  }, [allowedFruits]);

  // Keep track of level config for speed & obstacles
  const levelConfigRef = useRef<LevelConfig>(levelConfig);
  useEffect(() => {
    levelConfigRef.current = levelConfig;
  }, [levelConfig]);

  // Timers to freeze and pause everything in-game perfectly
  const lastRealTimeRef = useRef<number>(0);
  const animationTimerRef = useRef<number>(0);

  // Handle game loop timer
  const lastMoveTimeRef = useRef<number>(0);
  const prevSnakeRef = useRef<Position[]>([]);
  const moveProgressRef = useRef<number>(1.0);
  const animationFrameIdRef = useRef<number | null>(null);
  const headEatAnimRef = useRef<number>(0);

  // Initialize/Reset Game
  const resetGame = () => {
    const initialSnake = [
      { x: 10, y: 8 },
      { x: 10, y: 9 },
      { x: 10, y: 10 },
    ];
    setSnake(initialSnake);
    prevSnakeRef.current = [
      { x: 10, y: 8 },
      { x: 10, y: 9 },
      { x: 10, y: 10 },
    ];
    moveProgressRef.current = 1.0;
    setDirection('UP');
    setComboCount(0);
    setComboTimer(0);
    setFoodEatenCount(0);
    setBoosterEatenCount(0);
    boosterEatenCountRef.current = 0;
    setActiveEffects({ chili: 0, grape: 0, booster: 0, immortal: 0, doublePoints: 0, magnet: 0, chiliCrying: 0 });
    particlesRef.current = [];
    floatingTextsRef.current = [];
    eatAnimationsRef.current = [];
    setCountdown(null);
    setIsLizardPaused(false);
    setIsLizardDelay(false);
    const activeObstacles = gameMode === 'CLASSIC' ? [] : levelConfig.obstacles;
    const initialFood = spawnFood(initialSnake, activeObstacles);
    setFood(initialFood);
  };

  const handleLizardToggle = () => {
    if (isPaused) {
      // If menu is paused, close it, and resume with a silent 1 second delay
      setIsPaused(false);
      setIsLizardPaused(false);
      setIsLizardDelay(true);
      setTimeout(() => {
        setIsLizardDelay(false);
      }, 1000);
    } else if (isLizardPaused) {
      // Unpause from lizard pause: 1s silent delay, no visible countdown timer
      setIsLizardPaused(false);
      setIsLizardDelay(true);
      setTimeout(() => {
        setIsLizardDelay(false);
      }, 1000);
    } else {
      // Pause via lizard
      setIsLizardPaused(true);
    }
  };

  const handleMenuResume = () => {
    setIsPaused(false);
    setCountdown(3);
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (isPlaying) {
      resetGame();
    }
  }, [isPlaying, gameMode, currentLevel]);

  // Spawn food avoiding snake & obstacles
  const spawnFood = (currentSnake: Position[], currentObstacles: Position[], forceBooster: boolean = false): Food => {
    let attempts = 0;
    let newPos: Position = { x: 5, y: 5 };
    let isCollision = true;

    while (isCollision && attempts < 200) {
      newPos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      
      const inSnake = currentSnake.some(s => s.x === newPos.x && s.y === newPos.y);
      const inObstacles = currentObstacles.some(o => o.x === newPos.x && o.y === newPos.y);
      
      if (!inSnake && !inObstacles) {
        isCollision = false;
      }
      attempts++;
    }

    if (forceBooster) {
      return {
        position: newPos,
        type: 'BOOSTER',
        color: '#2563EB', // Royal Magic Blue
        emoji: '🧪',
        points: 50,
        pulseScale: 1.0,
        spawnTime: Date.now(),
      };
    }

    // Determine food type dynamically based on allowedFruits checkbox settings with weighted probabilities
    let templates = ALL_FOOD_TEMPLATES.filter(t => allowedFruitsRef.current && allowedFruitsRef.current[t.type] === true);

    // Force add always-active power-ups to the templates pool so they can always spawn, regardless of checklists!
    const alwaysActivePowerTypes = ['POWER_SPEED', 'POWER_IMMORTAL', 'POWER_DOUBLE', 'POWER_MAGNET', 'POWER_SHRINK'];
    const activePowerTemplates = ALL_FOOD_TEMPLATES.filter(t => alwaysActivePowerTypes.includes(t.type));
    
    // Combine checked standard fruits and always-active powerups
    templates = [...templates, ...activePowerTemplates];

    // Fallback if somehow none are active
    if (templates.length === 0) {
      templates.push({ type: 'APPLE', color: '#EF4444', emoji: '🍎', points: 10, prob: 100, name: 'Red Apple' });
    }

    const totalWeight = templates.reduce((acc, curr) => acc + curr.prob, 0);
    let randWeight = Math.random() * totalWeight;
    
    let type: FoodType = 'APPLE';
    let color = '#EF4444';
    let emoji = '🍎';
    let points = 10;

    for (const t of templates) {
      if (randWeight <= t.prob) {
        type = t.type as FoodType;
        color = t.color;
        emoji = t.emoji;
        points = t.points;
        break;
      }
      randWeight -= t.prob;
    }

    return {
      position: newPos,
      type,
      color,
      emoji,
      points,
      pulseScale: 1.0,
      spawnTime: Date.now(),
    };
  };

  // Trigger colorful particle explosion
  const createExplosion = (x: number, y: number, color: string, count: number = 10) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellWidth = canvas.width / GRID_SIZE;
    const startX = x * cellWidth + cellWidth / 2;
    const startY = y * cellWidth + cellWidth / 2;

    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      newParticles.push({
        id: Math.random() + i,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 4 + 3,
        life: 0,
        maxLife: Math.random() * 20 + 15,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  };

  // Sparkle trail for special power-ups
  const createTrailSparkle = (headX: number, headY: number, color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellWidth = canvas.width / GRID_SIZE;
    const startX = headX * cellWidth + cellWidth / 2 + (Math.random() * 10 - 5);
    const startY = headY * cellWidth + cellWidth / 2 + (Math.random() * 10 - 5);

    particlesRef.current.push({
      id: Math.random(),
      x: startX,
      y: startY,
      vx: (Math.random() * 1 - 0.5) * 0.5,
      vy: (Math.random() * 1 - 0.5) * 0.5,
      color,
      size: Math.random() * 3 + 1.5,
      life: 0,
      maxLife: 15,
    });
  };

  // Create floating animation text
  const addFloatingText = (text: string, x: number, y: number, color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellWidth = canvas.width / GRID_SIZE;
    const startX = x * cellWidth + cellWidth / 2;
    const startY = y * cellWidth;

    floatingTextsRef.current.push({
      id: Math.random(),
      text,
      x: startX,
      y: startY,
      color,
      life: 30, // frames
    });
  };

  // Handle Keyboard Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      initAudio(); // Force audio resume on first key press
      if (!isPlayingRef.current || isPausedRef.current) return;

      const currentDir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir !== 'LEFT') setDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, isPaused, setDirection]);

  // Game step logic (movement, collisions, food eating)
  const gameStep = () => {
    if (!isPlayingRef.current || isPausedRef.current || isLizardPausedRef.current || countdownRef.current !== null || isLizardDelayRef.current) return;

    const prevSnake = [...snakeRef.current];
    if (prevSnake.length === 0) return;

    // Magnet power-up logic: dynamically pull food closer to snake head
    const magneticFood = foodRef.current;
    if (magneticFood && activeEffectsRef.current.magnet > 0) {
      const head = prevSnake[0];
      if (head) {
        const dx = head.x - magneticFood.position.x;
        const dy = head.y - magneticFood.position.y;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        
        // If within magnet pull range (e.g. 4 cells)
        if (distance > 0 && distance <= 4) {
          let nextFoodX = magneticFood.position.x;
          let nextFoodY = magneticFood.position.y;
          
          if (dx > 0) nextFoodX += 1;
          else if (dx < 0) nextFoodX -= 1;
          
          if (dy > 0) nextFoodY += 1;
          else if (dy < 0) nextFoodY -= 1;
          
          // Ensure pulled food does not overlap with obstacles or other body parts
          const inObstacles = gameModeRef.current === 'LEVELS' && levelConfigRef.current.obstacles.some(o => o.x === nextFoodX && o.y === nextFoodY);
          const inSnakeBody = prevSnake.slice(1).some(s => s.x === nextFoodX && s.y === nextFoodY);
          
          if (!inObstacles && !inSnakeBody && nextFoodX >= 0 && nextFoodX < GRID_SIZE && nextFoodY >= 0 && nextFoodY < GRID_SIZE) {
            magneticFood.position = { x: nextFoodX, y: nextFoodY };
            foodRef.current = { ...magneticFood };
            setFood({ ...magneticFood });
          }
        }
      }
    }

    const head = prevSnake[0];
    const dir = directionRef.current;
    let nextHead = { ...head };

    switch (dir) {
      case 'UP': nextHead.y -= 1; break;
      case 'DOWN': nextHead.y += 1; break;
      case 'LEFT': nextHead.x -= 1; break;
      case 'RIGHT': nextHead.x += 1; break;
    }

    const activeMode = gameModeRef.current;

    // 1. Check Border Collision
    if (
      nextHead.x < 0 ||
      nextHead.x >= GRID_SIZE ||
      nextHead.y < 0 ||
      nextHead.y >= GRID_SIZE
    ) {
      if (activeMode === 'CLASSIC') {
        // Classic wraps around
        nextHead.x = (nextHead.x + GRID_SIZE) % GRID_SIZE;
        nextHead.y = (nextHead.y + GRID_SIZE) % GRID_SIZE;
      } else {
        // Level Mode: crash!
        playCrashSound();
        setScreenShake(20);
        const finalScore = scoreRef.current;
        const highscore = Number(localStorage.getItem(`snake_hs_${activeMode}`) || '0');
        const newHigh = Math.max(finalScore, highscore);
        if (newHigh > highscore) {
          localStorage.setItem(`snake_hs_${activeMode}`, newHigh.toString());
        }
        onGameOver(finalScore, newHigh, foodEatenCountRef.current);
        return;
      }
    }

    // 2. Check Self Collision
    const collidedWithSelf = prevSnake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    if (collidedWithSelf && activeEffectsRef.current.immortal <= 0) {
      playCrashSound();
      setScreenShake(20);
      const finalScore = scoreRef.current;
      const activeMode = gameModeRef.current;
      const highscore = Number(localStorage.getItem(`snake_hs_${activeMode}`) || '0');
      const newHigh = Math.max(finalScore, highscore);
      if (newHigh > highscore) {
        localStorage.setItem(`snake_hs_${activeMode}`, newHigh.toString());
      }
      onGameOver(finalScore, newHigh, foodEatenCountRef.current);
      return;
    }

    // 3. Check Obstacles Collision
    const collidedWithObstacle = gameModeRef.current === 'LEVELS' && levelConfigRef.current.obstacles.some(
      (obs) => obs.x === nextHead.x && obs.y === nextHead.y
    );
    if (collidedWithObstacle && activeEffectsRef.current.immortal <= 0) {
      playCrashSound();
      setScreenShake(20);
      const finalScore = scoreRef.current;
      const activeMode = gameModeRef.current;
      const highscore = Number(localStorage.getItem(`snake_hs_${activeMode}`) || '0');
      const newHigh = Math.max(finalScore, highscore);
      if (newHigh > highscore) {
        localStorage.setItem(`snake_hs_${activeMode}`, newHigh.toString());
      }
      onGameOver(finalScore, newHigh, foodEatenCountRef.current);
      return;
    }

    // Create new snake list
    const newSnake = [nextHead, ...prevSnake];

    // 4. Check Food Eating using synchronized foodRef
    const currentFood = foodRef.current;
    if (currentFood && nextHead.x === currentFood.position.x && nextHead.y === currentFood.position.y) {
      // Eaten!
      playEatSound(currentFood.type, comboCountRef.current);
      
      // Trigger mouth eating animation
      headEatAnimRef.current = 15;

      // Synchronously increment food eaten count
      const nextEaten = foodEatenCountRef.current + 1;
      foodEatenCountRef.current = nextEaten;
      setFoodEatenCount(nextEaten);

      // Score Calculation with combos
      let earnedPoints = currentFood.points;
      const isChiliActive = activeEffectsRef.current.chili > 0;
      const isDoublePointsActive = activeEffectsRef.current.doublePoints > 0;
      
      // Multiplier bonuses
      let currentMultiplier = 1;
      const currentCombo = comboCountRef.current;
      if (currentCombo > 0) {
        currentMultiplier += Math.floor(currentCombo / 2);
      }
      if (isChiliActive) {
        currentMultiplier *= 2; // Chili doubles all score increments!
      }
      if (isDoublePointsActive) {
        currentMultiplier *= 2; // Double Points powerup doubles all score increments!
      }

      earnedPoints = earnedPoints * currentMultiplier;
      
      // Synchronously increment score
      const nextScore = scoreRef.current + earnedPoints;
      scoreRef.current = nextScore;
      onScoreChange(nextScore, currentMultiplier);

      // Particle, ring, and text effects at snake head
      const cellWidth = canvasRef.current ? canvasRef.current.width / GRID_SIZE : 40;
      const hX = nextHead.x * cellWidth + cellWidth / 2;
      const hY = nextHead.y * cellWidth + cellWidth / 2;

      // Glow swoosh ring animation
      eatAnimationsRef.current.push({
        id: Math.random(),
        x: hX,
        y: hY,
        radius: 4,
        maxRadius: cellWidth * 2.2,
        color: currentFood.color,
        alpha: 1,
      });

      createExplosion(currentFood.position.x, currentFood.position.y, currentFood.color, 15);
      
      let floatMsg = `+${earnedPoints}`;
      if (currentMultiplier > 1) {
        floatMsg += ` (x${currentMultiplier})`;
      }
      addFloatingText(floatMsg, currentFood.position.x, currentFood.position.y, currentFood.color);

      // Trigger screen shake for stars or big meals
      if (currentFood.type === 'BOOSTER') {
        setActiveEffects(prev => ({ ...prev, booster: 10000 })); // 10 seconds of magical speed boost!
        setBoosterEatenCount(prev => prev + 1); // Increment booster count!
        unlockAchievement('blue_magic');
        addFloatingText('BLUE MAGIC POTION! 🧪✨', currentFood.position.x, currentFood.position.y - 0.5, '#2563EB');
        setScreenShake(8);
      } else if (currentFood.type === 'GOLDEN_STAR') {
        setScreenShake(12);
        unlockAchievement('star_power');
        addFloatingText('Star Blast! ✨', currentFood.position.x, currentFood.position.y - 0.5, '#FACC15');
      } else if (currentFood.type === 'CHILI') {
        setActiveEffects(prev => ({ ...prev, chili: 8000, chiliCrying: 10000 })); // 8 seconds of speed + 10 seconds tears!
        unlockAchievement('spicy_run');
        unlockAchievement('chili_crying');
        addFloatingText('SPICY FIRE BOOST! 🔥😭', currentFood.position.x, currentFood.position.y - 0.5, '#F97316');
      } else if (currentFood.type === 'GRAPE') {
        setActiveEffects(prev => ({ ...prev, grape: 6000 })); // 6 seconds of purple chill mode
        addFloatingText('CHILL MODE... 🍇', currentFood.position.x, currentFood.position.y - 0.5, '#8B5CF6');
      } else if (currentFood.type === 'CAKE') {
        // Growing big: grow 2 extra segments
        newSnake.push({ ...newSnake[newSnake.length - 1] });
        newSnake.push({ ...newSnake[newSnake.length - 1] });
        addFloatingText('FEAST TIME! 🍰', currentFood.position.x, currentFood.position.y - 0.5, '#FF007F');
      } else if (currentFood.type === 'WATERMELON') {
        setScreenShake(14);
        createExplosion(currentFood.position.x, currentFood.position.y, '#22C55E', 25);
        createExplosion(currentFood.position.x, currentFood.position.y, '#EF4444', 15); // red juice!
        addFloatingText('GIANT WATERMELON SPLASH! 🍉💥', currentFood.position.x, currentFood.position.y - 0.5, '#22C55E');
      } else if (currentFood.type === 'DRAGON_FRUIT') {
        setScreenShake(12);
        createExplosion(currentFood.position.x, currentFood.position.y, '#EC4899', 20);
        createExplosion(currentFood.position.x, currentFood.position.y, '#A855F7', 15); // mystical purple sparkles
        addFloatingText('MYSTICAL DRAGON BURST! 🐉✨', currentFood.position.x, currentFood.position.y - 0.5, '#EC4899');
      } else if (currentFood.type === 'COCONUT') {
        setScreenShake(5);
        createExplosion(currentFood.position.x, currentFood.position.y, '#854D0E', 12); // brown wood splinters
        createExplosion(currentFood.position.x, currentFood.position.y, '#FFFFFF', 8); // white meat splinters
        addFloatingText('HARD NUT CRUNCH! 🥥🔨', currentFood.position.x, currentFood.position.y - 0.5, '#854D0E');
      } else if (currentFood.type === 'BANANA') {
        createExplosion(currentFood.position.x, currentFood.position.y, '#FBBF24', 12);
        addFloatingText('SLIPPERY BANANA! 🍌💨', currentFood.position.x, currentFood.position.y - 0.5, '#FBBF24');
      } else if (currentFood.type === 'PINEAPPLE') {
        createExplosion(currentFood.position.x, currentFood.position.y, '#EAB308', 15);
        addFloatingText('TROPICAL SPLASH! 🍍🌴', currentFood.position.x, currentFood.position.y - 0.5, '#EAB308');
      } else if (currentFood.type === 'POWER_SPEED') {
        setActiveEffects(prev => ({ ...prev, chili: 8000 })); // 8 seconds hyper speed!
        unlockAchievement('perfect_reflexes');
        addFloatingText('HYPER SPEED BOOSTER! ⚡💨', currentFood.position.x, currentFood.position.y - 0.5, '#38BDF8');
      } else if (currentFood.type === 'POWER_IMMORTAL') {
        setActiveEffects(prev => ({ ...prev, immortal: 10000 })); // 10 seconds immortal ghost!
        unlockAchievement('immortal_ghost');
        addFloatingText('GHOST IMMORTALITY! 👻🛡️', currentFood.position.x, currentFood.position.y - 0.5, '#A78BFA');
      } else if (currentFood.type === 'POWER_DOUBLE') {
        setActiveEffects(prev => ({ ...prev, doublePoints: 15000 })); // 15 seconds 2x points!
        unlockAchievement('double_deal');
        addFloatingText('2X POINTS ACTIVE! 💎✨', currentFood.position.x, currentFood.position.y - 0.5, '#F472B6');
      } else if (currentFood.type === 'POWER_MAGNET') {
        setActiveEffects(prev => ({ ...prev, magnet: 12000 })); // 12 seconds magnet!
        unlockAchievement('magnet_pull');
        addFloatingText('MAGNETIC FORCE! 🧲🧲', currentFood.position.x, currentFood.position.y - 0.5, '#F87171');
      } else if (currentFood.type === 'POWER_SHRINK') {
        const originalLength = newSnake.length;
        const targetLength = Math.max(3, Math.round(originalLength * 0.65));
        newSnake.splice(targetLength); // Instantly cut length by 35%
        unlockAchievement('shrink_master');
        addFloatingText('SHRINK SHROOM! 🍄🤏', currentFood.position.x, currentFood.position.y - 0.5, '#34D399');
      }

      // Synchronously update combo count
      const nextCombo = currentCombo + 1;
      comboCountRef.current = nextCombo;
      setComboCount(nextCombo);
      setComboTimer(100); // 100 frames to keep combo alive

      unlockAchievement('first_bite');
      
      if (nextScore >= 50) unlockAchievement('half_century');
      if (nextScore >= 100) unlockAchievement('century');
      if (nextScore >= 300) unlockAchievement('snake_master');
      if (nextScore >= 500) unlockAchievement('score_500');
      if (nextScore >= 1000) unlockAchievement('score_1000');

      if (nextEaten >= 30) {
        unlockAchievement('hungry_slitherer');
      }

      if (nextCombo >= 8) {
        unlockAchievement('combo_king');
      }

      if (isDoublePointsActive) {
        unlockAchievement('double_deal');
      }

      // Check level-up
      if (activeMode === 'LEVELS' && nextScore >= levelConfigRef.current.targetScore) {
        playLevelUpSound();
        createExplosion(10, 10, '#A855F7', 40);
        onLevelUp();
        unlockAchievement('level_clear');
      }

      // Determine if next item should be a magical booster (every 10 food items eaten)
      const shouldBeBooster = (nextEaten > 0 && nextEaten % 10 === 0);
      const spawned = spawnFood(newSnake, gameModeRef.current === 'CLASSIC' ? [] : levelConfigRef.current.obstacles, shouldBeBooster);
      foodRef.current = spawned;
      setFood(spawned);
    } else {
      // Did not eat food, pop the tail
      newSnake.pop();
    }

    // IMMEDIATELY sync the snakeRef current position to prevent lag/stutter between tick and React render cycle!
    prevSnakeRef.current = [...snakeRef.current];
    snakeRef.current = newSnake;
    setSnake(newSnake);
  };

  // Timer loop for powerup decays, combo timers, and screen shake decay
  useEffect(() => {
    let timerId: any;
    const isGameFrozen = isPaused || isLizardPaused || countdown !== null || isLizardDelay;
    if (isPlaying && !isGameFrozen) {
      timerId = setInterval(() => {
        // Decay active power-up timers
        setActiveEffects(prev => {
          const nextChili = Math.max(0, prev.chili - 100);
          const nextGrape = Math.max(0, prev.grape - 100);
          const nextBooster = Math.max(0, prev.booster - 100);
          const nextImmortal = Math.max(0, prev.immortal - 100);
          const nextDoublePoints = Math.max(0, prev.doublePoints - 100);
          const nextMagnet = Math.max(0, prev.magnet - 100);
          const nextChiliCrying = Math.max(0, (prev.chiliCrying || 0) - 100);
          return {
            chili: nextChili,
            grape: nextGrape,
            booster: nextBooster,
            immortal: nextImmortal,
            doublePoints: nextDoublePoints,
            magnet: nextMagnet,
            chiliCrying: nextChiliCrying
          };
        });

        // Check food expiration: exactly 10s for ALL foods!
        const currentFood = foodRef.current;
        if (currentFood && currentFood.spawnTime) {
          const expirationTime = 10000; // exactly 10 seconds for all foods
          if (Date.now() - currentFood.spawnTime >= expirationTime) {
            // Trigger a beautiful puff particle explosion at food location before disappearing
            createExplosion(currentFood.position.x, currentFood.position.y, '#94A3B8', 12); // Gray smoke puff!
            addFloatingText('Poof! 💨', currentFood.position.x, currentFood.position.y - 0.5, '#94A3B8');
            
            // Food expired! Spawn a new random item
            const spawned = spawnFood(snakeRef.current, gameModeRef.current === 'CLASSIC' ? [] : levelConfigRef.current.obstacles, false);
            foodRef.current = spawned;
            setFood(spawned);
          }
        }

        // Decay combo timer
        setComboTimer(prev => {
          if (prev <= 1) {
            setComboCount(0); // combo lost
            return 0;
          }
          return prev - 1.5;
        });

        // Decay screen shake smoothly
        setScreenShake(prev => Math.max(0, prev - 2));
      }, 100);
    }
    return () => clearInterval(timerId);
  }, [isPlaying, isPaused, isLizardPaused, countdown, isLizardDelay]);

  // Main Canvas Tick Loop (60 FPS rendering + grid tick timing)
  useEffect(() => {
    let animationId: number;

    const renderTick = (timestamp: number) => {
      const nowReal = Date.now();
      if (!lastRealTimeRef.current) lastRealTimeRef.current = nowReal;
      const dtReal = nowReal - lastRealTimeRef.current;
      lastRealTimeRef.current = nowReal;

      const isGameFrozen = isPausedRef.current || isLizardPausedRef.current || countdownRef.current !== null || isLizardDelayRef.current;
      if (isGameFrozen) {
        // Shift food spawnTime so it stays completely frozen in place!
        if (foodRef.current && foodRef.current.spawnTime) {
          foodRef.current.spawnTime += dtReal;
        }
      } else {
        // Only advance animation timer when game is active!
        animationTimerRef.current += dtReal;
      }

      if (!lastMoveTimeRef.current) lastMoveTimeRef.current = timestamp;

      // Decay head eat mouth animation frames
      if (headEatAnimRef.current > 0) {
        headEatAnimRef.current -= 1;
      }

      // Core Game Speed calculations based on levels, gradual progression, & active effects
      let currentBaseSpeed = gameModeRef.current === 'CLASSIC' ? 220 : levelConfigRef.current.speed;
      
            // GENTLE GRADUAL SPEED INCREMENTS: Slowly reduce tick delay by 3ms for every 5 food items eaten.
      // This is a much gentler, rewarding speedup capped at 30ms to keep game perfectly controllable.
      const speedStep = Math.floor(foodEatenCountRef.current / 5);
      const foodSpeedAdjustment = speedStep * 3;
      const cappedAdjustment = Math.min(foodSpeedAdjustment, 30);
      currentBaseSpeed = Math.max(160, currentBaseSpeed - cappedAdjustment);
      
      const currentActiveEffects = activeEffectsRef.current;
      // Active Speed modifiers
      if (currentActiveEffects.chili > 0) {
        currentBaseSpeed = Math.floor(currentBaseSpeed * 0.82); // Chili speedup
      } else if (currentActiveEffects.grape > 0) {
        currentBaseSpeed = Math.floor(currentBaseSpeed * 1.5); // Grape slowdown
      }

      // Blue Magical Booster: Dynamic Speed Boost according to user's specification (50%, then 40%, 30%, 20%, 15% min)
      if (currentActiveEffects.booster > 0) {
        const boosterIndex = boosterEatenCountRef.current; // 1-indexed count of boosters eaten
        let boostPercent = Math.max(0.15, 0.50 - (boosterIndex - 1) * 0.10);
        
        // Balance slightly with snake length to maintain smooth, perfect user control
        const snakeLength = snakeRef.current.length;
        if (snakeLength > 8) {
          boostPercent = Math.max(0.15, boostPercent - (snakeLength - 8) * 0.01);
        }
        
        currentBaseSpeed = Math.floor(currentBaseSpeed * (1 - boostPercent));
      }

      // Apply the user's custom functional speed multiplier slider setting in real-time
      currentBaseSpeed = Math.floor(currentBaseSpeed / customSpeedMultiplierRef.current);
      // Clamp speed delay to safe but extremely exciting extremes (minimum 25ms up to 1500ms)
      currentBaseSpeed = Math.max(25, Math.min(1500, currentBaseSpeed));

      let elapsed = timestamp - lastMoveTimeRef.current;
      if (elapsed >= currentBaseSpeed) {
        gameStep();
        // Set lastMoveTimeRef exactly to current frame (no cumulative remainder) to completely eliminate glitchy leaps!
        lastMoveTimeRef.current = timestamp;
        elapsed = 0;
      }

      // Calculate move progress from 0.0 to 1.0 for buttery-smooth visual slide interpolation!
      let progress = Math.min(1.0, Math.max(0.0, elapsed / currentBaseSpeed));
      if (!isPlayingRef.current || isPausedRef.current || isLizardPausedRef.current || countdownRef.current !== null || isLizardDelayRef.current) {
        lastMoveTimeRef.current = timestamp;
        progress = 1.0;
      }
      moveProgressRef.current = progress;

      // Draw everything with up-to-date progress
      drawGame();

      // Sparkle trails at head if active effect or custom skins
      const currentSnake = snakeRef.current;
      const currentSelectedSkin = selectedSkinRef.current;
      const isGameFrozenSparkles = isPausedRef.current || isLizardPausedRef.current || countdownRef.current !== null || isLizardDelayRef.current;
      if (isPlayingRef.current && !isGameFrozenSparkles && currentSnake.length > 0) {
        if (currentSelectedSkin.id === 'fire') {
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#F97316'); // fiery orange
          if (Math.random() < 0.5) {
            createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#FACC15'); // hot yellow
          }
          if (Math.random() < 0.35 && currentSnake.length > 1) {
            const randSegIdx = Math.floor(Math.random() * currentSnake.length);
            createTrailSparkle(currentSnake[randSegIdx].x, currentSnake[randSegIdx].y, '#EF4444'); // full body flame
          }
        } else if (currentSelectedSkin.id === 'ice') {
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#BAE6FD'); // ice cyan-white
          if (Math.random() < 0.5) {
            createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#FFFFFF'); // frost snow
          }
          if (Math.random() < 0.35 && currentSnake.length > 1) {
            const randSegIdx = Math.floor(Math.random() * currentSnake.length);
            createTrailSparkle(currentSnake[randSegIdx].x, currentSnake[randSegIdx].y, '#38BDF8'); // ice blue body mist
          }
        } else if (currentActiveEffects.chili > 0) {
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#F97316');
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#EF4444');
        } else if (currentActiveEffects.grape > 0) {
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#A855F7');
        } else if (currentActiveEffects.booster > 0) {
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#2563EB');
          createTrailSparkle(currentSnake[0].x, currentSnake[0].y, '#60A5FA');
        }
      }

      animationId = requestAnimationFrame(renderTick);
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(renderTick);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  // Canvas Drawing Function
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellWidth = canvas.width / GRID_SIZE;
    const currentScreenShake = screenShakeRef.current;
    const currentGameMode = gameModeRef.current;
    const currentLevelConfig = levelConfigRef.current;
    const currentFood = foodRef.current;
    const currentSnake = snakeRef.current;
    const currentActiveEffects = activeEffectsRef.current;
    const currentSelectedSkin = selectedSkinRef.current;

    // Apply Screen Shake
    ctx.save();
    if (currentScreenShake > 0) {
      const dx = (Math.random() - 0.5) * currentScreenShake;
      const dy = (Math.random() - 0.5) * currentScreenShake;
      ctx.translate(dx, dy);
    }

    // 1. Clear background with custom theme color combos (falls back to level config if not overridden)
    let bgCol1 = '#C2F5D3';
    let bgCol2 = '#E6FCEE';

    if (currentGameMode === 'LEVELS') {
      // Levels Mode always locks to the beautiful level-specific custom gaming backgrounds
      if (currentLevelConfig.theme.bgCol1 && currentLevelConfig.theme.bgCol2) {
        bgCol1 = currentLevelConfig.theme.bgCol1;
        bgCol2 = currentLevelConfig.theme.bgCol2;
      } else {
        // Fallback old levels background colors
        switch (currentLevelConfig.level) {
          case 1:
            bgCol1 = '#C2F5D3';
            bgCol2 = '#E6FCEE';
            break;
          case 2:
            bgCol1 = '#FED7AA';
            bgCol2 = '#FFF7ED';
            break;
          case 3:
            bgCol1 = '#E9D5FF';
            bgCol2 = '#FAF5FF';
            break;
          case 4:
            bgCol1 = '#FECDD3';
            bgCol2 = '#FFF1F2';
            break;
          case 5:
            bgCol1 = '#1E1B4B';
            bgCol2 = '#0B0A21';
            break;
          case 6:
            bgCol1 = '#FEF08A';
            bgCol2 = '#FEF9C3';
            break;
          case 7:
            bgCol1 = '#93C5FD';
            bgCol2 = '#DBEAFE';
            break;
          case 8:
            bgCol1 = '#86EFAC';
            bgCol2 = '#DCFCE7';
            break;
          case 9:
            bgCol1 = '#CBD5E1';
            bgCol2 = '#F1F5F9';
            break;
          case 10:
            bgCol1 = '#4C1D95';
            bgCol2 = '#1E1B4B';
            break;
          default:
            bgCol1 = '#C2F5D3';
            bgCol2 = '#E6FCEE';
        }
      }
    } else {
      // Classic Mode: Use the custom selected board theme from settings
      const activeBoardTheme = BOARD_THEMES.find(t => t.id === boardThemeRef.current);
      if (activeBoardTheme) {
        bgCol1 = activeBoardTheme.color1;
        bgCol2 = activeBoardTheme.color2;
      } else {
        bgCol1 = '#C2F5D3'; // Vibrant soft mint
        bgCol2 = '#E6FCEE'; // Very light mint-white
      }
    }

    // Draw the gorgeous custom-styled colorful grid
    ctx.fillStyle = bgCol2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = bgCol1;
          ctx.fillRect(c * cellWidth, r * cellWidth, cellWidth, cellWidth);
        }
      }
    }

    const isDarkTheme = currentGameMode === 'LEVELS' && (currentLevelConfig.theme.bg.includes('slate') || currentLevelConfig.theme.bg.includes('indigo-950') || currentLevelConfig.theme.bg.includes('violet-900'));

    // 2. Draw Obstacles (Bushes, Blocks, Clouds etc. in levels)
    const activeObstacles = currentGameMode === 'LEVELS' ? currentLevelConfig.obstacles : [];
    activeObstacles.forEach((obs) => {
      ctx.save();
      // Draw colorful cartoon obstacle candy block
      ctx.fillStyle = isDarkTheme ? '#EC4899' : '#DC2626'; // Hot Pink / Red
      ctx.strokeStyle = isDarkTheme ? '#F472B6' : '#991B1B';
      ctx.lineWidth = 3;

      const px = obs.x * cellWidth;
      const py = obs.y * cellWidth;
      const r = 8; // roundedness

      // Rounded rect obstacle
      ctx.beginPath();
      ctx.moveTo(px + r, py);
      ctx.lineTo(px + cellWidth - r, py);
      ctx.quadraticCurveTo(px + cellWidth, py, px + cellWidth, py + r);
      ctx.lineTo(px + cellWidth, py + cellWidth - r);
      ctx.quadraticCurveTo(px + cellWidth, py + cellWidth, px + cellWidth - r, py + cellWidth);
      ctx.lineTo(px + r, py + cellWidth);
      ctx.quadraticCurveTo(px, py + cellWidth, px, py + cellWidth - r);
      ctx.lineTo(px, py + r);
      ctx.quadraticCurveTo(px, py, px + r, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inside bubble details for a glassy cartoon look
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(px + 6, py + 6, 3, 2, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Drawn emoji on obstacle
      ctx.font = `${cellWidth * 0.55}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚧', px + cellWidth / 2, py + cellWidth / 2);

      ctx.restore();
    });

    // 3. Draw Food item
    if (currentFood) {
      ctx.save();
      const fx = currentFood.position.x * cellWidth + cellWidth / 2;
      const fy = currentFood.position.y * cellWidth + cellWidth / 2;

      // Circular Ticking Timer Dial showing 10 seconds countdown
      if (currentFood.spawnTime) {
        const elapsed = Date.now() - currentFood.spawnTime;
        const timeLeft = Math.max(0, 10000 - elapsed);
        const ratio = timeLeft / 10000;

        // Draw background tracks for countdown dial
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fx, fy, cellWidth * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // Draw remaining countdown arc (green turning to red)
        const dialColor = ratio > 0.4 ? '#10B981' : ratio > 0.2 ? '#F59E0B' : '#EF4444';
        ctx.strokeStyle = dialColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        // Draw clockwise arc from top (-Math.PI/2)
        ctx.arc(fx, fy, cellWidth * 0.62, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * ratio));
        ctx.stroke();

        // Fast blink when food is about to expire (less than 3 seconds remaining)
        if (timeLeft < 3000) {
          const blink = Math.floor(Date.now() / 150) % 2 === 0;
          if (blink) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.beginPath();
            ctx.arc(fx, fy, cellWidth * 0.72, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Soft cute neon circular glow behind food
      const glowGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, cellWidth * (currentFood.type === 'BOOSTER' ? 1.4 : 0.8));
      glowGrad.addColorStop(0, currentFood.color + (currentFood.type === 'BOOSTER' ? '99' : '66'));
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, cellWidth * (currentFood.type === 'BOOSTER' ? 1.4 : 0.8), 0, Math.PI * 2);
      ctx.fill();

      // If it is a magical blue booster, draw an outer spinning glowing magical circle
      if (currentFood.type === 'BOOSTER') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#60A5FA';
        ctx.shadowBlur = 10;
        
        // Dynamic angle for spinning ring
        const angle = (Date.now() * 0.003) % (Math.PI * 2);
        
        ctx.beginPath();
        ctx.arc(fx, fy, cellWidth * 0.85, angle, angle + Math.PI * 1.5);
        ctx.stroke();
        
        // Draw decorative magic dots on the circle
        ctx.fillStyle = '#60A5FA';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        const dotX = fx + Math.cos(angle) * cellWidth * 0.85;
        const dotY = fy + Math.sin(angle) * cellWidth * 0.85;
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw opposite spinning thin halo
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fx, fy, cellWidth * 0.65, -angle, -angle + Math.PI * 1.5);
        ctx.stroke();
      }

      // Pulse scaling
      const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.12;

      ctx.translate(fx, fy);
      ctx.scale(pulse, pulse);

      // Render custom booster flask or standard fruit emoji
      if (currentFood.type === 'BOOSTER') {
        const w = cellWidth * 0.74; // Bottle total width
        const h = cellWidth * 0.82; // Bottle total height
        
        const topY = -h / 2;
        const bottomY = h / 2 - 1.5;
        const neckWidth = w * 0.28;
        const bottomWidth = w * 0.88;
        const neckHeight = h * 0.30;
        const neckBottomY = topY + neckHeight;
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // 1. Draw glowing liquid inside first (so the glass outline sits on top)
        ctx.fillStyle = '#2563EB'; // Royal Blue liquid
        ctx.beginPath();
        // The liquid fills the bottom portion (e.g. from y = neckBottomY + 4 to bottomY - 2.5)
        const liquidTopY = neckBottomY + 4;
        const t = (liquidTopY - neckBottomY) / (bottomY - neckBottomY);
        const liquidTopWidth = neckWidth + (bottomWidth - neckWidth) * t;
        
        ctx.moveTo(-liquidTopWidth / 2, liquidTopY);
        ctx.lineTo(liquidTopWidth / 2, liquidTopY);
        ctx.lineTo(bottomWidth / 2 - 3, bottomY - 3);
        ctx.lineTo(-bottomWidth / 2 + 3, bottomY - 3);
        ctx.closePath();
        
        // Create a nice gradient for the magical blue liquid
        const liquidGrad = ctx.createLinearGradient(0, liquidTopY, 0, bottomY);
        liquidGrad.addColorStop(0, '#60A5FA'); // Light blue at top surface
        liquidGrad.addColorStop(0.3, '#3B82F6'); // Classic blue in middle
        liquidGrad.addColorStop(1, '#1D4ED8'); // Deep blue at bottom
        ctx.fillStyle = liquidGrad;
        ctx.fill();

        // 1b. Add cute bubbles inside the blue liquid
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        const bubbleTime = Date.now() * 0.005;
        // Bubble 1
        const b1X = Math.sin(bubbleTime) * (bottomWidth * 0.22);
        const b1Y = bottomY - 8 - ((bubbleTime * 12) % (bottomY - liquidTopY - 6));
        if (b1Y > liquidTopY) {
          ctx.beginPath();
          ctx.arc(b1X, b1Y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Bubble 2
        const b2X = Math.cos(bubbleTime * 1.5) * (bottomWidth * 0.25);
        const b2Y = bottomY - 5 - (((bubbleTime + 2.5) * 10) % (bottomY - liquidTopY - 6));
        if (b2Y > liquidTopY) {
          ctx.beginPath();
          ctx.arc(b2X, b2Y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Draw Glass Outline of Erlenmeyer Flask
        ctx.strokeStyle = '#FFFFFF'; // Bright white glass
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        
        // Start at top-left rim
        ctx.moveTo(-neckWidth / 2 - 2, topY);
        // Draw top rim lip
        ctx.lineTo(neckWidth / 2 + 2, topY);
        // Go down to start of neck
        ctx.moveTo(-neckWidth / 2, topY);
        ctx.lineTo(-neckWidth / 2, neckBottomY);
        // Slanted side to bottom-left corner
        ctx.lineTo(-bottomWidth / 2, bottomY);
        // Bottom flat edge
        ctx.lineTo(bottomWidth / 2, bottomY);
        // Slanted side back to neck-right
        ctx.lineTo(neckWidth / 2, neckBottomY);
        // Up neck-right to top
        ctx.lineTo(neckWidth / 2, topY);
        ctx.stroke();

        // Draw top cork (elegant wooden cap)
        ctx.fillStyle = '#C27803'; // Cork brown
        ctx.beginPath();
        ctx.fillRect(-neckWidth / 2 + 1, topY - 5, neckWidth - 2, 5);

        // 3. Draw a sleek specular highlight on the left glass side for professional 3D feel
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-neckWidth / 2 + 2, topY + 4);
        ctx.lineTo(-neckWidth / 2 + 2, neckBottomY - 2);
        ctx.lineTo(-bottomWidth / 2 + 6, bottomY - 4);
        ctx.stroke();
      } else {
        ctx.font = `${cellWidth * 0.88}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentFood.emoji, 0, 0);
      }

      ctx.restore();
    }

    // 4. Draw Snake
    if (currentSnake.length > 0) {
      currentSnake.forEach((segment, index) => {
        const isHead = index === 0;

        const sx = segment.x * cellWidth;
        const sy = segment.y * cellWidth;
        const radius = cellWidth / 2;

        ctx.save();

        // Base snake colors
        let pColor = currentSelectedSkin.primaryColor;
        let sColor = currentSelectedSkin.secondaryColor;

        if (currentSelectedSkin.id === 'fire') {
          // Dynamic fire color shifting based on position and time
          const firePulse = (Math.sin(animationTimerRef.current * 0.015 + index * 0.4) + 1) / 2;
          pColor = firePulse > 0.65 ? '#F97316' : firePulse > 0.3 ? '#EF4444' : '#FBBF24'; // hot orange to fiery red to yellow
          sColor = '#7F1D1D'; // dark crimson border
        } else if (currentSelectedSkin.id === 'ice') {
          // Dynamic ice blue shifting
          const icePulse = (Math.sin(animationTimerRef.current * 0.01 + index * 0.3) + 1) / 2;
          pColor = icePulse > 0.5 ? '#E0F2FE' : '#38BDF8'; // ice cyan-white to glacier blue
          sColor = '#0284C7'; // deep sea ice border
        }

        // Visual transformations if active power-ups
        if (currentActiveEffects.chili > 0) {
          pColor = '#EF4444'; // Hot fire-red
          sColor = '#F97316'; // Orange spots
        } else if (currentActiveEffects.grape > 0) {
          pColor = '#C084FC'; // Calm purple
          sColor = '#8B5CF6'; // Darker purple
        }

        // Draw body segments as cute circles
        ctx.fillStyle = pColor;
        ctx.strokeStyle = sColor;
        ctx.lineWidth = 2.5;

        // Custom segment sizes for a cartoonish tapered caterpillar look (made 10% larger & plumper!)
        let segSize = radius * 1.08;
        if (!isHead) {
          // Shrink size towards tail
          const shrinkFactor = 1 - (index / currentSnake.length) * 0.35;
          segSize = radius * 0.96 * shrinkFactor;
        }

        // Segment circle
        ctx.beginPath();
        ctx.arc(sx + radius, sy + radius, segSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw stunning flaming Ghostrider flames or Glacier Frost crystals around segment
        if (currentSelectedSkin.id === 'fire') {
          ctx.save();
          const time = animationTimerRef.current * 0.01;
          ctx.globalCompositeOperation = 'screen';
          for (let f = 0; f < 3; f++) {
            const scale = segSize * (0.75 + Math.sin(time + index + f) * 0.2);
            const fxOffset = Math.sin(time * 1.5 + index * 0.8 + f) * 3;
            const fyOffset = -segSize * 0.3 - (f * 3) - Math.abs(Math.cos(time + index) * 4);
            
            const grad = ctx.createRadialGradient(
              sx + radius + fxOffset,
              sy + radius + fyOffset,
              1,
              sx + radius + fxOffset,
              sy + radius + fyOffset,
              scale
            );
            if (f === 0) {
              grad.addColorStop(0, 'rgba(253, 224, 71, 0.95)'); // yellow
              grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.65)'); // orange
              grad.addColorStop(1, 'rgba(239, 68, 68, 0)'); // transparent red
            } else if (f === 1) {
              grad.addColorStop(0, 'rgba(249, 115, 22, 0.95)'); // orange
              grad.addColorStop(0.6, 'rgba(239, 68, 68, 0.55)'); // red
              grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            } else {
              grad.addColorStop(0, 'rgba(239, 68, 68, 0.85)'); // red
              grad.addColorStop(1, 'rgba(127, 29, 29, 0)');
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx + radius + fxOffset, sy + radius + fyOffset, scale, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (currentSelectedSkin.id === 'ice') {
          ctx.save();
          const time = animationTimerRef.current * 0.005;
          ctx.globalCompositeOperation = 'source-over';
          // Draw 2 small diamond crystals drifting around the segment
          for (let c = 0; c < 2; c++) {
            const angle = time + (index * 0.5) + (c * Math.PI);
            const cx = sx + radius + Math.cos(angle) * (segSize * 0.95);
            const cy = sy + radius + Math.sin(angle) * (segSize * 0.95);
            const cSize = segSize * 0.25;
            
            ctx.fillStyle = '#BAE6FD'; // sky-blue ice
            ctx.strokeStyle = '#FFFFFF'; // white crystal edge
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy - cSize);
            ctx.lineTo(cx + cSize * 0.7, cy);
            ctx.lineTo(cx, cy + cSize);
            ctx.lineTo(cx - cSize * 0.7, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          // Add frosty glowing outer aura for segment
          const frostGlow = ctx.createRadialGradient(sx + radius, sy + radius, segSize * 0.5, sx + radius, sy + radius, segSize * 1.3);
          frostGlow.addColorStop(0, 'rgba(186, 230, 253, 0.45)');
          frostGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
          frostGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = frostGlow;
          ctx.beginPath();
          ctx.arc(sx + radius, sy + radius, segSize * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw Skin Patterns (Stripes or Spots)
        if (!isHead) {
          if (currentSelectedSkin.id === 'fire') {
            // Glowing fire core inside body segment
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#F59E0B';
            ctx.fillStyle = '#FACC15'; // yellow core
            ctx.beginPath();
            ctx.arc(sx + radius, sy + radius, segSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw a tiny flame lick shape
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.moveTo(sx + radius - segSize * 0.3, sy + radius);
            ctx.quadraticCurveTo(sx + radius, sy + radius - segSize * 0.7, sx + radius + segSize * 0.3, sy + radius);
            ctx.quadraticCurveTo(sx + radius, sy + radius + segSize * 0.3, sx + radius - segSize * 0.3, sy + radius);
            ctx.fill();
          } else if (currentSelectedSkin.id === 'ice') {
            // Shiny frosted diamond shape
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#60A5FA';
            ctx.fillStyle = '#F0F9FF'; // crystal white shine
            ctx.beginPath();
            ctx.moveTo(sx + radius, sy + radius - segSize * 0.6);
            ctx.lineTo(sx + radius + segSize * 0.6, sy + radius);
            ctx.lineTo(sx + radius, sy + radius + segSize * 0.6);
            ctx.lineTo(sx + radius - segSize * 0.6, sy + radius);
            ctx.closePath();
            ctx.fill();
            
            // Outer white frost border
            ctx.strokeStyle = '#E0F2FE';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (currentSelectedSkin.pattern === 'STRIPES' && index % 2 === 0) {
            ctx.fillStyle = sColor;
            ctx.beginPath();
            ctx.arc(sx + radius, sy + radius, segSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
          } else if (currentSelectedSkin.pattern === 'SPOTS') {
            ctx.fillStyle = sColor;
            ctx.beginPath();
            ctx.arc(sx + radius - segSize * 0.3, sy + radius - segSize * 0.3, segSize * 0.25, 0, Math.PI * 2);
            ctx.arc(sx + radius + segSize * 0.3, sy + radius + segSize * 0.3, segSize * 0.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (currentSelectedSkin.pattern === 'GLOW' || currentSelectedSkin.id === 'cosmic') {
            // Pulse visual glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = pColor;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // DRAW CUTE SNAKE HEAD FEATURES
        if (isHead) {
          const hDir = directionRef.current;
          const headCenterX = sx + radius;
          const headCenterY = sy + radius;

          ctx.save();
          // Translate and rotate so head is drawn pointing UP (the default preview direction)
          ctx.translate(headCenterX, headCenterY);
          let rotationAngle = 0;
          switch (hDir) {
            case 'UP': rotationAngle = 0; break;
            case 'RIGHT': rotationAngle = Math.PI / 2; break;
            case 'DOWN': rotationAngle = Math.PI; break;
            case 'LEFT': rotationAngle = -Math.PI / 2; break;
          }
          ctx.rotate(rotationAngle);

          // Clip path to the head segment circle to prevent pattern leaking out of head boundary!
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, segSize, 0, Math.PI * 2);
          ctx.clip();

          if (currentSelectedSkin.pattern === 'STRIPES') {
            ctx.strokeStyle = sColor;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(-segSize, -segSize * 0.3);
            ctx.lineTo(segSize, -segSize * 0.3);
            ctx.moveTo(-segSize, segSize * 0.3);
            ctx.lineTo(segSize, segSize * 0.3);
            ctx.stroke();
          } else if (currentSelectedSkin.pattern === 'SPOTS') {
            ctx.fillStyle = sColor;
            ctx.beginPath();
            ctx.arc(-segSize * 0.4, -segSize * 0.4, segSize * 0.25, 0, Math.PI * 2);
            ctx.arc(segSize * 0.4, -segSize * 0.4, segSize * 0.25, 0, Math.PI * 2);
            ctx.arc(0, segSize * 0.4, segSize * 0.3, 0, Math.PI * 2);
            ctx.arc(-segSize * 0.5, segSize * 0.1, segSize * 0.2, 0, Math.PI * 2);
            ctx.arc(segSize * 0.5, segSize * 0.1, segSize * 0.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (currentSelectedSkin.id === 'fire') {
            // Draw flickering background flames behind skull
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const time = animationTimerRef.current * 0.025;
            for (let f = 0; f < 4; f++) {
              const flameSize = segSize * (0.9 + Math.sin(time + f) * 0.2);
              const flameX = Math.sin(time * 1.5 + f) * 5;
              const flameY = -segSize * 0.6 - f * 4;
              const grad = ctx.createRadialGradient(flameX, flameY, 2, flameX, flameY, flameSize);
              grad.addColorStop(0, '#FDF08A'); // bright yellow-white
              grad.addColorStop(0.4, '#F97316'); // fiery orange
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(flameX, flameY, flameSize, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();

            // Bone white/cream skull base
            const headGlow = ctx.createRadialGradient(0, -2, 2, 0, 0, segSize);
            headGlow.addColorStop(0, '#FEF08A'); // light yellow
            headGlow.addColorStop(0.7, '#FFFDE6'); // pure bone white
            headGlow.addColorStop(1, '#D97706'); // golden orange rim
            ctx.fillStyle = headGlow;
            ctx.beginPath();
            ctx.arc(0, 0, segSize, 0, Math.PI * 2);
            ctx.fill();
          } else if (currentSelectedSkin.id === 'ice') {
            const headGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, segSize);
            headGlow.addColorStop(0, '#FFFFFF'); // pure snow white core
            headGlow.addColorStop(0.4, '#E0F2FE'); // light ice blue
            headGlow.addColorStop(0.8, '#38BDF8'); // ice blue
            headGlow.addColorStop(1, '#0284C7'); // deep glacier blue border
            ctx.fillStyle = headGlow;
            ctx.beginPath();
            ctx.arc(0, 0, segSize, 0, Math.PI * 2);
            ctx.fill();
          } else if (currentSelectedSkin.pattern === 'GLOW' || currentSelectedSkin.id === 'cosmic') {
            const headGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, segSize);
            headGlow.addColorStop(0, '#FFFFFF');
            headGlow.addColorStop(0.3, pColor);
            headGlow.addColorStop(1, sColor);
            ctx.fillStyle = headGlow;
            ctx.beginPath();
            ctx.arc(0, 0, segSize, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // solid base head
            ctx.fillStyle = pColor;
            ctx.beginPath();
            ctx.arc(0, 0, segSize, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Eye setup (drawn symmetrically relative to (0,0) as head is rotated UP)
          const eyeSpacing = radius * 0.45;
          const eyeSize = radius * 0.38;
          const pupilSize = eyeSize * 0.45;

          const eyeX1 = -eyeSpacing; const eyeY1 = -radius * 0.3;
          const eyeX2 = eyeSpacing; const eyeY2 = -radius * 0.3;
          const pupilOffsetX = 0; const pupilOffsetY = -eyeSize * 0.15;

          if (currentSelectedSkin.id === 'fire') {
            // Red glowing skull sockets
            ctx.fillStyle = '#000000'; // black sockets
            ctx.beginPath();
            ctx.arc(eyeX1, eyeY1, eyeSize * 1.1, 0, Math.PI * 2);
            ctx.arc(eyeX2, eyeY2, eyeSize * 1.1, 0, Math.PI * 2);
            ctx.fill();

            // Blazing yellow-orange pupil center
            ctx.fillStyle = '#FACC15';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#F97316';
            ctx.beginPath();
            ctx.arc(eyeX1, eyeY1, eyeSize * 0.45, 0, Math.PI * 2);
            ctx.arc(eyeX2, eyeY2, eyeSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          } else if (currentSelectedSkin.id === 'ice') {
            // Diamond-cut icy white/sky eyes
            ctx.fillStyle = '#FFFFFF';
            // Diamond eye 1
            ctx.beginPath();
            ctx.moveTo(eyeX1, eyeY1 - eyeSize);
            ctx.lineTo(eyeX1 + eyeSize * 0.8, eyeY1);
            ctx.lineTo(eyeX1, eyeY1 + eyeSize);
            ctx.lineTo(eyeX1 - eyeSize * 0.8, eyeY1);
            ctx.closePath();
            // Diamond eye 2
            ctx.moveTo(eyeX2, eyeY2 - eyeSize);
            ctx.lineTo(eyeX2 + eyeSize * 0.8, eyeY2);
            ctx.lineTo(eyeX2, eyeY2 + eyeSize);
            ctx.lineTo(eyeX2 - eyeSize * 0.8, eyeY2);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#0284C7';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Glowing pupil spark
            ctx.fillStyle = '#0EA5E9';
            ctx.beginPath();
            ctx.arc(eyeX1, eyeY1, eyeSize * 0.35, 0, Math.PI * 2);
            ctx.arc(eyeX2, eyeY2, eyeSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Draw eyes (Big white cartoon circles)
            ctx.fillStyle = currentSelectedSkin.eyeColor;
            ctx.beginPath();
            ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
            ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Draw pupils (glowing look)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(eyeX1 + pupilOffsetX, eyeY1 + pupilOffsetY, pupilSize, 0, Math.PI * 2);
            ctx.arc(eyeX2 + pupilOffsetX, eyeY2 + pupilOffsetY, pupilSize, 0, Math.PI * 2);
            ctx.fill();

            // Draw little cute highlight reflection bubbles
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(eyeX1 + pupilOffsetX - pupilSize * 0.2, eyeY1 + pupilOffsetY - pupilSize * 0.2, pupilSize * 0.4, 0, Math.PI * 2);
            ctx.arc(eyeX2 + pupilOffsetX - pupilSize * 0.2, eyeY2 + pupilOffsetY - pupilSize * 0.2, pupilSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Skull Nose & Jaw features for Ghostrider fire skin
          if (currentSelectedSkin.id === 'fire') {
            // Draw skull nose cavity (upside down heart/triangle)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.lineTo(-2.5, 4.5);
            ctx.lineTo(2.5, 4.5);
            ctx.closePath();
            ctx.fill();

            // Skull teeth/jaw lines
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-5, 9); ctx.lineTo(5, 9);
            ctx.moveTo(-3, 7); ctx.lineTo(-3, 11);
            ctx.moveTo(-1, 7); ctx.lineTo(-1, 11);
            ctx.moveTo(1, 7); ctx.lineTo(1, 11);
            ctx.moveTo(3, 7); ctx.lineTo(3, 11);
            ctx.stroke();
          } else if (currentSelectedSkin.id === 'ice') {
            // Draw beautiful spiky ice cracks on head
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-segSize * 0.5, -segSize * 0.1);
            ctx.lineTo(-segSize * 0.1, 0.1);
            ctx.lineTo(-segSize * 0.4, segSize * 0.3);
            ctx.moveTo(segSize * 0.5, -segSize * 0.1);
            ctx.lineTo(segSize * 0.1, 0.1);
            ctx.lineTo(segSize * 0.4, segSize * 0.3);
            ctx.stroke();
          }

          // Spicy chili funny crying tear drops animation (continuous for 10 seconds)
          if (currentActiveEffects.chiliCrying && currentActiveEffects.chiliCrying > 0 && currentSelectedSkin.id !== 'fire') {
            ctx.save();
            ctx.fillStyle = '#38BDF8'; // beautiful bright blue water color
            ctx.strokeStyle = '#0284C7'; // darker blue outline
            ctx.lineWidth = 1.5;

            const dripCycle = (animationTimerRef.current % 800) / 800; // faster dripping
            const wobbleX1 = Math.sin(animationTimerRef.current * 0.03) * 3;
            const wobbleX2 = Math.cos(animationTimerRef.current * 0.03) * 3;

            // Tear 1 (Eye 1)
            const dripY1 = eyeY1 + eyeSize * 0.5 + dripCycle * 32;
            const tRadius1 = Math.max(1.5, 4.5 * (1 - dripCycle * 0.4));
            ctx.beginPath();
            ctx.arc(eyeX1 + wobbleX1, dripY1, tRadius1, 0, Math.PI);
            ctx.lineTo(eyeX1 + wobbleX1, dripY1 - tRadius1 * 1.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Tear 2 (Eye 2)
            const dripCycle2 = (dripCycle + 0.5) % 1;
            const dripY2 = eyeY2 + eyeSize * 0.5 + dripCycle2 * 32;
            const tRadius2 = Math.max(1.5, 4.5 * (1 - dripCycle2 * 0.4));
            ctx.beginPath();
            ctx.arc(eyeX2 + wobbleX2, dripY2, tRadius2, 0, Math.PI);
            ctx.lineTo(eyeX2 + wobbleX2, dripY2 - tRadius2 * 1.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Occasionally spawn water droplets as particles for even extra funny look!
            if (Math.random() < 0.12) {
              const canvas = canvasRef.current;
              if (canvas) {
                // Adjust coordinates relative to world space since we are inside a rotated translated matrix
                const cosA = Math.cos(rotationAngle);
                const sinA = Math.sin(rotationAngle);
                const rx1 = eyeX1 + wobbleX1;
                const ry1 = dripY1 + tRadius1;
                const worldX = headCenterX + (rx1 * cosA - ry1 * sinA);
                const worldY = headCenterY + (rx1 * sinA + ry1 * cosA);

                particlesRef.current.push({
                  id: Math.random(),
                  x: worldX,
                  y: worldY,
                  vx: (Math.random() - 0.5) * 1.2,
                  vy: 0.8 + Math.random() * 1.2,
                  color: '#38BDF8',
                  size: Math.random() * 2.5 + 1.5,
                  life: 0,
                  maxLife: Math.random() * 12 + 10,
                });
              }
            }
            ctx.restore();
          }

          // Draw cute pink flicking tongue
          if (currentSelectedSkin.id !== 'fire') {
            ctx.save();
            ctx.strokeStyle = '#F43F5E'; // Juicy pink
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            const tongueFlick = Math.sin(animationTimerRef.current * 0.05) > 0;

            if (tongueFlick) {
              ctx.beginPath();
              ctx.moveTo(0, -radius); ctx.lineTo(0, -radius - 10);
              ctx.moveTo(0, -radius - 10); ctx.lineTo(-4, -radius - 14);
              ctx.moveTo(0, -radius - 10); ctx.lineTo(4, -radius - 14);
              ctx.stroke();
            }
            ctx.restore();

            // Draw cute animated mouth (happy and smiling, opens wide when eating)
            ctx.save();
            ctx.fillStyle = '#1E293B'; // dark inner mouth
            ctx.strokeStyle = '#F43F5E'; // pink outline / lips
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            
            const mouthRadius = headEatAnimRef.current > 0 ? radius * 0.48 : radius * 0.22;
            const mouthX = 0;
            const mouthY = -radius * 0.15;
            const startAngle = Math.PI * 1.1; 
            const endAngle = Math.PI * 1.9;

            ctx.arc(mouthX, mouthY, mouthRadius, startAngle, endAngle, false);
            ctx.lineTo(mouthX, mouthY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Draw expanding eating "swoosh" wave ring ripple around the head
          if (headEatAnimRef.current > 0) {
            ctx.save();
            ctx.strokeStyle = currentSelectedSkin.primaryColor;
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 3;
            
            const animPercent = (15 - headEatAnimRef.current) / 15;
            const waveRadius = radius * (1.1 + animPercent * 2.8);
            
            ctx.beginPath();
            ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Draw Accessory (Crown, Sunglasses, Bandana, Mustache)
          const acc = currentSelectedSkin.accessory;
          if (acc === 'CROWN') {
            ctx.save();
            ctx.fillStyle = '#FACC15'; // gold
            ctx.strokeStyle = '#D97706'; // darker border
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, -radius);
            ctx.lineTo(-12, -radius - 12);
            ctx.lineTo(-4, -radius - 6);
            ctx.lineTo(0, -radius - 15);
            ctx.lineTo(4, -radius - 6);
            ctx.lineTo(12, -radius - 12);
            ctx.lineTo(10, -radius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Crown jewels
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(-12, -radius - 12, 2, 0, Math.PI * 2);
            ctx.arc(0, -radius - 15, 2, 0, Math.PI * 2);
            ctx.arc(12, -radius - 12, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (acc === 'SUNGLASSES') {
            ctx.save();
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            // Draw sunglasses exactly matching the eye coordinates!
            ctx.fillRect(-11, -11, 9, 6);
            ctx.fillRect(2, -11, 9, 6);
            ctx.beginPath();
            ctx.moveTo(-2, -8); ctx.lineTo(2, -8);
            ctx.stroke();
            ctx.restore();
          } else if (acc === 'BANDANA') {
            ctx.save();
            ctx.fillStyle = '#EF4444'; // Red bandana
            ctx.strokeStyle = '#991B1B';
            ctx.lineWidth = 1.5;
            // Bandana wrapping head top
            ctx.fillRect(-13, -13, 26, 4);
            // Tied ribbon knots on the left side
            ctx.beginPath();
            ctx.moveTo(-13, -11);
            ctx.lineTo(-19, -17);
            ctx.lineTo(-17, -7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else if (acc === 'MUSTACHE') {
            ctx.save();
            ctx.fillStyle = '#78350F'; // Brown mustache
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 1);
            ctx.bezierCurveTo(-5, -3, -12, 3, -10, 6);
            ctx.bezierCurveTo(-11, 2, -4, 1, 0, 1);
            ctx.bezierCurveTo(4, 1, 11, 2, 10, 6);
            ctx.bezierCurveTo(12, 3, 5, -3, 0, 1);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.restore();
        }

        ctx.restore();
      });
    }

    // 5. Update and Draw Particles
    const particles = particlesRef.current;
    const isGameDrawingFrozen = isPausedRef.current || isLizardPausedRef.current || countdownRef.current !== null || isLizardDelayRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!isGameDrawingFrozen) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
      }

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;

      ctx.beginPath();
      // Stars or circles
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5.5 Update and Draw Eat Swoosh Ring Animations
    const eatAnims = eatAnimationsRef.current;
    for (let i = eatAnims.length - 1; i >= 0; i--) {
      const anim = eatAnims[i];
      if (!isGameDrawingFrozen) {
        anim.radius += (anim.maxRadius - anim.radius) * 0.16 + 1.2;
        anim.alpha = 1 - anim.radius / anim.maxRadius;
      }

      if (anim.alpha <= 0 || anim.radius >= anim.maxRadius) {
        eatAnims.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = anim.alpha;
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = anim.color;

      // Primary halo
      ctx.beginPath();
      ctx.arc(anim.x, anim.y, anim.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer halo ring
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(anim.x, anim.y, anim.radius * 1.25, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 6. Update and Draw Floating Texts
    const floaters = floatingTextsRef.current;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      if (!isGameDrawingFrozen) {
        f.y -= 0.8; // move up slowly
        f.life--;
      }

      if (f.life <= 0) {
        floaters.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = f.life / 30;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px Fredoka, "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      
      // Shadow stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      
      ctx.restore();
    }

    // Restore shake translate context
    ctx.restore();
  };

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-stretch w-full max-w-[650px] lg:max-w-[950px] bg-slate-200 dark:bg-slate-800 p-0.5 sm:p-1.5 lg:p-3 rounded-[2rem] lg:rounded-none border-4 border-amber-400 dark:border-amber-500 shadow-[0_24px_50px_rgba(0,0,0,0.35)] gap-2 lg:gap-4 mx-auto relative overflow-hidden">
      
      {/* MID-GAME OPTIONS OVERLAY MENU WHEN PAUSED - Now full translucent floating card styled! */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1.5px] z-30 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto rounded-[2rem] lg:rounded-none animate-fade-in">
          <div className="w-full max-w-sm bg-slate-950/95 border-2 border-amber-400/90 shadow-[0_24px_50px_rgba(0,0,0,0.8)] rounded-3xl p-5 flex flex-col max-h-[92vh] overflow-y-auto select-none">
            <div className="w-full text-center">
              <h3 className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight uppercase">
                ⏸️ GAME PAUSED
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mb-4">
                Change configurations on the fly!
              </p>

              <div className="space-y-3 max-w-sm mx-auto text-left">
                {/* 1. SPEED SLIDER */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] sm:text-xs font-black text-slate-300">⚡ SNAKE SPEED:</span>
                    <span className="text-[10px] sm:text-xs font-mono font-black text-violet-400">
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
                      setCustomSpeedMultiplier(parseFloat(e.target.value));
                    }}
                    className="w-full accent-violet-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* 2. BOARD THEME COMBOS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] sm:text-xs font-black text-slate-300 block mb-1.5">
                    🎨 BOARD BACKGROUND COMBOS:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {BOARD_THEMES.map((theme) => {
                      const isSel = boardTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => {
                            playClickSound();
                            setBoardTheme(theme.id);
                          }}
                          className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 cursor-pointer transition-all ${
                            isSel
                              ? 'bg-violet-950/40 border-violet-500 text-violet-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-[9px] sm:text-[10px] font-bold truncate">{theme.name.split(' ')[0]}</span>
                          <div className="flex -space-x-1 items-center flex-shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: theme.color1 }} />
                            <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: theme.color2 }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SOUND CONTROLS */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-300">🔊 AUDIO:</span>
                    <button
                      onClick={handleToggleSound}
                      className="px-2 py-0.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-[9px] sm:text-[10px] font-black rounded transition-all cursor-pointer"
                    >
                      {soundOn ? 'ON' : 'MUTED'}
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-300">VOL:</span>
                      <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 font-bold">
                        {soundOn ? Math.round(volumeLevel * 100) : 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={soundOn ? volumeLevel : 0}
                      disabled={!soundOn}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* 4. FRUITS CHECKLIST */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] sm:text-xs font-black text-slate-300 block mb-1.5">
                    🍎 ALLOWED FOOD SPAWNS:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {ALL_FOOD_TEMPLATES.map((fruit) => {
                      const isTicked = allowedFruits[fruit.type] === true;
                      return (
                        <button
                          key={fruit.type}
                          onClick={() => {
                            playClickSound();
                            setAllowedFruits(fruit.type);
                          }}
                          className="flex justify-between items-center px-1.5 py-1 hover:bg-slate-800 rounded transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{fruit.emoji}</span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">{fruit.name}</span>
                          </div>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                            isTicked ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-700 bg-slate-950'
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

                {/* 5. SKINS SELECTION */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                  <span className="text-[10px] sm:text-xs font-black text-amber-400 block mb-1.5 uppercase text-center">
                    🎭 Change Skin mid-game:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950 rounded-lg">
                    {SNAKE_SKINS.map((skin) => {
                      const isSel = skin.id === selectedSkin.id;
                      return (
                        <button
                          key={skin.id}
                          onClick={() => { playClickSound(); onSelectSkin(skin); }}
                          className={`p-1.5 rounded border flex items-center gap-2 text-left cursor-pointer transition-all ${
                            isSel
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex-shrink-0 bg-slate-900/40 rounded-full p-0.5 border border-slate-800">
                            <SnakeHeadPreview skin={skin} size={24} />
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black truncate">{skin.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full mt-4 max-w-sm mx-auto">
              <button
                onClick={() => { playClickSound(); handleMenuResume(); }}
                className="w-full py-2 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black rounded-xl border-2 border-emerald-600 shadow-[0_3px_0_#059669] active:translate-y-0.5 transition-all text-xs uppercase cursor-pointer"
              >
                ▶ Resume Game
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setCustomSpeedMultiplier(1.0);
                  setBoardTheme('mint');
                  const slinkySkin = SNAKE_SKINS.find(s => s.id === 'slinky');
                  if (slinkySkin) {
                    onSelectSkin(slinkySkin);
                  }
                }}
                className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl border-2 border-sky-700 shadow-[0_3px_0_#0369A1] active:translate-y-0.5 transition-all text-xs uppercase cursor-pointer"
              >
                ⚙️ Reset To Compatible Defaults
              </button>

              <button
                onClick={() => { playClickSound(); setIsPaused(false); resetGameAndBack(); }}
                className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl border-2 border-red-700 shadow-[0_3px_0_#991B1B] active:translate-y-0.5 transition-all text-xs uppercase cursor-pointer"
              >
                🚪 Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL: Header and Screen Section */}
      <div className="w-full lg:w-[55%] flex flex-col items-center gap-2">

        {/* Sleek Arcade Top Header */}
      <div className="w-full flex justify-between items-center px-1.5 select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]" />
          <span className="text-[10px] sm:text-xs font-black text-slate-700 dark:text-slate-200 tracking-wider">SLINKY ARCADE</span>
        </div>
        
        {/* Unified Bezel HUD Bar (Inside Arcade cabinet header, outside the active canvas to prevent any overlaps!) */}
        <div className="flex items-center gap-4">
          {comboCount > 1 && (
            <span className="text-[10px] font-black text-pink-600 dark:text-pink-400 animate-bounce bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
              COMBO x{comboCount}!
            </span>
          )}
          {isPlaying && (
            <button
              onClick={() => { playClickSound(); setIsPaused(!isPaused); }}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 border border-amber-600 rounded-lg text-[10px] sm:text-xs font-black shadow-[0_1.5px_0_#D97706] text-slate-950 transition-all active:translate-y-0.5 cursor-pointer z-20"
            >
              ⚙️ MENU
            </button>
          )}
        </div>
      </div>

      {/* 1. Screen Section (Unified dark arcade bezel) - Slimmed padding by 75% to maximize the playable screen size */}
      <div className="w-full bg-slate-950 p-0.5 sm:p-1 rounded-2xl border-4 border-slate-900 flex flex-col items-center shadow-inner relative overflow-hidden">
        
        {/* ACTIVE SCREEN EFFECTS INDICATOR */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 pointer-events-none">
          {activeEffects.chili > 0 && (
            <div className="flex items-center gap-1 bg-amber-500/95 text-white text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-amber-300 animate-bounce font-bold">
              🔥 Speed Boost ({(activeEffects.chili / 1000).toFixed(1)}s)
            </div>
          )}
          {activeEffects.grape > 0 && (
            <div className="flex items-center gap-1 bg-purple-500/95 text-white text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-purple-300 animate-pulse font-bold">
              🍇 Chill Mode ({(activeEffects.grape / 1000).toFixed(1)}s)
            </div>
          )}
          {activeEffects.booster > 0 && (
            <div className="flex items-center gap-1 bg-blue-600/95 text-white text-[9px] px-2 py-0.5 rounded-full shadow-lg border border-blue-400 animate-bounce font-bold shadow-blue-500/20">
              ⚡ Magic Booster ({(activeEffects.booster / 1000).toFixed(1)}s)
            </div>
          )}
        </div>

        {/* Grid Canvas with doubled resolution (800x800) for pristine sharp vectors */}
        <div className="w-full aspect-square overflow-hidden rounded-xl border-2 border-slate-900 relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            className="cursor-none shadow-inner w-full h-full aspect-square bg-slate-950"
          />

          {/* LIZARD PAUSE OVERLAY - Transparent, elegant, showing ruka hua game */}
          {isLizardPaused && (
            <div className="absolute inset-0 bg-slate-950/15 flex flex-col items-center justify-center text-center p-4 z-20 select-none animate-fade-in">
              <div className="bg-slate-950/90 border-2 border-amber-400 px-6 py-4 rounded-2xl flex flex-col items-center shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
                <span className="text-3xl mb-1 animate-pulse">⏸️</span>
                <h3 className="text-base font-black text-amber-400 tracking-widest uppercase">
                  GAME PAUSED
                </h3>
                <p className="text-[9px] text-slate-300 font-bold mt-1 max-w-[180px]">
                  Tap center button to resume!
                </p>
              </div>
            </div>
          )}

          {/* COUNTDOWN TIMER OVERLAY - Clear transparent background, showing food/snake perfectly */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-slate-950/10 flex flex-col items-center justify-center text-center z-20 select-none animate-fade-in">
              <div className="bg-slate-950/85 px-8 py-5 rounded-3xl border-2 border-amber-400/30 flex flex-col items-center justify-center shadow-2xl scale-110">
                <span className="text-6xl font-black text-amber-400 animate-ping">
                  {countdown}
                </span>
                <p className="text-[10px] text-slate-300 font-extrabold tracking-widest mt-2 uppercase animate-pulse">
                  GET READY!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Score & High Score status inside dark bezel (LCD HUD style) */}
        <div className="mt-2 flex justify-between w-full px-2 text-slate-300 font-mono text-[11px] select-none relative">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold uppercase tracking-tight">SCORE:</span>
            <span className="font-bold text-violet-400">
              {score} PTS
            </span>
          </div>
          
          <div className="flex items-center gap-1 relative">
            <span className="text-slate-500 font-bold uppercase tracking-tight">HIGHSCORE:</span>
            <span className={`font-bold transition-all duration-300 ${
              blastActive
                ? 'text-amber-400 scale-125 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                : 'text-emerald-400'
            }`}>
              {highScore} PTS
            </span>

            {/* Highscore break blast sparks floating animations */}
            {blastActive && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none z-50">
                {blastSparks.map((spark) => (
                  <span
                    key={spark.id}
                    className="absolute text-sm select-none animate-ping"
                    style={{
                      transform: `translate(${Math.cos(spark.angle) * 45}px, ${Math.sin(spark.angle) * 35}px) scale(1.6)`,
                    }}
                  >
                    {spark.char}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LEFT PANEL END */}
      </div>

      {/* RIGHT PANEL: Dpad & Controller Section */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center pt-1.5 lg:pt-0 border-t-2 lg:border-t-0 lg:border-l-2 border-slate-300 dark:border-slate-700/50 px-2 lg:px-4">
        <Dpad
          currentDirection={direction}
          onChangeDirection={(dir) => {
            initAudio(); // Force audio resume on touch interaction
            setDirection(dir);
          }}
          onPauseToggle={handleLizardToggle}
        />
      </div>

    </div>
  );
}
