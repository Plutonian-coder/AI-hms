import { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({
        identifier: '',
        surname: '',
        first_name: '',
        gender: 'male',
        password: '',
        email: '',
        department: '',
        level: '',
        phone: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        role: 'student'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await apiClient.post('/auth/register', formData);
            localStorage.setItem('access_token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data));
            navigate(res.data.role === 'admin' ? '/admin' : '/');
        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const inputClass = "w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30";

    return (
        <div className="flex bg-cream min-h-screen items-center justify-center p-6 py-12">
            <div className="max-w-lg w-full animate-in zoom-in-95 duration-300">
                <div className="bg-forest rounded-3xl shadow-2xl p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-white tracking-tight">Student Signup</h2>
                        <p className="text-white/50 font-medium text-sm mt-2">Create an account to participate in hostel allocation</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/20 text-red-300 text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Matric No.</label>
                            <input name="identifier" required className={inputClass} value={formData.identifier} onChange={handleChange} placeholder="F/ND/..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Surname</label>
                                <input name="surname" required className={inputClass} value={formData.surname} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">First Name</label>
                                <input name="first_name" required className={inputClass} value={formData.first_name} onChange={handleChange} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email Address</label>
                            <input name="email" type="email" className={inputClass} value={formData.email} onChange={handleChange} placeholder="student@email.com" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Level</label>
                                <select name="level" value={formData.level} onChange={handleChange} className={inputClass}>
                                    <option value="">Select Level</option>
                                    <option value="ND1">ND1</option>
                                    <option value="ND2">ND2</option>
                                    <option value="HND1">HND1</option>
                                    <option value="HND2">HND2</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Department</label>
                                <input name="department" className={inputClass} value={formData.department} onChange={handleChange} placeholder="e.g. Computer Science" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Phone Number</label>
                                <input name="phone" type="tel" className={inputClass} value={formData.phone} onChange={handleChange} placeholder="08012345678" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Secure Password</label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className={inputClass + ' pr-12'}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Min 8 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-5 mt-2">
                            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Next of Kin</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Full Name</label>
                                    <input name="next_of_kin_name" className={inputClass} value={formData.next_of_kin_name} onChange={handleChange} placeholder="Parent/Guardian name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Phone</label>
                                    <input name="next_of_kin_phone" type="tel" className={inputClass} value={formData.next_of_kin_phone} onChange={handleChange} placeholder="08012345678" />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full mt-4 text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all ${loading ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? 'Creating Account...' : 'Continue'}
                        </button>
                    </form>

                    <p className="text-sm font-medium text-white/40 text-center mt-8">
                        Already registered? <Link to="/login" className="text-lime hover:text-lime-hover font-bold tracking-tight">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
