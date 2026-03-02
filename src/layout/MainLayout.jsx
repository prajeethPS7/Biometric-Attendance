import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    BarChart3,
    Monitor,
    Settings,
    LogOut,
    Menu,
    X,
    ScanFace,
    Shield,
    ChevronRight,
} from 'lucide-react';

const navigation = [
    {
        name: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        description: 'Overview & stats',
    },
    {
        name: 'Employees',
        path: '/employees',
        icon: Users,
        description: 'Manage workforce',
    },
    {
        name: 'Devices',
        path: '/devices',
        icon: Monitor,
        description: 'Scanner devices',
    },
    {
        name: 'Reports',
        path: '/reports',
        icon: BarChart3,
        description: 'Attendance reports',
    },
    {
        name: 'Users',
        path: '/users',
        icon: Shield,
        description: 'System operators',
    },
    {
        name: 'Kiosk Mode',
        path: '/kiosk',
        icon: ScanFace,
        description: 'Attendance scanner',
        accent: true,
    },
];

export default function MainLayout() {
    const { user, userRole, signOut } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-surface-950">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-surface-950/60 lg:hidden"
                    style={{ backdropFilter: 'blur(4px)' }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out bg-surface-900 border-r border-surface-800 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    } ${collapsed ? 'w-[72px]' : 'w-[260px]'}`}
            >
                {/* Logo */}
                <div className={`flex items-center h-16 px-4 border-b border-surface-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <ScanFace className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="animate-fade-in">
                            <h1 className="text-sm font-bold text-surface-100 leading-tight">BioAttend</h1>
                            <p className="text-[10px] text-surface-500">Industrial Attendance</p>
                        </div>
                    )}

                    {/* Close button - mobile */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="ml-auto p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 lg:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center' : ''
                                } ${isActive
                                    ? item.accent
                                        ? 'bg-gradient-to-r from-primary-600/20 to-cyan-600/20 text-cyan-400 border border-cyan-500/20'
                                        : 'bg-primary-600/15 text-primary-400 border border-primary-500/20'
                                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800 border border-transparent'
                                }`
                            }
                        >
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? '' : ''}`} />
                            {!collapsed && (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate">{item.name}</p>
                                        <p className="text-[10px] text-surface-500 truncate">{item.description}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User Section */}
                <div className={`p-3 border-t border-surface-800 ${collapsed ? '' : ''}`}>
                    {!collapsed ? (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {user?.email?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-surface-200 truncate">
                                    {user?.email || 'admin@company.com'}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Shield className="w-3 h-3 text-primary-400" />
                                    <span className="text-[10px] text-primary-400 font-medium uppercase">
                                        {userRole || 'Admin'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-danger-400 transition-colors"
                                title="Sign out"
                                id="btn-signout"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleSignOut}
                            className="w-full p-2.5 rounded-xl hover:bg-surface-800 text-surface-500 hover:text-danger-400 transition-colors flex justify-center"
                            title="Sign out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Collapse Toggle - Desktop only */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex items-center justify-center h-8 border-t border-surface-800 text-surface-600 hover:text-surface-400 hover:bg-surface-800/50 transition-colors"
                >
                    <ChevronRight
                        className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                    />
                </button>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-surface-800 bg-surface-900/50" style={{ backdropFilter: 'blur(8px)' }}>
                    {/* Mobile menu */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 lg:hidden"
                        id="btn-mobile-menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* Date/Time */}
                    <div className="hidden sm:block">
                        <p className="text-xs text-surface-500">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-3">
                        <NavLink
                            to="/kiosk"
                            className="btn-primary text-xs py-2 px-3"
                            id="btn-quick-kiosk"
                        >
                            <ScanFace className="w-4 h-4" />
                            <span className="hidden sm:inline">Open Kiosk</span>
                        </NavLink>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
