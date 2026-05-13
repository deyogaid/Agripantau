import React, { useState, useEffect } from 'react';
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
  CloudSun,
  Sprout
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
  doc,
  serverTimestamp, 
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(MOCK_MARKETS[0]);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityPrice | null>(null);
  const [supabaseData, setSupabaseData] = useState<CommodityPrice[] | null>(null);
  const [supabaseMarkets, setSupabaseMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [supabaseCommodities, setSupabaseCommodities] = useState<any[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
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
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Halo! Saya asisten AgriPantau. Ada yang bisa saya bantu terkait harga pasar atau perencanaan panen Anda?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    commodity: CommodityType.CABAI_MERAH,
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
    // Mock photo upload
    const mockUrl = `https://images.unsplash.com/photo-1592919016383-7d7211bf6272?auto=format&fit=crop&q=80&w=400`;
    setReportForm(prev => ({ ...prev, photoUrl: mockUrl }));
    alert("Foto produk berhasil dilampirkan!");
  };

  const [userReports, setUserReports] = useState<PriceReport[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'prices' | 'market' | 'scout' | 'settings'>('prices');
  const [customApiKey, setCustomApiKey] = useState('');

  const displayData: CommodityPrice[] = (supabaseData && supabaseData.length > 0) ? supabaseData : MOCK_DATA;
  const filteredDisplayData = displayData.filter(item => item.market.id === selectedMarket.id);
  const filteredUserReports = userReports.filter(report => report.marketName === selectedMarket.name);
  const hasNoData = filteredDisplayData.length === 0 && filteredUserReports.length === 0;
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [newListing, setNewListing] = useState({
    commodity: CommodityType.CABAI_MERAH,
    price: '',
    stock: '',
    description: ''
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateListing = async () => {
    if (!currentUser || !userProfile) return;
    try {
      try {
        await addDoc(collection(db, 'listings'), {
          userId: currentUser.uid,
          userName: userProfile.displayName,
          userAvatar: userProfile.photoURL,
          commodity: newListing.commodity,
          price: Number(newListing.price),
          stock: Number(newListing.stock),
          description: newListing.description,
          location: userProfile.location,
          status: 'active',
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'listings');
      }
      setIsListingModalOpen(false);
      setNewListing({
        commodity: CommodityType.CABAI_MERAH,
        price: '',
        stock: '',
        description: ''
      });
    } catch (e) {
      console.error("Error creating listing", e);
    }
  };

  const handleBargain = (listing: any) => {
    // Placeholder for bargain logic
    alert(`Mulai tawar menawar untuk ${listing.commodity} dengan ${listing.userName}`);
  };

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
        } catch (error) {
          // Only handle as error if it's not simply "doc doesn't exist" (which getDoc handles fine)
          // Actually, if it's permission denied, handleFirestoreError will catch it.
          if (error instanceof Error && error.message.includes('permission-denied')) {
             handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
          console.error("Profile sync error", error);
        }
      } else {
        signInAnonymously(auth);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'price_reports');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleReportPrice = async () => {
    if (!currentUser) return;
    setIsReporting(true);

    try {
      // Existing Firebase saving
      try {
        await addDoc(collection(db, 'price_reports'), {
          commodity: reportForm.commodity,
          price: Number(reportForm.price),
          unit: 'kg',
          marketName: reportForm.marketName,
          location: reportForm.location,
          latitude: reportForm.latitude,
          longitude: reportForm.longitude,
          photoUrl: reportForm.photoUrl,
          isGpsVerified: reportForm.isGpsVerified,
          userId: currentUser.uid,
          userName: userProfile.displayName || 'Petani',
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'price_reports');
      }

      // Sync to Supabase
      try {
        await submitSupabasePriceReport({
          commodity: reportForm.commodity,
          price: Number(reportForm.price),
          marketName: reportForm.marketName,
          location: reportForm.location,
          latitude: reportForm.latitude,
          longitude: reportForm.longitude,
          photoUrl: reportForm.photoUrl,
          isGpsVerified: reportForm.isGpsVerified,
          userId: currentUser.uid,
          userName: userProfile.displayName || 'Petani'
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
      setReportForm(prev => ({ ...prev, price: '' }));
      alert('Berhasil melaporkan harga! Data Anda membantu transparansi pasar.');
    } catch (error) {
      console.error("Error reporting price:", error);
      alert('Gagal melaporkan harga. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsReporting(false);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isCultivationAnalyzing, setIsCultivationAnalyzing] = useState(false);
  const [cultivationAdvice, setCultivationAdvice] = useState<string | null>(null);

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
      const prompt = `Sebagai pakar agribisnis dan klimatologi, berikan saran strategi tanam untuk petani di lokasi: ${selectedMarket.name}, ${selectedMarket.province}.
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

  const renderScoutTab = () => (
    <div className="space-y-6">
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
        <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-3">
            <Calculator size={20} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Kalkulator</h3>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hitung Margin Modal</p>
        </section>

        {/* Direct Buyer */}
        <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
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
    </div>
  );
  const renderPricesTab = () => (
    <div className="space-y-4">
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

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Pasar Rakyat</h2>
          <button 
            onClick={() => setIsListingModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            MULAI JUALAN
          </button>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
          Tentukan harga Anda sendiri berdasarkan data pasar! Transaksi langsung petani dan pembeli.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {listings.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-300 shadow-sm">
              <Store size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-400">Belum ada dagangan baru.</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Jadilah yang pertama berjualan!</p>
            </div>
          </div>
        ) : (
          listings.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all relative"
            >
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={item.userAvatar} className="w-10 h-10 rounded-xl bg-slate-100" alt="" />
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{item.commodity}</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.userName}</p>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded shadow-sm border border-emerald-100">Verified</div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Harga</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(item.price)}<span className="text-xs text-slate-300 font-bold ml-1">/kg</span></p>
                    </div>
                    <div className="text-right">
                       <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase justify-end mb-1">
                         <MapPin size={10} />
                         {item.location}
                       </div>
                       <p className="text-[11px] font-black text-slate-900">{item.stock}kg tersedia</p>
                    </div>
                  </div>
                  {item.description && <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl italic">"{item.description}"</p>}
                </div>

                <button 
                  onClick={() => handleBargain(item)}
                  className="w-full bg-[#065F46] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-100"
                >
                  AJUKAN TAWARAN
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );


  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <User size={120} />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <img src={userProfile?.photoURL} className="w-20 h-20 rounded-[24px] bg-slate-100 shadow-xl border-4 border-white" alt="" />
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{userProfile?.displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded-md tracking-tighter">
                  {userProfile?.role}
                </span>
                <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                  <MapPin size={8} />
                  {userProfile?.location}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 space-y-5">
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
                Key tersimpan aman di database personal Anda. AI akan menggunakan kuota Anda sendiri tanpa dipungut biaya platform.
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
      </div>
      
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Aktivitas Saya</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dagangan Aktif</p>
            <p className="text-xl font-black text-slate-900">0</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tawaran Nego</p>
            <p className="text-xl font-black text-slate-900">0</p>
          </div>
        </div>
      </div>
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-[60] bg-[#065F46] text-white px-4 py-4 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
            <Leaf className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none uppercase tracking-wider">AgriPantau</h1>
            <p className="text-[10px] text-emerald-100 opacity-80 font-black uppercase tracking-widest">Market Feed Live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {supabaseData && !isDbLoading && (
            <div className="flex items-center gap-1.5 bg-emerald-700/50 px-2 py-1 rounded-full border border-emerald-400/20">
              <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-tighter">Sync Active</span>
            </div>
          )}
          {isDbLoading ? (
            <Loader2 className="w-4 h-4 text-emerald-100 animate-spin" />
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
              supabaseData ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30" : "bg-slate-400/20 text-slate-300 border border-slate-400/30"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", supabaseData ? "bg-emerald-400 animate-pulse" : "bg-slate-400")} />
              {supabaseData ? "Supabase Live" : "Offline"}
            </div>
          )}
          
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
            bridgeStatus === 'CONNECTED' ? "bg-blue-400/20 text-blue-200 border border-blue-400/30" : 
            bridgeStatus === 'CHECKING' ? "bg-slate-400/10 text-slate-400 border border-slate-400/20" :
            "bg-orange-400/20 text-orange-200 border border-orange-400/30"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full", 
              bridgeStatus === 'CONNECTED' ? "bg-blue-400 animate-pulse" : 
              bridgeStatus === 'CHECKING' ? "bg-slate-400 animate-spin" : 
              "bg-orange-400"
            )} />
            {bridgeStatus === 'CONNECTED' ? "v0 Bridge" : 
             bridgeStatus === 'CHECKING' ? "Syncing..." : "v0 Detached"}
          </div>
          <button className="relative p-2 text-white/80 hover:bg-white/10 rounded-full transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          <div className="w-9 h-9 rounded-full bg-white border-2 border-white/30 overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Farmer`} alt="Profile" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
        
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
        {activeTab === 'prices' && renderPricesTab()}
        {activeTab === 'market' && renderMarketplaceTab()}
        {activeTab === 'scout' && renderScoutTab()}
        {activeTab === 'settings' && renderProfileTab()}
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
              className="w-full max-w-md bg-white rounded-t-[32px] p-6 pb-12 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Laporkan Harga</h3>
                <p className="text-xs text-slate-500">Bantu petani lain dengan melaporkan harga pasar terkini.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Komoditas</label>
                  <select 
                    value={reportForm.commodity}
                    onChange={(e) => setReportForm(prev => ({ ...prev, commodity: e.target.value as CommodityType }))}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-800"
                  >
                    {supabaseCommodities.length > 0 ? (
                      supabaseCommodities.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      Object.values(CommodityType).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Harga per kg (Rp)</label>
                  <input 
                    type="number"
                    value={reportForm.price}
                    onChange={(e) => setReportForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="Contoh: 45000"
                    className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-800 placeholder:text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Pasar</label>
                    <input 
                      value={reportForm.marketName}
                      onChange={(e) => setReportForm(prev => ({ ...prev, marketName: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lokasi</label>
                    <input 
                      value={reportForm.location}
                      onChange={(e) => setReportForm(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleGetLocation}
                    type="button"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest",
                      reportForm.isGpsVerified 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                    )}
                  >
                    {isGpsLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    {reportForm.isGpsVerified ? "Lokasi Terverifikasi" : "Verifikasi Lokasi"}
                  </button>
                  <button 
                    onClick={handlePhotoUpload}
                    type="button"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest",
                      reportForm.photoUrl 
                        ? "bg-blue-50 border-blue-500 text-blue-700" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-blue-200"
                    )}
                  >
                    <Plus size={14} />
                    {reportForm.photoUrl ? "Foto Terlampir" : "Unggah Foto"}
                  </button>
                </div>
              </div>

              <button 
                onClick={handleReportPrice}
                disabled={isReporting || !reportForm.price}
                className="w-full bg-[#065F46] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {isReporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>🚀</span>}
                Kirim Laporan
              </button>
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
            className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-0"
            onClick={() => setIsListingModalOpen(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md bg-white rounded-t-[32px] p-6 pb-12 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Buka Lapak Baru</h3>
                <p className="text-xs text-slate-500">Tentukan harga terbaik untuk hasil panen Anda.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Komoditas</label>
                  <select 
                    value={newListing.commodity}
                    onChange={(e) => setNewListing(prev => ({ ...prev, commodity: e.target.value as CommodityType }))}
                    className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-800"
                  >
                    {Object.values(CommodityType).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Harga per kg</label>
                    <input 
                      type="number"
                      value={newListing.price}
                      onChange={(e) => setNewListing(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stok (kg)</label>
                    <input 
                      type="number"
                      value={newListing.stock}
                      onChange={(e) => setNewListing(prev => ({ ...prev, stock: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deskripsi Produk</label>
                  <textarea 
                    value={newListing.description}
                    onChange={(e) => setNewListing(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Contoh: Cabai rawit segar petik pagi ini..."
                    className="w-full bg-slate-50 border-none rounded-xl p-4 text-xs font-bold text-slate-800 h-24 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreateListing}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-100"
              >
                TAYANGKAN DAGANGAN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white border-t border-slate-100 px-6 flex items-start pt-4 justify-between z-[60] shadow-[0_-15px_50px_rgba(0,0,0,0.06)] max-w-lg mx-auto rounded-t-[36px] backdrop-blur-md bg-white/90">
        <NavButton 
          icon={<LayoutDashboard size={22} />} 
          label="Harga" 
          active={activeTab === 'prices'} 
          onClick={() => setActiveTab('prices')} 
        />
        <NavButton 
          icon={<Store size={22} />} 
          label="Pasar" 
          active={activeTab === 'market'} 
          onClick={() => setActiveTab('market')} 
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

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "w-full text-left bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-slate-50 hover:shadow-md relative overflow-hidden group",
        data.id.startsWith('sb-') ? "border-l-4 border-l-blue-400" : ""
      )}
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
    </motion.button>
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
