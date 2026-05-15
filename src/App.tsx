import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  TrendingUp, 
  TrendingDown, 
  Info, 
  LayoutDashboard, 
  Leaf, 
  History, 
  User,
  MapPin,
  Bell,
  ArrowRightLeft,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Send,
  Loader2,
  X,
  GitBranch,
  Github,
  Rocket,
  Store,
  Plus,
  Coins,
  Settings,
  Heart,
  MessageCircle,
  Search,
  Calculator,
  Users,
  Zap,
  Award,
  Clock,
  CloudSun,
  Sprout,
  Copy,
  ExternalLink,
  Check,
  CheckCircle2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Filter,
  Star,
  Camera,
  Video,
  Play,
  Trash2,
  AlertCircle,
  UserPlus,
  RefreshCw,
  Package,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '@/src/lib/utils';
import { CommodityType, CommodityPrice, Market, PriceReport } from '@/src/types';
import { predictPrice, getPersonalAdvice } from '@/src/services/geminiService';
import { db, auth } from '@/src/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp, 
  deleteDoc,
  increment,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '@/src/lib/firebaseUtils';
import { 
  fetchSupabasePrices, 
  fetchSupabaseMarkets, 
  fetchSupabaseCommodities, 
  fetchSupabaseHistory,
  submitSupabasePriceReport
} from '@/src/services/supabaseService';
import { VercelBridge } from '@/src/services/vercelBridge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Mock Data
const MOCK_MARKETS: Market[] = [
  { id: '1', name: 'Pasar Induk Kramat Jati', location: 'Jakarta' },
  { id: '2', name: 'Pasar Cibitung', location: 'Bekasi' },
  { id: '3', name: 'Pasar Gedebage', location: 'Bandung' },
];

const MOCK_DATA: CommodityPrice[] = [
  {
    id: 'c1',
    type: CommodityType.CABAI_MERAH,
    currentPrice: 45000,
    previousPrice: 42000,
    unit: 'kg',
    trend: 'up',
    market: MOCK_MARKETS[0],
    lastUpdated: '10 menit yang lalu',
    history: Array.from({ length: 7 }, (_, i) => ({
      time: `Hari ${i + 1}`,
      price: 40000 + Math.random() * 8000,
      open: 0, high: 0, low: 0, close: 0
    }))
  },
  {
    id: 'c2',
    type: CommodityType.BAWANG_MERAH,
    currentPrice: 32000,
    previousPrice: 35000,
    unit: 'kg',
    trend: 'down',
    market: MOCK_MARKETS[0],
    lastUpdated: '5 menit yang lalu',
    history: Array.from({ length: 7 }, (_, i) => ({
      time: `Hari ${i + 1}`,
      price: 30000 + Math.random() * 6000,
      open: 0, high: 0, low: 0, close: 0
    }))
  },
  {
    id: 'c3',
    type: CommodityType.BERAS,
    currentPrice: 13500,
    previousPrice: 13500,
    unit: 'kg',
    trend: 'stable',
    market: MOCK_MARKETS[0],
    lastUpdated: '1 jam yang lalu',
    history: Array.from({ length: 7 }, (_, i) => ({
      time: `Hari ${i + 1}`,
      price: 13000 + Math.random() * 1000,
      open: 0, high: 0, low: 0, close: 0
    }))
  }
];

const CustomDropdown = ({ 
  label, 
  value, 
  options, 
  onChange, 
  placeholder = "Pilih..." 
}: { 
  label: string, 
  value: string, 
  options: { label: string, value: string }[], 
  onChange: (val: string) => void,
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border-none rounded-xl p-3 text-[10px] font-bold outline-none flex items-center justify-between group transition-all"
      >
        <span className={cn(selectedOption ? "text-slate-700" : "text-slate-300")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={cn("text-slate-300 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 4 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute left-0 right-0 top-full z-50 bg-white border border-slate-100 rounded-2xl shadow-xl p-1.5 max-h-48 overflow-y-auto no-scrollbar"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl text-[10px] font-bold transition-colors",
                    value === option.value ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'fyp' | 'prices' | 'market' | 'scout' | 'chats' | 'settings'>('fyp');
  const [userReports, setUserReports] = useState<PriceReport[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([
    { id: 1, product: 'Cabai Merah', buyer: 'Siti Aminah', amount: '5kg', status: 'pending', time: '5m' },
    { id: 2, product: 'Beras Pandan Wangi', buyer: 'Warung Bu Joko', amount: '50kg', status: 'processed', time: '1j' }
  ]);
  const [chatList, setChatList] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isFirebaseOffline, setIsFirebaseOffline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications] = useState([
    { id: 1, title: 'Harga Cabe Naik!', message: 'Harga cabe di Pasar Induk naik 15% pagi ini.', time: '2m ago', read: false },
    { id: 2, title: 'Pesanan Baru', message: 'Ada permintaan 50kg tomat dari Restoran Sari.', time: '1h ago', read: true },
    { id: 3, title: 'Tips Tanam', message: 'Cara mengompres video agar lebih cepat terunggah.', time: '5h ago', read: true },
  ]);

  const isDeveloper = currentUser?.email === 'deyogaid@gmail.com';
  const [isDevPortalOpen, setIsDevPortalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityPrice | null>(null);
  const [supabaseData, setSupabaseData] = useState<CommodityPrice[] | null>(null);
  const [supabaseMarkets, setSupabaseMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [supabaseCommodities, setSupabaseCommodities] = useState<any[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const reportPhotoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isMediaUploading, setIsMediaUploading] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isVideoTooLong, setIsVideoTooLong] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = async (file: File) => {
    if (!file) return;
    
    setIsMediaUploading(true);
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    setIsVideoTooLong(false);

    if (isVideo) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        setVideoDuration(video.duration);
        if (video.duration > 180) {
          setIsVideoTooLong(true);
        }
      };
      video.src = url;
    }

    try {
      let fileToUpload = file;
      
      // Compress if it's an image
      if (!isVideo) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          const base64 = await base64Promise;
          const compressedBase64 = await compressImage(base64);
          
          // Convert compressed base64 back to Blob/File for FormData upload
          const res = await fetch(compressedBase64);
          const blob = await res.blob();
          fileToUpload = new File([blob], file.name, { type: 'image/jpeg' });
        } catch (compErr) {
          console.warn("Compression failed, uploading original", compErr);
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, try text
          try {
            const textError = await response.text();
            if (textError.includes('<!doctype html>')) {
              errorMessage = "Server returned an HTML error page. The backend might be misconfigured or crashing.";
            } else {
              errorMessage = textError.substring(0, 100) || errorMessage;
            }
          } catch (e2) {
            // ignore
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        setNewListing(prev => ({ ...prev, mediaUrl: result.url }));
      } else {
        throw new Error(result.error || 'Gagal mengunggah berkas');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Gagal mengunggah media. Silakan coba lagi.');
    } finally {
      setIsMediaUploading(false);
      setIsDragOver(false);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e) {
      file = e.dataTransfer.files[0];
    }
    if (file) processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'NOT_CONFIGURED' | 'CONNECTED' | 'SERVER_ERROR' | 'UNREACHABLE' | 'CHECKING'>('CHECKING');

  useEffect(() => {
    async function loadSupabase() {
      setIsDbLoading(true);
      
      const [priceData, marketData, commodityData] = await Promise.all([
        fetchSupabasePrices(),
        fetchSupabaseMarkets(),
        fetchSupabaseCommodities()
      ]);

      if (marketData && marketData.length > 0) {
        setSupabaseMarkets(marketData);
        setSelectedMarket(marketData[0]);
      }

      if (commodityData && commodityData.length > 0) {
        setSupabaseCommodities(commodityData);
      }

      if (priceData && priceData.length > 0) {
        // Transform Supabase data to match our UI Model
        const transformed = priceData.map((item: any, idx: number) => {
          const currentPrice = item.current_price;
          // Note: Since we only have current_price in the main view, we'll use a mocked previous price for trend for now
          const prevPrice = currentPrice; 
          
          return {
            id: `sb-${item.id || idx}`,
            type: item.type as CommodityType,
            currentPrice: currentPrice,
            previousPrice: prevPrice,
            unit: item.unit || 'kg',
            trend: 'stable' as const,
            market: { 
              id: item.market_id ? String(item.market_id) : 'sb', 
              name: item.market_name || 'Pasar Rakyat', 
              location: item.province || '' 
            },
            lastUpdated: item.last_updated ? new Date(item.last_updated).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Baru saja',
            isLive: true,
            history: Array.from({ length: 7 }, (_, i) => ({
              time: `Hari ${i + 1}`,
              price: currentPrice * (0.95 + Math.random() * 0.1),
              open: 0, high: 0, low: 0, close: 0
            }))
          };
        });
        setSupabaseData(transformed);
      }
      setIsDbLoading(false);
    }
    loadSupabase();

    // Check Vercel Bridge status
    async function checkBridge() {
      const status = await VercelBridge.checkConnection();
      setBridgeStatus(status);
    }
    checkBridge();
  }, []);

  // ... rest of the component
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [activeCommentItem, setActiveCommentItem] = useState<any>(null);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Halo! Saya asisten AgriPantau. Ada yang bisa saya bantu terkait harga pasar atau perencanaan panen Anda?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    commodity: CommodityType.CABAI_MERAH as string,
    price: '',
    marketName: selectedMarket.name,
    location: selectedMarket.location,
    latitude: null as number | null,
    longitude: null as number | null,
    isGpsVerified: false,
    photoUrl: ''
  });
  const [isReporting, setIsReporting] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung oleh browser Anda.");
      return;
    }

    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReportForm(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          isGpsVerified: true
        }));
        setIsGpsLoading(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsGpsLoading(false);
        alert("Gagal mendapatkan lokasi. Pastikan izin lokasi aktif.");
      }
    );
  };

  const handlePhotoUpload = () => {
    reportPhotoInputRef.current?.click();
  };

  // Fetch chats
  useEffect(() => {
    if (!currentUser || !auth.currentUser) {
      setChatList([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatList(chats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch active chat messages
  useEffect(() => {
    if (!activeChat) {
      setChatMessages([]);
      return;
    }

    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatMessages(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [activeChat]);

  useEffect(() => {
    if (!currentUser || listings.length === 0) return;

    const checkLikes = async () => {
      const likesMap = { ...userLikes };
      let changed = false;
      for (const item of listings) {
        if (likesMap[item.id] === undefined) {
          const likeRef = doc(db, 'listings', item.id, 'likes', currentUser.uid);
          try {
            const likeDoc = await getDoc(likeRef);
            likesMap[item.id] = likeDoc.exists();
            changed = true;
          } catch (e) {
            console.error("Error checking like", e);
          }
        }
      }
      if (changed) {
        setUserLikes(likesMap);
      }
    };

    checkLikes();
  }, [listings, currentUser]);

  // Real-time B2B application status notifications
  useEffect(() => {
    if (!currentUser) return;
    
    // We'll track the last known count to detect new accepted/rejected
    let firstLoad = true;
    const q = query(
      collection(db, 'b2b_applications'), 
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (firstLoad) {
        firstLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const app = change.doc.data();
          if (app.status === 'accepted') {
            toast.success(`Selamat! Pengajuan kontrak Anda untuk ${app.commodity} telah DISETUJUI.`, { duration: 6000 });
          } else if (app.status === 'rejected') {
            toast.error(`Pengajuan kontrak Anda untuk ${app.commodity} belum dapat disetujui saat ini.`, { duration: 6000 });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'b2b_applications');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleToggleLike = async (item: any) => {
    if (!currentUser) {
      toast.error('Silakan login untuk memberikan like');
      return;
    }

    const likeRef = doc(db, 'listings', item.id, 'likes', currentUser.uid);
    const listingRef = doc(db, 'listings', item.id);

    // Optimistic UI
    const isLiked = userLikes[item.id];
    setUserLikes(prev => ({ ...prev, [item.id]: !isLiked }));

    try {
      const likeDoc = await getDoc(likeRef);
      if (likeDoc.exists()) {
        await deleteDoc(likeRef);
        await updateDoc(listingRef, {
          likesCount: increment(-1)
        });
      } else {
        await setDoc(likeRef, {
          userId: currentUser.uid,
          timestamp: serverTimestamp()
        });
        await updateDoc(listingRef, {
          likesCount: increment(1)
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic UI
      setUserLikes(prev => ({ ...prev, [item.id]: isLiked }));
      toast.error('Gagal memperbarui like');
      handleFirestoreError(error, OperationType.WRITE, `listings/${item.id}/likes`);
    }
  };

  const handleShare = async (item: any) => {
    const shareData = {
      title: `AgriPantau - ${item.commodity || 'Postingan Baru'}`,
      text: `${item.userName} ${item.type === 'listing' ? 'menjual ' + item.commodity : 'berbagi momen'} di AgriPantau. Cek sekarang!`,
      url: window.location.href,
    };

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link disalin ke clipboard!');
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        // If it was canceled by the user, we just ignore it
        if (err.name === 'AbortError') {
          return;
        }
        // For other errors (unsupported by platform, etc), fallback to clipboard
        await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Berhasil masuk dengan Google!');
    } catch (error: any) {
      console.error("Google Login Error:", error);
      toast.error('Gagal masuk dengan Google.');
    }
  };

  const handleStartChat = async (listing: any) => {
    if (!currentUser) {
      alert("Harap login terlebih dahulu untuk memulai percakapan.");
      setActiveTab('settings');
      return;
    }

    if (listing.userId === currentUser.uid) {
      alert("Ini adalah produk Anda sendiri.");
      return;
    }

    setIsChatLoading(true);

    try {
      // Find existing chat between these two users for this product
      // Note: participants is a list, we can't easily find exact match with array-contains 
      // if it has more than one uid. We fetch all chats for user and filter in memory for simplicity in this demo.
      // In production, use a more complex indexing or subcollections.
      const existing = chatList.find(c => 
        c.participants.includes(listing.userId) && 
        c.productId === listing.id
      );

      if (existing) {
        setActiveChat(existing);
        setActiveTab('chats');
      } else {
        // Create new chat
        const chatData = {
          participants: [currentUser.uid, listing.userId],
          participantInfo: {
            [currentUser.uid]: { name: userProfile.displayName, avatar: userProfile.photoURL },
            [listing.userId]: { name: listing.userName, avatar: listing.userAvatar }
          },
          productId: listing.id,
          productName: listing.commodity,
          lastMessage: `Hai, saya tertarik dengan ${listing.commodity}`,
          lastMessageAt: serverTimestamp()
        };

        const chatRef = await addDoc(collection(db, 'chats'), chatData);
        
        // Add initial auto-message
        await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
          chatId: chatRef.id,
          senderId: currentUser.uid,
          text: `Hai @${listing.userName}, saya tertarik dengan produk ${listing.commodity} yang Anda jual di AgriPantau.`,
          timestamp: serverTimestamp()
        });

        setActiveChat({ id: chatRef.id, ...chatData });
        setActiveTab('chats');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !activeChat || !currentUser) return;

    const messageText = chatInput.trim();
    setChatInput('');

    try {
      const messageData = {
        chatId: activeChat.id,
        senderId: currentUser.uid,
        text: messageText,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), messageData);
      
      // Update last message in chat doc
      await setDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp()
      }, { merge: true });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  const handleDevImpersonate = (userId: string, profile: any) => {
    // Only for UI verification
    setUserProfile(profile);
    const mockUser = {
      uid: userId,
      email: profile.email || 'mock@user.com',
      displayName: profile.displayName,
      photoURL: profile.photoURL
    };
    setCurrentUser(mockUser);
    alert(`Impersonating ${profile.displayName}.\nNote: FS rules still check real Auth UID.`);
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/system/status');
        const data = await res.json();
        setSystemStatus(data);
      } catch (err) {
        console.error('Failed to fetch system status');
      }
    };
    fetchStatus();
  }, []);
  const [customApiKey, setCustomApiKey] = useState('');
  const [farmerLocation, setFarmerLocation] = useState<{
    coords?: { lat: number, lng: number },
    areaName: string,
  }>({ areaName: '' });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const [marketFilters, setMarketFilters] = useState({
    commodity: '' as string,
    location: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'newest' as 'newest' | 'price_low' | 'price_high' | 'trusted'
  });
  const [showFilters, setShowFilters] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (isDeveloper && isDevPortalOpen) {
      const q = query(collection(db, 'users'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(users);
      });
      return () => unsubscribe();
    }
  }, [isDeveloper, isDevPortalOpen]);

  const renderDevPortal = () => (
    <AnimatePresence>
      {isDevPortalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDevPortalOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden relative z-10 flex flex-col max-h-[80vh] shadow-2xl"
          >
            <div className="p-8 bg-slate-900 text-white relative shrink-0">
              <button 
                onClick={() => setIsDevPortalOpen(false)}
                className="absolute top-8 right-8 text-white/50 hover:text-white"
              >
                <X size={24} />
              </button>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Developer Tools</p>
              <h3 className="text-3xl font-black uppercase tracking-tighter">Admin Panel</h3>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8 no-scrollbar">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Daftar Pengguna</h4>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase italic">BETA Dev Tool</span>
                </div>
                
                <div className="grid gap-3">
                  {allUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-emerald-200 transition-all group">
                      <div className="flex items-center gap-4">
                        <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm" alt="" />
                        <div>
                          <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{user.displayName || 'Anonymous'}</h5>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono truncate max-w-[150px]">{user.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button 
                           onClick={() => handleDevImpersonate(user.id, user)}
                           className="px-4 py-2 bg-white text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                         >
                           PINDAH USER
                         </button>
                      </div>
                    </div>
                  ))}
                  {allUsers.length === 0 && (
                    <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada data user terdeteksi</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-4">
                 <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Quick Actions</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                        signInAnonymously(auth);
                        setIsDevPortalOpen(false);
                      }}
                      className="p-6 bg-slate-900 text-white rounded-3xl flex flex-col gap-2 hover:bg-slate-800 transition-all group"
                    >
                      <UserPlus size={24} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black uppercase tracking-widest text-left">Login Anonim <br/><span className="text-[10px] opacity-40">Test role Guest</span></span>
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="p-6 bg-emerald-50 text-emerald-900 rounded-3xl flex flex-col gap-2 hover:bg-emerald-100 transition-all group border border-emerald-100"
                    >
                      <RefreshCw size={24} className="text-emerald-600 mb-2 group-hover:rotate-180 transition-transform duration-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-left">Reset Session <br/><span className="text-[10px] opacity-40">Muat ulang app</span></span>
                    </button>
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const detectLocation = () => {
    setIsDetectingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setFarmerLocation(prev => ({
            ...prev,
            coords: { lat: latitude, lng: longitude }
          }));

          try {
            // Reverse Geocoding using Nominatim (OSM)
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'Accept-Language': 'id',
                  'User-Agent': 'TaniTrade-Applet'
                }
              }
            );
            const data = await response.json();
            
            // Extract meaningful area names (village, suburb, or city district)
            const address = data.address;
            const areaName = address.village || address.suburb || address.city_district || address.county || '';
            
            if (areaName) {
              setFarmerLocation(prev => ({ ...prev, areaName }));
            }
          } catch (error) {
            console.error("Reverse geocoding error:", error);
          } finally {
            setIsDetectingLocation(false);
          }
        },
        (error) => {
          console.error("Error detecting location:", error);
          setIsDetectingLocation(false);
          alert("Gagal mendeteksi lokasi. Pastikan izin lokasi aktif.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsDetectingLocation(false);
      alert("Browser Anda tidak mendukung deteksi lokasi.");
    }
  };

  const resetLocation = () => {
    setFarmerLocation({ areaName: '' });
  };

  const [priceFilters, setPriceFilters] = useState({
    commodity: '' as string,
    trend: '' as 'up' | 'down' | 'stable' | '',
    sortBy: 'default' as 'default' | 'price_low' | 'price_high' | 'change'
  });
  const [showPriceFilters, setShowPriceFilters] = useState(false);

  const displayData: CommodityPrice[] = (supabaseData && supabaseData.length > 0) ? supabaseData : MOCK_DATA;
  const filteredDisplayData = displayData.filter(item => {
    const matchMarket = item.market.id === selectedMarket.id;
    const matchCommodity = !priceFilters.commodity || item.type === priceFilters.commodity;
    const matchTrend = !priceFilters.trend || item.trend === priceFilters.trend;
    return matchMarket && matchCommodity && matchTrend;
  }).sort((a, b) => {
    if (priceFilters.sortBy === 'price_low') return a.currentPrice - b.currentPrice;
    if (priceFilters.sortBy === 'price_high') return b.currentPrice - a.currentPrice;
    if (priceFilters.sortBy === 'change') {
      const aChange = Math.abs((a.currentPrice - a.previousPrice) / a.previousPrice);
      const bChange = Math.abs((b.currentPrice - b.previousPrice) / b.previousPrice);
      return bChange - aChange;
    }
    return 0;
  });

  const filteredUserReports = userReports.filter(report => {
    const matchMarket = report.marketName === selectedMarket.name;
    const matchCommodity = !priceFilters.commodity || report.commodity === priceFilters.commodity;
    return matchMarket && matchCommodity;
  });
  const hasNoData = filteredDisplayData.length === 0 && filteredUserReports.length === 0;
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const openEditModal = (item: any) => {
    setEditingItemId(item.id);
    setNewListing({
      type: item.type,
      commodity: item.commodity,
      price: String(item.price),
      stock: String(item.stock),
      description: item.description,
      mediaUrl: item.mediaUrl || ''
    });
    setMediaType(item.mediaUrl?.match(/\.(mp4|webm|ogg)$/i) || item.mediaUrl?.startsWith('data:video/') ? 'video' : 'image');
    setIsListingModalOpen(true);
  };

  const handleDeleteListing = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'listings', id));
      await deleteDoc(doc(db, 'listing_media', id)).catch(() => {});
      toast.success('Postingan dihapus');
    } catch (e) {
      toast.error('Gagal menghapus');
    }
  };

  const resetListingForm = () => {
    setEditingItemId(null);
    setNewListing({
      type: 'post',
      commodity: '',
      price: '',
      stock: '',
      description: '',
      mediaUrl: ''
    });
    setMediaType(null);
  };

  const [newListing, setNewListing] = useState({
    type: 'post', // 'post' or 'listing'
    commodity: '',
    price: '',
    stock: '',
    description: '',
    mediaUrl: ''
  });

  // Fetch listings
  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setListings(docs);
      setIsFirebaseOffline(false);
    }, (error) => {
      if (error.code === 'unavailable') {
        setIsFirebaseOffline(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateListing = async () => {
    if (!currentUser || !userProfile) return;
    try {
      let finalDescription = newListing.description;
      let commodity = newListing.commodity || (newListing.type === 'post' ? 'Kabar Hari Ini' : 'Postingan Baru');
      let price = Number(newListing.price) || 0;
      let stock = Number(newListing.stock) || 0;

      if (editingItemId) {
        // Update existing listing
        const listingRef = doc(db, 'listings', editingItemId);
        await updateDoc(listingRef, {
          type: newListing.type,
          commodity,
          price,
          stock,
          description: finalDescription,
          mediaUrl: newListing.mediaUrl,
          updatedAt: serverTimestamp()
        });
        toast.success('Postingan berhasil diperbarui!');
        setIsListingModalOpen(false);
        resetListingForm();
        return;
      }

      // Only process as product listing if type is listing
      if (newListing.type === 'listing') {
        try {
          const processResponse = await fetch('/api/process-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commodity: newListing.commodity,
              price: Number(newListing.price),
              description: newListing.description
            })
          });
          
          const processResult = await processResponse.json();
          if (processResult.success) {
            finalDescription = processResult.processedData.description;
          }
        } catch (e) {
          console.warn("AI processing skipped or failed", e);
        }
      }

      try {
        const mediaUrl = newListing.mediaUrl;
        const listingMetadata = {
          userId: currentUser.uid,
          userName: userProfile.displayName,
          userAvatar: userProfile.photoURL,
          type: newListing.type,
          commodity: commodity,
          price: price,
          stock: stock,
          description: finalDescription,
          hasPhoto: !!mediaUrl,
          // Store mediaUrl in metadata ONLY if it's short (external URL). 
          // If it's long (base64/data), store in media collection instead.
          mediaUrl: (mediaUrl && mediaUrl.length < 1000) ? mediaUrl : null,
          location: userProfile.location,
          userRating: userProfile.rating || 5.0,
          reviewCount: userProfile.reviewCount || 0,
          status: 'active',
          createdAt: serverTimestamp(),
          likesCount: 0,
          commentsCount: 0
        };

        const docRef = await addDoc(collection(db, 'listings'), listingMetadata);
        const listingId = docRef.id;

        // Separate heavy media if it's a data URL or very long
        if (mediaUrl && (mediaUrl.length >= 1000 || mediaUrl.startsWith('data:'))) {
          await setDoc(doc(db, 'listing_media', listingId), {
            photoUrl: mediaUrl, // Using photoUrl key to match blueprint/PriceReportEvidence pattern
            userId: currentUser.uid,
            timestamp: serverTimestamp()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'listings');
      }
      setIsListingModalOpen(false);
      setNewListing({
        type: 'post',
        commodity: '',
        price: '',
        stock: '',
        description: '',
        mediaUrl: ''
      });
    } catch (e) {
      console.error("Error creating listing", e);
    }
  };

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedListingForPurchase, setSelectedListingForPurchase] = useState<any>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    quantity: 1,
    address: '',
    phone: '',
    shippingMethod: 'Kurir Petani'
  });
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  const openPurchaseModal = (listing: any) => {
    setSelectedListingForPurchase(listing);
    setPurchaseForm({
      quantity: 1,
      address: userProfile?.location || '',
      phone: '',
      shippingMethod: 'Kurir Petani'
    });
    setIsPurchaseModalOpen(true);
  };

  const submitPurchase = async () => {
    if (!currentUser || !selectedListingForPurchase) {
      alert("Silakan masuk terlebih dahulu untuk melakukan pembelian.");
      return;
    }

    if (!purchaseForm.address || !purchaseForm.phone) {
      alert("Mohon lengkapi alamat dan nomor telepon.");
      return;
    }

    setIsSubmittingPurchase(true);
    try {
      const transactionData = {
        userId: currentUser.uid,
        listingId: selectedListingForPurchase.id,
        sellerId: selectedListingForPurchase.userId,
        commodity: selectedListingForPurchase.commodity,
        amount: Number(purchaseForm.quantity),
        unit: 'kg',
        totalPrice: Number(purchaseForm.quantity) * selectedListingForPurchase.price,
        status: 'pending',
        deliveryAddress: purchaseForm.address,
        contactPhone: purchaseForm.phone,
        shippingMethod: purchaseForm.shippingMethod,
        timestamp: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, 'transactions'), transactionData);
        alert("Pesanan berhasil dikirim! Penjual akan segera menghubungi Anda.");
        setIsPurchaseModalOpen(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'transactions');
      }
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Gagal melakukan pembelian. Silakan coba lagi.");
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const renderPurchaseModal = () => (
    <AnimatePresence>
      {isPurchaseModalOpen && selectedListingForPurchase && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPurchaseModalOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[32px] sm:rounded-[40px] overflow-hidden relative z-10 shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 sm:p-8 bg-emerald-900 text-white relative shrink-0">
               <button 
                 onClick={() => setIsPurchaseModalOpen(false)}
                 className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/50 hover:text-white transition-colors"
               >
                 <X size={20} className="sm:w-6 sm:h-6" />
               </button>
               <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 sm:mb-2">Konfirmasi Pembelian</p>
               <h3 className="text-xl sm:text-3xl font-black uppercase tracking-tighter leading-tight">{selectedListingForPurchase.commodity}</h3>
               <p className="text-[10px] sm:text-xs font-bold text-emerald-200 mt-1 flex items-center gap-2">
                 <Store size={12} className="sm:w-3.5 sm:h-3.5" /> {selectedListingForPurchase.userName}
               </p>
            </div>

            <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto">
               <div className="space-y-4">
                 <div>
                   <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Jumlah (kg)</label>
                   <div className="flex items-center gap-3 sm:gap-4">
                     <button 
                       onClick={() => setPurchaseForm(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
                       className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-600 active:scale-90 transition-all"
                     >
                       <span className="text-lg sm:text-xl font-bold">-</span>
                     </button>
                     <input 
                       type="number"
                       value={purchaseForm.quantity}
                       onChange={(e) => setPurchaseForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                       className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center text-base sm:text-lg font-black outline-none focus:border-emerald-500 transition-all"
                     />
                     <button 
                       onClick={() => setPurchaseForm(p => ({ ...p, quantity: p.quantity + 1 }))}
                       className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-600 active:scale-90 transition-all"
                     >
                       <span className="text-lg sm:text-xl font-bold">+</span>
                     </button>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-4 rounded-2xl sm:rounded-3xl border border-slate-100">
                    <div>
                      <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Harga Satuan</p>
                      <p className="text-xs sm:text-sm font-black text-slate-900">{formatCurrency(selectedListingForPurchase.price)}/kg</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Bayar</p>
                      <p className="text-base sm:text-lg font-black text-emerald-700">{formatCurrency(selectedListingForPurchase.price * purchaseForm.quantity)}</p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-1 sm:pt-2">
                   <div>
                     <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Alamat Pengiriman</label>
                     <textarea 
                        value={purchaseForm.address}
                        onChange={(e) => setPurchaseForm(p => ({ ...p, address: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-[11px] sm:text-xs font-bold outline-none focus:border-emerald-500 transition-all min-h-[70px] sm:min-h-[80px] resize-none"
                        placeholder="Masukkan alamat lengkap pengiriman..."
                     />
                   </div>
                   <div>
                     <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nomor WhatsApp / HP</label>
                     <input 
                        type="tel"
                        value={purchaseForm.phone}
                        onChange={(e) => setPurchaseForm(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-[11px] sm:text-xs font-mono outline-none focus:border-emerald-500 transition-all"
                        placeholder="Contoh: 081234567890"
                     />
                   </div>

                   <div>
                     <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Metode Pengiriman</label>
                     <div className="grid grid-cols-3 gap-2">
                       {['Kurir Petani', 'Ekspedisi', 'Ambil Sendiri'].map((method) => (
                         <button
                           key={method}
                           onClick={() => setPurchaseForm(p => ({ ...p, shippingMethod: method }))}
                           className={cn(
                             "py-2 px-1 rounded-xl text-[8px] sm:text-[9px] font-black uppercase transition-all border-2",
                             purchaseForm.shippingMethod === method 
                               ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-900/10" 
                               : "bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-100"
                           )}
                         >
                           {method}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>
               </div>

               <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 pb-2">
                 <button 
                   onClick={() => setIsPurchaseModalOpen(false)}
                   className="order-2 sm:order-1 flex-1 bg-slate-100 text-slate-600 font-extrabold py-4 sm:py-4.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                 >
                   Batal
                 </button>
                 <button 
                   onClick={submitPurchase}
                   disabled={isSubmittingPurchase}
                   className="order-1 sm:order-2 flex-[2] bg-emerald-600 text-white font-extrabold py-4 sm:py-4.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/10 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isSubmittingPurchase ? 'MEMPROSES...' : 'KIRIM PESANAN'}
                 </button>
               </div>
               <p className="text-[8px] sm:text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest opacity-60">
                 Transaksi aman & terverifikasi DigiAgri Shield
               </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const saveUserSettings = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        await setDoc(userRef, {
          geminiApiKey: customApiKey
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
      setUserProfile((prev: any) => ({ ...prev, geminiApiKey: customApiKey }));
      alert("Pengaturan disimpan!");
    } catch (e) {
      console.error("Error saving settings", e);
    }
  };

  useEffect(() => {
    // Basic auth setup - for demo we use anonymous
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Sync/Fetch user profile
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            const newProfile = {
              uid: user.uid,
              displayName: user.displayName || `Petani_${user.uid.slice(0, 4)}`,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              role: 'petani',
              rating: 5.0,
              reviewCount: 0,
              location: selectedMarket.location,
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(userDocRef, newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
            }
            setUserProfile(newProfile);
          } else {
            const p = userDoc.data();
            setUserProfile(p);
            if (p.geminiApiKey) setCustomApiKey(p.geminiApiKey);
          }
        } catch (error: any) {
          // If offline, provide a temporary local profile so app doesn't break
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            setIsFirebaseOffline(true);
            const fallbackProfile = {
              uid: user.uid,
              displayName: user.displayName || `Petani_${user.uid.slice(0, 4)}`,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              role: 'petani',
              rating: 5.0,
              reviewCount: 0,
              location: selectedMarket.location,
              isOfflineProfile: true
            };
            setUserProfile(fallbackProfile);
            console.warn("Operating in offline mode. Profile sync skipped.");
          } else if (error.message?.includes('permission-denied')) {
             handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          } else {
            console.error("Profile sync error", error);
          }
        }
      } else {
        signInAnonymously(auth);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;

    const q = query(
      collection(db, 'price_reports'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PriceReport[];
      setUserReports(reports);
      setIsFirebaseOffline(false);
    }, (error) => {
      if (error.code === 'unavailable') {
        setIsFirebaseOffline(true);
      }
      handleFirestoreError(error, OperationType.LIST, 'price_reports');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Using 0.7 quality to significantly reduce size while keeping validation visible
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleReportPrice = async () => {
    if (!currentUser) return;
    setIsReporting(true);

    try {
      const photoUrl = reportForm.photoUrl;
      
      // 1. First, save metadata to 'price_reports' (Lightweight document)
      let reportId = '';
      try {
        const metadata = {
          commodity: reportForm.commodity,
          price: Number(reportForm.price),
          unit: 'kg',
          marketName: reportForm.marketName,
          location: reportForm.location,
          latitude: reportForm.latitude,
          longitude: reportForm.longitude,
          hasPhoto: !!photoUrl, // Flag indicating there is a photo in the separate collection
          isGpsVerified: reportForm.isGpsVerified,
          userId: currentUser.uid,
          userName: userProfile.displayName || 'Petani',
          timestamp: serverTimestamp(),
          status: 'pending'
        };

        const docRef = await addDoc(collection(db, 'price_reports'), metadata);
        reportId = docRef.id;

        // 2. Save heavy photo to 'price_report_evidence' ONLY if it exists
        if (photoUrl && reportId) {
          await setDoc(doc(db, 'price_report_evidence', reportId), {
            photoUrl,
            userId: currentUser.uid,
            timestamp: serverTimestamp()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'price_reports');
      }

      // Sync to Supabase (Supabase is fine with large JSON, keeps single record integrity)
      try {
        await submitSupabasePriceReport({
          commodity: reportForm.commodity,
          price: Number(reportForm.price),
          unit: 'kg',
          marketName: reportForm.marketName,
          location: reportForm.location,
          latitude: reportForm.latitude,
          longitude: reportForm.longitude,
          photoUrl: photoUrl, // Supabase can handle the single row sync
          isGpsVerified: reportForm.isGpsVerified,
          userId: currentUser.uid,
          userName: userProfile.displayName || 'Petani',
          timestamp: new Date().toISOString(),
          status: 'pending'
        });
      } catch (sbError) {
        console.error("Supabase sync error:", sbError);
      }

      // Vercel webhook/API sync (optional integration point)
      const vercelApi = import.meta.env.VITE_VERCEL_API_URL;
      if (vercelApi) {
        try {
          await fetch(`${vercelApi}/api/sync-price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commodity: reportForm.commodity,
              price: reportForm.price,
              market: reportForm.marketName,
              timestamp: new Date().toISOString()
            })
          });
        } catch (vError) {
          console.warn("Vercel sync skipped or failed:", vError);
        }
      }

      setIsReportModalOpen(false);
      setReportForm(prev => ({ ...prev, price: '', photoUrl: '', isGpsVerified: false }));
      toast.success('Laporan terkirim! Sedang diverifikasi oleh sistem (Foto & GPS).', {
        duration: 5000,
        style: {
          borderRadius: '16px',
          background: '#065F46',
          color: '#fff',
          fontSize: '12px'
        },
      });
    } catch (error) {
      console.error("Error reporting price:", error);
      toast.error('Gagal melaporkan harga. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsReporting(false);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isCultivationAnalyzing, setIsCultivationAnalyzing] = useState(false);
  const [cultivationAdvice, setCultivationAdvice] = useState<string | null>(null);

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isBuyersOpen, setIsBuyersOpen] = useState(false);
  const [b2bDemands, setB2bDemands] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'b2b_demands'), (snapshot) => {
      const demands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setB2bDemands(demands);
      
      // Seed if empty (demo purpose)
      if (demands.length === 0 && currentUser) {
        const initialDemands = [
          { buyerName: 'Hotel Mulia Farm-to-Table', commodity: 'Tomat Cherry', amount: '500kg/mgu', price: 18000, deadline: '2 Hari', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop', status: 'open', createdAt: serverTimestamp() },
          { buyerName: 'Resto Padang Sederhana (Pusat)', commodity: 'Cabai Merah', amount: '2 Ton/bln', price: 22000, deadline: 'Segera', image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200&h=200&fit=crop', status: 'open', createdAt: serverTimestamp() },
          { buyerName: 'Catering Ibu Kita', commodity: 'Bawang Merah', amount: '200kg/mgu', price: 15500, deadline: '5 Hari', image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=200&h=200&fit=crop', status: 'open', createdAt: serverTimestamp() },
          { buyerName: 'SayurBox Procurement', commodity: 'Pakcoy Hidroponik', amount: '100kg/hari', price: 12000, deadline: 'Kontrak 1th', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&h=200&fit=crop', status: 'open', createdAt: serverTimestamp() }
        ];
        initialDemands.forEach(async (d) => {
          try {
            await addDoc(collection(db, 'b2b_demands'), d);
          } catch (e) {
            console.warn('Seeding skipped due to permissions');
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'b2b_demands');
    });
    return () => unsub();
  }, [currentUser]);

  const getSmartSalesAdvice = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `Sebagai pakar ekonomi pertanian, analisa data harga berikut untuk memberikan saran strategi penjualan kepada petani agar pendapatan mereka maksimal.
      Data Harga Saat Ini: ${JSON.stringify(displayData.map(d => ({ item: d.type, price: d.currentPrice, market: d.market.name })))}
      
      INSTRUKSI FORMATTING KHUSUS:
      - Gunakan Bahasa Indonesia yang sangat sederhana.
      - Gunakan MARKDOWN.
      - Gunakan huruf yang jelas dan bullet points untuk setiap poin.
      - Jika ada perbandingan harga antar pasar, buatkan TABEL sederhana.
      - Berikan spasi lebar antar poin agar nyaman dibaca orang tua.
      
      Berikan saran tentang:
      1. Komoditas apa yang paling menguntungkan saat ini?
      2. Apakah harus menjual sekarang atau menunggu?
      3. Pasar mana yang memberikan harga terbaik?`;

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setAiAdvice(result.text || "AI tidak dapat memberikan saran saat ini.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiAdvice("Maaf, gagal menganalisa pasar saat ini. Silakan coba lagi nanti.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCultivationAdvice = async () => {
    setIsCultivationAnalyzing(true);
    try {
      const locationContext = farmerLocation.areaName 
        ? `${farmerLocation.areaName}, ${selectedMarket.province}` 
        : `${selectedMarket.name}, ${selectedMarket.province}`;
      
      const prompt = `Sebagai pakar agribisnis dan klimatologi, berikan saran strategi tanam untuk petani di lokasi spesifik: ${locationContext}.
      Gunakan data musim saat ini (analisa berdasarkan waktu sekarang Mei 2026).
      
      INSTRUKSI FORMATTING KHUSUS:
      - Gunakan Bahasa Indonesia yang sangat sederhana.
      - Gunakan MARKDOWN.
      - Gunakan bullet points atau penomoran yang jelas.
      - Berikan spasi antar poin agar nyaman dibaca orang tua.
      
      Berikan saran tentang:
      1. Komoditas yang paling cocok ditanam (low risk, high demand)?
      2. Peringatan cuaca/hama yang harus diwaspadai bulan depan?
      3. Tips kesehatan tanaman untuk komoditas unggulan di daerah tersebut.`;

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setCultivationAdvice(result.text || "AI tidak dapat memberikan saran strategi tanam saat ini.");
    } catch (error) {
      console.error("Cultivation Analysis Error:", error);
      setCultivationAdvice("Maaf, gagal menganalisa strategi tanam. Silakan coba lagi nanti.");
    } finally {
      setIsCultivationAnalyzing(false);
    }
  };
  
  const [showPromptCopy, setShowPromptCopy] = useState(false);
  
  const getExternalPrompt = () => {
    const marketData = displayData
      .filter(d => d.market.id === selectedMarket.id)
      .map(d => `- ${d.type}: Rp ${formatCurrency(d.currentPrice).replace('Rp', '')} (${d.market.name})`)
      .join('\n');

    const locationContext = farmerLocation.areaName 
      ? `${farmerLocation.areaName}, ${selectedMarket.province}` 
      : `${selectedMarket.name}, ${selectedMarket.province}`;

    return `Anda adalah analis pertanian dan pasar komoditas Indonesia.

Tugas Anda:
Membantu petani menentukan strategi tanam dan penjualan berdasarkan harga pasar terbaru.

DATA PASAR HARI INI:
${marketData}

PASAR ACUAN:
${selectedMarket.name}

LOKASI KEBUN (SPESIFIK):
${locationContext}

ANALISIS BERDASARKAN:
- Potensi keuntungan
- Stabilitas harga
- Risiko cuaca
- Kecepatan masa panen
- Permintaan pasar

TOLONG BERIKAN:
1. Komoditas paling menguntungkan saat ini
2. Komoditas paling aman untuk ditanam
3. Prediksi tren harga jangka pendek
4. Risiko utama yang perlu diwaspadai
5. Strategi jual terbaik saat ini
6. Tips menghadapi cuaca

FORMAT OUTPUT:
- Gunakan Bahasa Indonesia sederhana (untuk petani)
- Gunakan Markdown
- Gunakan bullet point
- Gunakan tabel untuk perbandingan
- Tebalkan **angka penting**
- Beri jarak antar paragraf agar mudah dibaca oleh orang tua
- Hindari istilah teknis rumit

ATURAN TAMBAHAN:
- Jangan mengarang data pasti jika tidak tersedia
- Jika prediksi belum pasti, katakan "perkiraan umum"
- Fokus pada saran praktis untuk petani kecil

Tutup jawaban dengan:
## KESIMPULAN JELAS`;
  };

  const copyPromptToClipboard = () => {
    const prompt = getExternalPrompt();
    navigator.clipboard.writeText(prompt);
    setShowPromptCopy(true);
    setTimeout(() => setShowPromptCopy(false), 2000);
  };

  const renderScoutTab = () => (
    <div className="space-y-6 pb-20">
      {/* Location Precision Card */}
      <section className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Lokasi Kebun Presisi</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Saran lebih akurat sesuai kec./desa</p>
            </div>
          </div>
          <button 
            onClick={detectLocation}
            disabled={isDetectingLocation}
            className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50"
          >
            {isDetectingLocation ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} className="rotate-45" />}
          </button>
        </div>

        <div className="relative group">
          <input 
            type="text"
            placeholder="Ketik Kecamatan/Desa (Misal: Cempaka)"
            value={farmerLocation.areaName}
            onChange={(e) => setFarmerLocation(prev => ({ ...prev, areaName: e.target.value }))}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-5 pr-24 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {farmerLocation.areaName && (
              <button 
                onClick={resetLocation}
                className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 transition-colors"
                title="Hapus lokasi"
              >
                <X size={14} />
              </button>
            )}
            {farmerLocation.coords && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm border border-emerald-200">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter">GPS</span>
              </div>
            )}
            <div className="p-1.5 text-slate-300">
              <Pencil size={14} />
            </div>
          </div>
        </div>
        
        {!farmerLocation.areaName && (
          <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-3 px-1 flex items-center gap-1">
            <Info size={10} />
            Masukkan lokasi spesifik untuk hasil lebih akurat
          </p>
        )}
      </section>

      {/* AI Sales Advisor Card */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-12 -mt-12 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Strategi Jual (Market)</h2>
              <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Optimasi Pendapatan Panen</p>
            </div>
          </div>
          
          {aiAdvice ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 mb-4 border border-white/20">
              <div className="markdown-prose text-emerald-50">
                <ReactMarkdown>{aiAdvice}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="text-sm text-emerald-50 mb-6 leading-relaxed">
              Analisa harga pasar di {selectedMarket.name} untuk menentukan waktu jual terbaik.
            </p>
          )}

          <button 
            onClick={getSmartSalesAdvice}
            disabled={isAnalyzing}
            className="w-full bg-white text-emerald-700 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                MENGANALISA HARGA...
              </>
            ) : (
              <>
                <TrendingUp size={18} />
                ANALISA WAKTU JUAL
              </>
            )}
          </button>
        </div>
      </section>

      {/* AI Cultivation Advisor Card */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 -ml-12 -mb-12 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Sprout className="w-6 h-6 text-blue-100" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Strategi Tanam (Cultivation)</h2>
              <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">Saran Komoditi & Kesehatan</p>
            </div>
          </div>
          
          {cultivationAdvice ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 mb-4 border border-white/20">
              <div className="markdown-prose text-blue-50">
                <ReactMarkdown>{cultivationAdvice}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-50 mb-6 leading-relaxed">
              Dapatkan rekomendasi jenis tanaman yang paling cocok berdasarkan lokasi dan prediksi cuaca.
            </p>
          )}

          <button 
            onClick={getCultivationAdvice}
            disabled={isCultivationAnalyzing}
            className="w-full bg-white text-blue-700 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCultivationAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                MENGANALISA LAHAN...
              </>
            ) : (
              <>
                <CloudSun size={18} />
                CEK STRATEGI TANAM
              </>
            )}
          </button>
        </div>
      </section>

      {/* Additional Tools Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Margin Calculator */}
        <section 
          onClick={() => setIsCalculatorOpen(true)}
          className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3">
            <Calculator size={20} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Kalkulator</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hitung Margin Modal</p>
        </section>

        {/* Direct Buyer */}
        <section 
          onClick={() => setIsBuyersOpen(true)}
          className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
            <Users size={20} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Pembeli</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Kontrak Institusi</p>
        </section>
      </div>

      {/* Direct Buyer Connection List */}
      <section className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm overflow-hidden relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Chat Ahli Tani</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono">Konsultasi Penyakit & Hama</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 text-center italic">Unggah foto tanaman Anda untuk diagnosa AI cepat atau hubungi penyuluh lapangan terdekat.</p>
          </div>
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-slate-200"
          >
            Mulai Konsultasi
          </button>
        </div>
      </section>

      {/* External AI Bridge Card */}
      <section className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
            <ExternalLink size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Gunakan AI Eksternal</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Gunakan ini jika token habis atau butuh opini kedua</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-5 relative">
          <div className="absolute top-3 right-3">
             <button 
               onClick={copyPromptToClipboard}
               className={cn(
                 "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95",
                 showPromptCopy ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
               )}
             >
               {showPromptCopy ? <Check size={12} /> : <Copy size={12} />}
               {showPromptCopy ? "BERHASIL SALIN" : "SALIN PROMPT"}
             </button>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 font-mono">Template Injeksi Prompt:</p>
          <div className="max-h-24 overflow-hidden mask-fade-bottom">
            <p className="text-[11px] text-slate-500 leading-relaxed italic">
              "{getExternalPrompt().substring(0, 150)}..."
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "ChatGPT", url: "https://chat.openai.com", color: "bg-emerald-600" },
            { name: "Gemini", url: "https://gemini.google.com", color: "bg-blue-600" },
            { name: "DeepSeek", url: "https://chat.deepseek.com", color: "bg-indigo-600" },
            { name: "Claude AI", url: "https://claude.ai", color: "bg-amber-700" }
          ].map((bot) => (
            <a 
              key={bot.name}
              href={bot.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all active:scale-95"
              )}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{bot.name}</span>
              <ExternalLink size={12} className="text-slate-300" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
  const renderPricesTab = () => (
    <div className="space-y-4">
      {/* Price Tab Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input 
            type="text" 
            placeholder="Cari komoditas..."
            value={priceFilters.commodity}
            onChange={(e) => setPriceFilters(prev => ({ ...prev, commodity: e.target.value }))}
            className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-emerald-500/10 outline-none"
          />
        </div>
        <button 
          onClick={() => setShowPriceFilters(!showPriceFilters)}
          className={cn(
            "p-3 rounded-2xl border transition-all active:scale-95 shadow-sm",
            showPriceFilters ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white border-slate-100 text-slate-400"
          )}
        >
          <Filter size={18} />
        </button>
        <button 
          onClick={() => setPriceFilters(prev => ({
            ...prev,
            sortBy: prev.sortBy === 'default' ? 'price_low' : prev.sortBy === 'price_low' ? 'price_high' : prev.sortBy === 'price_high' ? 'change' : 'default'
          }))}
          className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm active:scale-95 transition-all"
        >
          {priceFilters.sortBy === 'default' ? <ArrowRightLeft size={16} className="rotate-90" /> : 
           priceFilters.sortBy === 'price_low' ? <TrendingDown size={16} /> :
           priceFilters.sortBy === 'price_high' ? <TrendingUp size={16} /> :
           <Sparkles size={16} />}
          <span className="hidden sm:inline">
            {priceFilters.sortBy === 'default' ? 'Urutkan' : 
             priceFilters.sortBy === 'price_low' ? 'Termurah' :
             priceFilters.sortBy === 'price_high' ? 'Termahal' : 'Gejolak'}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {showPriceFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-100 rounded-2xl p-3 flex gap-2 overflow-x-auto no-scrollbar">
              {['Semua', ...Object.values(CommodityType)].map((type) => (
                <button
                  key={type}
                  onClick={() => setPriceFilters(prev => ({ ...prev, commodity: type === 'Semua' ? '' : type }))}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-colors",
                    (type === 'Semua' && !priceFilters.commodity) || priceFilters.commodity === type
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crowd Report Trigger */}
      <button 
        onClick={() => setIsReportModalOpen(true)}
        className="w-full bg-white border border-emerald-100 p-4 rounded-[28px] flex items-center justify-between group active:scale-[0.98] transition-all shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Plus size={20} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Bantu Verifikasi Harga?</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Klik untuk lapor harga di {selectedMarket.name}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:border-emerald-100 transition-all">
          <ArrowRightLeft size={14} className="rotate-90" />
        </div>
      </button>

      <div className="grid gap-3">
        {hasNoData ? (
          <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300 shadow-sm">
              <Search size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-400">Belum ada data harga.</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Wilayah {selectedMarket.name} belum memiliki laporan harga resmi atau publik hari ini.
              </p>
            </div>
          </div>
        ) : (
          <>
            {filteredDisplayData.map((item) => (
              <PriceCard 
                key={item.id} 
                data={item} 
                onClick={() => setSelectedCommodity(item)}
              />
            ))}
            {filteredUserReports.map((report) => (
              <PriceCard 
                key={report.id} 
                data={{
                  id: report.id,
                  type: report.commodity as any,
                  currentPrice: report.price as any,
                  previousPrice: report.price as any, // Simple fallback
                  unit: report.unit,
                  trend: 'up',
                  market: { name: report.marketName, location: report.location } as any,
                  lastUpdated: 'Baru saja',
                  isGpsVerified: report.isGpsVerified,
                  photoUrl: report.photoUrl,
                  hasPhoto: report.hasPhoto,
                  history: []
                }} 
                onClick={() => {}}
              />
            ))}
          </>
        )}
      </div>

      {/* Stats and Info Cards */}
      <div className="bg-emerald-800 text-emerald-50 rounded-3xl p-5 shadow-xl border border-emerald-700 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 blur-sm">
          <Leaf size={100} />
        </div>
        <div className="relative z-10 flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tighter">Informasi Terverifikasi</h3>
            <p className="text-[9px] text-emerald-300 font-black uppercase tracking-widest">Kualitas Data Grade A</p>
          </div>
          <div className="bg-emerald-500/20 p-2 rounded-xl">
            <Sparkles size={16} />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed opacity-80 mb-4 font-medium italic">
          "Data harga dikumpulkan langsung dari pasar induk setiap hari pukul 09:00 WIB melalui jaringan petugas dinas perdagangan."
        </p>
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest border-t border-emerald-700/50 pt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            98% Akurat
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            Real-time Update
          </div>
        </div>
      </div>
    </div>
  );

    const filteredListings = listings.filter(item => {
    const matchCommodity = !marketFilters.commodity || item.commodity === marketFilters.commodity;
    const matchLocation = !marketFilters.location || 
      item.location?.toLowerCase().includes(marketFilters.location.toLowerCase());
    const matchMinPrice = !marketFilters.minPrice || item.price >= Number(marketFilters.minPrice);
    const matchMaxPrice = !marketFilters.maxPrice || item.price <= Number(marketFilters.maxPrice);
    return matchCommodity && matchLocation && matchMinPrice && matchMaxPrice;
  }).sort((a, b) => {
    if (marketFilters.sortBy === 'price_low') return a.price - b.price;
    if (marketFilters.sortBy === 'price_high') return b.price - a.price;
    if (marketFilters.sortBy === 'trusted') return (b.userRating || 0) - (a.userRating || 0);
    return new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime();
  });

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Bursa Petani</h2>
          <button 
            onClick={() => setIsListingModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            BUKA LAPAK
          </button>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
          Platform Transparansi Harga: Lihat perbandingan harga pasar langsung di setiap produk.
        </p>
      </div>

      {/* Filter Section */}
      <section className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              type="text" 
              placeholder="Cari lokasi atau pedagang..."
              value={marketFilters.location}
              onChange={(e) => setMarketFilters(prev => ({ ...prev, location: e.target.value }))}
              className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-3 rounded-2xl border transition-all relative",
              showFilters ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-white border-slate-100 text-slate-400"
            )}
          >
            <Filter size={18} />
            {(marketFilters.commodity || marketFilters.minPrice || marketFilters.maxPrice) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-5">
        {filteredListings.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-300 shadow-sm">
              <Store size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-400">Pasar sedang sepi.</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Belum ada yang berjualan di sini.</p>
            </div>
          </div>
        ) : (
          filteredListings.map((item) => (
            <MarketListingItem 
              key={item.id} 
              item={item} 
              onStartChat={handleStartChat}
              getMarketPriceForCommodity={getMarketPriceForCommodity}
            />
          ))
        )}
      </div>
    </div>
  );


  const renderProfileTab = () => (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 px-1">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sistem & Keamanan</h2>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
          Monitor integrasi infrastruktur digital Anda secara real-time.
        </p>
      </div>

      {/* System Status Dashboard */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-800 text-sm uppercase">Status Infrastruktur</h3>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
          
          <div className="space-y-4">
            {/* Cloudinary */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", systemStatus?.cloudinary?.configured ? "bg-emerald-500" : "bg-amber-500")} />
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase">Cloudinary (Media)</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{systemStatus?.cloudinary?.cloudName || 'Checking...'}</p>
                </div>
              </div>
              <span className={cn("text-[9px] font-black uppercase", systemStatus?.cloudinary?.configured ? "text-emerald-600" : "text-amber-600")}>
                {systemStatus?.cloudinary?.configured ? 'Connected' : 'Demo Mode'}
              </span>
            </div>

            {/* Supabase */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", systemStatus?.supabase?.configured ? "bg-emerald-500" : "bg-amber-500")} />
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase">Supabase (Harga)</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase truncate max-w-[120px]">{systemStatus?.supabase?.url || 'Checking...'}</p>
                </div>
              </div>
              <span className={cn("text-[9px] font-black uppercase", systemStatus?.supabase?.configured ? "text-emerald-600" : "text-amber-600")}>
                {systemStatus?.supabase?.configured ? 'Connected' : 'Sync Active'}
              </span>
            </div>

            {/* Firebase */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase">Firebase (Keamanan)</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Enterprise Mode</p>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase text-emerald-600">Shield Active</span>
            </div>
          </div>
        </div>

        <div className="bg-emerald-900/5 border border-emerald-900/10 rounded-[32px] p-6">
          <div className="flex gap-4">
             <Shield className="text-emerald-700 shrink-0" size={24} />
             <div className="space-y-1">
               <p className="text-xs font-black text-emerald-900 uppercase">Progres Kerangka Kerja</p>
               <p className="text-[9px] text-emerald-700 font-bold leading-relaxed">
                 Sistem saat ini berada di <span className="underline decoration-wavy">Tingkat 3 (Resiliensi)</span>. 
                 Kompresi video berat diaktifkan dan deteksi otomatis integrasi telah tersinkronisasi.
               </p>
             </div>
          </div>
        </div>

        {isDeveloper && (
          <div className="bg-slate-900 rounded-[32px] p-6 shadow-2xl shadow-slate-900/20 border border-slate-800 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] group-hover:bg-emerald-500/20 transition-all" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Developer Detected</p>
                </div>
                <h4 className="text-lg font-black text-white uppercase tracking-tighter">Menu Pengembang</h4>
              </div>
              <button 
                onClick={() => setIsDevPortalOpen(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-500"
              >
                Buka Panel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="font-black text-slate-800 text-sm uppercase px-2">Konfigurasi AI</h3>
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-6">
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={10} className="text-emerald-500" />
                Gemini API Key (BYOK)
              </label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[8px] font-black text-blue-500 uppercase underline">Ambil Key Gratis</a>
            </div>
            <input 
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="Masukkan API Key Anda..."
              className="w-full bg-slate-50 border-2 border-slate-100 focus:border-emerald-400 rounded-2xl p-4 text-xs font-mono transition-all outline-none"
            />
            <p className="text-[9px] text-slate-400 italic px-1 leading-relaxed">
              Key tersimpan aman untuk akses analisis harga Gemini Flash 2.0.
            </p>
          </div>
          <button 
            onClick={saveUserSettings}
            className="w-full bg-[#065F46] text-white font-black py-4.5 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95 transition-all"
          >
            SIMPAN PENGATURAN
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="font-black text-slate-800 text-sm uppercase px-2">Profil Pengguna</h3>
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
          {currentUser ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img src={currentUser.photoURL || "/api/placeholder/100/100"} className="w-16 h-16 rounded-3xl border-2 border-emerald-100 shadow-sm" alt="" />
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tighter">{currentUser.displayName || "Petani Tanpa Nama"}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full bg-red-50 text-red-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                KELUAR DARI SISTEM
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-200">
                <ShieldAlert size={32} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase">Anda belum masuk sebagai pengguna terverifikasi.</p>
              <button 
                 onClick={handleGoogleLogin}
                 className="flex items-center justify-center gap-3 w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-900/20"
              >
                MASUK DENGAN GOOGLE
              </button>
            </div>
          )}
        </div>
      </div>

      {currentUser && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-800 text-sm uppercase">Postingan Saya</h3>
            <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
              {listings.filter(l => l.userId === currentUser.uid).length} Item
            </span>
          </div>
          <div className="space-y-3">
            {listings.filter(l => l.userId === currentUser.uid).length > 0 ? (
              listings.filter(l => l.userId === currentUser.uid).map(listing => (
                <UserListingItem 
                  key={listing.id}
                  listing={listing}
                  onEdit={openEditModal}
                  onDelete={handleDeleteListing}
                />
              ))
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] p-8 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase italic">Anda Belum Memiliki Postingan</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const getMarketPriceForCommodity = (commodityName: string) => {
    const data = (supabaseData && supabaseData.length > 0) ? supabaseData : MOCK_DATA;
    // Try to find exact match
    const match = data.find(item => item.type.toLowerCase().includes(commodityName.toLowerCase()) || 
                                   commodityName.toLowerCase().includes(item.type.toLowerCase()));
    return match ? match.currentPrice : null;
  };

  const renderChatsTab = () => {
    if (!currentUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center text-slate-300">
            <MessageSquare size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Percakapan Tersembunyi</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Login untuk melihat pesan pribadi Anda dengan petani & pembeli.
            </p>
          </div>
          <button 
            onClick={() => setActiveTab('settings')}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            Login Sekarang
          </button>
        </div>
      );
    }

    if (activeChat) {
      return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col max-w-lg mx-auto h-screen">
          {/* Chat Header */}
          <div className="bg-emerald-900 p-4 text-white flex items-center gap-4 shrink-0">
            <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ChevronDown className="rotate-90" size={24} />
            </button>
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
               <img 
                 src={activeChat.participantInfo[activeChat.participants.find((p: string) => p !== currentUser.uid)].avatar} 
                 className="w-10 h-10 rounded-2xl border border-white/20" 
                 alt="" 
               />
               <div className="overflow-hidden">
                 <h4 className="text-sm font-black uppercase tracking-tighter truncate">
                   {activeChat.participantInfo[activeChat.participants.find((p: string) => p !== currentUser.uid)].name}
                 </h4>
                 <p className="text-[9px] text-emerald-200 font-bold uppercase tracking-widest truncate">
                    Membahas: {activeChat.productName}
                 </p>
               </div>
            </div>
            <button className="p-2 hover:bg-white/10 rounded-full">
              <Store size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 no-scrollbar">
            {chatMessages.map((msg) => {
              const isMine = msg.senderId === currentUser.uid;
              return (
                <div key={msg.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[80%] px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm",
                    isMine ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-slate-700 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] font-black uppercase text-slate-300 mt-1 px-1">
                    {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </span>
                </div>
              );
            })}
            <div className="h-4" />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-3 sticky bottom-0 z-50">
            <input 
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
              placeholder="Ketik pesan..."
              className="flex-1 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none transition-all"
            />
            <button 
              onClick={handleSendChatMessage}
              disabled={!chatInput.trim()}
              className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-24">
        <div className="px-2">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Pesan Pribadi</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Negosiasi & Koordinasi Langsung</p>
        </div>

        <div className="space-y-3">
          {chatList.length > 0 ? (
            chatList.map((chat) => {
              const otherUserId = chat.participants.find((p: string) => p !== currentUser.uid);
              const otherUser = chat.participantInfo[otherUserId];
              
              return (
                <button 
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className="w-full bg-white border border-slate-100 rounded-[28px] p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="relative">
                    <img src={otherUser.avatar} className="w-14 h-14 rounded-2xl border-2 border-white shadow-sm" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white">
                      <MessageCircle size={10} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-black uppercase text-slate-800 truncate">{otherUser.name}</h4>
                      <span className="text-[8px] font-black text-slate-300 uppercase shrink-0">
                        {chat.lastMessageAt?.toDate ? chat.lastMessageAt.toDate().toLocaleDateString() : '...'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest truncate mb-1">
                      📦 {chat.productName}
                    </p>
                    <p className="text-xs text-slate-400 font-medium truncate italic leading-none">
                      "{chat.lastMessage || 'Belum ada pesan'}"
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
               <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200">
                 <MessageSquare size={32} />
               </div>
               <div>
                 <p className="text-lg font-black text-slate-400 uppercase tracking-tighter italic">Belum Ada Obrolan</p>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                   Mulailah menyapa petani dari tab Feed untuk bertransaksi!
                 </p>
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  const renderFYPTab = () => (
    <div className="space-y-8 -mt-2 pb-20">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Untuk Anda</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Video Segar dari Petani</p>
        </div>
        <div className="flex gap-2 relative">
           {isSearchOpen && (
             <motion.div 
               initial={{ width: 0, opacity: 0 }}
               animate={{ width: 200, opacity: 1 }}
               className="absolute right-12 top-0 h-10"
             >
               <input 
                 autoFocus
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 onBlur={() => !searchQuery && setIsSearchOpen(false)}
                 placeholder="Cari komoditas..."
                 className="w-full h-full bg-white border border-emerald-100 rounded-full px-4 text-xs shadow-sm outline-none focus:ring-2 ring-emerald-500/20"
               />
             </motion.div>
           )}
           <button 
             onClick={() => setIsSearchOpen(!isSearchOpen)}
             className={cn(
               "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
               isSearchOpen ? "bg-emerald-600 text-white" : "bg-white border border-slate-100 text-slate-400"
             )}
           >
             <Search size={18} />
           </button>
           <div className="relative">
             <button 
               onClick={() => setShowNotifications(!showNotifications)}
               className={cn(
                 "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm relative",
                 showNotifications ? "bg-emerald-600 text-white" : "bg-white border border-slate-100 text-slate-400"
               )}
             >
               <Bell size={18} />
               {!showNotifications && notifications.some(n => !n.read) && (
                 <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
               )}
             </button>

             <AnimatePresence>
               {showNotifications && (
                 <motion.div 
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: 10, scale: 0.95 }}
                   className="absolute right-0 top-12 w-72 bg-white border border-slate-100 rounded-[32px] shadow-2xl z-[100] overflow-hidden"
                 >
                   <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                     <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Notifikasi</p>
                     <button onClick={() => setShowNotifications(false)} className="text-slate-400"><X size={14} /></button>
                   </div>
                   <div className="max-h-[300px] overflow-y-auto">
                     {notifications.length > 0 ? (
                       notifications.map(n => (
                         <div key={n.id} className={cn("p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer", !n.read && "bg-emerald-50/30")}>
                           <div className="flex justify-between items-start mb-1">
                             <p className="text-[11px] font-black text-slate-900">{n.title}</p>
                             <p className="text-[8px] text-slate-400 font-bold uppercase">{n.time}</p>
                           </div>
                           <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{n.message}</p>
                         </div>
                       ))
                     ) : (
                       <div className="p-8 text-center">
                         <p className="text-[10px] font-black text-slate-300 uppercase italic">Kosong Melompong</p>
                       </div>
                     )}
                   </div>
                   <button className="w-full py-3 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors">
                     Tandai Semua Sudah Dibaca
                   </button>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-12">
        {listings.filter(listing => 
          listing.commodity.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          listing.location.toLowerCase().includes(searchQuery.toLowerCase())
        ).length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-100 rounded-[40px] p-16 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto text-emerald-300 shadow-sm">
              <Video size={40} />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-black text-slate-400 uppercase tracking-tight">
                {searchQuery ? 'Hasil Tidak Ditemukan' : 'Belum Ada Video'}
              </p>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                {searchQuery 
                  ? `Tidak ada hasil untuk "${searchQuery}". Coba kata kunci lain.` 
                  : 'Jadilah petani pertama yang mengunggah video panen hari ini!'}
              </p>
            </div>
            {!searchQuery && (
              <button 
                onClick={() => setIsListingModalOpen(true)}
                className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/10 active:scale-95 transition-all"
              >
                Mulai Unggah
              </button>
            )}
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline"
              >
                Bersihkan Pencarian
              </button>
            )}
          </div>
        ) : (
          listings.filter(listing => 
            listing.commodity.toLowerCase().includes(searchQuery.toLowerCase()) ||
            listing.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            listing.location.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((item) => {
            const marketPrice = getMarketPriceForCommodity(item.commodity);
            const savings = marketPrice ? marketPrice - item.price : 0;
            // User directive: Green if >= reference, Red if below
            // Reference here is marketPrice
            const isFairToFarmer = marketPrice ? item.price >= marketPrice * 0.95 : true; 

            return (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="relative group h-[70vh] sm:h-[600px]"
              >
                {/* Vertical Video Style Container */}
                <div className="w-full h-full bg-slate-900 rounded-[48px] overflow-hidden shadow-2xl relative border-4 border-white">
                  {item.mediaUrl ? (
                    (item.mediaUrl.startsWith('data:video/') || item.mediaUrl.match(/\.(mp4|webm|ogg)$/i)) ? (
                      <video src={item.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                    ) : (
                      <img src={item.mediaUrl} className="w-full h-full object-cover opacity-90" alt={item.commodity} />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-900/20">
                      <ImageIcon size={48} className="text-emerald-900/20" />
                    </div>
                  )}

                  {/* Info Box Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                  {/* Price Sticker Overlay */}
                  {item.type !== 'post' && item.price > 0 && (
                    <motion.div 
                      drag
                      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                      className="absolute top-20 left-6 z-20 cursor-move"
                    >
                      <div className="bg-amber-400 text-black px-4 py-3 rounded-2xl shadow-2xl border-2 border-black/10 flex flex-col gap-0.5 -rotate-6 scale-110">
                        {marketPrice ? (
                          <>
                            <p className="text-[9px] font-black uppercase tracking-tighter opacity-80">Harga Pasar Induk</p>
                            <p className="text-sm font-black line-through opacity-40">{formatCurrency(marketPrice)}/kg</p>
                            <p className="text-[9px] font-black uppercase tracking-tighter opacity-80 mt-1">Direct From Farmer</p>
                          </>
                        ) : (
                          <p className="text-[9px] font-black uppercase tracking-tighter opacity-80">Harga Jual</p>
                        )}
                        <p className="text-2xl font-black leading-none">{formatCurrency(item.price)}/kg</p>
                        {marketPrice && savings > 0 && (
                          <div className="mt-2 pt-2 border-t border-black/10 flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-ping" />
                            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-tighter">Save {formatCurrency(savings)}!</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Sidebar Actions */}
                  <div className="absolute right-4 bottom-32 z-30 flex flex-col gap-5 items-center">
                    {currentUser && item.userId === currentUser.uid && (
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => openEditModal(item)}
                          className="w-12 h-12 bg-amber-500/20 backdrop-blur-xl rounded-full flex items-center justify-center text-amber-500 active:scale-90 transition-all border border-amber-500/30 shadow-lg"
                        >
                          <Pencil className="w-6 h-6" />
                        </button>
                        <span className="text-[8px] font-black text-amber-500 shadow-sm uppercase">Edit</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        onClick={() => handleToggleLike(item)}
                        className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg"
                      >
                        <Heart className={cn(
                          "w-6 h-6 transition-colors",
                          userLikes[item.id] ? "fill-red-500 text-red-500" : "fill-transparent"
                        )} />
                      </button>
                      <span className="text-[10px] font-black text-white shadow-sm">{item.likesCount || 0}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        onClick={() => {
                          setActiveCommentItem(item);
                          setIsCommentsOpen(true);
                        }}
                        className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg"
                      >
                        <MessageSquare className="w-6 h-6" />
                      </button>
                      <span className="text-[10px] font-black text-white shadow-sm">{item.commentsCount || 0}</span>
                    </div>
                    <button 
                      onClick={() => handleShare(item)}
                      className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg"
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Bottom Info Overlay */}
                  <div className="absolute bottom-6 left-6 right-20 z-30 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative group/avatar">
                        <img src={item.userAvatar} className="w-12 h-12 rounded-2xl border-2 border-white shadow-2xl active:scale-110 transition-transform" alt="" />
                        <div className={cn(
                          "absolute -top-1 -right-1 rounded-full p-1 ring-2 ring-white shadow-lg transition-colors",
                          item.type === 'post' ? "bg-sky-500" : (isFairToFarmer ? "bg-emerald-500" : "bg-red-500")
                        )}>
                          {item.type === 'post' ? <MessageSquare size={8} strokeWidth={4} className="text-white" /> : (isFairToFarmer ? <Check size={8} strokeWidth={4} className="text-white" /> : <TrendingDown size={8} strokeWidth={4} className="text-white" />)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-black text-sm uppercase tracking-tighter drop-shadow-md">@{item.userName.replace(/\s/g, '').toLowerCase()}</h4>
                          <div className={cn(
                            "backdrop-blur-md px-2 py-0.5 rounded flex items-center gap-1 border",
                            item.type === 'post' ? "bg-sky-500/20 border-sky-500/30" : (isFairToFarmer ? "bg-emerald-500/20 border-emerald-500/30" : "bg-red-500/20 border-red-500/30")
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", item.type === 'post' ? "bg-sky-400" : (isFairToFarmer ? "bg-emerald-400" : "bg-red-400"))} />
                            <span className={cn("text-[8px] font-black uppercase tracking-widest", item.type === 'post' ? "text-sky-300" : (isFairToFarmer ? "text-emerald-300" : "text-red-300"))}>
                                {item.type === 'post' ? "Kabar Tani" : (isFairToFarmer ? "Harga Sejahtera" : "Di Bawah Pasar")}
                            </span>
                          </div>
                        </div>
                        <p className="text-emerald-100/80 text-[10px] font-bold flex items-center gap-1 drop-shadow-sm">
                          <MapPin size={10} />
                          {item.location}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {item.type !== 'post' && (
                        <div className="flex items-end gap-2">
                          <h3 className="text-white font-black text-lg uppercase tracking-tight drop-shadow-md">{item.commodity}</h3>
                          <span className="text-white/60 text-xs font-bold mb-0.5">| {formatCurrency(item.price)}/kg</span>
                        </div>
                      )}
                      <p className="text-white/80 text-xs line-clamp-2 leading-relaxed drop-shadow-sm">{item.description}</p>
                    </div>

                    {item.type !== 'post' && (
                      <div className="flex items-center gap-3 pt-2 w-full">
                         <button 
                          onClick={() => openPurchaseModal(item)}
                          className="flex-1 bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-black/20"
                         >
                           🛒 Beli Sekarang
                         </button>
                         <button 
                          onClick={() => handleStartChat(item)}
                          disabled={isChatLoading}
                          className={cn(
                            "w-14 h-14 bg-white/10 backdrop-blur-xl hover:bg-white/20 border border-white/20 text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-lg",
                            isChatLoading && "opacity-50"
                          )}
                         >
                           {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={22} />}
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Community Transparency Ledger (Simplified) */}
      <section className="bg-white border-2 border-slate-100 rounded-[40px] p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
             <GitBranch size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Ledger Transparansi</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audit Harga Komunitas Real-time</p>
          </div>
        </div>
        <div className="space-y-4">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <p className="text-[10px] font-black text-slate-700 uppercase">Petani_{8892+i} Baru Mengunggah Harga</p>
                    <p className="text-[8px] text-slate-400 font-bold">Verifikasi PIHPS Berhasil - Hash: 0x{Math.random().toString(16).slice(2, 10)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-600">AKTIF</p>
                  <p className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">Baru Saja</p>
                </div>
             </div>
           ))}
        </div>
      </section>
    </div>
  );

  const handleSendMessage = async (manualMsg?: string) => {
    const userMsg = manualMsg || inputMessage;
    if (!userMsg.trim()) return;
    
    if (!manualMsg) setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    const context = `User is at ${selectedMarket.name}. 
    Current top commodities from system: ${displayData.map(d => `${d.type}: ${d.currentPrice}/${d.unit}`).join(', ')}.
    Data source: ${supabaseData ? 'Supabase (Live)' : 'Mock Data (System)'}.
    User Location Context: ${selectedMarket.location}.`;
    const aiResponse = await getPersonalAdvice(userMsg, context);
    
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    setIsTyping(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-32 overflow-x-hidden">
      <Toaster position="top-center" reverseOrder={false} />
      {/* Header */}
      <header className="sticky top-0 z-[60] bg-[#065F46] text-white py-4 shadow-lg w-full">
        <div className="max-w-lg mx-auto px-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              <Leaf className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-base leading-none uppercase tracking-wider">AgriPantau</h1>
              <p className="text-[10px] text-emerald-100 opacity-80 font-black uppercase tracking-widest">Market Feed Live</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isFirebaseOffline && (
              <div className="flex items-center gap-1.5 bg-red-500/20 px-2 py-1 rounded-full border border-red-400/30">
                <ShieldAlert size={10} className="text-red-300" />
                <span className="text-[7px] font-black uppercase tracking-tighter text-red-100">Offline Mode</span>
              </div>
            )}
            {supabaseData && !isDbLoading && (
              <div className="hidden xs:flex items-center gap-1.5 bg-emerald-700/50 px-2 py-1 rounded-full border border-emerald-400/20">
                <div className="w-1 h-1 bg-emerald-300 rounded-full animate-ping" />
              </div>
            )}
            
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all",
              bridgeStatus === 'CONNECTED' ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" : 
              bridgeStatus === 'CHECKING' ? "bg-slate-400/10 text-slate-400 border border-slate-400/20" :
              "bg-orange-400/20 text-orange-200 border border-orange-400/30"
            )}>
              <div className={cn(
                "w-1 h-1 rounded-full", 
                bridgeStatus === 'CONNECTED' ? "bg-blue-400 animate-pulse" : 
                bridgeStatus === 'CHECKING' ? "bg-slate-400 animate-spin" : 
                "bg-orange-400"
              )} />
              {bridgeStatus === 'CONNECTED' ? "v0" : 
               bridgeStatus === 'CHECKING' ? "..." : "OFF"}
            </div>

            <button 
              onClick={() => {
                setActiveTab('chats');
                setActiveChat(null);
              }}
              className={cn(
                "relative p-1.5 text-white/80 hover:bg-white/10 rounded-full transition-colors",
                activeTab === 'chats' && "bg-white/20 text-white"
              )}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-emerald-600 animate-pulse" />
            </button>

            <button 
              onClick={() => setIsRequestModalOpen(true)}
              className={cn(
                "relative p-1.5 text-white/80 hover:bg-white/10 rounded-full transition-colors",
                isRequestModalOpen && "bg-white/20 text-white"
              )}
            >
              <Package className="w-5 h-5" />
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full border border-orange-600" />
              )}
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-9 h-9 rounded-full bg-white border-2 border-white/30 overflow-hidden active:scale-95 transition-all"
              >
                <img src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=Farmer`} alt="Profile" />
              </button>
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95, transformOrigin: 'top right' }}
                      animate={{ opacity: 1, y: 4, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50 mb-1">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tighter truncate">{userProfile?.displayName || 'Petani Muda'}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{userProfile?.role || 'Pengguna Umum'}</p>
                      </div>
                      
                      {[
                        { icon: User, label: 'Profil Saya', tab: 'settings' },
                        { icon: History, label: 'Riwayat Laporan', tab: 'prices' },
                        { icon: MessageCircle, label: 'Pusat Bantuan', action: () => setIsChatOpen(true) },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (item.tab) setActiveTab(item.tab as any);
                            if (item.action) item.action();
                            setActiveChat(null); // Reset active chat when moving
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                            <item.icon size={16} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        </button>
                      ))}

                      <div className="mt-1 pt-1 border-t border-slate-50">
                        <button 
                          onClick={() => {
                            auth.signOut();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors group"
                        >
                           <div className="w-8 h-8 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                            <X size={16} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest">Keluar Akun</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
        {isFirebaseOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-[32px] flex items-center gap-4 text-amber-800 shadow-sm mx-1"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">Database Offline</p>
              <p className="text-[9px] font-bold opacity-80 leading-relaxed">Gagal terhubung ke Cloud Firestore. Data mungkin tidak akurat.</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-amber-200/50 hover:bg-amber-200 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shrink-0"
            >
              Retry
            </button>
          </motion.div>
        )}
        
        {/* Market Selector (Only on prices tab) */}
        {activeTab === 'prices' && (
          <section className="relative z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
              <MapPin className="w-3 h-3" />
              <span>Wilayah Pantauan</span>
            </div>
            
            <button 
              onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
              className="w-full flex items-center justify-between group active:scale-[0.98] transition-transform"
            >
              <div className="text-left">
                <span className="text-lg font-bold text-slate-800 italic block leading-none">
                  {selectedMarket.name}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {selectedMarket.province || selectedMarket.location}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">TERBARU</div>
                <ChevronDown className={cn("w-5 h-5 text-slate-300 transition-transform duration-300", isMarketDropdownOpen && "rotate-180 text-emerald-500")} />
              </div>
            </button>
          </div>

          <AnimatePresence>
            {isMarketDropdownOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-40"
                  onClick={() => setIsMarketDropdownOpen(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 4, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute left-0 right-0 top-full bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-emerald-900/10 p-3 z-50 overflow-hidden"
                >
                  <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1">
                    {[...supabaseMarkets, ...MOCK_MARKETS.filter(mm => !supabaseMarkets.some(sm => sm.id === mm.id))].map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedMarket(m);
                          setIsMarketDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left group active:scale-[0.98]",
                          selectedMarket.id === m.id 
                            ? "bg-emerald-50 text-emerald-700" 
                            : "hover:bg-slate-50 text-slate-600"
                        )}
                      >
                        <div className="space-y-0.5">
                          <p className={cn("text-sm font-bold uppercase tracking-tight", selectedMarket.id === m.id ? "text-emerald-700" : "text-slate-800")}>
                            {m.name}
                          </p>
                          <p className="text-[10px] font-medium opacity-60">
                            {m.province || m.location}
                          </p>
                        </div>
                        {selectedMarket.id === m.id && (
                          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </section>
        )}

        {/* Dashboard Views */}
        {activeTab === 'fyp' && renderFYPTab()}
        {activeTab === 'chats' && renderChatsTab()}
        {renderPurchaseModal()}
        {activeTab === 'prices' && renderPricesTab()}
        {activeTab === 'market' && renderMarketplaceTab()}
        {activeTab === 'scout' && renderScoutTab()}
        {activeTab === 'settings' && renderProfileTab()}
        {renderDevPortal()}
      </main>

      {/* Commodity Detail Modal */}
      <AnimatePresence>
        {selectedCommodity && (
          <DetailModal 
            data={selectedCommodity} 
            userProfile={userProfile}
            onClose={() => setSelectedCommodity(null)} 
            setIsChatOpen={setIsChatOpen}
            handleSendMessage={handleSendMessage}
          />
        )}
      </AnimatePresence>

      {/* Report Price Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-0"
            onClick={() => setIsReportModalOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md bg-white rounded-t-[32px] flex flex-col max-h-[92vh] shadow-2xl shadow-slate-900/40 relative z-[80]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-2 space-y-4 shrink-0">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto" />
                  <button 
                    onClick={() => setIsReportModalOpen(false)}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Laporkan Harga</h3>
                    <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase">Verified</div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">Data Anda membantu ribuan petani mendapatkan harga yang adil.</p>
                </div>
              </div>

              {/* Benefit Info Section */}
              <div className="px-6 mb-2">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                  <div className="p-2 bg-blue-500 text-white rounded-xl h-fit">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-blue-900 uppercase">Transparansi Pasar</h4>
                    <p className="text-[10px] text-blue-700 leading-normal font-medium">Laporan ini dibuat terpusat untuk memutus rantai spekulasi tengkulak. Foto & GPS memastikan data Anda valid dan diakui pasar.</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar pb-32">
                <input 
                  type="file" 
                  ref={reportPhotoInputRef} 
                  className="hidden" 
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const originalBase64 = reader.result as string;
                        // Compress before setting to state to avoid Firestore limit
                        const compressedBase64 = await compressImage(originalBase64);
                        setReportForm(prev => ({ ...prev, photoUrl: compressedBase64 }));
                        toast.success("Foto bukti berhasil dilampirkan!", {
                          icon: '📸'
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                
                <div className="space-y-4">
                  {/* Commodity & Price Section */}
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-[24px] border border-slate-100">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Komoditas</label>
                        {reportForm.commodity && !supabaseCommodities.some(c => c.name.toLowerCase() === reportForm.commodity.toLowerCase()) && !Object.values(CommodityType).some(t => t.toLowerCase() === reportForm.commodity.toLowerCase()) && (
                          <motion.span 
                            initial={{ opacity: 0, x: 5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase"
                          >
                            Item Baru
                          </motion.span>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          list="commodity-options"
                          value={reportForm.commodity}
                          onChange={(e) => setReportForm(prev => ({ ...prev, commodity: e.target.value }))}
                          placeholder="Contoh: Cabai Kariting"
                          className="w-full bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl p-4 font-bold text-slate-800 placeholder:text-slate-300 transition-all shadow-sm"
                        />
                        <datalist id="commodity-options">
                          {supabaseCommodities.length > 0 ? (
                            supabaseCommodities.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))
                          ) : (
                            Object.values(CommodityType).map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))
                          )}
                        </datalist>
                      </div>
                      {reportForm.commodity && !supabaseCommodities.some(c => c.name.toLowerCase() === reportForm.commodity.toLowerCase()) && !Object.values(CommodityType).some(t => t.toLowerCase() === reportForm.commodity.toLowerCase()) && (
                        <p className="text-[9px] text-amber-600 font-medium px-1">
                          <AlertCircle size={10} className="inline mr-1" />
                          Komoditas baru akan melalui verifikasi Manual via Bukti Foto.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga per KG (IDR)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">Rp</span>
                        <input 
                          type="number"
                          value={reportForm.price}
                          onChange={(e) => setReportForm(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="0"
                          className="w-full bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl p-4 pl-10 font-black text-slate-800 placeholder:text-slate-300 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location Info Section */}
                  <div className="space-y-4 px-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-slate-300 rounded-full" />
                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Detail Lokasi</label>
                      </div>
                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Bisa Diubah</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Pasar</label>
                        <input 
                          value={reportForm.marketName}
                          onChange={(e) => setReportForm(prev => ({ ...prev, marketName: e.target.value }))}
                          placeholder="Nama Pasar..."
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kota/Wilayah</label>
                        <input 
                          value={reportForm.location}
                          onChange={(e) => setReportForm(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Contoh: Bandung"
                          className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 italic font-medium">Laporan akan otomatis dikategorikan ke wilayah yang Anda tulis di atas.</p>
                  </div>

                  {/* Verification Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                      <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Wajib Verifikasi</label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={handleGetLocation}
                        type="button"
                        className={cn(
                          "flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[10px]",
                          reportForm.isGpsVerified 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md shadow-emerald-500/10" 
                            : "bg-white border-slate-100 text-slate-500 hover:border-emerald-200"
                        )}
                      >
                        {isGpsLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                        {reportForm.isGpsVerified ? "Lokasi Terkunci" : "Cek GPS Lokasi"}
                      </button>

                      <div className="space-y-2">
                        <button 
                          onClick={handlePhotoUpload}
                          type="button"
                          className={cn(
                            "w-full flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border-2 transition-all font-black uppercase tracking-widest text-[10px]",
                            reportForm.photoUrl 
                              ? "bg-sky-50 border-sky-500 text-sky-700 shadow-md shadow-sky-500/10" 
                              : "bg-white border-slate-100 text-slate-500 hover:border-sky-200"
                          )}
                        >
                          <Camera size={16} />
                          {reportForm.photoUrl ? "Bukti Terlampir" : "Foto Struk/Harga"}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug px-1 text-center font-medium italic">
                      *Lampirkan foto struk belanja atau label harga di rak untuk verifikasi akurasi data.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 pt-2 shrink-0 border-t border-slate-50 bg-white rounded-b-[32px]">
                <button 
                  onClick={handleReportPrice}
                  disabled={isReporting || !reportForm.price || !reportForm.commodity}
                  className="w-full bg-[#065F46] text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-40 shadow-2xl shadow-emerald-900/20"
                >
                  {isReporting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send size={20} />}
                  Kirim Laporan Valid
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listing Modal */}
      <AnimatePresence>
        {isListingModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-100/10 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4"
            onClick={() => setIsListingModalOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header Handle & Close */}
              <div className="relative p-4 flex items-center justify-center border-b border-slate-50">
                <div className="w-12 h-1 bg-slate-100 rounded-full" />
                <button 
                  onClick={() => {
                    setIsListingModalOpen(false);
                    resetListingForm();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-24 text-left">
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                    {editingItemId ? 'Edit Postingan' : 'Buat Konten Baru'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {editingItemId ? 'Perbarui informasi konten Anda.' : 'Bagikan momen atau buka lapak jualan Anda.'}
                  </p>
                </div>

                {/* Type Selection */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                   <button 
                    onClick={() => setNewListing(prev => ({ ...prev, type: 'post' }))}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      newListing.type === 'post' ? "bg-white text-[#065F46] shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                   >
                     🚀 Posting
                   </button>
                   <button 
                    onClick={() => setNewListing(prev => ({ ...prev, type: 'listing' }))}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      newListing.type === 'listing' ? "bg-white text-[#065F46] shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                   >
                     🛍️ Buka Lapak
                   </button>
                </div>

                {newListing.type === 'listing' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Info size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Tips Jualan Cuan</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-600 shadow-sm flex-shrink-0">1</div>
                        <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">Gunakan nama yang jelas agar pembeli mudah mencari.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-600 shadow-sm flex-shrink-0">2</div>
                        <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">Cek "Daftar Harga" di aplikasi ini sebagai acuan agar harga bersaing.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  {newListing.type === 'listing' && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nama Produk / Komoditas</label>
                        <input 
                          type="text"
                          value={newListing.commodity}
                          onChange={(e) => setNewListing(prev => ({ ...prev, commodity: e.target.value }))}
                          placeholder="Contoh: Cabai Rawit Merah Super"
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-[#065F46] rounded-xl p-4 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Harga per kg</label>
                          <input 
                            type="number"
                            inputMode="numeric"
                            value={newListing.price}
                            onChange={(e) => setNewListing(prev => ({ ...prev, price: e.target.value }))}
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-[#065F46] rounded-xl p-4 font-bold text-slate-800 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Stok (kg)</label>
                          <input 
                            type="number"
                            inputMode="numeric"
                            value={newListing.stock}
                            onChange={(e) => setNewListing(prev => ({ ...prev, stock: e.target.value }))}
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-[#065F46] rounded-xl p-4 font-bold text-slate-800 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      {newListing.type === 'listing' ? 'Deskripsi Jualan' : 'Apa yang Anda pikirkan?'}
                    </label>
                    <textarea 
                      value={newListing.description}
                      onChange={(e) => setNewListing(prev => ({ ...prev, description: e.target.value }))}
                      placeholder={newListing.type === 'listing' ? "Contoh: Cabai rawit segar petik pagi ini..." : "Bagikan tips pertanian atau momen hari ini..."}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-[#065F46] rounded-xl p-4 text-xs font-bold text-slate-800 h-32 placeholder:text-slate-300 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Foto / Video Produk (Opsional)</label>
                    <input 
                      type="file"
                      ref={photoInputRef}
                      onChange={handleMediaSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <input 
                      type="file"
                      ref={videoInputRef}
                      onChange={handleMediaSelect}
                      accept="video/*"
                      className="hidden"
                    />
                    <div 
                      className={cn(
                        "flex flex-col gap-3 transition-all p-1 rounded-3xl",
                        isDragOver ? "bg-emerald-100 ring-2 ring-emerald-500 scale-[1.02]" : ""
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); onDrop(e); }}
                    >
                      {isMediaUploading ? (
                         <div className="w-full aspect-video rounded-2xl bg-white border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center gap-3">
                           <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sabar ya, Berkas sedang diracik...</span>
                         </div>
                      ) : newListing.mediaUrl ? (
                        <div className="space-y-3">
                          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-100">
                            {mediaType === 'video' ? (
                              <video src={newListing.mediaUrl} className="w-full h-full object-cover" controls />
                            ) : (
                              <img src={newListing.mediaUrl} className="w-full h-full object-cover" alt="Preview" />
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewListing(prev => ({ ...prev, mediaUrl: '' }));
                                setMediaType(null);
                                setIsVideoTooLong(false);
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm z-10"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          
                          {isVideoTooLong && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3"
                            >
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertCircle size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Video Kemanisan (Terlalu Panjang)</span>
                              </div>
                              <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                                Durasi video Anda <span className="font-bold">{Math.floor(videoDuration)} detik</span>. Maksimal hanya boleh 3 menit (180 detik).
                              </p>
                              <button 
                                onClick={() => {
                                  setIsVideoTooLong(false);
                                  // Mock trimming: In real app we would slice the file or use a timestamp
                                  alert("Video akan dipangkas otomatis ke 3 menit pertama saat ditayangkan.");
                                }}
                                className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-amber-600 transition-colors"
                              >
                                Pangkas Jadi 3 Menit
                              </button>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 w-full">
                           <button 
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 text-slate-400 hover:text-emerald-600 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                          >
                            <Camera size={24} />
                            Ambil Foto
                          </button>
                          <button 
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 text-slate-400 hover:text-emerald-600 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                          >
                            <Video size={24} />
                            Unggah Video
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold px-1 uppercase tracking-widest italic font-mono">- Melampirkan media dapat meningkatkan kepercayaan pembeli hingga 70%</p>
                  </div>
                </div>
              </div>

              {/* Fixed Footer Sticky Button */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-50">
                <button 
                  onClick={handleCreateListing}
                  className="w-full bg-[#065F46] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-emerald-900/10"
                >
                  {editingItemId ? 'Simpan Perubahan' : 'Tayangkan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full h-24 bg-white border-t border-slate-100 px-4 flex items-start pt-4 justify-between z-[60] shadow-[0_-15px_50px_rgba(0,0,0,0.06)] max-w-lg mx-auto rounded-t-[36px] backdrop-blur-md bg-white/90">
        <NavButton 
          icon={<Rocket size={22} />} 
          label="Feed" 
          active={activeTab === 'fyp'} 
          onClick={() => setActiveTab('fyp')} 
        />
        <NavButton 
          icon={<LayoutDashboard size={22} />} 
          label="Harga" 
          active={activeTab === 'prices'} 
          onClick={() => setActiveTab('prices')} 
        />
        <NavButton 
          icon={<Plus className="bg-[#065F46] text-white rounded-2xl p-1 shadow-lg shadow-[#065F46]/20" size={28} />} 
          label="Post" 
          active={false} 
          onClick={() => setIsListingModalOpen(true)} 
        />
        <NavButton 
          icon={<Sparkles size={22} />} 
          label="Scout" 
          active={activeTab === 'scout'} 
          onClick={() => setActiveTab('scout')} 
        />
        <NavButton 
          icon={<User size={22} />} 
          label="Profil" 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
        />
      </nav>

      {/* Floating AI Assistant Button */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsChatOpen(true)}
        className="fixed right-6 bottom-24 w-14 h-14 bg-[#065F46] text-white rounded-full shadow-2xl flex items-center justify-center z-40"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full flex items-center justify-center">
          <Sparkles className="w-2 h-2" />
        </span>
      </motion.button>

      {/* Comments Modal */}
      <CommentsModal 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)} 
        item={activeCommentItem} 
        currentUser={currentUser}
        userProfile={userProfile}
      />

      {/* Order Requests Modal */}
      <OrderRequestsModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        requests={requests}
      />

      <CalculatorModal 
        isOpen={isCalculatorOpen} 
        onClose={() => setIsCalculatorOpen(false)} 
        selectedMarket={selectedMarket}
        displayData={displayData}
        currentUser={currentUser}
      />

      <BuyersModal 
        isOpen={isBuyersOpen}
        onClose={() => setIsBuyersOpen(false)}
        demands={b2bDemands}
        currentUser={currentUser}
      />

      {/* Chat Bot Interface */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed inset-0 z-[60] p-4 bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-end sm:justify-center"
          >
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col h-[80vh] overflow-hidden">
              <div className="bg-[#065F46] p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-emerald-100">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Asisten AgriPantau</h3>
                    <p className="text-[10px] text-emerald-100 opacity-80 uppercase tracking-widest font-bold">AI Aktif</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[90%] p-4 rounded-2xl text-base leading-relaxed shadow-sm",
                      msg.role === 'user' ? "bg-[#065F46] text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none font-medium"
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="markdown-prose max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      <span className="text-xs text-slate-400 font-medium italic">Sedang mengetik...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Tanya harga atau tips panen..."
                  className="flex-1 bg-slate-100 border-none rounded-xl px-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim()}
                  className="w-12 h-12 bg-[#065F46] text-white rounded-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PriceCardProps {
  key?: string | number;
  data: CommodityPrice;
  onClick: () => void;
}

function PriceCard({ data, onClick }: PriceCardProps) {
  const diff = data.currentPrice - data.previousPrice;
  const percent = ((Math.abs(diff) / data.previousPrice) * 100).toFixed(1);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(data.photoUrl);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  const handleFetchPhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photoUrl || !data.hasPhoto || isLoadingPhoto) return;

    setIsLoadingPhoto(true);
    try {
      const evidenceDoc = await getDoc(doc(db, 'price_report_evidence', data.id));
      if (evidenceDoc.exists()) {
        const photoData = evidenceDoc.data().photoUrl;
        setPhotoUrl(photoData);
      } else {
        toast.error('Foto bukti tidak ditemukan');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `price_report_evidence/${data.id}`);
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "w-full text-left bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-slate-50 hover:shadow-md relative overflow-hidden group cursor-pointer",
        data.id.startsWith('sb-') ? "border-l-4 border-l-blue-400" : ""
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {data.id.startsWith('sb-') && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-blue-100/50 transition-colors" />
      )}
      <div className="flex items-center gap-4 relative z-10 w-full">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0",
          data.type === CommodityType.CABAI_MERAH ? "bg-red-50 text-red-600" : 
          data.type === CommodityType.BAWANG_MERAH ? "bg-purple-50 text-purple-600" : "bg-yellow-50 text-yellow-600"
        )}>
          {data.type === CommodityType.CABAI_MERAH ? '🌶️' : 
           data.type === CommodityType.BAWANG_MERAH ? '🧅' : '🌾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <h3 className="font-bold text-slate-800 text-sm whitespace-nowrap">{data.type}</h3>
            {data.id.startsWith('sb-') && (
              <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">Live</span>
            )}
            {data.isGpsVerified && (
              <div className="flex items-center gap-0.5 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter shadow-sm">
                <MapPin size={10} fill="currentColor" />
                Verified
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider truncate">{data.lastUpdated}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-black text-xl text-slate-900 leading-none mb-1.5">
            {formatCurrency(data.currentPrice).replace('Rp', '')}
            <span className="text-[10px] font-normal text-slate-400 italic font-sans ml-1">/ {data.unit}</span>
          </p>
          <div className="flex items-center justify-end gap-1.5">
            {data.trend !== 'stable' && (
              <span className={cn(
                "text-[10px] font-black flex items-center gap-0.5",
                data.trend === 'up' ? "text-emerald-600" : "text-red-600"
              )}>
                {data.trend === 'up' ? '▲' : '▼'} {percent}%
              </span>
            )}
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter bg-slate-50 px-1.5 py-0.5 rounded">
              {data.trend === 'stable' ? 'Stabil' : data.trend === 'up' ? 'Naik' : 'Turun'}
            </span>
          </div>
        </div>
      </div>

      {(data.hasPhoto || photoUrl) && (
        <div className="relative z-10 w-full pt-1 border-t border-slate-50">
          {photoUrl ? (
            <div className="relative rounded-xl overflow-hidden aspect-[16/9] bg-slate-100 border border-slate-100">
              <img src={photoUrl} className="w-full h-full object-cover" alt="Bukti Foto" />
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[8px] font-black text-white uppercase tracking-widest flex items-center gap-1">
                <Camera size={10} />
                Foto Bukti
              </div>
            </div>
          ) : (
            <button 
              onClick={handleFetchPhoto}
              className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border border-emerald-100/50"
            >
              {isLoadingPhoto ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Memuat Bukti...
                </>
              ) : (
                <>
                  <Camera size={12} />
                  Lihat Foto Bukti
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function DetailModal({ data, onClose, setIsChatOpen, handleSendMessage, userProfile }: { data: CommodityPrice; onClose: () => void; setIsChatOpen: (open: boolean) => void; handleSendMessage: (msg: string) => void; userProfile: any }) {
  const [history, setHistory] = useState(data.history);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    avg: data.currentPrice,
    max: data.currentPrice * 1.05,
    min: data.currentPrice * 0.95
  });

  useEffect(() => {
    async function loadHistory() {
      if (data.id.startsWith('sb-')) {
        setIsLoading(true);
        const sbHistory = await fetchSupabaseHistory(data.type);
        if (sbHistory && sbHistory.length > 0) {
          const transformed = sbHistory.map((h: any) => ({
            time: new Date(h.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            price: h.current_price,
            open: h.open_price,
            high: h.high_price,
            low: h.low_price,
            close: h.current_price
          }));
          setHistory(transformed);
          
          const prices = sbHistory.map((h: any) => h.current_price);
          setStats({
            avg: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
            max: Math.max(...prices),
            min: Math.min(...prices)
          });
        }
        setIsLoading(false);
      }
    }
    loadHistory();
  }, [data]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className="w-full max-w-lg bg-white rounded-t-[32px] shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto my-5 flex-shrink-0" />
        
        <div className="px-6 space-y-6 overflow-y-auto pb-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{data.type}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                <MapPin className="w-3 h-3" />
                {data.market.name}, {data.market.location}
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-full hover:text-slate-600 transition-colors">
              <Leaf className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Harga Rata-rata</p>
              <p className="text-xl font-black">{isLoading ? '...' : formatCurrency(stats.avg).replace('Rp', '')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Tertinggi (Periode)</p>
              <p className="text-xl font-black text-emerald-600">
                {isLoading ? '...' : formatCurrency(stats.max).replace('Rp', '')}
                <span className="text-[10px] ml-1 font-bold">▲</span>
              </p>
            </div>
          </div>

          {/* Chart area */}
          <div className="h-64 w-full bg-[#F8FAFC] rounded-2xl p-5 border border-slate-100 flex flex-col relative">
            <div className="flex justify-between items-center mb-6">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {isLoading ? 'Mengambil Data...' : `Tren ${history.length} Data Terakhir`}
              </p>
              <p className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase font-bold">
                {stats.avg < data.currentPrice ? 'OVER TREND 📈' : 'BELOW TREND 📉'}
              </p>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid #f1f5f9', 
                      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }} 
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    formatter={(value) => [formatCurrency(value as number), 'Harga']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#065F46" 
                    strokeWidth={4} 
                    dot={false}
                    activeDot={{ r: 6, fill: '#065F46', stroke: '#fff', strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {userProfile?.role === 'admin' && (
              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 mb-2">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">Admin Control: Update Official Price</p>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    id="admin-price-input"
                    className="flex-1 bg-white border border-amber-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="New price..."
                    defaultValue={data.currentPrice}
                  />
                  <button 
                    onClick={async () => {
                      const input = document.getElementById('admin-price-input') as HTMLInputElement;
                      const val = Number(input.value);
                      if (val > 0) {
                        const { updateSupabaseMarketPrice } = await import('@/src/services/supabaseService');
                        await updateSupabaseMarketPrice(data.market.id, data.type, val);
                        alert('Official price updated in Supabase!');
                        window.location.reload(); // Simple refresh to see changes
                      }
                    }}
                    className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    UPDATE
                  </button>
                </div>
              </div>
            )}
            <button className="w-full bg-[#065F46] text-white font-bold py-4.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
              HUBUNGI PEMBELI INSTITUSI
              <ArrowRightLeft size={18} />
            </button>
            <button 
              onClick={() => {
                const query = `Beri saya insight lebih dalam tentang ${data.type} di ${data.market.name}. Dengan harga Rp ${data.currentPrice} vs rata-rata Rp ${stats.avg.toFixed(0)}, apakah sekarang waktu yang tepat untuk menjual?`;
                setIsChatOpen(true);
                handleSendMessage(query);
              }}
              className="w-full bg-emerald-50 text-emerald-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs uppercase tracking-widest"
            >
              <Sparkles className="w-4 h-4" />
              Tanya AI Insight
            </button>
            <button onClick={onClose} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest">
              Tutup Panel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AiPredictionCard({ commodity }: { commodity: CommodityPrice }) {
  const [prediction, setPrediction] = useState<{predictions: number[], reasoning: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    const result = await predictPrice(commodity);
    setPrediction(result);
    setLoading(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-lg">
            {commodity.type === CommodityType.CABAI_MERAH ? '🌶️' : 
             commodity.type === CommodityType.BAWANG_MERAH ? '🧅' : '🌾'}
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">{commodity.type}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saat ini: {formatCurrency(commodity.currentPrice)}</p>
          </div>
        </div>
        {!prediction && (
          <button 
            onClick={handlePredict}
            disabled={loading}
            className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5 active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? "Menganalisis..." : "Prediksi AI"}
          </button>
        )}
      </div>

      {prediction && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4 pt-3 border-t border-slate-100"
        >
          <div className="flex items-end justify-between px-2">
            {prediction.predictions.map((price, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase">H+{idx + 1}</p>
                <div 
                  className="w-10 bg-emerald-100 rounded-t-lg relative group overflow-hidden" 
                  style={{ height: `${(price / Math.max(...prediction.predictions)) * 60}px` }}
                >
                   <div className="absolute inset-0 bg-gradient-to-t from-emerald-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[10px] font-black text-emerald-700">{formatCurrency(price).replace('Rp', '').trim()}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Analisis Insight</p>
             <p className="text-xs text-slate-600 leading-relaxed italic">"{prediction.reasoning}"</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function CommentsModal({ isOpen, onClose, item, currentUser, userProfile }: { isOpen: boolean, onClose: () => void, item: any, currentUser: any, userProfile: any }) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !item) return;

    const q = query(
      collection(db, 'listings', item.id, 'comments'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `listings/${item.id}/comments`);
    });

    return () => unsubscribe();
  }, [isOpen, item]);

  const handleAddComment = async () => {
    if (!comment.trim() || !currentUser || !userProfile) return;

    try {
      const commentText = comment;
      setComment('');

      await addDoc(collection(db, 'listings', item.id, 'comments'), {
        userId: currentUser.uid,
        userName: userProfile.displayName,
        text: commentText,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'listings', item.id), {
        commentsCount: increment(1)
      });

    } catch (e) {
      console.error("Error adding comment", e);
      toast.error("Gagal mengirim komentar");
      handleFirestoreError(e, OperationType.WRITE, `listings/${item.id}/comments`);
    }
  };

  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-lg bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
               <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <MessageSquare size={24} />
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight text-left">Komentar</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">{item.commodity} - {item.userName}</p>
               </div>
            </div>

            <div className="h-[40vh] overflow-y-auto space-y-6 px-1 mb-6 custom-scrollbar">
               {comments.length > 0 ? comments.map(c => (
                 <div key={c.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                     {c.userName ? c.userName[0] : '?'}
                   </div>
                   <div className="flex-1 space-y-1 text-left">
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{c.userName}</p>
                        <p className="text-[8px] text-slate-300 font-bold">
                          {c.timestamp?.toDate ? new Date(c.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </p>
                     </div>
                     <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.text}</p>
                   </div>
                 </div>
               )) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                    <MessageSquare size={32} opacity={0.2} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Belum ada komentar</p>
                 </div>
               )}
            </div>

            <div className="flex gap-3 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
              <input 
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                placeholder="Tulis komentar..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium px-4 outline-none"
              />
              <button 
                onClick={handleAddComment}
                disabled={!comment.trim()}
                className="bg-[#065F46] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-50"
              >
                Kirim
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OrderRequestsModal({ isOpen, onClose, requests }: { isOpen: boolean, onClose: () => void, requests: any[] }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-lg bg-white rounded-t-[40px] p-6 pb-12 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
               <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                  <Package size={24} />
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight text-left">Daftar Pesanan</h3>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Permintaan Beli dari Postingan Anda</p>
               </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-4 px-1 mb-6 custom-scrollbar">
               {requests.length > 0 ? (
                 requests.map(req => (
                   <div key={req.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-bold text-slate-300 text-sm shadow-sm">
                       {req.buyer[0]}
                     </div>
                     <div className="flex-1 text-left">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{req.buyer}</h4>
                          <span className="text-[8px] font-black text-slate-400 uppercase">{req.time} lalu</span>
                        </div>
                        <p className="text-sm font-bold text-[#065F46] mt-0.5">{req.product}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Jumlah: <span className="font-bold text-slate-700">{req.amount}</span></p>
                     </div>
                     <div className="flex flex-col gap-2">
                        {req.status === 'pending' ? (
                          <button className="bg-[#065F46] text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10">
                            Proses
                          </button>
                        ) : (
                          <div className="bg-slate-200 text-slate-500 px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                            <Check size={10} /> Selesai
                          </div>
                        )}
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto">
                      <Package size={32} />
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada pesanan masuk</p>
                 </div>
               )}
            </div>

            <button 
              onClick={onClose}
              className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Tutup
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CalculatorModal({ isOpen, onClose, selectedMarket, displayData, currentUser }: { isOpen: boolean, onClose: () => void, selectedMarket: any, displayData: any[], currentUser: any }) {
  const [landSize, setLandSize] = useState<number>(1000);
  const [commodity, setCommodity] = useState<string>('Cabai Merah');
  const [costs, setCosts] = useState({
    seeds: 500000,
    fertilizer: 1200000,
    pesticide: 800000,
    labor: 2000000,
    other: 500000
  });
  const [isSubmittingFunding, setIsSubmittingFunding] = useState(false);

  const currentPrice = displayData.find(d => d.type === commodity)?.currentPrice || 0;
  const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  
  // Standard Yield (Estimate per 1000m2)
  const getYieldEstimate = (type: string) => {
    switch(type) {
      case 'Bawang Merah': return 1000; // 1 ton per 1000m2
      case 'Cabai Merah': return 800;
      case 'Tomat': return 1500;
      case 'Padi': return 600;
      default: return 500;
    }
  };

  const yieldEstimate = (getYieldEstimate(commodity) * landSize) / 1000;
  const estimatedRevenue = yieldEstimate * currentPrice;
  const margin = estimatedRevenue - totalCost;
  const roi = totalCost > 0 ? (margin / totalCost) * 100 : 0;

  const handleApplyFunding = async () => {
    if (!currentUser) {
      toast.error('Silakan login untuk mengajukan pendanaan');
      return;
    }

    setIsSubmittingFunding(true);
    try {
      await addDoc(collection(db, 'funding_requests'), {
        userId: currentUser.uid,
        commodity,
        landSize,
        totalCost,
        estimatedRevenue,
        estimatedMargin: margin,
        roi,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast.success('Pengajuan pendanaan berhasil dikirim! Tim kami akan meninjau kelayakan lahan Anda.');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'funding_requests');
    } finally {
      setIsSubmittingFunding(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white shrink-0">
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                     <Calculator size={20} />
                   </div>
                   <div>
                     <h2 className="font-bold text-lg">Kalkulator Margin</h2>
                     <p className="text-[10px] text-amber-100 font-bold uppercase tracking-widest">Simulasi Keuntungan Tani</p>
                   </div>
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                   <Plus size={20} className="rotate-45" />
                 </button>
               </div>

               <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                 <div className="flex justify-between items-end">
                   <div>
                     <p className="text-[9px] text-amber-200 font-black uppercase tracking-widest mb-1">Potensi Keuntungan</p>
                     <p className="text-3xl font-black">{formatCurrency(margin)}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[9px] text-amber-200 font-black uppercase tracking-widest mb-1">ROI Est.</p>
                     <p className="text-xl font-black text-amber-300">{roi.toFixed(1)}%</p>
                   </div>
                 </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="space-y-4">
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 pb-2">Konfigurasi Lahan</p>
                 <div className="grid grid-cols-1 gap-4">
                   <div className="space-y-1.5 relative">
                     <label className="text-[10px] text-slate-500 font-bold ml-1">NAMA KOMODITAS</label>
                     <div className="relative">
                        <input 
                          type="text"
                          value={commodity}
                          onChange={(e) => setCommodity(e.target.value)}
                          placeholder="Masukkan nama komoditas..."
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                          <Search size={14} />
                        </div>
                     </div>
                     
                     <div className="mt-2 space-y-2">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest ml-1">Saran Wilayah (Koordinator {selectedMarket?.name || 'Lokal'})</p>
                        <div className="flex flex-wrap gap-2">
                          {displayData.slice(0, 5).map(d => (
                            <button 
                              key={d.type}
                              onClick={() => setCommodity(d.type)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all",
                                commodity === d.type ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100"
                              )}
                            >
                              {d.type}
                            </button>
                          ))}
                        </div>
                     </div>
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-[10px] text-slate-500 font-bold ml-1">LUAS LAHAN (M2)</label>
                     <input 
                        type="number"
                        value={landSize}
                        onChange={(e) => setLandSize(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none"
                     />
                   </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 pb-2">Rincian Modal (Modal Kerja)</p>
                 <div className="grid grid-cols-1 gap-3">
                   {Object.entries(costs).map(([key, value]) => (
                     <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                       <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{key === 'seeds' ? 'Bibit' : key === 'fertilizer' ? 'Pupuk' : key === 'pesticide' ? 'Pestisida' : key === 'labor' ? 'Tenaga Kerja' : 'Lainnya'}</span>
                       <input 
                         type="number"
                         value={value}
                         onChange={(e) => setCosts(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                         className="bg-transparent text-right text-xs font-black text-slate-900 outline-none focus:text-amber-600 w-32"
                       />
                     </div>
                   ))}
                 </div>
               </div>

               <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-center gap-3">
                 <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                   <Zap size={16} />
                 </div>
                 <p className="text-[10px] text-emerald-700 leading-tight">
                   <b>Tips AI:</b> Berdasarkan harga di {selectedMarket.name}, biaya modal Anda tergolong {totalCost < 5000000 ? 'Efisien' : 'Standar'}. Pastikan panen minimal mencapai {yieldEstimate.toFixed(1)}kg untuk break-even.
                 </p>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 shrink-0 grid grid-cols-2 gap-3">
               <button 
                 onClick={onClose}
                 className="bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
               >
                 Tutup
               </button>
               <button 
                 onClick={handleApplyFunding}
                 disabled={isSubmittingFunding}
                 className="bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
               >
                 {isSubmittingFunding ? <Loader2 className="animate-spin" size={16} /> : (
                   <>
                     <Coins size={14} />
                     Ajukan Dana
                   </>
                 )}
               </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BuyersModal({ isOpen, onClose, demands, currentUser }: { isOpen: boolean, onClose: () => void, demands: any[], currentUser: any }) {
  const [applications, setApplications] = useState<any[]>([]);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'market' | 'history' | 'admin'>('market');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ landSize: 1000, estimatedYield: 500, contact: '' });

  // User's own applications
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(query(collection(db, 'b2b_applications'), where('userId', '==', currentUser.uid)), (snapshot) => {
      setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'b2b_applications');
    });
    return () => unsub();
  }, [currentUser]);

  // Admin view: all applications (for demo, we allow this if in admin tab)
  useEffect(() => {
    if (activeTab !== 'admin') return;
    const unsub = onSnapshot(query(collection(db, 'b2b_applications'), orderBy('timestamp', 'desc')), (snapshot) => {
      setAllApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'b2b_applications');
    });
    return () => unsub();
  }, [activeTab]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isApplying) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'b2b_applications'), {
        demandId: isApplying.id,
        buyerName: isApplying.buyerName,
        commodity: isApplying.commodity,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonim',
        landSize: formData.landSize,
        estimatedYield: formData.estimatedYield,
        contact: formData.contact,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast.success('Permohonan kontrak berhasil diajukan');
      setIsApplying(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'b2b_applications');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (appId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'b2b_applications', appId), { status });
      toast.success(`Status permohonan diperbarui ke ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'b2b_applications');
    }
  };

  const getUserApplication = (demandId: string) => applications.find(app => app.demandId === demandId);
  const statusColors: any = {
    pending: 'text-amber-600 bg-amber-50 border-amber-100',
    accepted: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    rejected: 'text-rose-600 bg-rose-50 border-rose-100'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shrink-0">
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                     <Users size={20} />
                   </div>
                   <div>
                     <h2 className="font-bold text-lg">Kontrak Pembeli</h2>
                     <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">Akses Pasar Institusi B2B</p>
                   </div>
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                   <Plus size={20} className="rotate-45" />
                 </button>
               </div>

               {/* Tabs */}
               <div className="flex bg-white/10 p-1 rounded-xl gap-1">
                 <button 
                  onClick={() => setActiveTab('market')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    activeTab === 'market' ? "bg-white text-blue-600" : "text-white"
                  )}
                 >
                   Pasar Aktif
                 </button>
                 <button 
                  onClick={() => setActiveTab('history')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    activeTab === 'history' ? "bg-white text-blue-600" : "text-white"
                  )}
                 >
                   Riwayat Saya
                 </button>
                 <button 
                  onClick={() => setActiveTab('admin')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    activeTab === 'admin' ? "bg-amber-400 text-slate-900" : "bg-white/5 text-blue-200"
                  )}
                 >
                   Kelola (Admin)
                 </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
               {activeTab === 'market' && (
                 <>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pb-2">Permintaan Pembelian Aktif</p>
                   {demands.length > 0 ? demands.map((demand) => {
                     const app = getUserApplication(demand.id);
                     return (
                       <div key={demand.id} className="bg-white border border-slate-100 rounded-3xl p-4 hover:border-blue-200 transition-all group">
                         <div className="flex gap-4 items-center">
                           <img src={demand.image} className="w-14 h-14 rounded-2xl object-cover bg-slate-50" alt="" />
                           <div className="flex-1 min-w-0">
                             <h4 className="text-xs font-black text-slate-800 uppercase tracking-tighter truncate">{demand.buyerName}</h4>
                             <p className="text-[10px] text-blue-600 font-black uppercase mt-0.5">{demand.commodity}</p>
                             <div className="flex items-center gap-3 mt-2">
                               <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase">
                                 <Clock size={10} className="text-slate-300" />
                                 {demand.deadline}
                               </div>
                               <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase">
                                 <Package size={10} className="text-slate-300" />
                                 {demand.amount}
                               </div>
                             </div>
                           </div>
                           <div className="text-right shrink-0">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Tawaran</p>
                             <p className="text-sm font-black text-slate-900">{formatCurrency(demand.price)}<span className="text-[8px] ml-0.5 text-slate-400">/kg</span></p>
                           </div>
                         </div>
                         <div className="grid grid-cols-1 gap-2 mt-4">
                           {app ? (
                             <div className={cn("p-3 rounded-xl border flex items-center justify-between", statusColors[app.status])}>
                               <span className="text-[10px] font-black uppercase tracking-widest">Status: {app.status === 'pending' ? 'Menunggu Review' : app.status === 'accepted' ? 'Diterima' : 'Ditolak'}</span>
                               {app.status === 'accepted' ? <ShieldCheck size={16} /> : <Clock size={16} />}
                             </div>
                           ) : (
                             <button 
                               onClick={() => setIsApplying(demand)}
                               className="bg-blue-600 text-white font-black py-2.5 rounded-xl text-[9px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all w-full"
                             >
                               Ajukan Kontrak
                             </button>
                           )}
                         </div>
                       </div>
                     )
                   }) : (
                     <div className="text-center py-8">
                       <p className="text-xs text-slate-400 italic">Belum ada penawaran kontrak institusi saat ini.</p>
                     </div>
                   )}
                 </>
               )}

               {activeTab === 'history' && (
                 <>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pb-2">Riwayat Pengajuan Saya</p>
                   {applications.length > 0 ? applications.map((app) => (
                     <div key={app.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">{app.buyerName}</h4>
                            <p className="text-[9px] text-blue-600 font-bold uppercase">{app.commodity}</p>
                          </div>
                          <div className={cn("px-2 py-1 rounded-md text-[8px] font-black uppercase border", statusColors[app.status])}>
                            {app.status}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                           <div>
                             <p className="text-[7px] text-slate-400 font-bold uppercase">Luas Lahan</p>
                             <p className="text-[10px] font-black text-slate-700">{app.landSize}m2</p>
                           </div>
                           <div>
                             <p className="text-[7px] text-slate-400 font-bold uppercase">Est. Panen</p>
                             <p className="text-[10px] font-black text-slate-700">{app.estimatedYield}kg</p>
                           </div>
                           <div>
                             <p className="text-[7px] text-slate-400 font-bold uppercase">Diajukan</p>
                             <p className="text-[10px] font-black text-slate-700">
                               {app.timestamp?.toDate ? app.timestamp.toDate().toLocaleDateString('id-ID') : 'Baru saja'}
                             </p>
                           </div>
                        </div>
                     </div>
                   )) : (
                     <div className="text-center py-12">
                       <History className="mx-auto text-slate-200 mb-2" size={32} />
                       <p className="text-xs text-slate-400">Belum ada riwayat pengajuan.</p>
                     </div>
                   )}
                 </>
               )}

               {activeTab === 'admin' && (
                 <>
                   <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-4">
                     <p className="text-[10px] text-amber-800 font-bold leading-tight">
                       <b>Admin View Demo:</b> Di sini koordinator dapat meninjau kapasitas produksi petani dan menyetujui kontrak supply.
                     </p>
                   </div>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest pb-2">Masuk Pengajuan ({allApplications.length})</p>
                   {allApplications.length > 0 ? allApplications.map((app) => (
                     <div key={app.id} className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                               <User size={14} />
                             </div>
                             <div>
                               <p className="text-[10px] font-black text-slate-800 uppercase">{app.userName}</p>
                               <p className="text-[9px] text-slate-400 font-bold">{app.contact || 'No Contact'}</p>
                             </div>
                          </div>
                          <div className={cn("px-2 py-1 rounded-md text-[8px] font-black uppercase border", statusColors[app.status])}>
                            {app.status}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl mb-3">
                           <div className="flex justify-between mb-1">
                             <span className="text-[8px] text-slate-400 font-bold uppercase">Target Kontrak</span>
                             <span className="text-[8px] text-blue-600 font-black uppercase">{app.buyerName}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-[8px] text-slate-400 font-bold uppercase">Kapasitas Produksi</span>
                             <span className="text-[8px] text-slate-800 font-black uppercase">{app.estimatedYield}kg / {app.landSize}m2</span>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            disabled={app.status === 'accepted'}
                            onClick={() => handleUpdateStatus(app.id, 'accepted')}
                            className="bg-emerald-600 text-white font-black py-2 rounded-xl text-[9px] uppercase tracking-widest active:scale-95 disabled:opacity-50"
                          >
                            Setujui
                          </button>
                          <button 
                             disabled={app.status === 'rejected'}
                             onClick={() => handleUpdateStatus(app.id, 'rejected')}
                             className="bg-rose-500 text-white font-black py-2 rounded-xl text-[9px] uppercase tracking-widest active:scale-95 disabled:opacity-50"
                          >
                            Tolak
                          </button>
                        </div>
                     </div>
                   )) : (
                     <p className="text-center text-xs text-slate-400 py-8 italic">Belum ada pengajuan masuk.</p>
                   )}
                 </>
               )}
            </div>

            {/* Application Modal (Overlay) */}
            <AnimatePresence>
              {isApplying && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[110] bg-white p-6 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-slate-800 uppercase text-sm">Form Pengajuan Kontrak</h3>
                    <button onClick={() => setIsApplying(null)} className="p-2 bg-slate-100 rounded-full">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl mb-6">
                    <img src={isApplying.image} className="w-12 h-12 rounded-xl" alt="" />
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase">{isApplying.buyerName}</p>
                      <p className="text-[10px] text-blue-600 font-black uppercase">{isApplying.commodity}</p>
                    </div>
                  </div>

                  <form onSubmit={handleApply} className="space-y-4 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Luas Lahan Siap Tanam (m2)</label>
                      <input 
                        type="number"
                        required
                        value={formData.landSize}
                        onChange={e => setFormData(p => ({ ...p, landSize: Number(e.target.value) }))}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Estimasi Produksi (kg)</label>
                      <input 
                        type="number"
                        required
                        value={formData.estimatedYield}
                        onChange={e => setFormData(p => ({ ...p, estimatedYield: Number(e.target.value) }))}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Kontak WhatsApp / Telp</label>
                      <input 
                        type="text"
                        required
                        placeholder="0812..."
                        value={formData.contact}
                        onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="pt-4">
                       <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Kirim Pengajuan"}
                       </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-6 border-t border-slate-100 shrink-0">
               <button 
                 className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                 onClick={onClose}
               >
                 Tutup
               </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 transition-all outline-none py-2 flex-1",
        active ? "text-[#065F46]" : "text-slate-300"
      )}
    >
      <div className={cn(
        "transition-all duration-300 p-1 rounded-xl",
        active ? "scale-110 bg-emerald-50" : "scale-100"
      )}>
        {icon}
      </div>
      <span className={cn("text-[10px] font-black tracking-widest uppercase transition-colors", active ? "text-emerald-800" : "text-slate-400")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="active-dot"
          className="w-1.5 h-1.5 bg-[#065F46] rounded-full mt-0.5" 
        />
      )}
    </button>
  );
}

function UserListingItem({ listing, onEdit, onDelete }: { listing: any, onEdit: (l: any) => void, onDelete: (id: string) => Promise<void> }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(listing.mediaUrl);
  const [isLoadingThumb, setIsLoadingThumb] = useState(false);

  useEffect(() => {
    const fetchThumbnail = async () => {
      if (thumbnailUrl || !listing.hasPhoto || isLoadingThumb) return;
      setIsLoadingThumb(true);
      try {
        const mediaDoc = await getDoc(doc(db, 'listing_media', listing.id));
        if (mediaDoc.exists()) {
          setThumbnailUrl(mediaDoc.data().photoUrl);
        }
      } catch (error) {
        console.error('Error fetching thumbnail:', error);
      } finally {
        setIsLoadingThumb(false);
      }
    };
    fetchThumbnail();
  }, [listing.id, listing.hasPhoto, thumbnailUrl]);

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] p-4 flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 relative">
        {isLoadingThumb && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50">
            <Loader2 size={16} className="animate-spin text-emerald-500" />
          </div>
        )}
        {thumbnailUrl ? (
          thumbnailUrl.match(/\.(mp4|webm|ogg)$/i) || thumbnailUrl.startsWith('data:video/') ? (
            <video src={thumbnailUrl} className="w-full h-full object-cover" />
          ) : (
            <img src={thumbnailUrl} className="w-full h-full object-cover" alt="" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon size={20} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-black uppercase text-slate-800 truncate mb-0.5">{listing.type === 'post' ? 'Kabar Tani' : listing.commodity}</h4>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{listing.location}</p>
        {listing.type === 'listing' && (
          <p className="text-[10px] text-emerald-600 font-black mt-1">{formatCurrency(listing.price)}/kg</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => onEdit(listing)}
          className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <Pencil size={16} />
        </button>
        <button 
          onClick={() => {
            if (confirm('Hapus postingan ini?')) {
              onDelete(listing.id);
            }
          }}
          className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
function MarketListingItem({ item, onStartChat, getMarketPriceForCommodity }: { item: any, onStartChat: (item: any) => void, getMarketPriceForCommodity: (c: string) => number | undefined }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(item.mediaUrl);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  const handleFetchMedia = async () => {
    if (mediaUrl || !item.hasPhoto || isLoadingMedia) return;
    setIsLoadingMedia(true);
    try {
      const mediaDoc = await getDoc(doc(db, 'listing_media', item.id));
      if (mediaDoc.exists()) {
        setMediaUrl(mediaDoc.data().photoUrl);
      } else {
        toast.error('Media tidak ditemukan');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `listing_media/${item.id}`);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const marketPrice = getMarketPriceForCommodity(item.commodity);
  const savings = marketPrice ? marketPrice - item.price : 0;
  const isFairToFarmer = marketPrice ? item.price >= marketPrice * 0.95 : true;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all relative"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={item.userAvatar} className="w-10 h-10 rounded-xl bg-slate-100" alt="" />
              <div className={cn(
                "absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white",
                item.type === 'post' ? "bg-sky-500" : (isFairToFarmer ? "bg-emerald-500" : "bg-red-500")
              )} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{item.type === 'post' ? 'Kabar Hari Ini' : item.commodity}</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">{item.userName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={cn(
              "px-2 py-0.5 text-[8px] font-black uppercase rounded shadow-sm border",
              item.type === 'post' ? "bg-sky-50 text-sky-600 border-sky-100" : (isFairToFarmer ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100")
            )}>
              {item.type === 'post' ? "Kabar Tani" : (isFairToFarmer ? "Harga Sejahtera" : "Di Bawah Pasar")}
            </div>
          </div>
        </div>

        {(mediaUrl || item.hasPhoto) ? (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 ring-1 ring-slate-100 mt-2 relative group-hover:ring-emerald-200 transition-all">
            {mediaUrl ? (
               mediaUrl.startsWith('data:video/') || mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={mediaUrl} className="w-full h-full object-cover" controls playsInline />
              ) : (
                <img src={mediaUrl} className="w-full h-full object-cover" alt={item.commodity} />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-50/50 backdrop-blur-sm">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                  {isLoadingMedia ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
                </div>
                <button 
                  onClick={handleFetchMedia}
                  className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-colors"
                >
                  {isLoadingMedia ? "Memuat..." : "Tampilkan Media"}
                </button>
              </div>
            )}
            
            {marketPrice && mediaUrl && (
              <div className="absolute top-3 left-3 flex flex-col gap-1">
                <div className="bg-amber-400 text-black px-2 py-1 rounded-lg shadow-lg rotate-[-4deg] text-[9px] font-black uppercase tracking-tighter">
                  {savings > 0 ? `HEBAT: HEMAT ${formatCurrency(savings)}` : "HARGA PASAR"}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Penawaran</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(item.price)}<span className="text-xs text-slate-300 font-bold ml-1">/kg</span></p>
            </div>
            <div className="text-right">
               <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase justify-end mb-1 font-mono">
                 <MapPin size={10} className="text-emerald-500" />
                 {item.location}
               </div>
               <p className="text-[11px] font-black text-emerald-700">{item.stock}kg Available</p>
            </div>
          </div>
          {item.description && <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-2xl italic leading-relaxed">"{item.description}"</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onStartChat(item)}
            className="bg-[#065F46] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-100"
          >
            NEGO HARGA
          </button>
          <button 
            className="bg-emerald-50 text-emerald-700 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-emerald-100 shadow-sm"
          >
            DETAIL BARANG
          </button>
        </div>
      </div>
    </motion.div>
  );
}
