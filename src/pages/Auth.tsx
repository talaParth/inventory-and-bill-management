import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';
import { getCompanyProfile, getUserPreference, setUserPreference } from '@/lib/storage';

const AUTH_KEY = 'authenticated';
const SESSION_EXPIRY_KEY = 'sessionExpiry';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const CREDENTIALS = { username: 'admin', password: '123' };

export default function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const companyData = await getCompanyProfile();
      setCompany(companyData);
      
      // Check if session is still valid
      const isAuth = await isAuthenticated();
      if (isAuth) {
        navigate('/');
      }
    };
    loadData();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      // Set session expiry to 24 hours from now
      const expiryTime = Date.now() + SESSION_DURATION;
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
      toast.success('Login successful!');
      navigate('/');
    } else {
      toast.error('Invalid credentials. Use admin/123');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-accent/20 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          {company?.logo && (
            <img 
              src={company.logo} 
              alt="Company Logo" 
              className="h-16 md:h-20 mx-auto object-contain mb-4"
            />
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {company?.name || 'BillEasy'}
          </h1>
          <p className="text-muted-foreground">Invoice Management System</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="font-medium">Demo Credentials:</p>
                <p>Username: <code className="font-mono">admin</code></p>
                <p>Password: <code className="font-mono">123</code></p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Secure and reliable billing management
        </p>
      </div>
    </div>
  );
}

export const isAuthenticated = async (): Promise<boolean> => {
  // Check localStorage first (per-device/browser)
  const authStatus = localStorage.getItem(AUTH_KEY);
  const expiryTime = localStorage.getItem(SESSION_EXPIRY_KEY);
  
  if (authStatus !== 'true' || !expiryTime) {
    // Clear any stale data
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    return false;
  }
  
  // Check if session has expired (24 hours)
  const now = Date.now();
  const expiry = parseInt(expiryTime, 10);
  
  if (now > expiry) {
    // Session expired, clear auth
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    return false;
  }
  
  return true;
};

export const logout = async (): Promise<void> => {
  // Clear localStorage (per-device/browser)
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
  // Also clear Firestore preference for consistency
  await setUserPreference(AUTH_KEY, 'false');
};

export const checkSessionExpiry = (): boolean => {
  const expiryTime = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!expiryTime) return false;
  
  const now = Date.now();
  const expiry = parseInt(expiryTime, 10);
  return now <= expiry;
};
