export interface ChannelConfig {
  name: string                // DB name (youtube_channels.name)
  pexelsQueries: string[]     // Cycle through these queries
  durationRange: [number, number]  // [min, max] seconds for source clip trim
  loop: boolean               // LoopForge ping-pong
  targetQueueDepth: number    // Minimum queued videos to maintain
  batchSize: number           // Videos to generate per worker run (if below target)
  category_id: string         // YouTube category
  titleTemplates: string[]
  description: string
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
    category_id: '22',
    titleTemplates: [
      "You can't watch this just once 🔪 #shorts",
      "The most satisfying cut today 🔪 #shorts",
      "ASMR precision slice 😌 #shorts",
      "This is oddly satisfying 🔪 #shorts",
      "Watch this 3× in a row 🔪 #shorts",
      "Pure precision. No words needed 🔪 #shorts",
      "Satisfying knife skills 🔪 #asmr #shorts",
      "This cut is *chef's kiss* 🔪 #shorts",
      "Why is this so satisfying 😮 #shorts",
      "Oddly satisfying precision cut 🔪 #shorts",
      "One clean slice ✂️ #asmr #shorts",
      "Mesmerizing precision 🔪 #shorts",
    ],
    description: "Oddly satisfying precision cutting 🔪\n\n#satisfying #asmr #cutting #knife #slicing #shorts #oddlysatisfying #precisioncut #asmrsounds #macrovideo",
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
    category_id: '28',  // Science & Technology
    titleTemplates: [
      "LEGO factory that never stops 🏭 #shorts",
      "Miniature assembly line hits different 🧱 #shorts",
      "This LEGO machine is hypnotic 🧱 #shorts",
      "Factory mode: ON 🏭 #shorts",
      "Satisfying LEGO automation 🏭 #shorts",
      "Industrial LEGO runs 24/7 🏭 #shorts",
      "The most satisfying build loop 🧱 #shorts",
      "LEGO but make it cinematic 🏭 #shorts",
      "No intro needed. Just watch 🧱 #shorts",
      "Engineering in miniature 🏭 #shorts",
    ],
    description: "Cinematic LEGO factory systems and miniature machines 🏭\n\n#lego #legofactory #satisfying #assemblyline #miniature #engineering #shorts #brickpulse #industrial #cinematic",
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
    category_id: '28',
    titleTemplates: [
      "This loop is impossible 🔄 #shorts",
      "You'll watch this forever 🔄 #shorts",
      "AI made this impossible machine 🤖 #shorts",
      "This can't stop. Neither can you 🔄 #shorts",
      "Infinite machine unlocked 🔄 #shorts",
      "The loop that never ends 🔄 #shorts",
      "Watch it loop again and again 🤖 #shorts",
      "Your brain can't look away 🔄 #shorts",
      "Impossible physics, satisfying loop 🔄 #shorts",
      "This machine runs forever 🤖 #shorts",
      "AI-generated infinite motion 🔄 #shorts",
      "Loop machine activated 🔄 #shorts",
    ],
    description: "AI-generated infinite loops and impossible machines 🔄\n\n#ailoop #infiniteloop #impossiblemachine #marblesimulation #loopforgeai #satisfying #generativeai #marblerun #shorts #aianimation",
    tags: ['ailoop', 'infiniteloop', 'aianimation', 'impossiblemachine', 'marblesimulation', 'loopforgeai', 'satisfying', 'generativeai', 'marblerun', 'shorts', 'aishorts', 'endlessmachine'],
  },
]
