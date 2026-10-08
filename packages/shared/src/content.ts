/**
 * The complete vocabulary of the app.
 *
 * Imported by the React buttons AND the API validator, so the two can never
 * drift. Nothing outside these arrays can ever be posted: the database stores
 * an index into them, never user-supplied text.
 */

export const PRESETS = [
  'Hello from the back row',
  'This is actually cool',
  'Scale it up!',
  'It works on my machine',
  'Send coffee',
] as const;

export const EMOJIS = ['🔥', '🚀', '👏', '🤯', '☕'] as const;

/**
 * Display names, assigned by the server — never chosen by the client.
 *
 * A session claims one atomically in the database, so every participant gets
 * a distinct name and all instances agree on who is who. Past 100 concurrent
 * sessions the pool wraps with a numeric suffix ("Mira 2").
 */
export const NAMES = [
  'Nebula',       'Quasar',       'Pulsar',       'Cosmo',        'Rocket',
  'Meteor',       'Orbit',        'Astro',        'Comet',        'Solaris',
  'NinjaYak',     'TurboOtter',   'DiscoLlama',   'JazzFerret',   'FunkyMoose',
  'CyberNewt',    'LaserSloth',   'RoboPanda',    'PixelPuffin',  'MegaWombat',
  'WaffleBot',    'NachoKnight',  'MangoByte',    'PizzaHawk',    'NoodleNinja',
  'BagelBaron',   'TacoTiger',    'DonutDuke',    'SushiSage',    'ChaiChamp',
  'NullPointer',  'SegFault',     'CacheMiss',    'StackPop',     'HeapDump',
  'ByteBandit',   'LoopLord',     'RegexRebel',   'KernelKid',    'PacketPirate',
  'GlitchGoat',   'VoltVulture',  'NeonNarwhal',  'TurboToast',   'PlasmaQuokka',
  'FuzzyLogic',   'BitCrusher',   'SonicShrew',   'PlasmaPigeon', 'RetroRaptor',
  'DiskDruid',    'ThreadThief',  'MutexMonk',    'AsyncAxolotl', 'LambdaLion',
  'VectorViper',  'MatrixMole',   'PixelPirate',  'CodeCoyote',   'DebugDingo',
  'SyntaxSwan',   'BinaryBee',    'HexHeron',     'CloudCougar',  'EdgeEagle',
  'ScaleSquid',   'LoadLemur',    'ProxyPuma',    'RouteRhino',   'SubnetSeal',
  'TokenToad',    'CipherCrow',   'HashHound',    'SaltSparrow',  'KeyKoala',
  'VaultVole',    'ShardShark',   'QueueQuail',   'BufferBison',  'StreamStoat',
  'ChunkChimp',   'FlushFalcon',  'CommitCrab',   'MergeMagpie',  'RebaseRaven',
  'BranchBadger', 'PatchPelican', 'DeployDodo',   'RollbackRat',  'CanaryCat',
  'BlueGreen',    'HotSwap',      'ColdStart',    'WarmPool',     'SpotFox',
  'IdleIbex',     'BurstBat',     'ThrottleTern', 'LatencyLynx',  'UptimeUrchin',
] as const;
