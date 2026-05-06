import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Stethoscope, 
  LogOut, 
  LayoutDashboard, 
  ShieldCheck,
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Navbar: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate('/auth');
  };

  if (!user) return null;

  const navItems = [
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: LayoutDashboard,
      show: user.role === 'doctor' 
    },
    { 
      name: 'Admin Panel', 
      path: '/admin', 
      icon: ShieldCheck,
      show: user.role === 'admin' 
    },
    { 
      name: 'Patients', 
      path: '/patients', 
      icon: Users,
      show: true
    },
    { 
      name: 'Reports', 
      path: '/reports', 
      icon: FileText,
      show: user.role === 'doctor'
    },
  ];

  const handleNavigation = (e: React.MouseEvent, item: any) => {
    if (item.comingSoon) {
      e.preventDefault();
      toast.info(`${item.name} Coming Soon`, {
        description: 'This module is currently under development for the next update.'
      });
    }
  };

  return (
    <aside className="w-60 bg-[#16161a] border-r border-[#2d2d35] flex flex-col p-6 h-screen sticky top-0 shrink-0">
      <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold mb-10 text-[#f0f0f2] hover:opacity-80 transition-opacity">
        <div className="bg-[#3b82f6] p-1.5 rounded-lg">
          <Stethoscope className="h-5 w-5 text-white" />
        </div>
        <span>Osseo<span className="text-[#3b82f6]">AI</span></span>
      </Link>

      <nav className="flex-1 space-y-1">
        {navItems.filter(item => item.show).map((item) => (
          <Link
            key={item.name}
            to={item.path}
            onClick={(e) => handleNavigation(e, item)}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
              location.pathname === item.path
                ? "bg-[#1e1e24] text-[#f0f0f2] border-l-3 border-[#3b82f6]"
                : "text-[#a1a1aa] hover:text-[#f0f0f2] hover:bg-[#1e1e24]/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
        
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
            location.pathname === "/settings"
              ? "bg-[#1e1e24] text-[#f0f0f2] border-l-3 border-[#3b82f6]"
              : "text-[#a1a1aa] hover:text-[#f0f0f2] hover:bg-[#1e1e24]/50"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </nav>

      <div className="mt-auto pt-6 border-t border-[#2d2d35]">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="h-8 w-8 rounded-full bg-[#1e1e24] flex items-center justify-center text-xs font-bold text-[#f0f0f2] border border-[#2d2d35]">
            {user.full_name?.charAt(0) || user.email?.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-xs font-semibold text-[#f0f0f2] truncate">{user.full_name}</p>
            <p className="text-[10px] text-[#a1a1aa] truncate">{user.email}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-[#a1a1aa] hover:text-red-400 hover:bg-red-400/10 gap-3 px-3"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Navbar;
