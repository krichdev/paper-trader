import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [startingBalance, setStartingBalance] = useState<number>(10000);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(username, password, startingBalance);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🏈 Paper Trader</h1>
          <p className="text-slate-400">Create your account</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-8 border-2 border-slate-700">
          <div className="bg-purple-500/10 border border-purple-500/50 rounded-lg p-3 mb-6">
            <p className="text-sm text-purple-300">
              Choose your starting balance to test your trading strategies!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Starting Balance</label>
              <select
                value={startingBalance}
                onChange={(e) => setStartingBalance(Number(e.target.value))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value={500}>$500 - Conservative Start</option>
                <option value={1000}>$1,000 - Beginner Friendly</option>
                <option value={5000}>$5,000 - Intermediate</option>
                <option value={10000}>$10,000 - Standard (Recommended)</option>
                <option value={25000}>$25,000 - Advanced</option>
                <option value={50000}>$50,000 - Pro Trader</option>
                <option value={100000}>$100,000 - Big Bankroll</option>
              </select>
              <p className="text-xs text-slate-400 mt-2">
                This is virtual money for testing. You can always create a new account to try different strategies!
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-400 hover:text-purple-300">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
