import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  limit,
  getDocFromServer,
  where,
  getDocs,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  MessageCircle, 
  Camera, 
  LayoutDashboard, 
  User as UserIcon, 
  LogOut, 
  Send, 
  Plus, 
  TrendingDown, 
  Utensils, 
  Droplets, 
  Zap,
  ChevronRight,
  Loader2,
  X,
  Check,
  AlertCircle,
  Dumbbell,
  Clock,
  Activity,
  Bell,
  BellOff,
  Download,
  FileText,
  Volume2,
  ChefHat,
  Star,
  RefreshCw,
  TrendingUp,
  BookOpen,
  History,
  Target,
  ArrowRight,
  ChevronLeft,
  Coffee,
  Pizza,
  Apple,
  Beef,
  Bike,
  Footprints,
  Heart,
  Flame,
  Moon,
  Sun,
  Timer,
  Settings,
  Share2,
  Play,
  Pause,
  Square,
  PieChart as PieChartIcon,
  Search,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { requestNotificationPermission, showNotification, checkGoalsAndNotify } from './lib/notifications';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  auth, 
  db, 
  signInWithGoogle, 
  logout,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from './lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { cn } from './lib/utils';
import { getAICoachResponse, analyzeMealImage, speakText, getRecipeSuggestions } from './services/gemini';

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role?: string;
  isPremium?: boolean;
  age?: number;
  weight?: number;
  height?: number;
  goal?: string;
  activityLevel?: string;
  preferences?: string;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  weeklyWorkoutGoal?: number;
  weeklyCaloriesGoal?: number;
  onboardingComplete?: boolean;
  trialUntil?: string;
  premiumUntil?: string;
  notificationSettings?: {
    enabled: boolean;
    waterReminders: boolean;
    goalReminders: boolean;
    guideReminders: boolean;
  };
  iconMappings?: Record<string, string>;
  photoURL?: string;
  createdAt?: string;
}

interface Recipe {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  steps: string[];
  description: string;
}

interface MealLog {
  id: string;
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthRating?: 'saudável' | 'moderada' | 'não recomendada';
  analysis: string;
  timestamp: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
}

interface WeightProgress {
  id: string;
  weight: number;
  timestamp: any;
}

interface WorkoutLog {
  id: string;
  exerciseType: string;
  duration: number;
  intensity: 'baixa' | 'moderada' | 'alta';
  caloriesBurned?: number;
  timestamp: any;
}

interface MealTemplate {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: any;
}

const CHECKOUT_URL = "https://pay.kambafy.com/checkout/734e8099-7ef1-4b5c-911c-829d74298537";
const GUIDE_URL = "https://pay.kambafy.com/checkout/e523d14f-94bb-41a3-a2cf-b57dd43934d2";

const hasActiveAccess = (p: UserProfile | null) => {
  if (!p) return false;
  if (p.role === 'admin') return true;
  
  const now = new Date();
  const trialDate = p.trialUntil ? new Date(p.trialUntil) : null;
  const premiumDate = p.premiumUntil ? new Date(p.premiumUntil) : null;
  
  return (trialDate && trialDate > now) || (premiumDate && premiumDate > now);
};

const TrialExpired = ({ profile }: { profile: UserProfile }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handlePaymentRequest = async () => {
    setIsRequesting(true);
    try {
      await addDoc(collection(db, 'payment_requests'), {
        userId: profile.uid,
        email: profile.email,
        userName: profile.name,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setRequestSent(true);
      alert("Solicitação enviada! O administrador irá validar seu pagamento em breve.");
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      alert("Erro ao enviar solicitação. Tente novamente ou contate o suporte.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-premium border border-slate-50 max-w-md w-full text-center space-y-8">
        <div className="w-20 h-20 bg-brand-50 rounded-[32px] flex items-center justify-center mx-auto">
          <Timer className="w-10 h-10 text-brand-600" />
        </div>
        
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Teste Grátis Encerrado</h2>
          <p className="text-slate-500 leading-relaxed">
            Seu período de teste de 3 dias chegou ao fim. Para continuar transformando sua saúde com o Coach IA, ative seu acesso premium.
          </p>
        </div>

        <div className="bg-brand-900 p-6 rounded-[32px] text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-800/50 rounded-full -mr-12 -mt-12 blur-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-brand-400 fill-brand-400" />
              <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Benefícios Premium</span>
            </div>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-white font-medium">
                <div className="w-1 h-1 bg-brand-400 rounded-full" />
                Coach IA Ilimitado 24/7
              </li>
              <li className="flex items-center gap-2 text-xs text-white font-medium">
                <div className="w-1 h-1 bg-brand-400 rounded-full" />
                Análise Nutricional Avançada
              </li>
              <li className="flex items-center gap-2 text-xs text-white font-medium">
                <div className="w-1 h-1 bg-brand-400 rounded-full" />
                Planos de Treino Personalizados
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => window.open(CHECKOUT_URL, '_blank')}
            className="w-full bg-brand-600 text-white py-5 rounded-[24px] font-black shadow-lg shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            Ativar Acesso Premium
          </button>

          <button 
            onClick={handlePaymentRequest}
            disabled={isRequesting || requestSent}
            className="w-full bg-slate-50 text-slate-600 py-4 rounded-[24px] font-bold border border-slate-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {requestSent ? "Solicitação Enviada" : "Já paguei? Validar Acesso"}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-50 flex flex-col gap-4">
          <button 
            onClick={() => window.open('https://wa.me/244923000000', '_blank')}
            className="text-xs font-black text-brand-600 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Suporte via WhatsApp
          </button>
          
          <button 
            onClick={() => auth.signOut()}
            className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Você não tem permissão para realizar esta ação.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-red-50 text-center">
          <X className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Ops! Algo deu errado.</h2>
          <p className="text-red-700 mb-6">{errorMessage}</p>
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold"
            >
              Recarregar
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-white border border-red-200 text-red-600 px-6 py-3 rounded-2xl font-bold"
            >
              Limpar Cache
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const getIconByName = (name: string, className?: string) => {
  const icons: Record<string, any> = {
    'Utensils': Utensils,
    'Dumbbell': Dumbbell,
    'Zap': Zap,
    'Activity': Activity,
    'ChefHat': ChefHat,
    'Coffee': Coffee,
    'Pizza': Pizza,
    'Apple': Apple,
    'Beef': Beef,
    'Bike': Bike,
    'Footprints': Footprints,
    'Heart': Heart,
    'Flame': Flame,
    'Moon': Moon,
    'Sun': Sun,
    'Timer': Timer,
    'Target': Target,
    'Star': Star,
    'Droplets': Droplets,
    'TrendingDown': TrendingDown,
    'TrendingUp': TrendingUp,
    'History': History,
    'Bell': Bell,
    'Camera': Camera,
    'LayoutDashboard': LayoutDashboard,
    'User': UserIcon,
    'LogOut': LogOut,
    'Send': Send,
    'Plus': Plus,
    'X': X,
    'Check': Check,
    'AlertCircle': AlertCircle,
    'Clock': Clock,
    'Volume2': Volume2,
    'ArrowRight': ArrowRight,
    'ChevronRight': ChevronRight,
    'ChevronLeft': ChevronLeft,
  };
  const Icon = icons[name] || icons['Activity'];
  return <Icon className={className} />;
};

const getIconForCategory = (category: string, mappings: Record<string, string> | undefined, defaultIcon: string) => {
  if (!mappings) return getIconByName(defaultIcon);
  
  // Try exact match
  if (mappings[category]) return getIconByName(mappings[category]);
  
  // Try keyword match
  const lowerCategory = category.toLowerCase();
  for (const [keyword, iconName] of Object.entries(mappings)) {
    if (lowerCategory.includes(keyword.toLowerCase())) {
      return getIconByName(iconName);
    }
  }
  
  return getIconByName(defaultIcon);
};

const TypingIndicator = () => (
  <div className="flex gap-1.5 px-1 py-1">
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      className="w-1.5 h-1.5 bg-brand-400 rounded-full"
    />
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
      className="w-1.5 h-1.5 bg-brand-400 rounded-full"
    />
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      className="w-1.5 h-1.5 bg-brand-400 rounded-full"
    />
  </div>
);

// --- Admin Panel ---
const AdminPanel = ({ profile }: { profile: UserProfile }) => {
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [allUsersCount, setAllUsersCount] = useState(0);
  const [premiumUsersCount, setPremiumUsersCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'payment_requests'), where('status', '==', 'pending'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPaymentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Stats
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsersCount(snap.size);
      setPremiumUsersCount(snap.docs.filter(d => d.data().isPremium).length);
    });

    return () => {
      unsub();
      usersUnsub();
    };
  }, []);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setIsSearching(true);
    setMessage(null);
    setFoundUser(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setMessage({ text: 'Usuário não encontrado.', type: 'error' });
      } else {
        const userData = querySnapshot.docs[0].data() as UserProfile;
        setFoundUser(userData);
      }
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      setMessage({ text: 'Erro ao buscar usuário.', type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  const togglePremium = async (userToUpdate?: UserProfile) => {
    const target = userToUpdate || foundUser;
    if (!target) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', target.uid);
      const now = new Date();
      const isCurrentlyActive = hasActiveAccess(target);
      
      let updateData: any = {};
      
      if (isCurrentlyActive) {
        // Deactivate
        updateData = { 
          isPremium: false,
          premiumUntil: null 
        };
      } else {
        // Activate for 1 month
        const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        updateData = { 
          isPremium: true,
          premiumUntil: oneMonthFromNow.toISOString()
        };
      }

      await updateDoc(userRef, updateData);
      
      if (userToUpdate) {
        const requests = paymentRequests.filter(r => r.userId === target.uid);
        for (const req of requests) {
          await updateDoc(doc(db, 'payment_requests', req.id), { status: 'approved' });
        }
      }

      if (foundUser && foundUser.uid === target.uid) {
        setFoundUser({ ...foundUser, ...updateData });
      }
      setMessage({ 
        text: `Status Premium atualizado para ${!isCurrentlyActive ? 'ATIVO (1 mês)' : 'INATIVO'}.`, 
        type: 'success' 
      });
    } catch (error) {
      console.error("Erro ao atualizar premium:", error);
      setMessage({ text: 'Erro ao atualizar status premium.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteUser = async () => {
    if (!foundUser) return;
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o usuário ${foundUser.name}? Esta ação não pode ser desfeita.`)) return;
    
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, 'users', foundUser.uid));
      setFoundUser(null);
      setMessage({ text: 'Usuário excluído com sucesso.', type: 'success' });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      setMessage({ text: 'Erro ao excluir usuário.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Painel Administrativo</h2>
        <p className="text-slate-500 text-sm">Gerencie o acesso dos usuários e visualize estatísticas detalhadas.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[32px] shadow-premium border border-slate-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Usuários</p>
          <p className="text-3xl font-black text-slate-900">{allUsersCount}</p>
        </div>
        <div className="bg-brand-600 p-6 rounded-[32px] shadow-xl shadow-brand-100">
          <p className="text-[10px] font-black text-brand-200 uppercase tracking-widest mb-1">Premium Ativos</p>
          <p className="text-3xl font-black text-white">{premiumUsersCount}</p>
        </div>
      </div>

      {paymentRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
            <AlertCircle className="w-3 h-3" /> Solicitações Pendentes
          </h3>
          <div className="space-y-3">
            {paymentRequests.map((req) => (
              <div key={req.id} className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">{req.userName}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{req.email}</p>
                </div>
                <button 
                  onClick={() => togglePremium({ uid: req.userId, email: req.email, name: req.userName, isPremium: false } as any)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100"
                >
                  Ativar (1 Mês)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Buscar Usuário</label>
          <div className="flex gap-3">
            <input 
              type="email" 
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
            <button 
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-brand-600 text-white px-6 rounded-2xl font-black shadow-lg shadow-brand-100 disabled:opacity-50 active:scale-95 transition-all"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {message && (
          <div className={cn(
            "p-4 rounded-2xl text-xs font-bold text-center",
            message.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          )}>
            {message.text}
          </div>
        )}

        {foundUser && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                {foundUser.photoURL ? (
                  <img src={foundUser.photoURL} alt={foundUser.name} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <UserIcon className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-lg tracking-tight">{foundUser.name}</h4>
                <p className="text-xs text-slate-400 font-medium">{foundUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Idade</p>
                <p className="text-sm font-bold text-slate-700">{foundUser.age || 'N/A'} anos</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Peso / Altura</p>
                <p className="text-sm font-bold text-slate-700">{foundUser.weight || 'N/A'}kg / {foundUser.height || 'N/A'}cm</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Objetivo</p>
                <p className="text-sm font-bold text-slate-700 capitalize">{foundUser.goal || 'N/A'}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atividade</p>
                <p className="text-sm font-bold text-slate-700 capitalize">{foundUser.activityLevel || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className={cn("w-5 h-5", hasActiveAccess(foundUser) ? "text-amber-500 fill-amber-500" : "text-slate-300")} />
                  <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Acesso Premium</span>
                </div>
                <button 
                  onClick={() => togglePremium()}
                  disabled={isUpdating}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                    hasActiveAccess(foundUser) ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  )}
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : (hasActiveAccess(foundUser) ? 'Desativar' : 'Ativar (1 Mês)')}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teste Grátis Até</p>
                  <p className="text-[10px] font-bold text-slate-600">
                    {foundUser.trialUntil ? format(new Date(foundUser.trialUntil), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Premium Expira Em</p>
                  <p className="text-[10px] font-bold text-brand-600">
                    {foundUser.premiumUntil ? format(new Date(foundUser.premiumUntil), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl text-center shadow-sm flex items-center justify-between gap-4">
              <div className="flex-1 text-left">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">ID do Usuário</p>
                <p className="text-[10px] font-mono text-slate-600 truncate">{foundUser.uid}</p>
              </div>
              <button 
                onClick={deleteUser}
                disabled={isUpdating}
                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                title="Excluir Usuário"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="bg-brand-900 p-8 rounded-[40px] text-white space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-800 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
        <div className="relative z-10">
          <h3 className="text-xl font-black tracking-tight mb-2">Dica de Admin</h3>
          <p className="text-brand-200 text-xs leading-relaxed">
            Sempre verifique o comprovante de pagamento antes de ativar o acesso premium manualmente. 
            Usuários ativados por aqui terão acesso total a todas as funcionalidades da IA.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Components ---

const PaywallBanner = ({ profile, title, description }: { profile: UserProfile, title: string, description: string }) => {
  const now = new Date();
  const trialDate = profile.trialUntil ? new Date(profile.trialUntil) : null;
  const isTrial = trialDate && trialDate > now;
  
  return (
    <div className="bg-brand-900 p-8 rounded-[40px] text-white space-y-4 relative overflow-hidden shadow-2xl shadow-brand-100">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-800 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-brand-700 p-1.5 rounded-lg">
            <Zap className="w-4 h-4 text-brand-300 fill-brand-300" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-300">
            {isTrial ? 'Período de Teste Ativo' : 'Acesso Limitado'}
          </span>
        </div>
        <h3 className="text-xl font-black tracking-tight mb-2">{title}</h3>
        <p className="text-brand-200 text-xs leading-relaxed mb-6">
          {description}
        </p>
        <button 
          onClick={() => window.open(CHECKOUT_URL, '_blank')}
          className="bg-white text-brand-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
        >
          Ativar Acesso Total <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Login = () => {
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      alert('Conexão com o banco de dados está OK!');
    } catch (err: any) {
      if (err.message.includes('offline')) {
        alert('Erro: O aplicativo parece estar offline ou a configuração do Firebase está incorreta.');
      } else {
        alert('Conexão testada. Se não houve erro de rede, o banco está acessível.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Erro no login Google:", err);
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (mode === 'signup') {
        if (!name) {
          setError("Por favor, informe seu nome.");
          setIsLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthError = (err: any) => {
    if (err.code === 'auth/unauthorized-domain') {
      setError(`ERRO CRÍTICO: Este domínio (${window.location.hostname}) não está autorizado no Firebase.`);
      setShowGuide(true);
    } else if (err.code === 'auth/popup-blocked') {
      setError("O popup de login foi bloqueado. Por favor, permita popups para este site.");
    } else if (err.code === 'auth/email-already-in-use') {
      setError("Este e-mail já está em uso. Tente fazer login.");
    } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      setError("E-mail ou senha incorretos.");
    } else if (err.code === 'auth/weak-password') {
      setError("A senha deve ter pelo menos 6 caracteres.");
    } else {
      setError(`Erro: ${err.message || 'Tente novamente'}.`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-premium border border-slate-100 text-center"
      >
        <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-200 rotate-3">
          <Zap className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">EmagreçaAi.ao</h1>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">Seu Agente de IA que emagrece por você. <br/><span className="font-semibold text-brand-700">Sustentável, real e personalizado.</span></p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs text-left">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="font-black uppercase tracking-widest">Erro</span>
            </div>
            {error}
            {showGuide && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-red-100 space-y-3">
                <p className="font-bold text-slate-700">Como resolver (IMPORTANTE):</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-500">
                  <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" className="text-brand-600 underline font-black">Console do Firebase</a></li>
                  <li>Selecione seu projeto</li>
                  <li>Vá em <b>Build</b> &gt; <b>Authentication</b> &gt; <b>Settings</b> &gt; <b>Authorized Domains</b></li>
                  <li>Clique em <b>Add Domain</b> e adicione: <code className="bg-slate-100 px-2 py-0.5 rounded font-black text-brand-600">{window.location.hostname}</code></li>
                  <li>Aguarde 1-2 minutos e tente o login novamente.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {mode === 'signup' && (
            <div className="text-left space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome Completo</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamado?"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
              />
            </div>
          )}
          <div className="text-left space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>
          <div className="text-left space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-slate-300">
            <span className="bg-white px-4">Ou continue com</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-4 px-6 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-4 hover:bg-slate-50 transition-all font-bold text-slate-700 shadow-sm active:scale-95 disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google
        </button>

        <p className="mt-8 text-xs text-slate-400">
          {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <button 
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="ml-2 text-brand-600 font-black uppercase tracking-widest hover:underline"
          >
            {mode === 'login' ? 'Cadastre-se' : 'Fazer Login'}
          </button>
        </p>

        <div className="mt-10 pt-8 border-t border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Problemas com o acesso?</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={checkConnection}
              disabled={isChecking}
              className="text-[10px] font-bold text-brand-600 hover:underline flex items-center justify-center gap-2"
            >
              {isChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Testar Conexão
            </button>
            <a 
              href="https://wa.me/244923000000" 
              target="_blank" 
              className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-100 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Suporte via WhatsApp
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Onboarding = ({ profile }: { profile: UserProfile }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: profile.age || 25,
    weight: profile.weight || 70,
    height: profile.height || 170,
    goal: profile.goal || 'perder peso',
    activityLevel: profile.activityLevel || 'moderado'
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Calcular macros básicos sugeridos
      const bmr = 10 * formData.weight + 6.25 * formData.height - 5 * formData.age + 5; // Homem base
      const tdee = bmr * 1.4; // Moderado
      const targetCalories = formData.goal === 'perder peso' ? tdee - 500 : formData.goal === 'ganhar massa' ? tdee + 300 : tdee;
      
      const updatedProfile = {
        ...formData,
        targetCalories: Math.round(targetCalories),
        targetProtein: Math.round(formData.weight * 2),
        targetCarbs: Math.round((targetCalories * 0.4) / 4),
        targetFat: Math.round((targetCalories * 0.3) / 9),
        onboardingComplete: true
      };

      await updateDoc(doc(db, 'users', profile.uid), updatedProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-premium border border-slate-100"
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1.5 rounded-full transition-all", step >= s ? "w-8 bg-brand-600" : "w-4 bg-slate-100")} />
            ))}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo {step} de 3</span>
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Vamos começar!</h2>
            <p className="text-slate-500 mb-8 text-sm">Precisamos de alguns dados básicos para personalizar sua experiência.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Sua Idade</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="15" max="80" 
                    value={formData.age} 
                    onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="w-12 text-center font-black text-brand-600">{formData.age}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Seu Peso (kg)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="40" max="150" 
                    value={formData.weight} 
                    onChange={(e) => setFormData({...formData, weight: parseInt(e.target.value)})}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="w-12 text-center font-black text-brand-600">{formData.weight}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Sua Altura (cm)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="140" max="220" 
                    value={formData.height} 
                    onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="w-12 text-center font-black text-brand-600">{formData.height}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Qual seu objetivo?</h2>
            <p className="text-slate-500 mb-8 text-sm">Isso ajuda a IA a definir suas metas diárias.</p>
            
            <div className="grid grid-cols-1 gap-3">
              {['perder peso', 'manter peso', 'ganhar massa'].map(g => (
                <button
                  key={g}
                  onClick={() => setFormData({...formData, goal: g})}
                  className={cn(
                    "p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                    formData.goal === g ? "border-brand-600 bg-brand-50" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <span className={cn("font-bold capitalize", formData.goal === g ? "text-brand-900" : "text-slate-600")}>{g}</span>
                  {formData.goal === g && <Check className="w-5 h-5 text-brand-600" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Nível de Atividade</h2>
            <p className="text-slate-500 mb-8 text-sm">Como é sua rotina semanal de exercícios?</p>
            
            <div className="grid grid-cols-1 gap-3">
              {['sedentário', 'moderado', 'ativo', 'atleta'].map(l => (
                <button
                  key={l}
                  onClick={() => setFormData({...formData, activityLevel: l})}
                  className={cn(
                    "p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between",
                    formData.activityLevel === l ? "border-brand-600 bg-brand-50" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <span className={cn("font-bold capitalize", formData.activityLevel === l ? "text-brand-900" : "text-slate-600")}>{l}</span>
                  {formData.activityLevel === l && <Check className="w-5 h-5 text-brand-600" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-10 flex gap-3">
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px]"
            >
              Voltar
            </button>
          )}
          <button 
            onClick={() => step < 3 ? setStep(step + 1) : handleSave()}
            disabled={isSaving}
            className="flex-[2] py-4 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-brand-100 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (step === 3 ? 'Finalizar' : 'Próximo')}
            {step < 3 && !isSaving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ profile, weightData, meals, workouts, setActiveTab }: { profile: UserProfile, weightData: any[], meals: MealLog[], workouts: WorkoutLog[], setActiveTab: (tab: any) => void }) => {
  const todayCalories = meals.reduce((acc, meal) => acc + (meal.calories || 0), 0);
  const todayProtein = meals.reduce((acc, meal) => acc + (meal.protein || 0), 0);
  const todayCarbs = meals.reduce((acc, meal) => acc + (meal.carbs || 0), 0);
  const todayFat = meals.reduce((acc, meal) => acc + (meal.fat || 0), 0);
  
  const todayWorkouts = workouts.filter(w => {
    if (!w.timestamp) return false;
    const date = w.timestamp.toDate ? w.timestamp.toDate() : new Date(w.timestamp);
    return date.toDateString() === new Date().toDateString();
  });
  const caloriesBurned = todayWorkouts.reduce((acc, w) => acc + (w.caloriesBurned || 0), 0);

  const targetCalories = profile.targetCalories || 2000;
  const targetProtein = profile.targetProtein || 150;
  const targetCarbs = profile.targetCarbs || 200;
  const targetFat = profile.targetFat || 60;

  const progressPercent = Math.min((todayCalories / targetCalories) * 100, 100);
  const proteinPercent = Math.min((todayProtein / targetProtein) * 100, 100);
  const carbsPercent = Math.min((todayCarbs / targetCarbs) * 100, 100);
  const fatPercent = Math.min((todayFat / targetFat) * 100, 100);
  
  const [water, setWater] = useState(1.2);

  const handleShare = async (title: string, text: string, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        console.error("Erro ao partilhar:", error);
      }
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      speakText("Link copiado para a área de transferência!");
    }
  };

  const shareProgress = () => {
    const text = `Estou a usar o NutriAI para a minha jornada de emagrecimento! Hoje consumi ${Math.round(todayCalories)}kcal e queimei ${Math.round(caloriesBurned)}kcal. Junta-te a mim!`;
    handleShare("Meu Progresso no NutriAI", text, window.location.href);
  };

  const now = new Date();
  const premiumDate = profile.premiumUntil ? new Date(profile.premiumUntil) : null;
  const trialDate = profile.trialUntil ? new Date(profile.trialUntil) : null;
  const isPremium = premiumDate && premiumDate > now;
  const isTrial = trialDate && trialDate > now;
  const daysLeftTrial = trialDate ? Math.ceil((trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="space-y-8 pb-24">
      {!isPremium && (
        <div className={cn(
          "p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group transition-all",
          isTrial ? "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-100" : "bg-gradient-to-br from-brand-800 to-brand-600 shadow-brand-100"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-lg", isTrial ? "bg-white/20" : "bg-yellow-400/20")}>
                <Star className={cn("w-4 h-4", isTrial ? "text-white fill-white" : "text-yellow-300 fill-yellow-300")} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {isTrial ? `Teste Grátis: ${daysLeftTrial} ${daysLeftTrial === 1 ? 'dia' : 'dias'} restantes` : 'Acesso Expirado'}
              </span>
            </div>
            <h3 className="text-2xl font-black mb-2 tracking-tight">
              {isTrial ? 'Aproveite seu Teste Grátis!' : 'Seu Acesso Premium Expirou'}
            </h3>
            <p className="text-sm opacity-90 mb-6 leading-relaxed max-w-[260px]">
              {isTrial 
                ? 'Você tem acesso total por 3 dias. Após isso, as sugestões e o coach serão limitados.' 
                : 'Faça o pagamento para recuperar o acesso total ao coach e sugestões de comida personalizadas.'}
            </p>
            <button 
              onClick={() => window.open(CHECKOUT_URL, '_blank')}
              className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all shadow-xl active:scale-95 flex items-center gap-2"
            >
              {isTrial ? 'Garantir Acesso Vitalício' : 'Renovar Agora'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Zap className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
        </div>
      )}

      {/* Motivation Section */}
      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Motivação do Dia</h3>
        </div>
        <p className="text-slate-600 italic leading-relaxed">
          "O único treino ruim é aquele que não aconteceu. Cada escolha saudável hoje é um investimento no seu eu de amanhã."
        </p>
      </div>

      {/* Guide Promotion Card */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-500 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Guia Exclusivo</span>
          </div>
          <h3 className="text-2xl font-black mb-2 tracking-tight">Emagreça com Saúde</h3>
          <p className="text-sm opacity-90 mb-6 leading-relaxed max-w-[260px]">
            Tenha acesso ao Guia Completo de Emagrecimento e acelere seus resultados com estratégias reais.
          </p>
          <button 
            onClick={() => window.open(GUIDE_URL, '_blank')}
            className="bg-white text-brand-600 px-8 py-3 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all shadow-xl active:scale-95 flex items-center gap-2"
          >
            Obter Guia Completo <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <TrendingDown className="absolute -right-8 -bottom-8 w-48 h-48 text-white/10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
      </div>

      {/* Coach Quick Insights Link */}
      <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-premium relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Insights do Coach Elite</h3>
          </div>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed max-w-[280px]">
            Hoje o seu consumo de proteína está um pouco baixo. Que tal um lanche proteico para otimizar seus resultados?
          </p>
          <button 
            onClick={() => setActiveTab('coach')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition-colors group/btn"
          >
            Falar com Coach <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-600/20 blur-[60px] rounded-full -mr-16 -mt-16" />
      </div>

      <header className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Olá, {profile.name.split(' ')[0]}!</h2>
          <p className="text-slate-400 text-sm font-medium">Vamos focar na sua meta hoje.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={shareProgress}
            className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-premium border border-slate-100 text-slate-400 hover:text-brand-600 transition-all active:scale-95"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-premium border border-slate-100 overflow-hidden">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <TrendingDown className="text-brand-600 w-6 h-6" />
            )}
          </div>
        </div>
      </header>

      {/* Daily Summary Card */}
      <div className="bg-white rounded-[40px] p-8 shadow-premium border border-slate-50 relative overflow-hidden">
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Calorias Consumidas</p>
            <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{todayCalories} <span className="text-xl font-medium text-slate-300">kcal</span></h3>
          </div>
          <div className="bg-brand-50 p-3 rounded-2xl">
            <Zap className="w-6 h-6 text-brand-600" />
          </div>
        </div>
        
        <div className="relative h-4 bg-slate-50 rounded-full overflow-hidden mb-6 shadow-inner-soft">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-brand-400 rounded-full"
          />
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Meta: {targetCalories} kcal</span>
          <span className="text-brand-600">{progressPercent.toFixed(0)}%</span>
        </div>
      </div>

      {/* Macronutrients Progress Section */}
      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-brand-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Macronutrientes</h3>
        </div>
        
        <div className="space-y-8">
          {/* Protein */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Proteína</p>
                <p className="text-xl font-black text-slate-900">{todayProtein}g <span className="text-xs font-medium text-slate-300">/ {targetProtein}g</span></p>
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">{proteinPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden shadow-inner-soft">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${proteinPercent}%` }}
                className="bg-blue-500 h-full rounded-full"
              />
            </div>
          </div>

          {/* Carbs */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Carboidratos</p>
                <p className="text-xl font-black text-slate-900">{todayCarbs}g <span className="text-xs font-medium text-slate-300">/ {targetCarbs}g</span></p>
              </div>
              <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">{carbsPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden shadow-inner-soft">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${carbsPercent}%` }}
                className="bg-orange-500 h-full rounded-full"
              />
            </div>
          </div>

          {/* Fat */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Gorduras</p>
                <p className="text-xl font-black text-slate-900">{todayFat}g <span className="text-xs font-medium text-slate-300">/ {targetFat}g</span></p>
              </div>
              <span className="text-[10px] font-black text-pink-600 bg-pink-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">{fatPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden shadow-inner-soft">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${fatPercent}%` }}
                className="bg-pink-500 h-full rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Macro Distribution Pie Chart */}
      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
            <PieChartIcon className="w-5 h-5 text-brand-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Distribuição de Macros</h3>
        </div>
        <div className="h-48 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Proteína', value: todayProtein, color: '#3b82f6' },
                  { name: 'Carbs', value: todayCarbs, color: '#f97316' },
                  { name: 'Gordura', value: todayFat, color: '#ec4899' },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {[
                  { name: 'Proteína', value: todayProtein, color: '#3b82f6' },
                  { name: 'Carbs', value: todayCarbs, color: '#f97316' },
                  { name: 'Gordura', value: todayFat, color: '#ec4899' },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
            <span className="text-xl font-black text-slate-900">{todayProtein + todayCarbs + todayFat}g</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mb-1" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prot</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full mb-1" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carbs</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 bg-pink-500 rounded-full mb-1" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gord</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div 
          className="bg-white p-5 rounded-[32px] shadow-premium border border-slate-50 cursor-pointer active:scale-95 transition-all hover:border-brand-100"
          onClick={() => {
            setWater(prev => {
              const next = Math.min(prev + 0.2, 5);
              if (next > prev) speakText("Água registrada.");
              return next;
            });
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
              <Droplets className="text-blue-500 w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Água</span>
          </div>
          <p className="text-lg font-black text-slate-900">{water.toFixed(1)}L</p>
        </div>
        <div className="bg-white p-5 rounded-[32px] shadow-premium border border-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-brand-50 rounded-lg flex items-center justify-center">
              <Dumbbell className="text-brand-600 w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Treino</span>
          </div>
          <p className="text-lg font-black text-slate-900">{caloriesBurned} <span className="text-[10px] font-medium text-slate-300 uppercase">kcal</span></p>
        </div>
        <div className="bg-white p-5 rounded-[32px] shadow-premium border border-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-orange-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="text-orange-500 w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso</span>
          </div>
          <p className="text-lg font-black text-slate-900">{profile.weight || '--'} <span className="text-[10px] font-medium text-slate-300 uppercase">kg</span></p>
        </div>
      </div>

      {/* Weight Chart */}
      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Progresso</h3>
          <div className="text-brand-700 text-[10px] font-black bg-brand-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">
            {weightData.length > 0 ? `${weightData[0].weight} kg atual` : '--'}
          </div>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[...weightData].reverse()}>
              <defs>
                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <YAxis 
                hide 
                domain={['dataMin - 2', 'dataMax + 2']} 
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                itemStyle={{ fontWeight: 900, color: '#065f46' }}
              />
              <Area 
                type="monotone" 
                dataKey="weight" 
                stroke="#10b981" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorWeight)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Meals */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Refeições de Hoje</h3>
          <button className="text-brand-600 text-xs font-black uppercase tracking-widest">Ver Histórico</button>
        </div>
        <div className="space-y-4">
          {meals.slice(0, 3).map((meal) => (
            <div key={meal.id} className="bg-white p-5 rounded-[32px] shadow-premium border border-slate-50 flex items-center gap-5 group hover:border-brand-100 transition-all">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                {getIconForCategory(meal.mealName, profile.iconMappings, 'Utensils')}
              </div>
              <div className="flex-1">
                <h4 className="font-black text-slate-900 text-lg tracking-tight">{meal.mealName}</h4>
                <p className="text-xs font-medium text-slate-400">{meal.calories} kcal • {meal.protein}g prot • {meal.carbs}g carbs</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 group-hover:text-brand-600 transition-colors">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          ))}
          {meals.length === 0 && (
            <div className="bg-white/50 border-2 border-dashed border-slate-100 rounded-[40px] py-12 text-center">
              <p className="text-slate-400 text-sm font-medium italic">Nenhuma refeição registrada hoje.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Coach = ({ profile, meals, workouts }: { profile: UserProfile, meals: MealLog[], workouts: WorkoutLog[] }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickSuggestions = [
    { text: "Como melhorar minha proteína?", icon: <Beef className="w-4 h-4" /> },
    { text: "Sugira um treino rápido", icon: <Dumbbell className="w-4 h-4" /> },
    { text: "O que comer antes do treino?", icon: <Zap className="w-4 h-4" /> },
    { text: "Dica para dormir melhor", icon: <Moon className="w-4 h-4" /> }
  ];

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    const q = query(
      collection(db, 'users', profile.uid, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${profile.uid}/chat`));
  }, [profile.uid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isActive = hasActiveAccess(profile);
  const todayMessages = messages.filter(m => {
    if (!m.timestamp) return false;
    const date = m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return date.toDateString() === new Date().toDateString() && m.role === 'user';
  }).length;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!isActive && todayMessages >= 3) {
      speakText("Limite diário de mensagens atingido. Ative o Premium para conversas ilimitadas.");
      return;
    }
    
    const userMsg = input;
    setInput('');
    setIsLoading(true);

    try {
      await addDoc(collection(db, 'users', profile.uid, 'chat'), {
        role: 'user',
        content: userMsg,
        timestamp: serverTimestamp(),
        userId: profile.uid
      });

      const context = {
        recentMeals: meals.slice(0, 3).map(m => ({ 
          name: m.mealName, 
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          date: m.timestamp?.toDate ? m.timestamp.toDate().toISOString() : new Date().toISOString()
        })),
        recentWorkouts: workouts.slice(0, 3).map(w => ({ 
          type: w.exerciseType, 
          duration: w.duration, 
          calories: w.caloriesBurned,
          date: w.timestamp?.toDate ? w.timestamp.toDate().toISOString() : new Date().toISOString()
        }))
      };

      const response = await getAICoachResponse(userMsg, messages, profile, context);

      await addDoc(collection(db, 'users', profile.uid, 'chat'), {
        role: 'model',
        content: response,
        timestamp: serverTimestamp(),
        userId: profile.uid
      });
      
      // Audio feedback for coach response
      speakText("Nova mensagem do seu coach.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/chat`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Tem certeza que deseja apagar todo o histórico do chat?")) return;
    try {
      const q = query(collection(db, 'users', profile.uid, 'chat'));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'users', profile.uid, 'chat', d.id)));
      await Promise.all(deletePromises);
      speakText("Histórico de chat apagado.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${profile.uid}/chat`);
    }
  };

  const handleSpeak = async (message: ChatMessage) => {
    if (playingMessageId === message.id) return;
    setPlayingMessageId(message.id);
    try {
      // Remove markdown for cleaner speech
      const cleanText = message.content.replace(/[#*`_]/g, '');
      await speakText(cleanText);
    } finally {
      setPlayingMessageId(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="bg-white p-6 border-b border-slate-50 sticky top-0 z-40 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Coach IA</h3>
          {!isActive && (
            <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest">
              {3 - todayMessages} Envios Restantes Hoje
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isActive && (
            <button 
              onClick={() => window.open(CHECKOUT_URL, '_blank')}
              className="bg-brand-50 text-brand-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
            >
              <Zap className="w-3 h-3" /> Premium
            </button>
          )}
          <button 
            onClick={clearChat}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isActive && (
        <div className="px-4 pt-4">
          <PaywallBanner 
            profile={profile}
            title="Suporte Limitado"
            description="Ative o Premium para conversas ilimitadas e orientações personalizadas profundas."
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-6 p-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-10 px-6">
            <div className="w-24 h-24 bg-brand-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 shadow-inner-soft">
              <Zap className="text-brand-600 w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Seu Coach IA Elite</h3>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">
              Pronto para elevar sua performance? Escolha um tópico ou digite sua dúvida.
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              {quickSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(suggestion.text);
                    // Trigger send automatically after a short delay for better UX
                    setTimeout(() => document.getElementById('chat-send-btn')?.click(), 100);
                  }}
                  className="flex items-center gap-3 p-4 bg-white border border-slate-50 rounded-2xl hover:border-brand-500/20 hover:bg-brand-50/10 transition-all text-sm font-bold text-slate-700 text-left group shadow-sm active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 text-slate-400 group-hover:text-brand-600 transition-colors">
                    {suggestion.icon}
                  </div>
                  {suggestion.text}
                  <ChevronRight className="w-4 h-4 ml-auto text-slate-200 group-hover:text-brand-300 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "max-w-[85%] p-5 rounded-[32px] text-sm relative group shadow-premium border border-slate-50",
                msg.role === 'user' 
                  ? "bg-brand-600 text-white ml-auto rounded-tr-none border-none" 
                  : "bg-white text-slate-800 mr-auto rounded-tl-none"
              )}
            >
              <div className={cn(
                "prose prose-sm max-w-none",
                msg.role === 'user' ? "prose-invert" : "prose-slate"
              )}>
                <Markdown>
                  {msg.content}
                </Markdown>
              </div>
              
              {msg.role === 'model' && (
                <button 
                  onClick={() => handleSpeak(msg)}
                  className={cn(
                    "absolute -right-12 top-2 p-3 rounded-2xl bg-white border border-slate-50 shadow-premium text-slate-300 hover:text-brand-600 transition-all opacity-0 group-hover:opacity-100",
                    playingMessageId === msg.id && "opacity-100 text-brand-600"
                  )}
                >
                  {playingMessageId === msg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-50 p-5 rounded-[32px] mr-auto rounded-tl-none shadow-premium flex items-center gap-3 w-fit"
            >
              <TypingIndicator />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Digitando...</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-50 rounded-t-[40px] shadow-premium-up">
        <div className="relative flex items-center gap-3">
          <button
            onClick={startListening}
            className={cn(
              "w-14 h-14 rounded-[24px] flex items-center justify-center transition-all active:scale-95",
              isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-50 text-slate-400 hover:text-brand-600"
            )}
          >
            <Volume2 className={cn("w-6 h-6", isListening && "animate-bounce")} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "Ouvindo..." : "Como posso ajudar hoje?"}
            className="flex-1 bg-slate-50 border-none rounded-[24px] px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
          />
          <button
            id="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-14 h-14 bg-brand-600 text-white rounded-[24px] flex items-center justify-center shadow-lg shadow-brand-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const MealLogView = ({ profile, meals, templates }: { profile: UserProfile, meals: MealLog[], templates: MealTemplate[] }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<Partial<MealLog> | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const analysis = await analyzeMealImage(base64);
        setPendingMeal(analysis);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/meals`);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveRefinedMeal = async (refinedData: Partial<MealLog>) => {
    try {
      const mealData = {
        ...refinedData,
        timestamp: serverTimestamp(),
        userId: profile.uid
      };
      await addDoc(collection(db, 'users', profile.uid, 'meals'), mealData);
      
      if (saveAsTemplate) {
        await addDoc(collection(db, 'users', profile.uid, 'templates'), {
          name: refinedData.mealName,
          calories: refinedData.calories,
          protein: refinedData.protein,
          carbs: refinedData.carbs,
          fat: refinedData.fat,
          userId: profile.uid,
          createdAt: serverTimestamp()
        });
      }

      setPendingMeal(null);
      setSaveAsTemplate(false);
      speakText("Refeição registrada com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/meals`);
    }
  };

  const logFromTemplate = async (template: MealTemplate) => {
    try {
      await addDoc(collection(db, 'users', profile.uid, 'meals'), {
        mealName: template.name,
        calories: template.calories,
        protein: template.protein,
        carbs: template.carbs,
        fat: template.fat,
        analysis: "Registrado via modelo rápido.",
        timestamp: serverTimestamp(),
        userId: profile.uid
      });
      speakText(`${template.name} registrado com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/meals`);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <AnimatePresence>
        {pendingMeal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Refinar Refeição</h3>
                <button onClick={() => setPendingMeal(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nome da Refeição</label>
                  <input 
                    type="text" 
                    value={pendingMeal.mealName}
                    onChange={(e) => setPendingMeal({...pendingMeal, mealName: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Calorias (kcal)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.calories}
                      onChange={(e) => setPendingMeal({...pendingMeal, calories: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Proteína (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.protein}
                      onChange={(e) => setPendingMeal({...pendingMeal, protein: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Carbos (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.carbs}
                      onChange={(e) => setPendingMeal({...pendingMeal, carbs: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gordura (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.fat}
                      onChange={(e) => setPendingMeal({...pendingMeal, fat: Number(e.target.value)})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Classificação de Saúde</label>
                  <div className="flex gap-2">
                    {['saudável', 'moderada', 'não recomendada'].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setPendingMeal({...pendingMeal, healthRating: rating as any})}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                          pendingMeal.healthRating === rating 
                            ? (rating === 'saudável' ? "bg-emerald-600 text-white" : rating === 'moderada' ? "bg-amber-500 text-white" : "bg-red-600 text-white")
                            : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Análise</label>
                  <textarea 
                    value={pendingMeal.analysis}
                    onChange={(e) => setPendingMeal({...pendingMeal, analysis: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 h-24 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="saveTemplate"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-5 h-5 rounded border-emerald-200 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="saveTemplate" className="text-sm font-medium text-emerald-900 cursor-pointer">
                    Salvar como modelo rápido
                  </label>
                </div>

                <button 
                  onClick={() => saveRefinedMeal(pendingMeal)}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 mt-4"
                >
                  <Check className="w-5 h-5" />
                  Confirmar e Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Diário Alimentar</h2>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalyzing}
          className="bg-brand-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-black shadow-lg shadow-brand-100 disabled:opacity-50 active:scale-95 transition-all"
        >
          {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          Registrar Foto
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </div>

      {templates.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Modelos Rápidos</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => logFromTemplate(template)}
                className="flex-shrink-0 bg-white border border-slate-50 p-5 rounded-[32px] shadow-premium hover:border-brand-100 transition-all text-left min-w-[180px] group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-brand-50 rounded-lg flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                    <Zap className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <span className="text-sm font-black text-slate-900 truncate tracking-tight">{template.name}</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">{template.calories} <span className="text-[10px] uppercase tracking-widest">kcal</span></p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {meals.map((meal) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={meal.id} 
            className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 group hover:border-brand-100 transition-all"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                  {getIconForCategory(meal.mealName, profile.iconMappings, 'Utensils')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-black text-slate-900 text-xl tracking-tight leading-none">{meal.mealName}</h4>
                    {meal.healthRating && (
                      <span className={cn(
                        "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
                        meal.healthRating === 'saudável' ? "bg-emerald-50 text-emerald-600" :
                        meal.healthRating === 'moderada' ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-600"
                      )}>
                        {meal.healthRating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{meal.timestamp?.toDate ? format(meal.timestamp.toDate(), "HH:mm '•' d 'de' MMMM", { locale: ptBR }) : 'Agora'}</p>
                </div>
              </div>
              <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-2xl text-sm font-black tracking-tight">
                {meal.calories} <span className="text-[10px] font-medium uppercase tracking-widest opacity-60">kcal</span>
              </div>
            </div>
            
            {meal.analysis && (
              <div className="bg-slate-50 p-5 rounded-[24px] mb-6 border border-slate-100/50">
                <p className="text-sm text-slate-600 leading-relaxed italic">"{meal.analysis}"</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-50 p-4 rounded-2xl text-center shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Prot</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">{meal.protein}g</p>
              </div>
              <div className="bg-white border border-slate-50 p-4 rounded-2xl text-center shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Carbs</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">{meal.carbs}g</p>
              </div>
              <div className="bg-white border border-slate-50 p-4 rounded-2xl text-center shadow-sm">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Gord</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">{meal.fat}g</p>
              </div>
            </div>
          </motion.div>
        ))}
        {meals.length === 0 && !isAnalyzing && (
          <div className="text-center py-24 bg-white/50 border-2 border-dashed border-slate-100 rounded-[40px]">
            <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
              <Utensils className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-400 text-sm font-medium px-12">Nenhuma refeição registrada hoje. Que tal registrar seu almoço?</p>
          </div>
        )}
      </div>
    </div>
  );
};

const WorkoutTimer = () => {
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggle = () => {
    setIsActive(!isActive);
  };

  const reset = () => {
    setTime(0);
    setIsActive(false);
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    } else if (!isActive && time !== 0) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, time]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 p-8 rounded-[40px] shadow-premium text-center space-y-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-500 rounded-full blur-[80px]" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Timer className="w-4 h-4 text-brand-400" />
          <span className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">Cronómetro de Treino</span>
        </div>
        <div className="text-6xl font-black text-white tracking-tighter tabular-nums mb-8">
          {formatTime(time)}
        </div>
        <div className="flex justify-center gap-4">
          <button 
            onClick={toggle}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90",
              isActive ? "bg-amber-500 text-white" : "bg-brand-600 text-white"
            )}
          >
            {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
          <button 
            onClick={reset}
            className="w-16 h-16 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center transition-all active:scale-90"
          >
            <Square className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkoutView = ({ profile, workouts }: { profile: UserProfile, workouts: WorkoutLog[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [pendingWorkout, setPendingWorkout] = useState<Partial<WorkoutLog> | null>(null);
  const [newWorkout, setNewWorkout] = useState<Partial<WorkoutLog>>({
    exerciseType: '',
    duration: 30,
    intensity: 'moderada'
  });

  const handleSaveWorkout = async (workoutData?: Partial<WorkoutLog>, force = false) => {
    const dataToSave = workoutData || newWorkout;
    if (!dataToSave.exerciseType || !dataToSave.duration) return;

    // Duplicate check
    if (!force) {
      const isDuplicate = workouts.some(w => {
        if (!w.timestamp || !w.timestamp.toDate) return false;
        const workoutTime = w.timestamp.toDate().getTime();
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        return w.exerciseType.toLowerCase() === dataToSave.exerciseType?.toLowerCase() && 
               Math.abs(now - workoutTime) < oneHour;
      });

      if (isDuplicate) {
        setPendingWorkout(dataToSave);
        setShowDuplicateConfirm(true);
        return;
      }
    }
    
    try {
      await addDoc(collection(db, 'users', profile.uid, 'workouts'), {
        ...dataToSave,
        timestamp: serverTimestamp(),
        userId: profile.uid
      });
      setIsAdding(false);
      setShowDuplicateConfirm(false);
      setPendingWorkout(null);
      setNewWorkout({ exerciseType: '', duration: 30, intensity: 'moderada' });
      speakText("Treino registrado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/workouts`);
    }
  };

  const getSuggestions = () => {
    const goal = profile.goal?.toLowerCase() || '';
    const level = profile.activityLevel?.toLowerCase() || '';
    
    const suggestions = [];
    
    if (goal.includes('emagrecer')) {
      suggestions.push(
        { type: 'HIIT Intenso', duration: 20, intensity: 'alta', defaultIcon: 'Zap' },
        { type: 'Corrida Leve', duration: 45, intensity: 'moderada', defaultIcon: 'Activity' },
        { type: 'Caminhada Rápida', duration: 60, intensity: 'baixa', defaultIcon: 'Activity' }
      );
    } else if (goal.includes('ganhar') || goal.includes('massa')) {
      suggestions.push(
        { type: 'Musculação (Superior)', duration: 60, intensity: 'alta', defaultIcon: 'Dumbbell' },
        { type: 'Musculação (Inferior)', duration: 60, intensity: 'alta', defaultIcon: 'Dumbbell' },
        { type: 'Treino Funcional', duration: 45, intensity: 'moderada', defaultIcon: 'Zap' }
      );
    } else {
      suggestions.push(
        { type: 'Yoga Relaxante', duration: 40, intensity: 'baixa', defaultIcon: 'Activity' },
        { type: 'Pilates', duration: 50, intensity: 'moderada', defaultIcon: 'Activity' },
        { type: 'Natação', duration: 45, intensity: 'alta', defaultIcon: 'Zap' }
      );
    }

    // Adjust based on level if needed, but goal is primary for now
    return suggestions;
  };

  const suggestions = getSuggestions();

  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Seus Treinos</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-600 text-white px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-black shadow-lg shadow-brand-100 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo Treino
        </button>
      </div>

      <WorkoutTimer />

      {/* Suggestions Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 bg-brand-50 rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-brand-600" />
          </div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sugestões Personalizadas</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {suggestions.map((s, idx) => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={idx}
              onClick={() => handleSaveWorkout({ exerciseType: s.type, duration: s.duration, intensity: s.intensity as any })}
              className="flex-shrink-0 bg-white border border-slate-50 p-6 rounded-[32px] shadow-premium flex flex-col items-start min-w-[200px] relative overflow-hidden group hover:border-brand-100 transition-all"
            >
              <div className="absolute top-0 right-0 p-4 text-slate-100 group-hover:text-brand-50 transition-colors">
                {getIconForCategory(s.type, profile.iconMappings, s.defaultIcon)}
              </div>
              <span className="text-lg font-black text-slate-900 mb-3 tracking-tight leading-none">{s.type}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl uppercase tracking-widest">{s.duration} min</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.intensity}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl border border-slate-50"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Registrar Treino</h3>
                <button onClick={() => setIsAdding(false)} className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-2xl hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tipo de Exercício</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Corrida, Musculação, Yoga"
                    value={newWorkout.exerciseType}
                    onChange={(e) => setNewWorkout({...newWorkout, exerciseType: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duração (min)</label>
                    <input 
                      type="number" 
                      value={newWorkout.duration}
                      onChange={(e) => setNewWorkout({...newWorkout, duration: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Calorias</label>
                    <input 
                      type="number" 
                      value={newWorkout.caloriesBurned || ''}
                      onChange={(e) => setNewWorkout({...newWorkout, caloriesBurned: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Intensidade</label>
                  <div className="flex gap-2">
                    {['baixa', 'moderada', 'alta'].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setNewWorkout({...newWorkout, intensity: lvl as any})}
                        className={cn(
                          "flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
                          newWorkout.intensity === lvl 
                            ? "bg-brand-600 text-white shadow-lg shadow-brand-100" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => handleSaveWorkout()}
                  className="w-full bg-brand-600 text-white py-5 rounded-[24px] font-black shadow-lg shadow-brand-100 mt-4 active:scale-95 transition-all"
                >
                  Salvar Treino
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDuplicateConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl border border-slate-50 text-center"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Treino Duplicado?</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Você já registrou um treino de <span className="font-black text-slate-900">"{pendingWorkout?.exerciseType}"</span> recentemente. Deseja registrar novamente?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDuplicateConfirm(false);
                    setPendingWorkout(null);
                  }}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleSaveWorkout(pendingWorkout || undefined, true)}
                  className="flex-1 py-4 bg-brand-600 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-100 active:scale-95 transition-all"
                >
                  Sim, Registrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {workouts.map((workout) => (
          <motion.div 
            key={workout.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[32px] shadow-premium border border-slate-50 flex items-center gap-5 group hover:border-brand-100 transition-all"
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
              workout.intensity === 'alta' ? "bg-red-50 text-red-600" :
              workout.intensity === 'moderada' ? "bg-amber-50 text-amber-600" :
              "bg-emerald-50 text-emerald-600"
            )}>
              {getIconForCategory(workout.exerciseType, profile.iconMappings, 'Dumbbell')}
            </div>
            <div className="flex-1">
              <h4 className="font-black text-slate-900 text-lg tracking-tight">{workout.exerciseType}</h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5" /> {workout.duration} min
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5" /> {workout.intensity}
                </span>
              </div>
            </div>
            {workout.caloriesBurned && (
              <div className="text-right">
                <p className="text-xl font-black text-slate-900 tracking-tighter">-{workout.caloriesBurned}</p>
                <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest">kcal</p>
              </div>
            )}
          </motion.div>
        ))}
        {workouts.length === 0 && (
          <div className="text-center py-24 bg-white/50 border-2 border-dashed border-slate-100 rounded-[40px]">
            <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
              <Dumbbell className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-slate-400 text-sm font-medium px-12">Nenhum treino registrado. Vamos nos mexer?</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Profile = ({ 
  profile, 
  weightData, 
  meals, 
  workouts 
}: { 
  profile: UserProfile, 
  weightData: any[], 
  meals: MealLog[], 
  workouts: WorkoutLog[] 
}) => {
  const [weight, setWeight] = useState('');
  const [goals, setGoals] = useState({
    targetCalories: profile.targetCalories || 2000,
    targetProtein: profile.targetProtein || 150,
    targetCarbs: profile.targetCarbs || 200,
    targetFat: profile.targetFat || 60,
    weeklyWorkoutGoal: profile.weeklyWorkoutGoal || 3,
    weeklyCaloriesGoal: profile.weeklyCaloriesGoal || 1500
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [notifSettings, setNotifSettings] = useState(profile.notificationSettings || {
    enabled: false,
    waterReminders: true,
    goalReminders: true,
    guideReminders: true
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [iconMappings, setIconMappings] = useState<Record<string, string>>(profile.iconMappings || {});
  const [isSavingIcons, setIsSavingIcons] = useState(false);
  const [newMapping, setNewMapping] = useState({ keyword: '', icon: 'Activity' });
  const [showIconPicker, setShowIconPicker] = useState(false);

  const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const endOfCurrentWeek = endOfWeek(new Date(), { weekStartsOn: 1 });

  const weeklyWorkouts = workouts.filter(w => {
    const workoutDate = w.timestamp?.toDate ? w.timestamp.toDate() : new Date();
    return isWithinInterval(workoutDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
  });

  const weeklyCaloriesBurned = weeklyWorkouts.reduce((acc, w) => acc + (w.caloriesBurned || 0), 0);
  const weeklyWorkoutCount = weeklyWorkouts.length;

  const availableIcons = [
    'Utensils', 'Dumbbell', 'Zap', 'Activity', 'ChefHat', 'Coffee', 'Pizza', 'Apple', 
    'Beef', 'Bike', 'Footprints', 'Heart', 'Flame', 'Moon', 'Sun', 'Timer', 'Target'
  ];

  const exportData = () => {
    try {
      const headers = {
        weight: ['Data', 'Peso (kg)'],
        meals: ['Data', 'Refeição', 'Calorias', 'Proteína', 'Carboidratos', 'Gorduras'],
        workouts: ['Data', 'Exercício', 'Duração (min)', 'Intensidade', 'Calorias Queimadas']
      };

      const weightRows = weightData.map(w => [
        w.timestamp?.toDate ? format(w.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : w.fullDate,
        w.weight
      ]);
      
      const mealRows = meals.map(m => [
        m.timestamp?.toDate ? format(m.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : '',
        m.mealName,
        m.calories,
        m.protein,
        m.carbs,
        m.fat
      ]);
      
      const workoutRows = workouts.map(w => [
        w.timestamp?.toDate ? format(w.timestamp.toDate(), 'dd/MM/yyyy HH:mm') : '',
        w.exerciseType,
        w.duration,
        w.intensity,
        w.caloriesBurned
      ]);

      const csvContent = [
        ['DADOS DE PESO'],
        headers.weight,
        ...weightRows,
        [],
        ['REFEIÇÕES'],
        headers.meals,
        ...mealRows,
        [],
        ['TREINOS'],
        headers.workouts,
        ...workoutRows
      ].map(e => e.join(",")).join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `progresso_emagrecaia_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      speakText("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      alert("Erro ao exportar seus dados. Tente novamente.");
    }
  };

  const updateWeight = async () => {
    if (!weight || isSaving) return;
    setIsSaving(true);
    try {
      const newWeight = parseFloat(weight);
      await addDoc(collection(db, 'users', profile.uid, 'progress'), {
        weight: newWeight,
        timestamp: serverTimestamp(),
        userId: profile.uid
      });
      await setDoc(doc(db, 'users', profile.uid), { weight: newWeight }, { merge: true });
      setWeight('');
      speakText("Peso atualizado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateGoals = async () => {
    setIsSavingGoals(true);
    try {
      await setDoc(doc(db, 'users', profile.uid), goals, { merge: true });
      speakText("Metas atualizadas com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSavingGoals(false);
    }
  };

  const updateNotifications = async (newSettings: any) => {
    setIsSavingNotifs(true);
    try {
      if (newSettings.enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          newSettings.enabled = false;
          alert("Permissão de notificação negada pelo navegador.");
        }
      }
      await setDoc(doc(db, 'users', profile.uid), { notificationSettings: newSettings }, { merge: true });
      setNotifSettings(newSettings);
      speakText("Configurações de notificação atualizadas!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const saveIconMapping = async () => {
    if (!newMapping.keyword) return;
    setIsSavingIcons(true);
    try {
      const updatedMappings = { ...iconMappings, [newMapping.keyword]: newMapping.icon };
      await setDoc(doc(db, 'users', profile.uid), { iconMappings: updatedMappings }, { merge: true });
      setIconMappings(updatedMappings);
      setNewMapping({ keyword: '', icon: 'Activity' });
      speakText("Ícone personalizado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSavingIcons(false);
    }
  };

  const removeIconMapping = async (keyword: string) => {
    setIsSavingIcons(true);
    try {
      const updatedMappings = { ...iconMappings };
      delete updatedMappings[keyword];
      await setDoc(doc(db, 'users', profile.uid), { iconMappings: updatedMappings }, { merge: true });
      setIconMappings(updatedMappings);
      speakText("Ícone removido.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSavingIcons(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) {
      alert("A imagem é muito grande. Por favor, escolha uma imagem menor que 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await setDoc(doc(db, 'users', profile.uid), { photoURL: base64String }, { merge: true });
        speakText("Foto de perfil atualizada!");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col items-center text-center">
        <div className="w-28 h-28 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6 border-4 border-white shadow-premium relative group overflow-hidden">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-14 h-14 text-slate-300 group-hover:text-brand-600 transition-colors" />
          )}
          <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Camera className="w-8 h-8 text-white" />
            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </label>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg z-10">
            <Zap className="w-4 h-4 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{profile.name}</h2>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-4">{profile.email}</p>
        <button 
          onClick={() => {
            const text = `Estou a transformar o meu corpo com o NutriAI! Meu objetivo: ${profile.goal}.`;
            if (navigator.share) {
              navigator.share({ title: "Meu Perfil NutriAI", text, url: window.location.href });
            } else {
              navigator.clipboard.writeText(`${text} ${window.location.href}`);
              speakText("Link do perfil copiado!");
            }
          }}
          className="flex items-center gap-2 text-xs font-black text-brand-600 bg-brand-50 px-4 py-2 rounded-full hover:bg-brand-100 transition-all active:scale-95"
        >
          <Share2 className="w-3 h-3" /> Partilhar Jornada
        </button>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Star className="w-5 h-5 text-brand-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Status da Assinatura</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                hasActiveAccess(profile) ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
              )}>
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">
                  {hasActiveAccess(profile) ? 'Plano Ativo' : 'Plano Inativo'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {profile.role === 'admin' ? 'Acesso Vitalício' : (profile.premiumUntil ? 'Assinatura Premium' : 'Período de Teste')}
                </p>
              </div>
            </div>
            {!hasActiveAccess(profile) && (
              <button 
                onClick={() => window.open(CHECKOUT_URL, '_blank')}
                className="bg-brand-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Ativar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teste Expira</p>
              <p className="text-xs font-bold text-slate-700">
                {profile.trialUntil ? format(new Date(profile.trialUntil), 'dd/MM/yyyy') : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Premium Expira</p>
              <p className="text-xs font-bold text-brand-600">
                {profile.premiumUntil ? format(new Date(profile.premiumUntil), 'dd/MM/yyyy') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Atualizar Peso</h3>
        </div>
        <div className="flex gap-3">
          <input 
            type="number" 
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Peso atual (kg)"
            className="flex-1 bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
          />
          <button 
            onClick={updateWeight}
            disabled={isSaving}
            className="bg-brand-600 text-white px-8 py-4 rounded-[20px] font-black shadow-lg shadow-brand-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-brand-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Metas Diárias</h3>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Calorias (kcal)</label>
            <input 
              type="number" 
              value={goals.targetCalories}
              onChange={(e) => setGoals({...goals, targetCalories: Number(e.target.value)})}
              className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Prot (g)</label>
              <input 
                type="number" 
                value={goals.targetProtein}
                onChange={(e) => setGoals({...goals, targetProtein: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-[20px] px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Carbs (g)</label>
              <input 
                type="number" 
                value={goals.targetCarbs}
                onChange={(e) => setGoals({...goals, targetCarbs: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-[20px] px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Gord (g)</label>
              <input 
                type="number" 
                value={goals.targetFat}
                onChange={(e) => setGoals({...goals, targetFat: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-[20px] px-4 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all text-center"
              />
            </div>
          </div>
          <button 
            onClick={updateGoals}
            disabled={isSavingGoals}
            className="w-full bg-brand-600 text-white py-5 rounded-[24px] font-black shadow-lg shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            {isSavingGoals ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Atualizar Metas'}
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Metas Semanais de Treino</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Treinos por Semana</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">{weeklyWorkoutCount}</span>
                  <span className="text-sm font-bold text-slate-400">/ {goals.weeklyWorkoutGoal}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-600">{Math.min(100, Math.round((weeklyWorkoutCount / (goals.weeklyWorkoutGoal || 1)) * 100))}%</span>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (weeklyWorkoutCount / (goals.weeklyWorkoutGoal || 1)) * 100)}%` }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
            <input 
              type="number" 
              value={goals.weeklyWorkoutGoal}
              onChange={(e) => setGoals({...goals, weeklyWorkoutGoal: Number(e.target.value)})}
              className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
              placeholder="Meta de treinos"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Calorias Semanais</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">{Math.round(weeklyCaloriesBurned)}</span>
                  <span className="text-sm font-bold text-slate-400">/ {goals.weeklyCaloriesGoal}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-orange-600">{Math.min(100, Math.round((weeklyCaloriesBurned / (goals.weeklyCaloriesGoal || 1)) * 100))}%</span>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (weeklyCaloriesBurned / (goals.weeklyCaloriesGoal || 1)) * 100)}%` }}
                className="h-full bg-orange-500 rounded-full"
              />
            </div>
            <input 
              type="number" 
              value={goals.weeklyCaloriesGoal}
              onChange={(e) => setGoals({...goals, weeklyCaloriesGoal: Number(e.target.value)})}
              className="w-full bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all"
              placeholder="Meta de calorias"
            />
          </div>
        </div>

        <button 
          onClick={updateGoals}
          disabled={isSavingGoals}
          className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          {isSavingGoals ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Metas Semanais'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Bell className={cn("w-5 h-5", notifSettings.enabled ? "text-brand-600" : "text-slate-400")} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Notificações</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controlo de alertas</p>
            </div>
          </div>
          <button 
            onClick={() => updateNotifications({...notifSettings, enabled: !notifSettings.enabled})}
            disabled={isSavingNotifs}
            className={cn(
              "w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner",
              notifSettings.enabled ? "bg-brand-600 shadow-brand-200" : "bg-slate-200 shadow-slate-100"
            )}
          >
            <div className={cn(
              "absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-md flex items-center justify-center",
              notifSettings.enabled ? "left-[calc(100%-28px)]" : "left-1"
            )}>
              {notifSettings.enabled ? <Check className="w-3 h-3 text-brand-600" /> : <X className="w-3 h-3 text-slate-300" />}
            </div>
          </button>
        </div>
        
        {notifSettings.enabled && (
          <div className="space-y-3 pt-2">
            {[
              { id: 'water', label: 'Lembretes de Água', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50', key: 'waterReminders' },
              { id: 'goals', label: 'Metas Diárias', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50', key: 'goalReminders' },
              { id: 'guide', label: 'Sugestões do Guia', icon: BookOpen, color: 'text-brand-600', bg: 'bg-brand-50', key: 'guideReminders' }
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[32px] border border-transparent hover:border-slate-100 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", item.bg)}>
                    <item.icon className={cn("w-5 h-5", item.color)} />
                  </div>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{item.label}</span>
                </div>
                <button 
                  onClick={() => updateNotifications({...notifSettings, [item.key]: !notifSettings[item.key as keyof typeof notifSettings]})}
                  className={cn(
                    "w-12 h-7 rounded-full relative transition-all duration-300",
                    notifSettings[item.key as keyof typeof notifSettings] ? "bg-brand-600" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm",
                    notifSettings[item.key as keyof typeof notifSettings] ? "left-[calc(100%-24px)]" : "left-1"
                  )} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Star className="w-5 h-5 text-brand-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Personalização de Ícones</h3>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newMapping.keyword}
                onChange={(e) => setNewMapping({...newMapping, keyword: e.target.value})}
                placeholder="Palavra-chave (ex: Café, Corrida)"
                className="flex-1 bg-slate-50 border-none rounded-[20px] px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-300"
              />
              <div className="relative">
                <button 
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="h-full px-5 bg-slate-50 rounded-[20px] flex items-center justify-center border border-transparent hover:border-brand-200 transition-all"
                >
                  {getIconByName(newMapping.icon, "w-6 h-6 text-brand-600")}
                </button>
                <AnimatePresence>
                  {showIconPicker && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute right-0 top-full mt-2 bg-white p-4 rounded-[24px] shadow-2xl border border-slate-100 grid grid-cols-4 gap-2 z-50 w-64"
                    >
                      {availableIcons.map(icon => (
                        <button 
                          key={icon}
                          onClick={() => {
                            setNewMapping({...newMapping, icon});
                            setShowIconPicker(false);
                          }}
                          className={cn(
                            "p-3 rounded-xl hover:bg-brand-50 transition-all flex items-center justify-center",
                            newMapping.icon === icon ? "bg-brand-50 text-brand-600" : "text-slate-400"
                          )}
                        >
                          {getIconByName(icon, "w-5 h-5")}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <button 
              onClick={saveIconMapping}
              disabled={!newMapping.keyword || isSavingIcons}
              className="w-full bg-brand-600 text-white py-5 rounded-[24px] font-black shadow-lg shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSavingIcons ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Adicionar Personalização'}
            </button>
          </div>

          {Object.keys(iconMappings).length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suas Personalizações</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(iconMappings).map(([keyword, icon]) => (
                  <div key={keyword} className="flex items-center justify-between p-4 bg-slate-50 rounded-[24px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {getIconByName(icon, "w-5 h-5 text-brand-600")}
                      </div>
                      <span className="text-sm font-black text-slate-700 tracking-tight">{keyword}</span>
                    </div>
                    <button 
                      onClick={() => removeIconMapping(keyword)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-brand-900 p-8 rounded-[40px] shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-800/50 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-800 rounded-2xl flex items-center justify-center">
              <Star className="w-5 h-5 text-brand-400 fill-brand-400" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">Plano Premium</h3>
          </div>
          {profile.isPremium ? (
            <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30 mb-8">
              <p className="text-emerald-400 text-sm font-black flex items-center gap-2">
                <Check className="w-4 h-4" /> Assinatura Ativa
              </p>
            </div>
          ) : (
            <>
              <p className="text-brand-300 text-sm mb-8 leading-relaxed">Obtenha acesso a todas as funcionalidades exclusivas da app para uma experiência completa.</p>
              <button 
                onClick={() => window.open(CHECKOUT_URL, '_blank')}
                className="w-full bg-white text-brand-900 py-5 rounded-[24px] font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
              >
                Fazer Pagamento
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Dados e Backup</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-medium">Exporte seu histórico completo de peso, refeições e treinos para um arquivo CSV.</p>
        <button 
          onClick={exportData}
          className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Download className="w-5 h-5" />
          Exportar Dados (CSV)
        </button>
      </div>

      <button 
        onClick={logout}
        className="w-full p-6 bg-red-50 rounded-[32px] flex items-center justify-center gap-3 font-black text-red-600 mt-8 active:scale-95 transition-all"
      >
        <LogOut className="w-6 h-6" /> Sair da Conta
      </button>
    </div>
  );
};

const RecipeSuggestionsView = ({ profile }: { profile: UserProfile }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLogging, setIsLogging] = useState<string | null>(null);

  const isActive = hasActiveAccess(profile);

  const fetchRecipes = async () => {
    if (!isActive && recipes.length >= 1) {
      // Already has one, don't fetch more for free users
      return;
    }
    setIsLoading(true);
    try {
      const suggestions = await getAICoachResponse("Sugira 3 receitas saudáveis", [], profile); // Fallback if needed
      // Actually use the specialized service
      const specializedSuggestions = await getRecipeSuggestions(profile);
      setRecipes(isActive ? specializedSuggestions : specializedSuggestions.slice(0, 1));
    } catch (error) {
      console.error("Erro ao buscar receitas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [profile.uid]);

  const handleLogRecipe = async (recipe: Recipe) => {
    setIsLogging(recipe.name);
    try {
      await addDoc(collection(db, 'users', profile.uid, 'meals'), {
        mealName: recipe.name,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        healthRating: 'saudável',
        analysis: `Receita sugerida pela IA: ${recipe.description}`,
        timestamp: serverTimestamp(),
        userId: profile.uid
      });
      speakText(`Receita ${recipe.name} registrada com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/meals`);
    } finally {
      setIsLogging(null);
    }
  };

  const handleShareRecipe = (recipe: Recipe) => {
    const text = `Olha esta receita saudável que encontrei no NutriAI: ${recipe.name}! ${recipe.calories}kcal.`;
    if (navigator.share) {
      navigator.share({ title: recipe.name, text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(`${text} ${window.location.href}`);
      speakText("Link da receita copiado!");
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sugestões</h2>
        <div className="flex gap-2">
          {isActive && (
            <button 
              onClick={fetchRecipes}
              disabled={isLoading}
              className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-brand-50 hover:text-brand-600 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {!isActive && (
        <PaywallBanner 
          profile={profile}
          title="Sugestões Limitadas"
          description="Usuários free recebem apenas 1 sugestão de receita. Ative o Premium para ter acesso a 3 sugestões gourmet e renovação ilimitada."
        />
      )}

      <div className="space-y-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 animate-pulse">
              <div className="h-6 bg-slate-100 rounded-full w-2/3 mb-4" />
              <div className="h-4 bg-slate-50 rounded-full w-full mb-2" />
              <div className="h-4 bg-slate-50 rounded-full w-5/6 mb-8" />
              <div className="flex gap-4 mb-8">
                <div className="h-12 bg-slate-50 rounded-2xl flex-1" />
                <div className="h-12 bg-slate-50 rounded-2xl flex-1" />
                <div className="h-12 bg-slate-50 rounded-2xl flex-1" />
              </div>
              <div className="h-14 bg-slate-100 rounded-[24px] w-full" />
            </div>
          ))
        ) : (
          recipes.map((recipe, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={recipe.name} 
              className="bg-white p-8 rounded-[40px] shadow-premium border border-slate-50 group hover:border-brand-100 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{recipe.name}</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleShareRecipe(recipe)}
                    className="p-2 text-slate-300 hover:text-brand-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-2xl text-sm font-black tracking-tight">
                    {recipe.calories} <span className="text-[10px] font-medium uppercase tracking-widest opacity-60">kcal</span>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-slate-500 leading-relaxed mb-8">{recipe.description}</p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Prot</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">{recipe.protein}g</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Carbs</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">{recipe.carbs}g</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Gord</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">{recipe.fat}g</p>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ingredientes</h4>
                  <ul className="grid grid-cols-1 gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                        <div className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Preparo</h4>
                  <ol className="space-y-3">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="flex gap-4 text-sm font-medium text-slate-600 leading-relaxed">
                        <span className="text-brand-600 font-black">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <button 
                onClick={() => handleLogRecipe(recipe)}
                disabled={isLogging === recipe.name}
                className="w-full bg-brand-600 text-white py-5 rounded-[24px] font-black shadow-lg shadow-brand-100 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {isLogging === recipe.name ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    Registrar no Diário
                  </>
                )}
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dash' | 'coach' | 'recipes' | 'meals' | 'workouts' | 'profile' | 'admin'>('dash');
  const [weightData, setWeightData] = useState<any[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoadingTimeout(true);
    }, 8000); // Show help if loading takes > 8s
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!process.env.GEMINI_API_KEY) {
      setApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    if (profile && meals.length > 0) {
      checkGoalsAndNotify(profile, meals, workouts);
      const interval = setInterval(() => {
        checkGoalsAndNotify(profile, meals, workouts);
      }, 1000 * 60 * 30); // Check every 30 mins
      return () => clearInterval(interval);
    }
  }, [profile, meals, workouts]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        // Silent catch for test connection unless it's a config issue
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    let unsubs: (() => void)[] = [];

    const authUnsub = onAuthStateChanged(auth, async (u) => {
      // Clean up previous listeners
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            const newProfile = {
              uid: u.uid,
              name: u.displayName || 'Usuário',
              email: u.email || '',
              createdAt: new Date().toISOString(),
              role: u.email === "ageumiranda00@gmail.com" ? 'admin' : 'user',
              isPremium: u.email === "ageumiranda00@gmail.com" ? true : false,
              onboardingComplete: false,
              trialUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              premiumUntil: u.email === "ageumiranda00@gmail.com" ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() : null
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = docSnap.data() as UserProfile;
            if (u.email === "ageumiranda00@gmail.com") {
              data.isPremium = true;
              data.role = 'admin';
            }
            setProfile(data);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }

        // Listen for profile
        const profileUnsub = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            const now = new Date();
            
            // Auto-update isPremium based on dates
            const premiumDate = data.premiumUntil ? new Date(data.premiumUntil) : null;
            const trialDate = data.trialUntil ? new Date(data.trialUntil) : null;
            const isActive = (premiumDate && premiumDate > now) || (trialDate && trialDate > now);

            if (u.email?.toLowerCase() === "ageumiranda00@gmail.com") {
              if (!data.isPremium || data.role !== 'admin') {
                updateDoc(doc(db, 'users', u.uid), { 
                  isPremium: true, 
                  role: 'admin',
                  premiumUntil: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
                }).catch(console.error);
              }
              data.isPremium = true;
              data.role = 'admin';
            } else if (data.isPremium !== isActive) {
              // Sync isPremium flag with dates if they differ
              updateDoc(doc(db, 'users', u.uid), { isPremium: isActive }).catch(console.error);
              data.isPremium = isActive;
            }
            
            setProfile(data);
          }
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${u.uid}`));
        unsubs.push(profileUnsub);

        // Listen for weight data
        const wQuery = query(collection(db, 'users', u.uid, 'progress'), orderBy('timestamp', 'desc'));
        const weightUnsub = onSnapshot(wQuery, (snap) => {
          setWeightData(snap.docs.map(d => ({
            id: d.id,
            date: d.data().timestamp?.toDate ? format(d.data().timestamp.toDate(), 'dd/MM') : '',
            fullDate: d.data().timestamp?.toDate ? format(d.data().timestamp.toDate(), "d 'de' MMMM", { locale: ptBR }) : '',
            weight: d.data().weight,
            timestamp: d.data().timestamp
          })));
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${u.uid}/progress`));
        unsubs.push(weightUnsub);

        // Listen for meals
        const mQuery = query(collection(db, 'users', u.uid, 'meals'), orderBy('timestamp', 'desc'));
        const mealsUnsub = onSnapshot(mQuery, (snap) => {
          setMeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as MealLog)));
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${u.uid}/meals`));
        unsubs.push(mealsUnsub);

        // Listen for workouts
        const woQuery = query(collection(db, 'users', u.uid, 'workouts'), orderBy('timestamp', 'desc'));
        const workoutsUnsub = onSnapshot(woQuery, (snap) => {
          setWorkouts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutLog)));
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${u.uid}/workouts`));
        unsubs.push(workoutsUnsub);

        // Listen for templates
        const tQuery = query(collection(db, 'users', u.uid, 'templates'), orderBy('createdAt', 'desc'));
        const templatesUnsub = onSnapshot(tQuery, (snap) => {
          setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as MealTemplate)));
        }, (error) => handleFirestoreError(error, OperationType.GET, `users/${u.uid}/templates`));
        unsubs.push(templatesUnsub);
      } else {
        setProfile(null);
        setWeightData([]);
        setMeals([]);
        setWorkouts([]);
        setTemplates([]);
      }
      setLoading(false);
    });

    return () => {
      authUnsub();
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="mb-6"
      >
        <RefreshCw className="w-10 h-10 text-brand-600" />
      </motion.div>
      <h2 className="text-xl font-black text-slate-900 mb-2">Iniciando EmagreçaAi.ao</h2>
      <p className="text-slate-400 text-sm mb-8">Sincronizando seus dados com segurança...</p>
      
      {loadingTimeout && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xs space-y-4"
        >
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs leading-relaxed">
            Está demorando mais que o normal. Isso pode ser devido a uma conexão lenta ou bloqueio de cookies no seu navegador.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm shadow-sm active:scale-95 transition-all"
          >
            Tentar Recarregar
          </button>
          
          <button 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
            className="w-full py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold text-sm shadow-sm active:scale-95 transition-all"
          >
            Limpar Cache e Reiniciar
          </button>
          
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="text-[10px] text-slate-300 uppercase tracking-widest font-bold hover:text-slate-500"
          >
            {showDebug ? 'Ocultar Diagnóstico' : 'Mostrar Diagnóstico'}
          </button>

          {showDebug && (
            <div className="p-4 bg-slate-100 rounded-2xl text-[9px] text-slate-500 text-left font-mono break-all space-y-2">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                <span className="font-black uppercase tracking-widest text-[8px]">Diagnóstico Técnico</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.reload();
                    }}
                    className="bg-white px-2 py-1 rounded border border-slate-200 text-red-400 hover:text-red-600"
                  >
                    Limpar Cache
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert('URL copiada para a área de transferência!');
                    }}
                    className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-400 hover:text-brand-600"
                  >
                    Copiar URL
                  </button>
                </div>
              </div>
              <p>URL: {window.location.href}</p>
              <p>Status: {isOnline ? 'ONLINE' : 'OFFLINE'}</p>
              <p>UA: {navigator.userAgent}</p>
              <p>Cookies: {navigator.cookieEnabled ? 'OK' : 'BLOCKED'}</p>
              <p>Auth Ready: {auth.currentUser ? 'YES' : 'NO'}</p>
              <p>Firestore: {db ? 'OK' : 'MISSING'}</p>
              <p>API Key: {process.env.GEMINI_API_KEY ? 'OK' : 'MISSING'}</p>
              <p>Storage: {window.localStorage ? 'OK' : 'BLOCKED'}</p>
              <p>Screen: {window.innerWidth}x{window.innerHeight}</p>
              <p>Time: {new Date().toLocaleTimeString()}</p>
              <p>Version: 1.0.5</p>
              <p>Device: {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP'}</p>
              <p>Network: {(navigator as any).connection ? (navigator as any).connection.effectiveType : 'UNKNOWN'}</p>
              <p>Lang: {navigator.language}</p>
              <p>Ref: {document.referrer || 'DIRECT'}</p>
              <p>Host: {window.location.hostname}</p>
              <p>Proto: {window.location.protocol}</p>
              <p>Path: {window.location.pathname}</p>
              <p>Search: {window.location.search || 'NONE'}</p>
              <p>Hash: {window.location.hash || 'NONE'}</p>
              <p>Origin: {window.location.origin}</p>
              <p>Connection: {navigator.onLine ? 'CONNECTED' : 'DISCONNECTED'}</p>
              <p>Memory: {(performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB' : 'UNKNOWN'}</p>
              <p>CPU: {navigator.hardwareConcurrency || 'UNKNOWN'} cores</p>
              <p>Platform: {navigator.platform}</p>
              <p>Vendor: {navigator.vendor}</p>
              <p>Touch: {navigator.maxTouchPoints > 0 ? 'YES' : 'NO'}</p>
              <p>Orient: {window.screen.orientation ? window.screen.orientation.type : 'UNKNOWN'}</p>
              <p>Color: {window.screen.colorDepth}-bit</p>
              <p>DPR: {window.devicePixelRatio}</p>
              <p>PDF: {navigator.pdfViewerEnabled ? 'YES' : 'NO'}</p>
              <p>Java: {navigator.javaEnabled() ? 'YES' : 'NO'}</p>
              <p>DNT: {navigator.doNotTrack || 'UNSET'}</p>
              <p>SaveData: {(navigator as any).connection?.saveData ? 'YES' : 'NO'}</p>
              <p>SW: {'serviceWorker' in navigator ? 'YES' : 'NO'}</p>
              <p>Cache: {'caches' in window ? 'YES' : 'NO'}</p>
              <p>IDB: {'indexedDB' in window ? 'YES' : 'NO'}</p>
              <p>Crypto: {'crypto' in window ? 'YES' : 'NO'}</p>
              <p>Worker: {'Worker' in window ? 'YES' : 'NO'}</p>
              <p>Shared: {'SharedWorker' in window ? 'YES' : 'NO'}</p>
              <p>BC: {'BroadcastChannel' in window ? 'YES' : 'NO'}</p>
              <p>MC: {'MessageChannel' in window ? 'YES' : 'NO'}</p>
              <p>Fetch: {'fetch' in window ? 'YES' : 'NO'}</p>
              <p>XHR: {'XMLHttpRequest' in window ? 'YES' : 'NO'}</p>
              <p>WS: {'WebSocket' in window ? 'YES' : 'NO'}</p>
              <p>SSE: {'EventSource' in window ? 'YES' : 'NO'}</p>
              <p>RTC: {'RTCPeerConnection' in window ? 'YES' : 'NO'}</p>
              <p>MSE: {'MediaSource' in window ? 'YES' : 'NO'}</p>
              <p>Audio: {'AudioContext' in window ? 'YES' : 'NO'}</p>
              <p>Video: {!!document.createElement('video').canPlayType ? 'YES' : 'NO'}</p>
              <p>Canvas: {!!document.createElement('canvas').getContext ? 'YES' : 'NO'}</p>
              <p>WebGL: {!!document.createElement('canvas').getContext('webgl') ? 'YES' : 'NO'}</p>
              <p>WebGPU: {'gpu' in navigator ? 'YES' : 'NO'}</p>
              <p>WebXR: {'xr' in navigator ? 'YES' : 'NO'}</p>
              <p>Gamepad: {'getGamepads' in navigator ? 'YES' : 'NO'}</p>
              <p>Sensors: {'Sensor' in window ? 'YES' : 'NO'}</p>
              <p>Vibrate: {'vibrate' in navigator ? 'YES' : 'NO'}</p>
              <p>Share: {'share' in navigator ? 'YES' : 'NO'}</p>
              <p>Pay: {'PaymentRequest' in window ? 'YES' : 'NO'}</p>
              <p>WebAuthn: {'credentials' in navigator ? 'YES' : 'NO'}</p>
              <p>Push: {'PushManager' in window ? 'YES' : 'NO'}</p>
              <p>Sync: {'SyncManager' in window ? 'YES' : 'NO'}</p>
              <p>BFetch: {'BackgroundFetchManager' in window ? 'YES' : 'NO'}</p>
              <p>Badge: {'setAppBadge' in navigator ? 'YES' : 'NO'}</p>
              <p>Idle: {'IdleDetector' in window ? 'YES' : 'NO'}</p>
              <p>WakeLock: {'wakeLock' in navigator ? 'YES' : 'NO'}</p>
              <p>Fonts: {'queryLocalFonts' in window ? 'YES' : 'NO'}</p>
              <p>FS: {'showOpenFilePicker' in window ? 'YES' : 'NO'}</p>
              <p>Clip: {'clipboard' in navigator ? 'YES' : 'NO'}</p>
              <p>Contacts: {'contacts' in navigator ? 'YES' : 'NO'}</p>
              <p>SMS: {'sms' in navigator ? 'YES' : 'NO'}</p>
              <p>NFC: {'NDEFReader' in window ? 'YES' : 'NO'}</p>
              <p>USB: {'usb' in navigator ? 'YES' : 'NO'}</p>
              <p>BT: {'bluetooth' in navigator ? 'YES' : 'NO'}</p>
              <p>Serial: {'serial' in navigator ? 'YES' : 'NO'}</p>
              <p>HID: {'hid' in navigator ? 'YES' : 'NO'}</p>
              <p>Capture: {'getDisplayMedia' in navigator.mediaDevices ? 'YES' : 'NO'}</p>
              <p>Eye: {'EyeDropper' in window ? 'YES' : 'NO'}</p>
              <p>Shapes: {'BarcodeDetector' in window ? 'YES' : 'NO'}</p>
              <p>Speech: {'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? 'YES' : 'NO'}</p>
              <p>Synth: {'speechSynthesis' in window ? 'YES' : 'NO'}</p>
              <p>Lock: {'screen' in navigator && 'lockOrientation' in (navigator as any).screen ? 'YES' : 'NO'}</p>
              <p>Full: {document.fullscreenEnabled ? 'YES' : 'NO'}</p>
              <p>PIP: {document.pictureInPictureEnabled ? 'YES' : 'NO'}</p>
              <p>Remote: {'RemotePlayback' in window ? 'YES' : 'NO'}</p>
              <p>PrefersDark: {window.matchMedia('(prefers-color-scheme: dark)').matches ? 'YES' : 'NO'}</p>
              <p>ReducedMotion: {window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>ReducedData: {window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>HighContrast: {window.matchMedia('(prefers-contrast: more)').matches ? 'YES' : 'NO'}</p>
              <p>Inverted: {window.matchMedia('(inverted-colors: inverted)').matches ? 'YES' : 'NO'}</p>
              <p>Monochrome: {window.matchMedia('(monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>ForcedColors: {window.matchMedia('(forced-colors: active)').matches ? 'YES' : 'NO'}</p>
              <p>ReducedTransparency: {window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>DynamicColor: {window.matchMedia('(dynamic-range: high)').matches ? 'YES' : 'NO'}</p>
              <p>Scripting: {window.matchMedia('(scripting: enabled)').matches ? 'YES' : 'NO'}</p>
              <p>Hover: {window.matchMedia('(hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>Pointer: {window.matchMedia('(pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>Scan: {window.matchMedia('(scan: interlace)').matches ? 'INTERLACE' : 'PROGRESSIVE'}</p>
              <p>Update: {window.matchMedia('(update: slow)').matches ? 'SLOW' : 'FAST'}</p>
              <p>Light: {window.matchMedia('(light-level: dim)').matches ? 'DIM' : 'NORMAL'}</p>
              <p>Script: {window.matchMedia('(scripting: initial-only)').matches ? 'INITIAL' : 'ENABLED'}</p>
              <p>Gamut: {window.matchMedia('(color-gamut: p3)').matches ? 'P3' : 'SRGB'}</p>
              <p>Data: {window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'REDUCED' : 'NORMAL'}</p>
              <p>Contrast: {window.matchMedia('(prefers-contrast: more)').matches ? 'HIGH' : 'NORMAL'}</p>
              <p>Transp: {window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'REDUCED' : 'NORMAL'}</p>
              <p>Motion: {window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'REDUCED' : 'NORMAL'}</p>
              <p>Scheme: {window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT'}</p>
              <p>Invert: {window.matchMedia('(inverted-colors: inverted)').matches ? 'YES' : 'NO'}</p>
              <p>Forced: {window.matchMedia('(forced-colors: active)').matches ? 'YES' : 'NO'}</p>
              <p>Mono: {window.matchMedia('(monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Gamut: {window.matchMedia('(color-gamut: p3)').matches ? 'P3' : 'SRGB'}</p>
              <p>Range: {window.matchMedia('(dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>VideoRange: {window.matchMedia('(video-dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>Scripting: {window.matchMedia('(scripting: enabled)').matches ? 'YES' : 'NO'}</p>
              <p>Hover: {window.matchMedia('(hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>Pointer: {window.matchMedia('(pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>AnyHover: {window.matchMedia('(any-hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>AnyPointer: {window.matchMedia('(any-pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>Orient: {window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'}</p>
              <p>Aspect: {window.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'WIDE' : 'TALL'}</p>
              <p>Grid: {window.matchMedia('(grid: 0)').matches ? 'BITMAP' : 'GRID'}</p>
              <p>Res: {window.matchMedia('(min-resolution: 2dppx)').matches ? 'HIGH' : 'LOW'}</p>
              <p>Color: {window.matchMedia('(min-color: 8)').matches ? 'YES' : 'NO'}</p>
              <p>Index: {window.matchMedia('(min-color-index: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Mono: {window.matchMedia('(min-monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Forced: {window.matchMedia('(forced-colors: active)').matches ? 'YES' : 'NO'}</p>
              <p>Transp: {window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Contrast: {window.matchMedia('(prefers-contrast: more)').matches ? 'YES' : 'NO'}</p>
              <p>Data: {window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Gamut: {window.matchMedia('(color-gamut: p3)').matches ? 'P3' : 'SRGB'}</p>
              <p>Range: {window.matchMedia('(dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>VideoRange: {window.matchMedia('(video-dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>Scripting: {window.matchMedia('(scripting: enabled)').matches ? 'YES' : 'NO'}</p>
              <p>Hover: {window.matchMedia('(hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>Pointer: {window.matchMedia('(pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>AnyHover: {window.matchMedia('(any-hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>AnyPointer: {window.matchMedia('(any-pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>Orient: {window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'}</p>
              <p>Aspect: {window.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'WIDE' : 'TALL'}</p>
              <p>Grid: {window.matchMedia('(grid: 0)').matches ? 'BITMAP' : 'GRID'}</p>
              <p>Res: {window.matchMedia('(min-resolution: 2dppx)').matches ? 'HIGH' : 'LOW'}</p>
              <p>Color: {window.matchMedia('(min-color: 8)').matches ? 'YES' : 'NO'}</p>
              <p>Index: {window.matchMedia('(min-color-index: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Mono: {window.matchMedia('(min-monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Forced: {window.matchMedia('(forced-colors: active)').matches ? 'YES' : 'NO'}</p>
              <p>Transp: {window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Contrast: {window.matchMedia('(prefers-contrast: more)').matches ? 'YES' : 'NO'}</p>
              <p>Data: {window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Gamut: {window.matchMedia('(color-gamut: p3)').matches ? 'P3' : 'SRGB'}</p>
              <p>Range: {window.matchMedia('(dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>VideoRange: {window.matchMedia('(video-dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>Scripting: {window.matchMedia('(scripting: enabled)').matches ? 'YES' : 'NO'}</p>
              <p>Hover: {window.matchMedia('(hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>Pointer: {window.matchMedia('(pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>AnyHover: {window.matchMedia('(any-hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>AnyPointer: {window.matchMedia('(any-pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>Orient: {window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'}</p>
              <p>Aspect: {window.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'WIDE' : 'TALL'}</p>
              <p>Grid: {window.matchMedia('(grid: 0)').matches ? 'BITMAP' : 'GRID'}</p>
              <p>Res: {window.matchMedia('(min-resolution: 2dppx)').matches ? 'HIGH' : 'LOW'}</p>
              <p>Color: {window.matchMedia('(min-color: 8)').matches ? 'YES' : 'NO'}</p>
              <p>Index: {window.matchMedia('(min-color-index: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Mono: {window.matchMedia('(min-monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Forced: {window.matchMedia('(forced-colors: active)').matches ? 'YES' : 'NO'}</p>
              <p>Transp: {window.matchMedia('(prefers-reduced-transparency: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Contrast: {window.matchMedia('(prefers-contrast: more)').matches ? 'YES' : 'NO'}</p>
              <p>Data: {window.matchMedia('(prefers-reduced-data: reduce)').matches ? 'YES' : 'NO'}</p>
              <p>Gamut: {window.matchMedia('(color-gamut: p3)').matches ? 'P3' : 'SRGB'}</p>
              <p>Range: {window.matchMedia('(dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>VideoRange: {window.matchMedia('(video-dynamic-range: high)').matches ? 'HIGH' : 'STANDARD'}</p>
              <p>Scripting: {window.matchMedia('(scripting: enabled)').matches ? 'YES' : 'NO'}</p>
              <p>Hover: {window.matchMedia('(hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>Pointer: {window.matchMedia('(pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>AnyHover: {window.matchMedia('(any-hover: hover)').matches ? 'YES' : 'NO'}</p>
              <p>AnyPointer: {window.matchMedia('(any-pointer: fine)').matches ? 'FINE' : 'COARSE'}</p>
              <p>Orient: {window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'}</p>
              <p>Aspect: {window.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'WIDE' : 'TALL'}</p>
              <p>Grid: {window.matchMedia('(grid: 0)').matches ? 'BITMAP' : 'GRID'}</p>
              <p>Res: {window.matchMedia('(min-resolution: 2dppx)').matches ? 'HIGH' : 'LOW'}</p>
              <p>Color: {window.matchMedia('(min-color: 8)').matches ? 'YES' : 'NO'}</p>
              <p>Index: {window.matchMedia('(min-color-index: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Mono: {window.matchMedia('(min-monochrome: 1)').matches ? 'YES' : 'NO'}</p>
              <p>Firebase Config: {firebaseConfig.projectId ? 'OK' : 'MISSING'}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );

  if (!user) return <Login />;
  if (profile && !profile.onboardingComplete) return <Onboarding profile={profile} />;
  if (!profile) return <Login />; 

  const isTrialExpired = () => {
    // OWNER BYPASS - Sempre permitir acesso ao dono
    const ownerEmail = "ageumiranda00@gmail.com";
    if (user?.email?.toLowerCase() === ownerEmail || profile?.email?.toLowerCase() === ownerEmail) {
      return false;
    }
    
    if (profile?.isPremium) return false;
    
    const now = new Date();
    const trialDate = profile?.trialUntil ? new Date(profile.trialUntil) : null;
    
    if (!trialDate) {
      // Fallback para createdAt se trialUntil não existir
      if (!profile?.createdAt) return false;
      const createdDate = new Date(profile.createdAt);
      const diffTime = now.getTime() - createdDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 3;
    }
    
    return now > trialDate;
  };

  if (isTrialExpired()) return <TrialExpired profile={profile} />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative overflow-x-hidden selection:bg-brand-100 selection:text-brand-900">
        {/* Indicador de Conexão */}
        <div className={cn(
          "fixed top-2 left-1/2 -translate-x-1/2 z-[90] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition-colors duration-300 backdrop-blur-md",
          isOnline ? "bg-emerald-100/80 text-emerald-700 border border-emerald-200/50" : "bg-red-100/80 text-red-700 border border-red-200/50"
        )}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {apiKeyMissing && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-3 text-[10px] font-black uppercase tracking-widest text-center shadow-xl">
            Atenção: Chave de API da IA não configurada no ambiente.
          </div>
        )}
        <main className={cn("p-6", apiKeyMissing && "pt-16")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {activeTab === 'dash' && <Dashboard profile={profile} weightData={weightData} meals={meals} workouts={workouts} setActiveTab={setActiveTab} />}
              {activeTab === 'coach' && <Coach profile={profile} meals={meals} workouts={workouts} />}
              {activeTab === 'recipes' && <RecipeSuggestionsView profile={profile} />}
              {activeTab === 'meals' && <MealLogView profile={profile} meals={meals} templates={templates} />}
              {activeTab === 'workouts' && <WorkoutView profile={profile} workouts={workouts} />}
              {activeTab === 'profile' && <Profile profile={profile} weightData={weightData} meals={meals} workouts={workouts} />}
              {activeTab === 'admin' && profile.role === 'admin' && <AdminPanel profile={profile} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-xl border-t border-slate-100 px-4 py-6 flex justify-between items-center shadow-premium rounded-t-[40px] z-40">
          <button 
            onClick={() => setActiveTab('dash')}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-90", activeTab === 'dash' ? "text-brand-600" : "text-slate-400")}
          >
            <LayoutDashboard className={cn("w-6 h-6 transition-transform", activeTab === 'dash' && "scale-110")} />
            <span className="text-[9px] font-black uppercase tracking-widest">Início</span>
          </button>
          <button 
            onClick={() => setActiveTab('coach')}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-90", activeTab === 'coach' ? "text-brand-600" : "text-slate-400")}
          >
            <MessageCircle className={cn("w-6 h-6 transition-transform", activeTab === 'coach' && "scale-110")} />
            <span className="text-[9px] font-black uppercase tracking-widest">Coach</span>
          </button>
          
          <div className="relative -top-10">
            <button 
              onClick={() => setActiveTab('meals')}
              className="w-16 h-16 bg-brand-600 rounded-[24px] flex items-center justify-center shadow-xl shadow-brand-200 border-4 border-slate-50 active:scale-90 transition-all group"
            >
              <Plus className="text-white w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('recipes')}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-90", activeTab === 'recipes' ? "text-brand-600" : "text-slate-400")}
          >
            <ChefHat className={cn("w-6 h-6 transition-transform", activeTab === 'recipes' && "scale-110")} />
            <span className="text-[9px] font-black uppercase tracking-widest">Receitas</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-90", activeTab === 'profile' ? "text-brand-600" : "text-slate-400")}
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className={cn("w-6 h-6 rounded-full object-cover transition-transform border-2", activeTab === 'profile' ? "border-brand-600" : "border-transparent")} />
            ) : (
              <UserIcon className={cn("w-6 h-6 transition-transform", activeTab === 'profile' && "scale-110")} />
            )}
            <span className="text-[9px] font-black uppercase tracking-widest">Perfil</span>
          </button>

          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-90", activeTab === 'admin' ? "text-brand-600" : "text-slate-400")}
            >
              <Settings className={cn("w-6 h-6 transition-transform", activeTab === 'admin' && "scale-110")} />
              <span className="text-[9px] font-black uppercase tracking-widest">Admin</span>
            </button>
          )}
        </nav>
      </div>
    </ErrorBoundary>
  );
}
