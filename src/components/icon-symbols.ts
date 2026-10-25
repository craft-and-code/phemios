import ArrowDownAZ from "lucide-solid/icons/arrow-down-a-z";
import ArrowDownUp from "lucide-solid/icons/arrow-down-up";
import ArrowDownWideNarrow from "lucide-solid/icons/arrow-down-wide-narrow";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import ArrowRight from "lucide-solid/icons/arrow-right";
import ArrowUp from "lucide-solid/icons/arrow-up";
import AudioWaveform from "lucide-solid/icons/audio-waveform";
import Bold from "lucide-solid/icons/bold";
import BookOpen from "lucide-solid/icons/book-open";
import Bookmark from "lucide-solid/icons/bookmark";
import Calendar from "lucide-solid/icons/calendar";
import ChartNoAxesColumn from "lucide-solid/icons/chart-no-axes-column";
import ChartNoAxesColumnIncreasing from "lucide-solid/icons/chart-no-axes-column-increasing";
import Check from "lucide-solid/icons/check";
import ChevronDown from "lucide-solid/icons/chevron-down";
import ChevronRight from "lucide-solid/icons/chevron-right";
import ChevronUp from "lucide-solid/icons/chevron-up";
import CircleHelp from "lucide-solid/icons/circle-question-mark";
import Combine from "lucide-solid/icons/combine";
import Disc3 from "lucide-solid/icons/disc-3";
import DiscAlbum from "lucide-solid/icons/disc-album";
import Download from "lucide-solid/icons/download";
import Eject from "lucide-solid/icons/eject";
import ExternalLink from "lucide-solid/icons/external-link";
import Eye from "lucide-solid/icons/eye";
import EyeOff from "lucide-solid/icons/eye-off";
import FileClock from "lucide-solid/icons/file-clock";
import FileDown from "lucide-solid/icons/file-down";
import FileMusic from "lucide-solid/icons/file-music";
import FileText from "lucide-solid/icons/file-text";
import FolderOpen from "lucide-solid/icons/folder-open";
import GalleryHorizontalEnd from "lucide-solid/icons/gallery-horizontal-end";
import Globe from "lucide-solid/icons/globe";
import GripVertical from "lucide-solid/icons/grip-vertical";
import HardDrive from "lucide-solid/icons/hard-drive";
import Heading2 from "lucide-solid/icons/heading-2";
import Heart from "lucide-solid/icons/heart";
import History from "lucide-solid/icons/rotate-ccw-clock";
import Italic from "lucide-solid/icons/italic";
import Keyboard from "lucide-solid/icons/keyboard";
import Layers from "lucide-solid/icons/layers";
import LayoutGrid from "lucide-solid/icons/layout-grid";
import Library from "lucide-solid/icons/library";
import List from "lucide-solid/icons/list";
import ListOrdered from "lucide-solid/icons/list-ordered";
import LockKeyhole from "lucide-solid/icons/lock-keyhole";
import Menu from "lucide-solid/icons/menu";
import MicVocal from "lucide-solid/icons/mic-vocal";
import Minus from "lucide-solid/icons/minus";
import MonitorOff from "lucide-solid/icons/monitor-off";
import MonitorPlay from "lucide-solid/icons/monitor-play";
import Mountain from "lucide-solid/icons/mountain";
import Music2 from "lucide-solid/icons/eighth-note";
import Network from "lucide-solid/icons/network";
import Palette from "lucide-solid/icons/palette";
import PanelLeft from "lucide-solid/icons/panel-left";
import Pause from "lucide-solid/icons/pause";
import Pencil from "lucide-solid/icons/pencil";
import Piano from "lucide-solid/icons/piano";
import Pilcrow from "lucide-solid/icons/pilcrow";
import Play from "lucide-solid/icons/play";
import Plus from "lucide-solid/icons/plus";
import Podcast from "lucide-solid/icons/mic-signal";
import Quote from "lucide-solid/icons/quote";
import Radio from "lucide-solid/icons/radio";
import RectangleVertical from "lucide-solid/icons/rectangle-vertical";
import Redo2 from "lucide-solid/icons/redo-2";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import Repeat from "lucide-solid/icons/repeat";
import Repeat1 from "lucide-solid/icons/repeat-1";
import Scan from "lucide-solid/icons/scan";
import Search from "lucide-solid/icons/search";
import Settings from "lucide-solid/icons/settings";
import ShieldCheck from "lucide-solid/icons/shield-check";
import Shuffle from "lucide-solid/icons/shuffle";
import SkipBack from "lucide-solid/icons/skip-back";
import SkipForward from "lucide-solid/icons/skip-forward";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import Smartphone from "lucide-solid/icons/smartphone";
import Sparkles from "lucide-solid/icons/sparkles";
import Square from "lucide-solid/icons/square";
import SquarePlay from "lucide-solid/icons/square-play";
import SquareTerminal from "lucide-solid/icons/square-terminal";
import Star from "lucide-solid/icons/star";
import Stethoscope from "lucide-solid/icons/stethoscope";
import Tags from "lucide-solid/icons/tags";
import Trash2 from "lucide-solid/icons/trash";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import Trophy from "lucide-solid/icons/trophy";
import Undo2 from "lucide-solid/icons/undo-2";
import Unplug from "lucide-solid/icons/unplug";
import Upload from "lucide-solid/icons/upload";
import Users from "lucide-solid/icons/users";
import Volume2 from "lucide-solid/icons/volume-2";
import VolumeX from "lucide-solid/icons/volume-x";
import Waves from "lucide-solid/icons/waves-horizontal";
import X from "lucide-solid/icons/x";
import type { LucideIcon } from "lucide-solid";

// Preserve semantic names used by navigation, saved menus and device descriptions.
const symbols = new Map<string, LucideIcon>(
  Object.entries({
    ipod: Smartphone,
    "ipod-nano": RectangleVertical,
    "ipod-touch": Smartphone,
    "ipod-square": SquarePlay,
    "ipod-shuffle": Shuffle,
    folder: FolderOpen,
    integrity: ShieldCheck,
    "cover-size": Scan,
    external: ExternalLink,
    concerts: MicVocal,
    "visualizer-off": MonitorOff,
    terminal: SquareTerminal,
    crossfade: Combine,
    "chevron-right": ChevronRight,
    book: BookOpen,
    trophy: Trophy,
    lock: LockKeyhole,
    "cover-flow": GalleryHorizontalEnd,
    keyboard: Keyboard,
    grip: GripVertical,
    reverse: ArrowDownUp,
    playlist: FileMusic,
    help: CircleHelp,
    moods: Waves,
    visualizer: MonitorPlay,
    "lyrics-download": FileDown,
    disconnect: Unplug,
    landscape: Mountain,
    "lyrics-timed": FileClock,
    lyrics: FileText,
    plus: Plus,
    minus: Minus,
    "chevron-up": ChevronUp,
    "chevron-down": ChevronDown,
    check: Check,
    podcast: Podcast,
    gear: Settings,
    sparkles: Sparkles,
    palette: Palette,
    trash: Trash2,
    edit: Pencil,
    doctor: Stethoscope,
    radio: Radio,
    muted: VolumeX,
    refresh: RefreshCw,
    settings: SlidersHorizontal,
    stop: Square,
    close: X,
    upload: Upload,
    download: Download,
    spectrum: ChartNoAxesColumn,
    star: Star,
    bold: Bold,
    italic: Italic,
    heading: Heading2,
    paragraph: Pilcrow,
    ordered: ListOrdered,
    quote: Quote,
    undo: Undo2,
    redo: Redo2,
    stats: ChartNoAxesColumnIncreasing,
    calendar: Calendar,
    alphabet: ArrowDownAZ,
    previous: SkipBack,
    next: SkipForward,
    pause: Pause,
    repeat: Repeat,
    "repeat-one": Repeat1,
    shuffle: Shuffle,
    volume: Volume2,
    menu: Menu,
    sort: ArrowDownWideNarrow,
    users: Users,
    cd: DiscAlbum,
    eject: Eject,
    disc: Disc3,
    layers: Layers,
    grid: LayoutGrid,
    globe: Globe,
    missing: TriangleAlert,
    eye: Eye,
    "eye-off": EyeOff,
    label: Bookmark,
    note: Music2,
    genres: Piano,
    tags: Tags,
    heart: Heart,
    library: Library,
    history: History,
    list: List,
    wave: AudioWaveform,
    graph: Network,
    drive: HardDrive,
    search: Search,
    sidebar: PanelLeft,
    play: Play,
    up: ArrowUp,
    forward: ArrowRight,
    back: ArrowLeft,
  }),
);

/** Shared local vocabulary backed exclusively by statically imported Lucide components. */
export const iconNames: readonly string[] = Object.freeze([...symbols.keys()]);

/** External or older menu values retain the existing neutral list fallback. */
export function resolveIcon(name: string): LucideIcon {
  return symbols.get(name) ?? List;
}
