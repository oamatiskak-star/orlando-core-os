export interface ChannelConfig {
  name: string                // DB name (youtube_channels.name)
  pexelsQueries: string[]     // Cycle through these queries
  durationRange: [number, number]  // [min, max] seconds for source clip trim
  loop: boolean               // LoopForge ping-pong
  targetQueueDepth: number    // Minimum queued videos to maintain
  batchSize: number           // Videos to generate per worker run (if below target)
  maxScheduledBacklog: number // Stop generating als deze backlog (scheduled+queued) overschreden is
  category_id: string         // YouTube category
  // Combinatorische titel-opbouw (vervangt de oude vaste titleTemplates) →
  // title = hook + emoji + hashtagSet. hooks×emojis×hashtagSets = honderden unieke combo's.
  titleHooks: string[]
  titleEmojis: string[]
  hashtagSets: string[]
  descriptionVariants: string[]
  tags: string[]
}

export const CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    name: 'SliceTheory',
    pexelsQueries: [
      'knife cutting food',
      'slicing vegetables asmr',
      'hydraulic press crushing',
      'kinetic sand cutting',
      'precision knife slice',
      'satisfying cut food',
      'soap cutting',
    ],
    durationRange: [7, 12],
    loop: false,
    targetQueueDepth: 30,
    batchSize: 5,
    maxScheduledBacklog: 60,
    category_id: '22',
    titleHooks: [
      "You can't watch this just once",
      "The most satisfying cut today",
      "ASMR precision slice",
      "This is oddly satisfying",
      "Watch this 3× in a row",
      "Pure precision, no words needed",
      "Satisfying knife skills",
      "This cut is *chef's kiss*",
      "Why is this so satisfying",
      "Oddly satisfying precision cut",
      "One clean slice",
      "Mesmerizing precision",
      "The cleanest cut you'll see today",
      "Your ears will thank you",
      "Slice, repeat, relax",
      "Too smooth to be real",
    ],
    titleEmojis: ['🔪', '✂️', '😌', '😮', '🤤'],
    hashtagSets: [
      '#shorts',
      '#shorts #asmr',
      '#shorts #satisfying',
      '#shorts #oddlysatisfying',
      '#asmr #shorts',
      '#shorts #relaxing',
      '#shorts #satisfyingvideo',
      '#shorts #fyp',
    ],
    descriptionVariants: [
      'Oddly satisfying precision cutting 🔪',
      'Turn the sound on for the full ASMR effect 😌',
      'The most relaxing 10 seconds of your day 🔪',
      'Precision cuts that hit different ✂️',
      'Watch, relax, repeat 🤤',
    ],
    tags: ['satisfying', 'asmr', 'cutting', 'knife', 'slicing', 'shorts', 'oddlysatisfying', 'precisioncut', 'kineticsand', 'hydraulicpress', 'macrovideo', 'relaxing'],
  },
  {
    name: 'BrickPulse Lab',
    pexelsQueries: [
      'lego construction building',
      'assembly line factory',
      'mechanical assembly process',
      'gear mechanism close up',
      'conveyor belt production',
      'miniature machine working',
      'building blocks assembly',
    ],
    durationRange: [10, 18],
    loop: false,
    targetQueueDepth: 25,
    batchSize: 4,
    maxScheduledBacklog: 50,
    category_id: '28',  // Science & Technology
    titleHooks: [
      "LEGO factory that never stops",
      "Miniature assembly line hits different",
      "This LEGO machine is hypnotic",
      "Factory mode: ON",
      "Satisfying LEGO automation",
      "Industrial LEGO runs 24/7",
      "The most satisfying build loop",
      "LEGO but make it cinematic",
      "No intro needed, just watch",
      "Engineering in miniature",
      "Tiny machine, massive satisfaction",
      "This belongs in a museum",
      "Precision in every brick",
      "The assembly line never sleeps",
    ],
    titleEmojis: ['🏭', '🧱', '⚙️', '🔧', '📦'],
    hashtagSets: [
      '#shorts',
      '#shorts #lego',
      '#shorts #satisfying',
      '#shorts #legofactory',
      '#shorts #oddlysatisfying',
      '#shorts #asmr',
      '#shorts #engineering',
      '#shorts #fyp',
    ],
    descriptionVariants: [
      'Cinematic LEGO factory systems and miniature machines 🏭',
      'Industrial automation, brick by brick 🧱',
      'The most satisfying miniature assembly line ⚙️',
      'Engineering in miniature — turn the sound on 🔧',
      'Factory mode never stops 🏭',
    ],
    tags: ['lego', 'legofactory', 'satisfying', 'assemblyline', 'miniature', 'engineering', 'shorts', 'industrial', 'cinematic', 'macrolego', 'brickpulse', 'legoshorts'],
  },
  {
    name: 'LoopForge AI',
    pexelsQueries: [
      'marble run marble machine',
      'domino chain reaction',
      'kinetic sculpture machine',
      'ball mechanism loop',
      'rube goldberg machine',
      'perpetual motion machine',
      'roller coaster marble',
    ],
    durationRange: [8, 13],
    loop: true,   // ping-pong = seamless infinite loop visual
    targetQueueDepth: 30,
    batchSize: 5,
    maxScheduledBacklog: 60,
    category_id: '28',
    titleHooks: [
      "This loop is impossible",
      "You'll watch this forever",
      "AI made this impossible machine",
      "This can't stop, neither can you",
      "Infinite machine unlocked",
      "The loop that never ends",
      "Watch it loop again and again",
      "Your brain can't look away",
      "Impossible physics, satisfying loop",
      "This machine runs forever",
      "AI-generated infinite motion",
      "Loop machine activated",
      "The machine that defies physics",
      "Zero gravity, infinite motion",
      "Mesmerizing and unstoppable",
      "Built by AI, looped forever",
    ],
    titleEmojis: ['🔄', '🤖', '♾️', '🌀', '⚙️'],
    hashtagSets: [
      '#shorts',
      '#shorts #satisfying',
      '#shorts #ai #satisfying',
      '#shorts #oddlysatisfying',
      '#shorts #aiart',
      '#shorts #loop',
      '#shorts #fyp',
      '#shorts #satisfyingvideo',
    ],
    descriptionVariants: [
      'AI-generated infinite loops and impossible machines 🔄',
      'Physics-defying motion, generated by AI 🤖',
      'The loop your brain won\'t let you skip ♾️',
      'Endless satisfying motion 🌀',
      'Impossible machines, infinite loops ⚙️',
    ],
    tags: ['ailoop', 'infiniteloop', 'aianimation', 'impossiblemachine', 'marblesimulation', 'loopforgeai', 'satisfying', 'generativeai', 'marblerun', 'shorts', 'aishorts', 'endlessmachine'],
  },
]
