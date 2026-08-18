import type { CSSProperties, ReactNode } from "react";
import {
  Apple, AtSign, Award, BadgeCheck, Ban, BellRing, BookOpen, Calendar,
  CalendarCheck, CalendarCog, CalendarDays, Camera, Captions, ChartLine, Check,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CirclePlay,
  CirclePlus, CircleQuestionMark, Clock, CloudCheck, CloudUpload, Copy, CreditCard,
  Croissant, Download, Dumbbell, ExternalLink, Eye, FilePen, FileText, FlaskConical,
  FolderX, FunnelX, GanttChart, Globe, Heading, House, IdCard, Image, Images, Info,
  LockKeyhole, Lock, LogIn, LogOut, Mail, Medal, MessageCircle, Moon, NotebookPen,
  Package, Pencil, Phone, Pill, PersonStanding, Plus, Quote, ReceiptText, Sandwich,
  Save, Search, SearchX, ShieldCheck, SquareMousePointer, StickyNote, Sun, Tag,
  CircleMinus,
  Trash, Trash2, TriangleAlert, Trophy, Upload, User, UserPlus, UserSearch, UserX,
  Users, Utensils, UtensilsCrossed, Wrench, X, Zap, ZoomIn,
  BriefcaseMedical, Activity, Gauge, Ruler, Hourglass, Timer,
  History, KeyRound, Power, RefreshCw, RotateCcw, Layers, Repeat,
  Drumstick, Wheat, Nut, Salad, GripVertical, Sheet, TrendingUp, TrendingDown, Settings,
  BicepsFlexed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The project's icon set.
 *
 * Backed by lucide-react (ISC licence): one dependency, one licence, and Next's
 * package-import optimisation keeps the bundle to only the icons named below.
 *
 * Replaces the Material Symbols webfont. That font addressed icons as ligature
 * text — <span class="material-symbols-outlined">delete</span> — which meant
 * every icon in the app was the literal English word until 357 KB finished
 * downloading, and stayed that word forever if the request failed. Inline SVG
 * has no such failure mode.
 *
 * Sized in `em`, not pixels, on purpose: the stylesheets that positioned these
 * icons did it with `font-size`, and dozens of call sites still pass
 * `style={{ fontSize: 20 }}`. Inheriting the font size keeps every one of those
 * rules working untouched. `stroke="currentColor"` does the same for colour.
 *
 * Names are kept identical to the Material Symbols ones they replace so the
 * migration is a mechanical swap and call sites stay greppable against the
 * original design.
 */

export type IconName =
  | "alternate_email" | "badge" | "description" | "done" | "format_quote"
  | "label" | "mail" | "medication" | "payments" | "phone" | "receipt_long"
  | "science" | "smart_button" | "subtitles" | "title" | "workspace_premium"
  | "add" | "add_circle" | "add_circle_outline" | "remove_circle_outline"
  | "bakery_dining" | "bedtime" | "block" | "build"
  | "calendar_month" | "calendar_today" | "card_membership" | "chat" | "check"
  | "check_circle" | "chevron_left" | "chevron_right" | "close" | "cloud_done" | "cloud_upload"
  | "contact_support" | "content_copy" | "dark_mode" | "delete" | "delete_forever"
  | "dinner_dining" | "edit" | "edit_calendar" | "edit_document" | "edit_note"
  | "error" | "event_available" | "exercise" | "expand_more" | "expand_less" | "filter_alt_off"
  | "fitness_center" | "group" | "home" | "image" | "info" | "inventory_2"
  | "library_books" | "light_mode" | "lock" | "lock_reset" | "login" | "logout"
  | "looks_one" | "looks_two" | "looks_3" | "lunch_dining" | "medical_services"
  | "military_tech" | "monitor_weight" | "monitoring" | "notifications_active"
  | "nutrition" | "open_in_new" | "person" | "person_add" | "person_off"
  | "person_search" | "photo_library" | "play_circle" | "restaurant"
  | "restaurant_menu" | "save" | "search" | "search_off" | "self_improvement"
  | "sticky_note_2" | "upload" | "user_male" | "verified_user" | "view_timeline"
  | "visibility" | "warning" | "web" | "schedule" | "verified" | "folder_off" | "zoom_in" | "photo_camera"
  | "emoji_events" | "bolt" | "error_outline" | "report_problem" | "file_download"
  | "activity" | "gauge" | "ruler" | "hourglass" | "timer"
  | "history" | "key" | "account_box" | "power_settings_new" | "event_note" | "update" | "restore" | "layers" | "repeat"
  | "food_protein" | "food_carbs" | "food_fats" | "food_veggies" | "food_fruit" | "drag_indicator" | "excel"
  | "trending_up" | "trending_down" | "settings" | "biceps_flexed";

const LUCIDE: Partial<Record<IconName, LucideIcon>> = {
  alternate_email: AtSign,
  badge: IdCard,
  description: FileText,
  done: Check,
  format_quote: Quote,
  label: Tag,
  mail: Mail,
  medication: Pill,
  payments: CreditCard,
  phone: Phone,
  receipt_long: ReceiptText,
  science: FlaskConical,
  smart_button: SquareMousePointer,
  subtitles: Captions,
  title: Heading,
  workspace_premium: Award,
  add: Plus,
  add_circle: CirclePlus,
  add_circle_outline: CirclePlus,
  remove_circle_outline: CircleMinus,
  bakery_dining: Croissant,
  bedtime: Moon,
  block: Ban,
  build: Wrench,
  calendar_month: CalendarDays,
  calendar_today: Calendar,
  card_membership: CreditCard,
  chat: MessageCircle,
  check: Check,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  cloud_done: CloudCheck,
  cloud_upload: CloudUpload,
  contact_support: CircleQuestionMark,
  content_copy: Copy,
  dark_mode: Moon,
  delete: Trash2,
  delete_forever: Trash,
  dinner_dining: UtensilsCrossed,
  edit: Pencil,
  edit_calendar: CalendarCog,
  edit_document: FilePen,
  edit_note: NotebookPen,
  error: CircleAlert,
  event_available: CalendarCheck,
  exercise: Dumbbell,
  expand_more: ChevronDown,
  expand_less: ChevronUp,
  filter_alt_off: FunnelX,
  fitness_center: Dumbbell,
  group: Users,
  home: House,
  image: Image,
  info: Info,
  inventory_2: Package,
  library_books: BookOpen,
  light_mode: Sun,
  lock: Lock,
  lock_reset: LockKeyhole,
  login: LogIn,
  logout: LogOut,
  lunch_dining: Sandwich,
  medical_services: BriefcaseMedical,
  military_tech: Medal,
  monitor_weight: Gauge,
  monitoring: ChartLine,
  notifications_active: BellRing,
  nutrition: Apple,
  open_in_new: ExternalLink,
  person: User,
  person_add: UserPlus,
  person_off: UserX,
  person_search: UserSearch,
  photo_library: Images,
  play_circle: CirclePlay,
  restaurant: Utensils,
  restaurant_menu: UtensilsCrossed,
  save: Save,
  search: Search,
  search_off: SearchX,
  self_improvement: PersonStanding,
  sticky_note_2: StickyNote,
  upload: Upload,
  user_male: User,
  verified_user: ShieldCheck,
  view_timeline: GanttChart,
  visibility: Eye,
  warning: TriangleAlert,
  web: Globe,
  schedule: Clock,
  verified: BadgeCheck,
  folder_off: FolderX,
  zoom_in: ZoomIn,
  photo_camera: Camera,
  emoji_events: Trophy,
  bolt: Zap,
  error_outline: CircleAlert,
  report_problem: TriangleAlert,
  file_download: Download,
  activity: Activity,
  gauge: Gauge,
  ruler: Ruler,
  hourglass: Hourglass,
  timer: Timer,
  history: History,
  key: KeyRound,
  account_box: IdCard,
  power_settings_new: Power,
  event_note: CalendarDays,
  update: RefreshCw,
  restore: RotateCcw,
  layers: Layers,
  repeat: Repeat,
  food_protein: Drumstick,
  food_carbs: Wheat,
  food_fats: Nut,
  food_veggies: Salad,
  food_fruit: Apple,
  drag_indicator: GripVertical,
  excel: Sheet,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  settings: Settings,
  biceps_flexed: BicepsFlexed,
};

/**
 * Icons lucide has no equivalent for, kept as the hand-drawn originals. Same
 * geometry contract as lucide: 24-unit box, 2-unit round stroke, no fill.
 */
const LOCAL: Partial<Record<IconName, ReactNode>> = {
  looks_one: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M11 9l2-1v8" /></>,
  looks_two: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M10 9.5a2 2 0 1 1 3.6 1.2L10 16h4" /></>,
  looks_3: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M10 8.5h4l-2.3 3.2H14a2.2 2.2 0 1 1-2.2 2.8" /></>,
};

export function Icon({
  name,
  className = "",
  style,
  title,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
  /* Supply only when the icon carries meaning no neighbouring text already
     gives. Without it the icon is hidden from screen readers, which is right
     for the decorative majority. */
  title?: string;
}) {
  const shared = {
    className: `app-icon ${className}`.trim(),
    style,
    role: title ? ("img" as const) : undefined,
    "aria-hidden": title ? undefined : true,
  };

  const Glyph = LUCIDE[name];
  if (Glyph) {
    return (
      <Glyph size="1em" {...shared}>
        {title && <title>{title}</title>}
      </Glyph>
    );
  }

  return (
    <svg
      {...shared}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title && <title>{title}</title>}
      {LOCAL[name]}
    </svg>
  );
}
