/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef, Component } from 'react';
import { 
  Search, 
  User, 
  Calendar, 
  MessageSquare, 
  ChevronRight, 
  Star, 
  MapPin, 
  Stethoscope, 
  Clock, 
  ShieldCheck,
  Menu,
  X,
  Send,
  Sparkles,
  Heart,
  Activity,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp, 
  setDoc, 
  doc, 
  getDocs,
  where
} from 'firebase/firestore';

// --- Types ---

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  rating: number;
  reviews: number;
  price: string;
  location: string;
  image: string;
  about: string;
  available: boolean;
}

interface Appointment {
  id?: string;
  userId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: any;
}

// --- Mock Data (Fallback) ---

const DOCTORS: Doctor[] = [
  {
    id: '1',
    name: 'dr. Andi Pratama, Sp.PD',
    specialty: 'Spesialis Penyakit Dalam',
    experience: '12 Tahun',
    rating: 4.9,
    reviews: 1240,
    price: 'Rp 150.000',
    location: 'RS Siloam Kebon Jeruk, Jakarta',
    image: 'https://picsum.photos/seed/doc1/400/400',
    about: 'dr. Andi adalah pakar dalam penanganan penyakit metabolik dan sistem imun. Beliau dikenal sangat teliti dan ramah kepada pasien.',
    available: true
  },
  {
    id: '2',
    name: 'dr. Sarah Wijaya, Sp.A',
    specialty: 'Spesialis Anak',
    experience: '8 Tahun',
    rating: 4.8,
    reviews: 850,
    price: 'Rp 120.000',
    location: 'RS Pondok Indah, Jakarta',
    image: 'https://picsum.photos/seed/doc2/400/400',
    about: 'dr. Sarah memiliki pendekatan yang lembut terhadap anak-anak. Beliau fokus pada tumbuh kembang anak dan nutrisi pediatrik.',
    available: true
  },
  {
    id: '3',
    name: 'dr. Budi Santoso, Sp.OT',
    specialty: 'Spesialis Bedah Tulang',
    experience: '15 Tahun',
    rating: 4.7,
    reviews: 560,
    price: 'Rp 200.000',
    location: 'RS Fatmawati, Jakarta',
    image: 'https://picsum.photos/seed/doc3/400/400',
    about: 'Ahli dalam menangani cedera olahraga dan rekonstruksi sendi. dr. Budi telah melakukan ribuan prosedur bedah ortopedi.',
    available: false
  },
  {
    id: '4',
    name: 'dr. Linda Kusuma, Sp.KK',
    specialty: 'Spesialis Kulit & Kelamin',
    experience: '10 Tahun',
    rating: 4.9,
    reviews: 2100,
    price: 'Rp 175.000',
    location: 'Klinik Estetika Jakarta',
    image: 'https://picsum.photos/seed/doc4/400/400',
    about: 'dr. Linda ahli dalam dermatologi medis dan kosmetik. Beliau sering menjadi pembicara di seminar kesehatan kulit internasional.',
    available: true
  }
];

// --- Components ---

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 whitespace-nowrap"
  >
    <Sparkles size={18} className="text-blue-400" />
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:text-slate-300 transition-colors">
      <X size={16} />
    </button>
  </motion.div>
);

const BookingModal: React.FC<{ doctor: Doctor; onClose: () => void; onConfirm: (date: string, time: string) => void }> = ({ doctor, onClose, onConfirm }) => {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const times = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900">Buat Janji Temu</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6 p-3 bg-blue-50 rounded-2xl">
          <img src={doctor.image} alt={doctor.name} className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <p className="font-bold text-slate-900 text-sm">{doctor.name}</p>
            <p className="text-xs text-blue-600">{doctor.specialty}</p>
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Waktu</label>
              <div className="grid grid-cols-4 gap-2">
                {times.map(t => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      time === t ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button
              disabled={!date || !time}
              onClick={() => setStep(2)}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
            >
              Lanjutkan
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">Konfirmasi Janji</h4>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan membuat janji dengan {doctor.name} pada tanggal <span className="font-bold text-slate-900">{date}</span> pukul <span className="font-bold text-slate-900">{time}</span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={() => onConfirm(date, time)}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const Navbar: React.FC<{ 
  user: FirebaseUser | null; 
  onAction: (msg: string) => void; 
  searchQuery: string; 
  setSearchQuery: (q: string) => void;
  setCurrentView: (view: string) => void;
}> = ({ user, onAction, searchQuery, setSearchQuery, setCurrentView }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      onAction('Aplikasi sudah terinstal atau browser tidak mendukung instalasi otomatis.');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 md:px-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => { setCurrentView('home'); setSearchQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
            A
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight hidden sm:block">Alodokter</span>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:flex flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari dokter, spesialis, atau gejala..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="hidden lg:flex items-center gap-8 text-slate-600 font-medium whitespace-nowrap">
          <button onClick={() => setCurrentView('chat')} className="hover:text-blue-600 transition-colors">Tanya Dokter</button>
          <button onClick={() => { setCurrentView('home'); setSearchQuery('RS'); }} className="hover:text-blue-600 transition-colors">Rumah Sakit</button>
          <button onClick={() => setCurrentView('articles')} className="hover:text-blue-600 transition-colors">Artikel</button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {deferredPrompt && (
            <button 
              onClick={handleInstall}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 transition-colors text-sm"
            >
              <ShieldCheck size={16} />
              Install
            </button>
          )}
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900">{user.displayName}</span>
                <button onClick={() => logout()} className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider">Keluar</button>
              </div>
              <img src={user.photoURL || ''} alt="Profile" className="w-10 h-10 rounded-full border-2 border-blue-100" />
            </div>
          ) : (
            <>
              <button 
                onClick={() => loginWithGoogle()}
                className="hidden md:flex items-center gap-2 px-5 py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-full transition-colors"
              >
                <LogIn size={18} />
                Masuk
              </button>
              <button 
                onClick={() => loginWithGoogle()}
                className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-shadow shadow-md shadow-blue-200"
              >
                Daftar
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const BottomNav: React.FC<{ active: string; setActive: (id: string) => void; onAction: (msg: string) => void }> = ({ active, setActive, onAction }) => {
  const navItems = [
    { id: 'home', icon: <Heart size={20} />, label: 'Beranda' },
    { id: 'chat', icon: <MessageSquare size={20} />, label: 'Chat' },
    { id: 'appointment', icon: <Calendar size={20} />, label: 'Janji' },
    { id: 'profile', icon: <User size={20} />, label: 'Profil' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActive(item.id)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            active === item.id ? 'text-blue-600' : 'text-slate-400'
          }`}
        >
          <div className={`${active === item.id ? 'scale-110' : 'scale-100'} transition-transform`}>
            {item.icon}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

const AppointmentsView: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">Janji Temu Saya</h2>
      <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
        {appointments.length} Total
      </div>
    </div>

    {appointments.length === 0 ? (
      <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar size={32} />
        </div>
        <p className="text-slate-500 font-medium">Belum ada janji temu yang dibuat.</p>
        <p className="text-sm text-slate-400 mt-2">Cari dokter dan buat janji temu pertama Anda!</p>
      </div>
    ) : (
      <div className="grid gap-4">
        {appointments.map((app) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Stethoscope size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{app.doctorName}</h4>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><Calendar size={14} /> {app.date}</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> {app.time}</span>
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
              app.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {app.status}
            </div>
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

const ProfileView: React.FC<{ user: FirebaseUser | null }> = ({ user }) => {
  if (!user) return (
    <div className="text-center py-20">
      <p className="text-slate-500 mb-4">Silakan masuk untuk melihat profil Anda.</p>
      <button 
        onClick={() => loginWithGoogle()}
        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200"
      >
        Masuk dengan Google
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-600 to-blue-400" />
        
        <div className="relative z-10 flex flex-col items-center">
          <img 
            src={user.photoURL || ''} 
            alt={user.displayName || ''} 
            className="w-32 h-32 rounded-[32px] border-4 border-white shadow-2xl mb-6 object-cover"
          />
          <h2 className="text-2xl font-bold text-slate-900 mb-1">{user.displayName}</h2>
          <p className="text-slate-500 mb-8">{user.email}</p>

          <div className="grid grid-cols-2 gap-4 w-full mb-8">
            <div className="bg-slate-50 p-4 rounded-3xl text-center">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</p>
              <p className="font-bold text-emerald-600">Terverifikasi</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl text-center">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Member Sejak</p>
              <p className="font-bold text-slate-900">2026</p>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button 
              onClick={() => logout()}
              className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Keluar dari Akun
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArticlesView: React.FC = () => {
  const articles = [
    { title: '7 Cara Menjaga Kesehatan Jantung', category: 'Kesehatan', image: 'https://picsum.photos/seed/heart/400/250' },
    { title: 'Pentingnya Vaksinasi Anak Sejak Dini', category: 'Anak', image: 'https://picsum.photos/seed/child/400/250' },
    { title: 'Tips Kulit Sehat di Cuaca Panas', category: 'Kecantikan', image: 'https://picsum.photos/seed/skin/400/250' },
    { title: 'Mengenal Gejala Diabetes Melitus', category: 'Penyakit', image: 'https://picsum.photos/seed/diabetes/400/250' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-900">Artikel Kesehatan Terbaru</h2>
      <div className="grid sm:grid-cols-2 gap-6">
        {articles.map((art, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5 }}
            className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer"
          >
            <img src={art.image} alt={art.title} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
            <div className="p-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{art.category}</span>
              <h3 className="text-lg font-bold text-slate-900 mt-2">{art.title}</h3>
              <p className="text-slate-500 text-sm mt-2">Baca selengkapnya tentang bagaimana menjaga kesehatan Anda...</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DoctorCard: React.FC<{ doctor: Doctor; onClick: () => void; onBook: (e: React.MouseEvent) => void }> = ({ doctor, onClick, onBook }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    onClick={onClick}
    className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
  >
    <div className="flex gap-4">
      <div className="relative">
        <img 
          src={doctor.image} 
          alt={doctor.name} 
          className="w-24 h-24 rounded-xl object-cover"
          referrerPolicy="no-referrer"
        />
        {doctor.available && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{doctor.name}</h3>
        <p className="text-sm text-slate-500 mb-2">{doctor.specialty}</p>
        <div className="flex items-center gap-1 text-amber-500 mb-2">
          <Star size={14} fill="currentColor" />
          <span className="text-sm font-bold">{doctor.rating}</span>
          <span className="text-xs text-slate-400 font-normal">({doctor.reviews} ulasan)</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-xs">
          <Clock size={12} />
          <span>{doctor.experience} Pengalaman</span>
        </div>
      </div>
    </div>
    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
      <div className="text-blue-600 font-bold">{doctor.price}</div>
      <button 
        onClick={onBook}
        className="px-4 py-1.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-100 transition-colors"
      >
        Buat Janji
      </button>
    </div>
  </motion.div>
);

const DoctorDetail: React.FC<{ doctor: Doctor; onClose: () => void; onBook: () => void; onChat: () => void }> = ({ doctor, onClose, onBook, onChat }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div 
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="relative h-48 bg-blue-600">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors"
        >
          <X size={20} />
        </button>
        <div className="absolute -bottom-12 left-8">
          <img 
            src={doctor.image} 
            alt={doctor.name} 
            className="w-32 h-32 rounded-2xl border-4 border-white object-cover shadow-lg"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
      
      <div className="pt-16 px-8 pb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{doctor.name}</h2>
            <p className="text-blue-600 font-medium">{doctor.specialty}</p>
          </div>
          <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full flex items-center gap-1 font-bold">
            <Star size={16} fill="currentColor" />
            {doctor.rating}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-50 p-3 rounded-2xl text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Pengalaman</p>
            <p className="font-bold text-slate-900">{doctor.experience}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Pasien</p>
            <p className="font-bold text-slate-900">2.5k+</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl text-center">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Ulasan</p>
            <p className="font-bold text-slate-900">{doctor.reviews}</p>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              Tentang Dokter
            </h4>
            <p className="text-slate-600 leading-relaxed">
              {doctor.about}
            </p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <MapPin size={18} className="text-blue-600" />
              Lokasi Praktik
            </h4>
            <p className="text-slate-600">{doctor.location}</p>
          </section>
        </div>

        <div className="mt-8 flex gap-4">
          <button 
            onClick={onBook}
            className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            Buat Janji Temu
          </button>
          <button 
            onClick={onChat}
            className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"
          >
            <MessageSquare size={24} />
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const HealthAssistant: React.FC<{ initialMessage?: string | null }> = ({ initialMessage }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Halo! Saya asisten kesehatan AI Alodokter. Ada yang bisa saya bantu hari ini?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessage) {
      setMessages(prev => [...prev, { role: 'user', text: initialMessage }]);
      handleSend(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    
    if (!textOverride) setInput('');
    if (!textOverride) setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsTyping(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        setMessages(prev => [...prev, { role: 'bot', text: 'Maaf, asisten AI belum dikonfigurasi dengan API Key yang valid.' }]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: textToSend,
        config: {
          systemInstruction: "Anda adalah asisten kesehatan Alodokter yang ramah dan profesional. Berikan saran kesehatan dasar, rekomendasikan spesialis dokter jika perlu, dan selalu ingatkan pengguna untuk berkonsultasi langsung dengan dokter untuk diagnosis medis. Gunakan bahasa Indonesia yang sopan.",
        }
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.text || 'Maaf, saya sedang mengalami kendala teknis.' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', text: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[500px]">
      <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="font-bold">AI Health Assistant</h3>
          <p className="text-xs text-blue-100">Tanya apa saja tentang kesehatan</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ketik keluhan Anda..."
          className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
        />
        <button 
          onClick={handleSend}
          className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState('home');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Auth Listener & User Doc Creation
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        // Create/Update user document
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: firebaseUser.email === "guntursetu99@gmail.com" ? 'admin' : 'user'
          };
          await setDoc(userRef, userDoc, { merge: true });
        } catch (error) {
          console.error("Error updating user profile:", error);
        }
      } else {
        setAppointments([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Appointments Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, [user]);

  // Firestore Data Listener & Seeding
  useEffect(() => {
    const q = query(collection(db, 'doctors'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
      
      if (docsData.length > 0) {
        setDoctors(docsData);
      } else {
        // Use mock data as fallback in UI until seeded
        setDoctors(DOCTORS);
        
        // Seed if empty AND user is admin
        if (user?.email === "guntursetu99@gmail.com") {
          const seedDoctors = async () => {
            try {
              const doctorsCollection = collection(db, 'doctors');
              for (const docData of DOCTORS) {
                await setDoc(doc(doctorsCollection, docData.id), docData);
              }
            } catch (error) {
              // Only log seeding errors if it's not a permission error for guest
              if (user?.email === "guntursetu99@gmail.com") {
                handleFirestoreError(error, OperationType.WRITE, 'doctors');
              }
            }
          };
          seedDoctors();
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'doctors');
    });

    return () => unsubscribe();
  }, [user]);

  const filteredDoctors = doctors.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleBooking = async (doctor: Doctor) => {
    if (!user) {
      try {
        await loginWithGoogle();
      } catch (error) {
        showToast('Gagal login. Silakan coba lagi.');
        return;
      }
    }
    setBookingDoctor(doctor);
    setSelectedDoctor(null);
  };

  const confirmBooking = async (date: string, time: string) => {
    if (!user || !bookingDoctor) return;

    try {
      const appointmentRef = doc(collection(db, 'appointments'));
      const appointmentData: Appointment = {
        id: appointmentRef.id,
        userId: user.uid,
        doctorId: bookingDoctor.id,
        doctorName: bookingDoctor.name,
        date,
        time,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await setDoc(appointmentRef, appointmentData);
      setBookingDoctor(null);
      showToast(`Janji temu dengan ${bookingDoctor.name} berhasil dibuat!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments');
      showToast('Gagal membuat janji temu. Silakan coba lagi.');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Menghubungkan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      <Navbar 
        user={user} 
        onAction={showToast} 
        searchQuery={searchQuery} 
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setCurrentView('home');
        }} 
        setCurrentView={setCurrentView}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hero Section */}
              <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold mb-6">
                    <ShieldCheck size={16} />
                    Terpercaya & Terverifikasi
                  </div>
                  <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                    Solusi Kesehatan <span className="text-blue-600">Lengkap</span> Untuk Anda.
                  </h1>
                  <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
                    Chat dengan dokter, buat janji temu rumah sakit, dan beli obat dengan mudah di satu platform kesehatan terintegrasi.
                  </p>
                  
                  <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Cari dokter atau spesialis..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative hidden md:block"
                >
                  <div className="relative z-10 rounded-[40px] overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                    <img 
                      src="https://picsum.photos/seed/medical/800/1000" 
                      alt="Medical Professional" 
                      className="w-full h-[500px] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
                  <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-emerald-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse [animation-delay:1s]" />
                  
                  {/* Floating Stats */}
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-10 -left-10 z-20 bg-white p-4 rounded-2xl shadow-xl border border-slate-50 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <Activity size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Aktifitas</p>
                      <p className="font-bold text-slate-900">Pasien Terlayani</p>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                {[
                  { id: 'chat', icon: <MessageSquare />, label: 'Chat Dokter', color: 'bg-blue-500' },
                  { id: 'appointment', icon: <Calendar />, label: 'Buat Janji', color: 'bg-emerald-500' },
                  { id: 'home', icon: <Stethoscope />, label: 'Rumah Sakit', color: 'bg-purple-500', action: () => setSearchQuery('RS') },
                  { id: 'articles', icon: <Heart />, label: 'Kesehatan', color: 'bg-rose-500' },
                ].map((item, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setCurrentView(item.id);
                      if (item.action) item.action();
                    }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-4 group"
                  >
                    <div className={`${item.color} text-white p-4 rounded-2xl group-hover:rotate-12 transition-transform`}>
                      {item.icon}
                    </div>
                    <span className="font-bold text-slate-700">{item.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Doctor List */}
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Rekomendasi Dokter</h2>
                    <button 
                      onClick={() => showToast('Fitur Lihat Semua Dokter akan segera hadir!')}
                      className="text-blue-600 font-bold flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Lihat Semua <ChevronRight size={20} />
                    </button>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {filteredDoctors.map(doc => (
                      <DoctorCard 
                        key={doc.id} 
                        doctor={doc} 
                        onClick={() => setSelectedDoctor(doc)} 
                        onBook={(e) => {
                          e.stopPropagation();
                          handleBooking(doc);
                        }}
                      />
                    ))}
                    {filteredDoctors.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">Tidak ada dokter yang ditemukan.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar / AI Assistant */}
                <div className="space-y-8">
                  <HealthAssistant />
                  
                  <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-xl font-bold mb-2">Langganan Aloproteksi</h3>
                      <p className="text-slate-400 text-sm mb-6">Dapatkan perlindungan kesehatan lengkap untuk keluarga Anda.</p>
                      <button 
                        onClick={() => showToast('Fitur Aloproteksi akan segera hadir!')}
                        className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        Pelajari Lebih Lanjut
                      </button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600 rounded-full opacity-20 blur-2xl" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              <HealthAssistant initialMessage={chatInitialMessage} />
            </motion.div>
          )}

          {currentView === 'appointment' && (
            <motion.div
              key="appointment"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AppointmentsView appointments={appointments} />
            </motion.div>
          )}

          {currentView === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ProfileView user={user} />
            </motion.div>
          )}

          {currentView === 'articles' && (
            <motion.div
              key="articles"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ArticlesView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 mt-20 py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
              <span className="text-xl font-bold text-slate-900">Alodokter</span>
            </div>
            <p className="text-slate-500 max-w-sm leading-relaxed">
              Alodokter adalah platform kesehatan digital nomor satu di Indonesia yang memberikan solusi kesehatan lengkap bagi masyarakat.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Layanan</h4>
            <ul className="space-y-4 text-slate-500 text-sm">
              <li><button onClick={() => setCurrentView('home')} className="hover:text-blue-600">Cari Dokter</button></li>
              <li><button onClick={() => setCurrentView('chat')} className="hover:text-blue-600">Tanya Dokter</button></li>
              <li><button onClick={() => { setCurrentView('home'); setSearchQuery('RS'); }} className="hover:text-blue-600">Rumah Sakit</button></li>
              <li><button onClick={() => setCurrentView('articles')} className="hover:text-blue-600">Artikel Kesehatan</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Perusahaan</h4>
            <ul className="space-y-4 text-slate-500 text-sm">
              <li><button onClick={() => showToast('Halaman Tentang Kami akan segera hadir!')} className="hover:text-blue-600">Tentang Kami</button></li>
              <li><button onClick={() => showToast('Halaman Karir akan segera hadir!')} className="hover:text-blue-600">Karir</button></li>
              <li><button onClick={() => showToast('Halaman Kontak akan segera hadir!')} className="hover:text-blue-600">Kontak</button></li>
              <li><button onClick={() => showToast('Halaman Kebijakan Privasi akan segera hadir!')} className="hover:text-blue-600">Kebijakan Privasi</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-50 text-center text-slate-400 text-sm">
          © 2026 Alodokter Clone. All rights reserved.
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {selectedDoctor && (
          <DoctorDetail 
            doctor={selectedDoctor} 
            onClose={() => setSelectedDoctor(null)} 
            onBook={() => handleBooking(selectedDoctor)}
            onChat={() => {
              setSelectedDoctor(null);
              setChatInitialMessage(`Halo, saya ingin bertanya tentang ${selectedDoctor.name} (${selectedDoctor.specialty})`);
              setCurrentView('chat');
            }}
          />
        )}
        {bookingDoctor && (
          <BookingModal 
            doctor={bookingDoctor} 
            onClose={() => setBookingDoctor(null)} 
            onConfirm={confirmBooking}
          />
        )}
        {toast && (
          <Toast message={toast} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
      <BottomNav active={currentView} setActive={setCurrentView} onAction={showToast} />
    </div>
  );
}
