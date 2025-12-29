import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserStore } from '@/store/useUserStore';
import { COUNTRIES } from '@/lib/countries';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
interface AuthDialogProps {
  trigger?: React.ReactNode;
}
export function AuthDialog({ trigger }: AuthDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // Signup State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupCountry, setSignupCountry] = useState('US');
  const login = useUserStore(s => s.login);
  const signup = useUserStore(s => s.signup);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
      toast.success('Welcome back!');
      setIsOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signup({ 
        email: signupEmail, 
        password: signupPassword, 
        username: signupUsername, 
        country: signupCountry 
      });
      toast.success('Account created successfully!');
      setIsOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Sign In</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-white border-4 border-slate-200 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold text-center text-slate-800">
            Join the League
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-haxball-blue data-[state=active]:shadow-sm">
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-haxball-blue data-[state=active]:shadow-sm">
              Sign Up
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="player@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="bg-slate-50"
                />
              </div>
              <Button type="submit" className="w-full btn-kid-primary mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                Login
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="s-username">Player Name</Label>
                <Input 
                  id="s-username" 
                  placeholder="Striker99"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  required
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input 
                  id="s-email" 
                  type="email" 
                  placeholder="player@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-password">Password</Label>
                <Input 
                  id="s-password" 
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={signupCountry} onValueChange={setSignupCountry}>
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <div className="flex items-center gap-2">
                          <img 
                            src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`}
                            srcSet={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png 2x`}
                            width="20"
                            alt={c.name}
                            className="rounded-sm"
                          />
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full btn-kid-action mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}