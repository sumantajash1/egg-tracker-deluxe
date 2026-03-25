import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Egg } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = signInSchema.extend({
  name: z.string().min(1, 'Name is required'),
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

const SignIn = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SignUpForm>({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema),
    defaultValues: { email: '', password: '', name: '' },
  });

  const onSubmit = async (data: SignUpForm) => {
    setIsSubmitting(true);
    let authError: Error | null = null;

    if (isSignUp) {
      if (!data.name) return; // Prevent TS complaining, handled by Zod
      const { error } = await signUp(data.email, data.password, data.name);
      authError = error;
    } else {
      const { error } = await signIn(data.email, data.password);
      authError = error;
    }

    setIsSubmitting(false);

    if (authError) {
      toast.error(authError.message);
      return;
    }
    toast.success(isSignUp ? 'Signed up successfully! Please check your email' : 'Signed in successfully');
    if (!isSignUp) {
      navigate('/', { replace: true });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Egg className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Eggzactly</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create an account to track your shared living eggs' : 'Sign in to track your shared living egg consumption'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Rahul Kumar"
                  autoComplete="name"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? (isSignUp ? 'Signing up...' : 'Signing in...')
                : (isSignUp ? 'Sign up' : 'Sign in')}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <Button
              variant="link"
              className="p-0"
              onClick={() => {
                setIsSignUp(!isSignUp);
                reset();
              }}
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignIn;
