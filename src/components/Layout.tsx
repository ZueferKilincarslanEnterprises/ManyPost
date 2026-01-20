import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Video,
  LayoutDashboard,
  Link as LinkIcon,
  Upload,
  Calendar,
  Clock,
  History,
  FileText,
  LogOut,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/integrations', icon: LinkIcon, label: 'Integrations' },
    { path: '/videos', icon: Upload, label: 'Videos' },
    { path: '/schedule', icon: Calendar, label: 'Schedule' },
    { path: '/scheduled', icon: Clock, label: 'Scheduled Posts' },
    { path: '/history', icon: History, label: 'Post History' },
    { path: '/drafts', icon: FileText, label: 'Drafts' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">ManyPost</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-50 w-full transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
