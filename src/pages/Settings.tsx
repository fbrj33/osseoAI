import React, { useState } from 'react';
import { useAuth, API } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import TwoFactorSetupModal from '@/src/components/TwoFactorSetupModal';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const token = localStorage.getItem('token');

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your password to disable 2FA');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/disable-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: new URLSearchParams({
          password: disablePassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to disable 2FA');
      }

      setTwoFactorEnabled(false);
      setShowDisableModal(false);
      setDisablePassword('');
      toast.success('Two-Factor Authentication disabled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASetupComplete = () => {
    setShowSetupModal(false);
    setTwoFactorEnabled(true);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#f0f0f2] mb-2">Settings</h1>
        <p className="text-[#a1a1aa]">Manage your account and security preferences</p>
      </div>

      {/* Account Information */}
      <Card className="bg-[#16161a] border border-[#2d2d35] rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-[#f0f0f2] mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#3b82f6]" />
          Account Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider">Full Name</label>
            <p className="text-[#f0f0f2] mt-1">{user?.full_name}</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider">Email</label>
            <p className="text-[#f0f0f2] mt-1">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider">Role</label>
            <p className="text-[#f0f0f2] mt-1 capitalize">{user?.role}</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider">License Number</label>
            <p className="text-[#f0f0f2] mt-1">{user?.license_no || 'N/A'}</p>
          </div>
        </div>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="bg-[#16161a] border border-[#2d2d35] rounded-xl p-6">
        <h2 className="text-xl font-bold text-[#f0f0f2] mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#3b82f6]" />
          Two-Factor Authentication
        </h2>

        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <p className="text-[#f0f0f2] font-medium mb-2">
              {twoFactorEnabled ? (
                <span className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Two-Factor Authentication is Enabled
                </span>
              ) : (
                <span className="flex items-center gap-2 text-[#a1a1aa]">
                  <AlertCircle className="h-5 w-5" />
                  Two-Factor Authentication is Disabled
                </span>
              )}
            </p>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              {twoFactorEnabled
                ? 'Your account is protected with two-factor authentication. You will need to enter a code from your authenticator app every time you log in.'
                : 'Add an extra layer of security to your account by enabling two-factor authentication. You will need to use an authenticator app to log in.'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {twoFactorEnabled ? (
            <Button
              onClick={() => setShowDisableModal(true)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
            >
              Disable 2FA
            </Button>
          ) : (
            <Button
              onClick={() => setShowSetupModal(true)}
              className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold"
            >
              Enable 2FA
            </Button>
          )}
        </div>

        {/* Authenticator Apps Info */}
        <div className="mt-6 pt-6 border-t border-[#2d2d35]">
          <p className="text-sm font-semibold text-[#f0f0f2] mb-3">Compatible Authenticator Apps:</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-[#a1a1aa]">
            <div className="flex items-center gap-2">
              <span className="text-[#3b82f6]">•</span> Google Authenticator
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#3b82f6]">•</span> Microsoft Authenticator
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#3b82f6]">•</span> Authy
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#3b82f6]">•</span> FreeOTP
            </div>
          </div>
        </div>
      </Card>

      {/* 2FA Setup Modal */}
      <TwoFactorSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onComplete={handle2FASetupComplete}
      />

      {/* Disable 2FA Confirmation Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#16161a] border border-[#2d2d35] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[#f0f0f2] mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Disable Two-Factor Authentication
            </h3>

            <p className="text-[#a1a1aa] mb-6">
              Enter your password to confirm you want to disable two-factor authentication.
            </p>

            <div className="mb-6">
              <label className="text-xs font-bold uppercase text-[#a1a1aa] tracking-wider">Password</label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] mt-1"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisablePassword('');
                }}
                className="flex-1 bg-[#2d2d35] hover:bg-[#3d3d45] text-[#f0f0f2]"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisable2FA}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Disable'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;
