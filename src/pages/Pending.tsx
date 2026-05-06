import React from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Pending: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0c]">
      <Card className="max-w-md w-full text-center bg-[#16161a] border-[#2d2d35] rounded-2xl shadow-2xl">
        <CardHeader>
          <div className="mx-auto bg-amber-500/10 p-4 rounded-full w-fit mb-5 border border-amber-500/20">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>
          <CardTitle className="text-2xl text-[#f0f0f2]">Account Under Review</CardTitle>
          <CardDescription className="text-[#a1a1aa] text-base mt-2">
            Hello, Dr. {user?.full_name || 'User'}. Your account is currently pending administrative approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="bg-[#1e1e24] p-5 rounded-xl text-sm text-[#a1a1aa] flex items-start gap-4 text-left border border-[#2d2d35]">
            <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              To ensure patient safety and data security, all medical professional accounts must be verified by our team. 
              This process typically takes 24-48 hours.
            </p>
          </div>
          
          <div className="space-y-3">
            <p className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-[0.2em]">License Information</p>
            <p className="text-base font-semibold text-[#f0f0f2] bg-[#0a0a0c] py-3 rounded-lg border border-[#2d2d35]">
              {user?.license_no || 'Pending verification'}
            </p>
          </div>

          <Button variant="ghost" className="w-full text-[#a1a1aa] hover:text-[#f0f0f2] hover:bg-[#1e1e24] h-12" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Pending;
